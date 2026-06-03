# Tauri 2 Migration Assessment

Benchmaker currently runs on Tauri 1.x. The repo and vault now state that explicitly.

## Recommendation

Do not migrate as part of the current hardening branch. The app should first ship the schema v3, credential-store, cost-control, checksum-updater, and test-infrastructure work on the current Tauri 1.x baseline.

Plan Tauri 2 as a separate upgrade branch after one successful signed release cycle.

## Why Not Now

- The Tauri 1.x build currently passes locally.
- The updater and SQLite command surface changed in this branch and should not be combined with a framework migration.
- Tauri 2 changes plugin permissions, updater patterns, and command configuration enough to require focused QA.
- The current high-value gaps are release smoke and signing, not framework capability.

## Expected Migration Work

1. Upgrade Tauri CLI, Rust crate, and JS API packages to compatible Tauri 2 versions.
2. Convert the allowlist model to Tauri 2 permissions and capabilities.
3. Revisit updater implementation against Tauri 2 APIs and packaging conventions.
4. Re-test custom window controls and title bar behavior.
5. Re-test SQLite app-data path resolution and schema migration.
6. Re-test OS credential-store access.
7. Re-test CSP with Code Arena iframe previews.
8. Rework CI install/build steps if required by Tauri 2.

## Acceptance Criteria For A Future Migration

- `npm run typecheck` passes.
- `npm test` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `npm run build` passes without large entry chunk warnings.
- `npm run test:e2e` passes.
- `npm run tauri:build` passes on Windows.
- A built Windows app launches and persists data.
- Credential-store save/clear smoke passes without losing an existing key.
- A signed macOS build launches and passes Gatekeeper.
- Updater checksum verification still rejects missing or mismatched checksums.

## Decision Log

2026-06-03: Defer migration. Treat Tauri 2 as a focused follow-up project after the current release-hardening work is committed and desktop-smoked.
