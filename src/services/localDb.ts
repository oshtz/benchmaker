import type { BenchmakerDb, CodeArenaRun, RunResult, TestSuite } from '@/types'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useRunStore } from '@/stores/runStore'
import { useCodeArenaRunStore } from '@/stores/codeArenaRunStore'

const DB_VERSION = 3
const WRITE_THROTTLE_MS = 300

let initialized = false
let writeTimer: number | null = null
let writeInFlight = false
let pendingSnapshot: BenchmakerDb | null = null
let lastPersistedSnapshot: BenchmakerDb | null = null

interface AppStateSnapshot {
  activeTestSuiteId: string | null
  currentRunId: string | null
  currentCodeArenaRunId: string | null
}

export interface SnapshotChangeSet {
  deletedTestSuiteIds: string[]
  deletedRunIds: string[]
  deletedCodeArenaRunIds: string[]
  savedTestSuites: TestSuite[]
  savedRuns: RunResult[]
  savedCodeArenaRuns: CodeArenaRun[]
  appStateChanged: boolean
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error('SQLite database requires Tauri runtime. Please run the desktop app.')
  }
  const { invoke } = await import('@tauri-apps/api/tauri')
  return invoke<T>(command, args)
}

export function normalizeSnapshot(parsed: Partial<BenchmakerDb> | null): BenchmakerDb | null {
  if (!parsed || !Array.isArray(parsed.testSuites) || !Array.isArray(parsed.runs)) {
    return null
  }

  return {
    version: typeof parsed.version === 'number' ? parsed.version : DB_VERSION,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    testSuites: parsed.testSuites,
    runs: parsed.runs,
    codeArenaRuns: Array.isArray(parsed.codeArenaRuns) ? parsed.codeArenaRuns : [],
    activeTestSuiteId: parsed.activeTestSuiteId ?? null,
    currentRunId: parsed.currentRunId ?? null,
    currentCodeArenaRunId: parsed.currentCodeArenaRunId ?? null,
  }
}

export async function initLocalDb(): Promise<void> {
  if (initialized || typeof window === 'undefined') return

  if (!isTauriRuntime()) {
    console.warn('SQLite database requires Tauri runtime. Data will not persist.')
    initialized = true
    return
  }

  initialized = true

  const existing = await readLocalDb()
  if (existing) {
    hydrateFromDb(existing, { markPersisted: true })
  } else {
    const initialSnapshot = buildSnapshot()
    await writeLocalDb(initialSnapshot)
  }

  useTestSuiteStore.subscribe(() => scheduleWrite())
  useRunStore.subscribe(() => scheduleWrite())
  useCodeArenaRunStore.subscribe(() => scheduleWrite())
}

export async function readLocalDb(): Promise<BenchmakerDb | null> {
  if (typeof window === 'undefined' || !isTauriRuntime()) return null

  try {
    const result = await tauriInvoke<BenchmakerDb | null>('read_snapshot')
    return normalizeSnapshot(result ?? null)
  } catch (error) {
    console.error('Failed to read from SQLite database:', error)
    return null
  }
}

export async function writeLocalDb(snapshot: BenchmakerDb): Promise<void> {
  if (typeof window === 'undefined' || !isTauriRuntime()) return

  try {
    await writeSnapshotChanges(lastPersistedSnapshot, snapshot)
    lastPersistedSnapshot = cloneSnapshot(snapshot)
  } catch (error) {
    console.error('Failed to write to SQLite database:', error)
  }
}

export function buildSnapshot(): BenchmakerDb {
  const testSuiteState = useTestSuiteStore.getState()
  const runState = useRunStore.getState()
  const codeArenaRunState = useCodeArenaRunStore.getState()

  return {
    version: DB_VERSION,
    updatedAt: Date.now(),
    testSuites: testSuiteState.testSuites,
    runs: runState.runs,
    codeArenaRuns: codeArenaRunState.runs,
    activeTestSuiteId: testSuiteState.activeTestSuiteId,
    currentRunId: runState.currentRunId,
    currentCodeArenaRunId: codeArenaRunState.currentRunId,
  }
}

export function hydrateFromDb(
  snapshot: BenchmakerDb,
  options: { markPersisted?: boolean } = {},
): void {
  useTestSuiteStore.setState({
    testSuites: snapshot.testSuites || [],
    activeTestSuiteId: snapshot.activeTestSuiteId ?? null,
  })
  useRunStore.setState({
    runs: snapshot.runs || [],
    currentRunId: snapshot.currentRunId ?? null,
  })
  useCodeArenaRunStore.setState({
    runs: snapshot.codeArenaRuns || [],
    currentRunId: snapshot.currentCodeArenaRunId ?? null,
  })

  if (options.markPersisted) {
    lastPersistedSnapshot = cloneSnapshot(snapshot)
  }
}

