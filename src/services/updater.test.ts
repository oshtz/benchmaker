import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  downloadUpdateWithServices,
  getAssetConfigForPlatform,
  getUpdateFileName,
  parseExpectedSha256,
  selectUpdateAssets,
  verifyChecksum,
  type UpdateDownloadServices,
  type GitHubReleaseAsset,
  type UpdateInfo,
} from './updater'

const SHA_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const SHA_B = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const UPDATE_BYTES = new TextEncoder().encode('benchmaker-update')

function asset(name: string, url = `https://github.com/oshtz/benchmaker/releases/download/v1/${name}`): GitHubReleaseAsset {
  return {
    name,
    browser_download_url: url,
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function updateInfo(overrides: Partial<UpdateInfo> = {}): UpdateInfo {
  return {
    version: '0.1.5',
    notes: null,
    publishedAt: null,
    assetName: 'Benchmaker-Portable.exe',
    downloadUrl: 'https://example.test/Benchmaker-Portable.exe',
    checksumUrl: 'https://example.test/Benchmaker-Portable.exe.sha256',
    ...overrides,
  }
}

function createDownloadServices({
  os,
  checksumText,
  events,
}: {
  os: string
  checksumText: string
  events: string[]
}): UpdateDownloadServices {
  return {
    downloadBinary: async (url) => {
      events.push(`download:${url}`)
      return UPDATE_BYTES
    },
    fetchText: async (url) => {
      events.push(`checksum:${url}`)
      return checksumText
    },
    getPlatform: async () => {
      events.push('platform')
      return os
    },
    createUpdateDir: async () => {
      events.push('mkdir')
    },
    writeBinaryFile: async (relativePath, contents) => {
      events.push(`write:${relativePath}:${contents.length}`)
    },
    getAppLocalDataDir: async () => {
      events.push('app-data')
      return 'C:/Users/USER/AppData/Local/com.benchmaker.app'
    },
    joinPath: async (...paths) => {
      events.push(`join:${paths.join('|')}`)
      return paths.join('/')
    },
    extractAppZip: async (zipPath) => {
      events.push(`extract:${zipPath}`)
      return `${zipPath}/Benchmaker.app`
    },
  }
}

describe('updater helpers', () => {
  it('selects platform asset names explicitly', () => {
    expect(getAssetConfigForPlatform('darwin')).toEqual({
      name: 'Benchmaker.app.zip',
      extension: '.app.zip',
    })

    expect(getAssetConfigForPlatform('win32')).toEqual({
      name: 'Benchmaker-Portable.exe',
      extension: '.exe',
    })
  })

  it('uses platform-specific update filenames', () => {
    expect(getUpdateFileName(updateInfo(), 'win32')).toBe('Benchmaker-0.1.5.exe')
    expect(getUpdateFileName(updateInfo(), 'darwin')).toBe('Benchmaker-0.1.5.app.zip')
  })

  it('compares semantic versions with v prefixes and prerelease suffixes', () => {
    expect(compareVersions('v0.1.5', '0.1.4')).toBe(1)
    expect(compareVersions('0.1.4-beta.1', '0.1.4')).toBe(0)
    expect(compareVersions('0.1.3', '0.1.4')).toBe(-1)
  })

  it('prefers an exact checksum sidecar for the selected asset', () => {
    const selected = selectUpdateAssets(
      [
        asset('Benchmaker-Portable.exe'),
        asset('checksums.txt'),
        asset('Benchmaker-Portable.exe.sha256'),
      ],
      getAssetConfigForPlatform('win32')
    )

    expect(selected.asset.name).toBe('Benchmaker-Portable.exe')
    expect(selected.checksumAsset.name).toBe('Benchmaker-Portable.exe.sha256')
  })

  it('falls back to a release checksum manifest', () => {
    const selected = selectUpdateAssets(
      [asset('Benchmaker.app.zip'), asset('checksums.txt')],
      getAssetConfigForPlatform('darwin')
    )

    expect(selected.asset.name).toBe('Benchmaker.app.zip')
    expect(selected.checksumAsset.name).toBe('checksums.txt')
  })

  it('falls back to extension matching when the exact asset name is absent', () => {
    const selected = selectUpdateAssets(
      [
        asset('Benchmaker_0.1.5_x64.exe', 'https://example.test/download/Benchmaker_0.1.5_x64.exe'),
        asset('Benchmaker_0.1.5_x64.exe.sha256'),
      ],
      getAssetConfigForPlatform('win32')
    )

    expect(selected.asset.name).toBe('Benchmaker_0.1.5_x64.exe')
    expect(selected.checksumAsset.name).toBe('Benchmaker_0.1.5_x64.exe.sha256')
  })

  it('rejects assets without checksum coverage', () => {
    expect(() =>
      selectUpdateAssets([asset('Benchmaker-Portable.exe')], getAssetConfigForPlatform('win32'))
    ).toThrow('No SHA-256 checksum asset found')
  })

  it('parses matching hashes from per-asset and manifest files', () => {
    expect(parseExpectedSha256(`${SHA_A}  Benchmaker-Portable.exe`, 'Benchmaker-Portable.exe')).toBe(SHA_A)
    expect(
      parseExpectedSha256(
        `${SHA_A}  other.zip\n${SHA_B}  Benchmaker.app.zip`,
        'Benchmaker.app.zip'
      )
    ).toBe(SHA_B)
  })

  it('verifies matching SHA-256 data and rejects mismatches', async () => {
    const hash = await sha256(UPDATE_BYTES)

    await expect(verifyChecksum(UPDATE_BYTES, `${hash}  Benchmaker-Portable.exe`, 'Benchmaker-Portable.exe')).resolves.toBeUndefined()
    await expect(verifyChecksum(UPDATE_BYTES, `${SHA_A}  Benchmaker-Portable.exe`, 'Benchmaker-Portable.exe')).rejects.toThrow(
      'Update checksum mismatch'
    )
  })

  it('downloads, verifies, and writes Windows updates through injected services', async () => {
    const events: string[] = []
    const hash = await sha256(UPDATE_BYTES)
    const result = await downloadUpdateWithServices(
      updateInfo(),
      createDownloadServices({
        os: 'win32',
        checksumText: `${hash}  Benchmaker-Portable.exe`,
        events,
      })
    )

    expect(result).toBe('C:/Users/USER/AppData/Local/com.benchmaker.app/benchmaker-updates/Benchmaker-0.1.5.exe')
    expect(events).toEqual([
      'download:https://example.test/Benchmaker-Portable.exe',
      'checksum:https://example.test/Benchmaker-Portable.exe.sha256',
      'platform',
      'mkdir',
      'app-data',
      'join:C:/Users/USER/AppData/Local/com.benchmaker.app|benchmaker-updates|Benchmaker-0.1.5.exe',
      'write:benchmaker-updates/Benchmaker-0.1.5.exe:17',
    ])
  })

  it('extracts macOS app zip updates after writing the verified archive', async () => {
    const events: string[] = []
    const hash = await sha256(UPDATE_BYTES)
    const result = await downloadUpdateWithServices(
      updateInfo({
        assetName: 'Benchmaker.app.zip',
        downloadUrl: 'https://example.test/Benchmaker.app.zip',
        checksumUrl: 'https://example.test/Benchmaker.app.zip.sha256',
      }),
      createDownloadServices({
        os: 'darwin',
        checksumText: `${hash}  Benchmaker.app.zip`,
        events,
      })
    )

    expect(result).toBe(
      'C:/Users/USER/AppData/Local/com.benchmaker.app/benchmaker-updates/Benchmaker-0.1.5.app.zip/Benchmaker.app'
    )
    expect(events[events.length - 1]).toBe(
      'extract:C:/Users/USER/AppData/Local/com.benchmaker.app/benchmaker-updates/Benchmaker-0.1.5.app.zip'
    )
  })

  it('does not write update bytes when checksum verification fails', async () => {
    const events: string[] = []

    await expect(
      downloadUpdateWithServices(
        updateInfo(),
        createDownloadServices({
          os: 'win32',
          checksumText: `${SHA_A}  Benchmaker-Portable.exe`,
          events,
        })
      )
    ).rejects.toThrow('Update checksum mismatch')

    expect(events).toEqual([
      'download:https://example.test/Benchmaker-Portable.exe',
      'checksum:https://example.test/Benchmaker-Portable.exe.sha256',
    ])
  })
})
