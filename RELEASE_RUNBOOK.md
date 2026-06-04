# Release Runbook

This runbook covers the production release checks that are not fully provable from unit tests.

## Required Secrets

Windows optional signing:

- `WINDOWS_CERTIFICATE`: base64-encoded `.pfx` certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: password for the `.pfx`.

macOS signing and notarization:

- `APPLE_CERTIFICATE`: base64-encoded `.p12` Developer ID Application certificate.
- `APPLE_CERTIFICATE_PASSWORD`: certificate password.
- `APPLE_SIGNING_IDENTITY`: exact Developer ID Application identity.
- `APPLE_ID`: Apple ID used for notarization.
- `APPLE_PASSWORD`: app-specific password.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

## Pre-Release Checklist

Run locally from the repo root:

```bash
npm ci
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npm run test:e2e
npm audit --audit-level=moderate
npm run tauri:build
npm run release:preflight
```

`release:preflight` is non-destructive. It checks version sync, expected npm scripts, workflow release contract, local build artifacts, checksum sidecars when present, and Windows Authenticode status when available.

Optional stricter modes:

```bash
npm run release:preflight -- --strict
npm run release:preflight -- --require-portable
npm run release:preflight -- --require-signing
```

Run the credential-store smoke test only when you are comfortable touching the local OS credential store. It preserves and restores any existing Benchmaker OpenRouter key:

```bash
cargo test --manifest-path src-tauri/Cargo.toml credential_store_round_trip_preserves_existing_openrouter_key -- --ignored --nocapture
```

Run the real OpenRouter smoke only when a valid API key is already saved in the desktop app. It chooses a known free/low-cost model when available and sends a one-token request:

```bash
cargo test --manifest-path src-tauri/Cargo.toml openrouter_minimal_completion_smoke_from_stored_key -- --ignored --nocapture
```

## Windows Release

1. Confirm `package.json` and `src-tauri/tauri.conf.json` versions match.
2. Run the Build Windows workflow manually on `dev` before promotion. Dev builds may continue unsigned so the rest of the pipeline can be exercised.
3. Push to `main` after the dev build passes. If Windows signing secrets are absent, the portable executable will be published unsigned with an Actions warning.
4. Confirm the workflow creates:
   - `Benchmaker-Portable.exe`
   - `Benchmaker-Portable.exe.sha256`
5. Download the artifact and verify the signature status and checksum. `NotSigned` is acceptable for unsigned releases, but should be called out in release notes:

```powershell
Get-AuthenticodeSignature .\Benchmaker-Portable.exe
Get-FileHash -Algorithm SHA256 .\Benchmaker-Portable.exe
```

6. Launch the portable executable on a clean Windows profile.
7. Save and clear an OpenRouter API key in the header dialog.
8. Run a tiny benchmark with a strict positive cost cap, then with a cap that allows the run.
9. Confirm SQLite data persists after restart.

## macOS Release

1. Confirm all Apple secrets are configured.
2. Run the macOS release job.
3. Confirm the workflow creates:
   - signed/notarized `.dmg`
   - `Benchmaker.app.zip`
   - `.sha256` sidecars for both
4. Download the release artifacts and verify:

```bash
codesign --verify --deep --strict --verbose=2 Benchmaker.app
spctl --assess --type execute --verbose Benchmaker.app
shasum -a 256 Benchmaker.app.zip
```

5. Install from the `.dmg` and launch.
6. Confirm Gatekeeper accepts the app.
7. Smoke the updater against a later signed `Benchmaker.app.zip` release asset.

## Updater Release Contract

The release must include checksum coverage for every updater asset. The app rejects downloads without a matching SHA-256 sidecar or `checksums.txt`.

Required updater assets:

```text
Benchmaker-Portable.exe
Benchmaker-Portable.exe.sha256
Benchmaker.app.zip
Benchmaker.app.zip.sha256
```

## Rollback

If an updater smoke fails:

1. Delete or mark the release as pre-release.
2. Publish a fixed release with a higher semver tag.
3. Do not replace assets under the same tag after users may have downloaded checksums.

## Known Manual Gates

- Windows SmartScreen reputation cannot be fully cleared by CI.
- Unsigned Windows portable releases show `Unknown Publisher` and may trigger SmartScreen or enterprise policy warnings.
- macOS notarization must be checked on real hardware or a clean VM.
- Real OpenRouter runs require a valid user key and may incur small API costs.
