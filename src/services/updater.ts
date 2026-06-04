export type GitHubReleaseAsset = {
  name: string
  browser_download_url: string
}

type GitHubRelease = {
  tag_name: string
  body?: string | null
  published_at?: string | null
  assets?: GitHubReleaseAsset[]
}

export type UpdateInfo = {
  version: string
  notes: string | null
  publishedAt: string | null
  assetName: string
  downloadUrl: string
  checksumUrl: string
}

const GITHUB_REPO = 'oshtz/Benchmaker'
const UPDATE_DIR_NAME = 'benchmaker-updates'

type AssetConfig = {
  name: string
  extension: string
}

export function getAssetConfigForPlatform(os: string): AssetConfig {
  if (os === 'darwin') {
    return { name: 'Benchmaker.app.zip', extension: '.app.zip' }
  }

  return { name: 'Benchmaker-Portable.exe', extension: '.exe' }
}

async function getAssetConfig(): Promise<AssetConfig> {
  const { platform } = await import('@tauri-apps/api/os')
  const os = await platform()

  return getAssetConfigForPlatform(os)
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '').split('-')[0]
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number(part) || 0)
  const rightParts = normalizeVersion(right).split('.').map((part) => Number(part) || 0)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0
    const rightValue = rightParts[index] ?? 0
    if (leftValue > rightValue) return 1
    if (leftValue < rightValue) return -1
  }

  return 0
}