export function buildSnapshotChangeSet(
  previous: BenchmakerDb | null,
  next: BenchmakerDb,
): SnapshotChangeSet {
  if (!previous) {
    return {
      deletedTestSuiteIds: [],
      deletedRunIds: [],
      deletedCodeArenaRunIds: [],
      savedTestSuites: next.testSuites,
      savedRuns: next.runs,
      savedCodeArenaRuns: next.codeArenaRuns,
      appStateChanged: true,
    }
  }

  const previousTestSuites = mapById(previous.testSuites)
  const previousRuns = mapById(previous.runs)
  const previousCodeArenaRuns = mapById(previous.codeArenaRuns)
  const nextTestSuites = mapById(next.testSuites)
  const nextRuns = mapById(next.runs)
  const nextCodeArenaRuns = mapById(next.codeArenaRuns)

  return {
    deletedTestSuiteIds: idsMissingFrom(previousTestSuites, nextTestSuites),
    deletedRunIds: idsMissingFrom(previousRuns, nextRuns),
    deletedCodeArenaRunIds: idsMissingFrom(previousCodeArenaRuns, nextCodeArenaRuns),
    savedTestSuites: changedEntities(previousTestSuites, next.testSuites),
    savedRuns: changedEntities(previousRuns, next.runs),
    savedCodeArenaRuns: changedEntities(previousCodeArenaRuns, next.codeArenaRuns),
    appStateChanged: entityChanged(snapshotAppState(previous), snapshotAppState(next)),
  }
}

async function writeSnapshotChanges(
  previous: BenchmakerDb | null,
  next: BenchmakerDb,
): Promise<void> {
  const changes = buildSnapshotChangeSet(previous, next)

  for (const id of changes.deletedRunIds) {
    await tauriInvoke<void>('delete_run', { id })
  }
  for (const id of changes.deletedCodeArenaRunIds) {
    await tauriInvoke<void>('delete_code_arena_run', { id })
  }
  for (const id of changes.deletedTestSuiteIds) {
    await tauriInvoke<void>('delete_test_suite', { id })
  }

  for (const suite of changes.savedTestSuites) {
    await tauriInvoke<void>('save_test_suite', { suite })
  }
  for (const run of changes.savedRuns) {
    await tauriInvoke<void>('save_run', { run })
  }
  for (const run of changes.savedCodeArenaRuns) {
    await tauriInvoke<void>('save_code_arena_run', { run })
  }

  if (changes.appStateChanged) {
    await tauriInvoke<void>('save_app_state', { state: snapshotAppState(next) })
  }
}

function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

function idsMissingFrom<T>(
  previous: Map<string, T>,
  next: Map<string, T>,
): string[] {
  return [...previous.keys()].filter((id) => !next.has(id))
}

function changedEntities<T extends { id: string }>(
  previous: Map<string, T>,
  next: T[],
): T[] {
  return next.filter((item) => entityChanged(previous.get(item.id), item))
}

function entityChanged(previous: unknown, next: unknown): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next)
}

function snapshotAppState(snapshot: BenchmakerDb): AppStateSnapshot {
  return {
    activeTestSuiteId: snapshot.activeTestSuiteId,
    currentRunId: snapshot.currentRunId,
    currentCodeArenaRunId: snapshot.currentCodeArenaRunId,
  }
}

function cloneSnapshot(snapshot: BenchmakerDb): BenchmakerDb {
  return JSON.parse(JSON.stringify(snapshot)) as BenchmakerDb
}

function scheduleWrite(): void {
  if (!isTauriRuntime()) return
  if (writeTimer !== null) return
  writeTimer = window.setTimeout(() => {
    writeTimer = null
    void queueWrite(buildSnapshot())
  }, WRITE_THROTTLE_MS)
}

async function queueWrite(snapshot: BenchmakerDb): Promise<void> {
  if (writeInFlight) {
    pendingSnapshot = snapshot
    return
  }

  writeInFlight = true
  try {
    await writeLocalDb(snapshot)
  } finally {
    writeInFlight = false
    if (pendingSnapshot) {
      const next = pendingSnapshot
      pendingSnapshot = null
      void queueWrite(next)
    }
  }
}
