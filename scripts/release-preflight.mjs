import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = process.cwd()
const strict = process.argv.includes('--strict')
const requirePortable = process.argv.includes('--require-portable')

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

  if (pkg.version === tauri.version && pkg.version === cargoVersion) {
    pass(`Version sync: ${pkg.version}`)
  } else {
    fail(`Version mismatch: package=${pkg.version}, tauri=${tauri.version}, cargo=${cargoVersion}`)
  }

  return pkg.version
}

function checkPackageScripts() {
  const pkg = readJson('package.json')
  const scripts = pkg.scripts ?? {}
  const required = [
    'lint',
    'typecheck',
    'test',
    'test:e2e',
    'check',
    'build',
    'prepare:ffmpeg',
    'prepare:ffmpeg:universal-macos',
    'tauri:build',
    'tauri:build:universal-macos',
    'release:preflight',
  ]

  for (const script of required) {
    if (scripts[script]) {
      pass(`npm script present: ${script}`)
    } else {
      fail(`Missing npm script: ${script}`)
    }
  }

  if (pkg.devDependencies?.['ffmpeg-static']) {
    pass(`Bundled encoder dependency present: ffmpeg-static ${pkg.devDependencies['ffmpeg-static']}`)
  } else {
    fail('Missing bundled FFmpeg dependency: ffmpeg-static')
  }

  const tauri = readJson('src-tauri/tauri.conf.json')
  if (tauri.bundle?.externalBin?.includes('binaries/ffmpeg')) {
    pass('Tauri bundle includes the FFmpeg sidecar')
  } else {
    fail('Tauri bundle is missing the FFmpeg sidecar')
  }

  const ffmpegScript = readText('scripts/prepare-ffmpeg.mjs')
  const macSidecars = ['x86_64-apple-darwin', 'aarch64-apple-darwin']
  for (const triple of macSidecars) {
    if (ffmpegScript.includes(`triple: '${triple}'`)) {
      pass(`Universal macOS preparation includes: ffmpeg-${triple}`)
    } else {
      fail(`Universal macOS preparation is missing: ffmpeg-${triple}`)
    }
  }
  if (ffmpegScript.includes('join(binaryDirectory, `ffmpeg-${asset.triple}`)')) {
    pass('Universal macOS preparation stages architecture-specific sidecars')
  } else {
    fail('Universal macOS preparation does not stage architecture-specific sidecars')
  }
}

function checkWorkflowContract() {
  const buildWorkflow = readText('.github/workflows/build.yml')
  const qualityWorkflow = readText('.github/workflows/quality.yml')

  const requiredBuildSnippets = [
    'Benchmaker-Portable.exe.sha256',
    "tags: ['v*']",
    'Verify portable is intentionally unsigned',
    'Benchmaker.app.zip.sha256',
    'Generate macOS checksums',
    'Verify notarization credentials',
    'universal-apple-darwin',
    'lipo -archs',
    'notarytool submit',
    'stapler staple',
    'stapler validate',
    'spctl --assess',
    'Cache Enigma Virtual Box installer',
    'EVB_INSTALLER_SHA256',
  ]

  for (const snippet of requiredBuildSnippets) {
    if (buildWorkflow.includes(snippet)) {
      pass(`build workflow includes: ${snippet}`)
    } else {
      fail(`build workflow missing: ${snippet}`)
    }
  }

  const forbiddenBuildSnippets = [
    'WINDOWS_CERTIFICATE',
    'WINDOWS_CERTIFICATE_PASSWORD',
    'signtool',
    'bundle/msi',
    'bundle/nsis',
    'refs/heads/main',
  ]

  for (const snippet of forbiddenBuildSnippets) {
    if (buildWorkflow.includes(snippet)) {
      fail(`build workflow violates release contract with: ${snippet}`)
    } else {
      pass(`build workflow excludes: ${snippet}`)
    }
  }

  const requiredQualitySnippets = [
    'npm run lint',
    'npm run typecheck',
    'npm test',
    'npm run prepare:ffmpeg',
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

function checkArtifacts() {
  const releaseExe = 'src-tauri/target/release/Benchmaker.exe'
  checkArtifact(releaseExe, { minBytes: 1024 * 1024, required: false })

  const portablePath = 'src-tauri/target/release/Benchmaker-Portable.exe'
  const portablePresent = checkArtifact(portablePath, {
    minBytes: 1024 * 1024,
    required: requirePortable,
  })
  if (portablePresent) {
    checkChecksumSidecar(portablePath, { required: true })
  }

  const macReleaseRoot = 'src-tauri/target/universal-apple-darwin/release/bundle'
  const macZip = `${macReleaseRoot}/macos/Benchmaker.app.zip`
  if (checkArtifact(macZip, { minBytes: 1024 * 1024, required: false })) {
    checkChecksumSidecar(macZip, { required: true })
  }

  const dmgs = findFiles(`${macReleaseRoot}/dmg`, (name) => name.endsWith('.dmg'))
  if (dmgs.length === 0) warn(`Artifact missing: ${macReleaseRoot}/dmg/*.dmg`)
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

checkVersionSync()
checkPackageScripts()
checkWorkflowContract()
checkArtifacts()

printSection('PASS', passes)
printSection('WARN', warnings)
printSection('FAIL', failures)

if (failures.length > 0 || (strict && warnings.length > 0)) {
  process.exitCode = 1
}
