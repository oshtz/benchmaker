import type { BenchmakerDb } from '@/types'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useRunStore } from '@/stores/runStore'
import { useCodeArenaRunStore } from '@/stores/codeArenaRunStore'

const DB_VERSION = 3
const WRITE_THROTTLE_MS = 300

let initialized = false
let writeTimer: number | null = null
let writeInFlight = false
let pendingSnapshot: BenchmakerDb | null = null

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
    hydrateFromDb(existing)
  } else {
    await writeLocalDb(buildSnapshot())
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
    await tauriInvoke<void>('write_snapshot', { snapshot })
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

export function hydrateFromDb(snapshot: BenchmakerDb): void {
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
