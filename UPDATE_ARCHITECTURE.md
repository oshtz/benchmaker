# Auto-Update Architecture

Benchmaker uses a small custom updater built on GitHub Releases and Tauri commands. It is intentionally separate from Tauri's bundled updater because the app distributes portable assets.

## Release Contract

Each release tag should match the app version, for example `v<package-version>`.

Required assets:

```text
Benchmaker-Portable.exe
Benchmaker-Portable.exe.sha256
Benchmaker.app.zip
Benchmaker.app.zip.sha256
Benchmaker_<version>_*.dmg
Benchmaker_<version>_*.dmg.sha256
```

The updater accepts either a per-asset `.sha256` file or a release-level `checksums.txt`. A compatible checksum asset is required; downloads without a SHA-256 checksum are rejected.

## Frontend Flow

`src/services/updater.ts`:

1. Skips updates outside the Tauri runtime and in development builds.
2. Reads the current app version from `@tauri-apps/api/app`.
3. Queries `https://api.github.com/repos/oshtz/Benchmaker/releases/latest`.
4. Selects the platform asset:
   - Windows: `Benchmaker-Portable.exe`
   - macOS: `Benchmaker.app.zip`
5. Finds the matching checksum asset.
6. Downloads the binary and checksum through Tauri HTTP.
7. Verifies SHA-256 with Web Crypto.
8. Writes the update to the app local data directory.
9. Invokes the Rust backend to apply the update.

## Backend Flow

`src-tauri/src/main.rs` exposes:

- `apply_update(update_path)`
- `extract_app_zip(zip_path)` on macOS, with a no-op error stub on other platforms

Windows applies an update by spawning a detached PowerShell script that waits for the current process, replaces the executable, and starts the new executable.

macOS extracts `Benchmaker.app.zip` with `ditto`, waits for the running app to exit, replaces the `.app` bundle, and starts it with `open`.

Debug builds reject update application.

## CI Workflow

`.github/workflows/build.yml` builds release assets.

Windows:

- Builds the Tauri executable.
- Packages the portable executable with Enigma Virtual Box.
- Optionally signs the portable executable when `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` are configured.
- Generates `Benchmaker-Portable.exe.sha256`.
- Uploads the executable and checksum to the GitHub release.

macOS:

- Imports Apple signing credentials.
- Verifies notarization credentials.
- Builds `.app` and `.dmg` bundles.
- Creates `Benchmaker.app.zip` with `ditto`.
- Generates `.sha256` files for the zip and dmg.
- Uploads all release assets.

`.github/workflows/quality.yml` runs TypeScript, unit tests, Rust tests, production build, Playwright smoke, and npm audit on PRs and pushes.

## Security Notes

- Update downloads are rejected unless the expected checksum is present and matches.
- The Tauri CSP is scoped to app assets, OpenRouter, GitHub update endpoints, and generated preview content.
- Windows signing is optional in CI because it depends on private certificate secrets, but unsigned builds are explicitly warned.
- macOS signing and notarization remain required for the macOS release job.

## Troubleshooting

- `No compatible update asset found`: the release is missing the expected platform asset.
- `No SHA-256 checksum asset found`: upload the matching `.sha256` file or `checksums.txt`.
- `Update checksum mismatch`: the binary and checksum do not match; rebuild and replace the release assets.
- `Updates require the Tauri runtime`: the code is running in browser-only development.
- `Auto-update is disabled in dev builds`: build and run a production Tauri app.
