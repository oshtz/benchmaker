import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const strict = process.argv.includes('--strict')
const requirePortable = process.argv.includes('--require-portable')
const requireSigning = process.argv.includes('--require-signing')

const failures = []
const warnings = []
const passes = []

function pass(message) {
  passes.push(message)
}

function warn(message) {
  warnings.push(message)
}

function fail(message) {
  failures.push(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'))
}

function readText(path) {
  return readFileSync(join(root, path), 'utf8')
}

function fileExists(path) {
  return existsSync(join(root, path))
}

function fileSize(path) {
  return statSync(join(root, path)).size
}

function sha256File(path) {
  const bytes = readFileSync(join(root, path))
  return createHash('sha256').update(bytes).digest('hex')
}

function findFiles(dir, predicate) {
  const absolute = join(root, dir)
  if (!existsSync(absolute)) return []

  return readdirSync(absolute)
    .filter(predicate)
    .map((name) => join(dir, name).replace(/\\/g, '/'))
}

function checkVersionSync() {
  const pkg = readJson('package.json')
  const tauri = readJson('src-tauri/tauri.conf.json')
  const cargo = readText('src-tauri/Cargo.toml')
  const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]

  if (pkg.version === tauri.package?.version && pkg.version === cargoVersion) {
    pass(`Version sync: ${pkg.version}`)
  } else {
    fail(`Version mismatch: package=${pkg.version}, tauri=${tauri.package?.version}, cargo=${cargoVersion}`)
  }

  return pkg.version
}

function checkPackageScripts() {
  const scripts = readJson('package.json').scripts ?? {}
  const required = [
    'typecheck',
    'test',
    'test:e2e',
    'check',
    'build',
    'tauri:build',
    'release:preflight',
  ]

  for (const script of required) {
    if (scripts[script]) {
      pass(`npm script present: ${script}`)
    } else {
      fail(`Missing npm script: ${script}`)
    }
  }
}

function checkWorkflowContract() {
  const buildWorkflow = readText('.github/workflows/build.yml')
  const qualityWorkflow = readText('.github/workflows/quality.yml')

  const requiredBuildSnippets = [
    'Benchmaker-Portable.exe.sha256',
    'WINDOWS_CERTIFICATE',
    'WINDOWS_CERTIFICATE_PASSWORD',
    'Benchmaker.app.zip.sha256',
    'Generate macOS checksums',
    'Verify notarization credentials',
    'Cache Enigma Virtual Box installer',
  ]

  for (const snippet of requiredBuildSnippets) {
    if (buildWorkflow.includes(snippet)) {
      pass(`build workflow includes: ${snippet}`)
    } else {
      fail(`build workflow missing: ${snippet}`)
    }
  }

  const requiredQualitySnippets = [
    'npm run typecheck',
    'npm test',
    'cargo test --manifest-path src-tauri/Cargo.toml',
    'npm run build',
    'npm run test:e2e',
    'npm audit --audit-level=moderate',
  ]

  for (const snippet of requiredQualitySnippets) {
    if (qualityWorkflow.includes(snippet)) {
      pass(`quality workflow includes: ${snippet}`)
    } else {
      fail(`quality workflow missing: ${snippet}`)
    }
  }
}

function checkArtifact(path, { minBytes = 1, required = true } = {}) {
  if (!fileExists(path)) {
    const message = `Artifact missing: ${path}`
    required ? fail(message) : warn(message)
    return false
  }

  const size = fileSize(path)
  if (size < minBytes) {
    fail(`Artifact too small: ${path} (${size} bytes)`)
    return false
  }

  pass(`Artifact present: ${path} (${size} bytes)`)
  return true
}

function checkChecksumSidecar(path, { required = false } = {}) {
  const sidecar = `${path}.sha256`
  if (!fileExists(sidecar)) {
    const message = `Checksum sidecar missing: ${sidecar}`
    required ? fail(message) : warn(message)
    return
  }

  const expected = readText(sidecar).match(/[a-fA-F0-9]{64}/)?.[0]?.toLowerCase()
  const actual = sha256File(path)
  if (!expected) {
    fail(`Checksum sidecar has no SHA-256 hash: ${sidecar}`)
  } else if (expected !== actual) {
    fail(`Checksum mismatch for ${path}: expected ${expected}, actual ${actual}`)
  } else {
    pass(`Checksum verified: ${basename(path)}`)
  }
}

function checkWindowsSignature(path) {
  if (process.platform !== 'win32' || !fileExists(path)) return

  try {
    const output = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `(Get-AuthenticodeSignature -LiteralPath '${join(root, path).replaceAll("'", "''")}').Status`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim()

    if (output === 'Valid') {
      pass(`Authenticode signature valid: ${path}`)
    } else {
      const message = `Authenticode signature status for ${path}: ${output || 'Unknown'}`
      requireSigning ? fail(message) : warn(message)
    }
  } catch (error) {
    const message = `Unable to inspect Authenticode signature for ${path}: ${error.message}`
    requireSigning ? fail(message) : warn(message)
  }
}

function checkArtifacts(version) {
  const releaseExe = 'src-tauri/target/release/Benchmaker.exe'
  checkArtifact(releaseExe, { minBytes: 1024 * 1024, required: false })
  checkWindowsSignature(releaseExe)

  const msiPath = `src-tauri/target/release/bundle/msi/Benchmaker_${version}_x64_en-US.msi`
  const nsisPath = `src-tauri/target/release/bundle/nsis/Benchmaker_${version}_x64-setup.exe`
  checkArtifact(msiPath, { minBytes: 1024 * 1024, required: false })
  checkArtifact(nsisPath, { minBytes: 1024 * 1024, required: false })

  const portablePath = 'src-tauri/target/release/Benchmaker-Portable.exe'
  const portablePresent = checkArtifact(portablePath, {
    minBytes: 1024 * 1024,
    required: requirePortable,
  })
  if (portablePresent) {
    checkChecksumSidecar(portablePath, { required: true })
    checkWindowsSignature(portablePath)
  }

  const macZip = 'src-tauri/target/release/bundle/macos/Benchmaker.app.zip'
  if (checkArtifact(macZip, { minBytes: 1024 * 1024, required: false })) {
    checkChecksumSidecar(macZip, { required: true })
  }

  const dmgs = findFiles('src-tauri/target/release/bundle/dmg', (name) => name.endsWith('.dmg'))
  for (const dmg of dmgs) {
    checkArtifact(dmg, { minBytes: 1024 * 1024, required: false })
    checkChecksumSidecar(dmg, { required: true })
  }
}

function printSection(title, rows) {
  if (rows.length === 0) return
  console.log(`\n${title}`)
  for (const row of rows) {
    console.log(`- ${row}`)
  }
}

const version = checkVersionSync()
checkPackageScripts()
checkWorkflowContract()
checkArtifacts(version)

printSection('PASS', passes)
printSection('WARN', warnings)
printSection('FAIL', failures)

if (failures.length > 0 || (strict && warnings.length > 0)) {
  process.exitCode = 1
}