async function fetchJson<T>(url: string): Promise<T> {
  const { fetch, ResponseType } = await import('@tauri-apps/api/http')

  let response
  try {
    response = await fetch<T>(url, {
      method: 'GET',
      responseType: ResponseType.JSON,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Benchmaker',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Network request failed: ${message}`)
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Try again later.')
    }
    throw new Error(`GitHub API request failed (${response.status})`)
  }

  return response.data
}

async function downloadBinary(url: string): Promise<Uint8Array> {
  const { fetch, ResponseType } = await import('@tauri-apps/api/http')

  let response
  try {
    response = await fetch<Uint8Array>(url, {
      method: 'GET',
      responseType: ResponseType.Binary,
      headers: {
        'User-Agent': 'Benchmaker',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Download failed: ${message}`)
  }

  if (!response.ok) {
    throw new Error(`Update download failed (${response.status})`)
  }

  return response.data instanceof Uint8Array
    ? response.data
    : new Uint8Array(response.data as unknown as number[])
}

async function fetchText(url: string): Promise<string> {
  const { fetch, ResponseType } = await import('@tauri-apps/api/http')

  let response
  try {
    response = await fetch<string>(url, {
      method: 'GET',
      responseType: ResponseType.Text,
      headers: {
        'User-Agent': 'Benchmaker',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Checksum download failed: ${message}`)
  }

  if (!response.ok) {
    throw new Error(`Checksum download failed (${response.status})`)
  }

  return response.data
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashInput = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', hashInput.buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function selectUpdateAssets(
  assets: GitHubReleaseAsset[],
  assetConfig: AssetConfig
): { asset: GitHubReleaseAsset; checksumAsset: GitHubReleaseAsset } {
  const asset =
    assets.find((entry) => entry.name === assetConfig.name) ??
    assets.find((entry) =>
      entry.browser_download_url.toLowerCase().endsWith(assetConfig.extension)
    )

  if (!asset) {
    throw new Error('No compatible update asset found for this platform.')
  }

  const checksumAsset =
    assets.find((entry) => entry.name === `${asset.name}.sha256`) ??
    assets.find((entry) => entry.name === 'checksums.txt')

  if (!checksumAsset) {
    throw new Error(`No SHA-256 checksum asset found for ${asset.name}.`)
  }

  return { asset, checksumAsset }
}

export function parseExpectedSha256(checksumText: string, assetName: string): string | null {
  const lines = checksumText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const hashPattern = /[a-f0-9]{64}/i

  const matchingLine = lines.find((line) => line.includes(assetName) && hashPattern.test(line))
  const fallbackLine = lines.find((line) => hashPattern.test(line))
  const match = (matchingLine ?? fallbackLine)?.match(hashPattern)

  return match?.[0].toLowerCase() ?? null
}

export async function verifyChecksum(
  bytes: Uint8Array,
  checksumText: string,
  assetName: string
): Promise<void> {
  const expected = parseExpectedSha256(checksumText, assetName)
  if (!expected) {
    throw new Error(`Checksum file does not contain a SHA-256 hash for ${assetName}.`)
  }

  const actual = await sha256Hex(bytes)
  if (actual !== expected) {
    throw new Error(`Update checksum mismatch for ${assetName}.`)
  }
}

export function getUpdateFileName(update: UpdateInfo, os: string): string {
  return os === 'darwin'
    ? `Benchmaker-${update.version}.app.zip`
    : `Benchmaker-${update.version}.exe`
}

export type UpdateDownloadServices = {
  downloadBinary: (url: string) => Promise<Uint8Array>
  fetchText: (url: string) => Promise<string>
  getPlatform: () => Promise<string>
  createUpdateDir: () => Promise<void>
  writeBinaryFile: (relativePath: string, contents: Uint8Array) => Promise<void>
  getAppLocalDataDir: () => Promise<string>
  joinPath: (...paths: string[]) => Promise<string>
  extractAppZip: (zipPath: string) => Promise<string>
}

export async function downloadUpdateWithServices(
  update: UpdateInfo,
  services: UpdateDownloadServices
): Promise<string> {
  const binary = await services.downloadBinary(update.downloadUrl)
  const checksumText = await services.fetchText(update.checksumUrl)
  await verifyChecksum(binary, checksumText, update.assetName)

  const os = await services.getPlatform()
  const fileName = getUpdateFileName(update, os)
  const relativePath = `${UPDATE_DIR_NAME}/${fileName}`

  await services.createUpdateDir()
  const updatePath = await services.joinPath(
    await services.getAppLocalDataDir(),
    UPDATE_DIR_NAME,
    fileName
  )

  await services.writeBinaryFile(relativePath, binary)

  if (os === 'darwin') {
    return services.extractAppZip(updatePath)
  }

  return updatePath
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauriRuntime() || import.meta.env.DEV) return null

  const { getVersion } = await import('@tauri-apps/api/app')
  const currentVersion = await getVersion()
  const release = await fetchJson<GitHubRelease>(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
  )

  const latestVersion = normalizeVersion(release.tag_name || '')
  if (!latestVersion) return null

  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return null
  }

  // Find platform-specific asset
  const assetConfig = await getAssetConfig()
  const { asset, checksumAsset } = selectUpdateAssets(release.assets ?? [], assetConfig)

  return {
    version: latestVersion,
    notes: release.body ?? null,
    publishedAt: release.published_at ?? null,
    assetName: asset.name,
    downloadUrl: asset.browser_download_url,
    checksumUrl: checksumAsset.browser_download_url,
  }
}

export async function downloadUpdate(update: UpdateInfo): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('Updates require the Tauri runtime.')
  }

  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
  const { createDir, writeBinaryFile, BaseDirectory } = await import('@tauri-apps/api/fs')
  const { platform } = await import('@tauri-apps/api/os')
  const { invoke } = await import('@tauri-apps/api/tauri')

  return downloadUpdateWithServices(update, {
    downloadBinary,
    fetchText,
    getPlatform: platform,
    createUpdateDir: () =>
      createDir(UPDATE_DIR_NAME, { dir: BaseDirectory.AppLocalData, recursive: true }),
    writeBinaryFile: (relativePath, contents) =>
      writeBinaryFile(
        { path: relativePath, contents },
        { dir: BaseDirectory.AppLocalData }
      ),
    getAppLocalDataDir: appLocalDataDir,
    joinPath: join,
    extractAppZip: (zipPath) => invoke<string>('extract_app_zip', { zipPath }),
  })
}

export async function installUpdate(updatePath: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('Updates require the Tauri runtime.')
  }

  const { invoke } = await import('@tauri-apps/api/tauri')
  await invoke('apply_update', { updatePath })
}
