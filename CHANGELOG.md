# Changelog

## 0.3.3 - 2026-03-20
- Added new `Themes` tab with full custom theme manager.
- Users can create, save, apply, remove, import, export, and share theme JSON.
- Startup now applies active custom theme automatically across launches.

## 0.3.2 - 2026-03-20
- Library now uses Website Catalog as primary flow; removed Single URL and Batch URL import sections.
- Added automatic website scan in Library with configurable scan delay from Settings.
- Locked updates repo setting to prevent accidental updater breakage.
- Added new themes: Transgender, Cyberpunk, Hello Kitty, Dark Reaper, Souless.
- Fixed theme startup behavior so saved theme applies automatically on app launch.

## 0.3.1 - 2026-03-20
- Update flow is now one-click for auto-updater builds: `Update Now` downloads and installs automatically.
- DLC Manager now shows a clear "Work in progress" page instead of broken controls.

## 0.3.0 - 2026-03-20
- Switched release automation to a local CLI flow (`npm run release:local`) to avoid GitHub Actions approvals.
- Added `scripts/release-local.ps1` to push branch/tag and publish updater assets in one command.
- Removed GitHub Actions auto-release workflow.

## 0.2.9 - 2026-03-20
- Added new `Discord` tab with join prompt and one-click invite open flow.
- Added safe external URL opening IPC channel for approved hosts (Discord/GitHub).

## 0.2.8 - 2026-03-20
- `Update Now` fallback now always opens GitHub Releases instead of repo/commits pages.
- Added `dist:publish` script to build and upload updater assets to GitHub Releases in one command.
- Added in-app hint when auto-install is unavailable due to missing release assets.

## 0.2.7 - 2026-03-20
- Added direct Website Catalog integration from `manifestkitkat.netlify.app/data/catalog.json`.
- New in-app website catalog search and one-click `Add Game` import flow.
- Added `steam:webCatalog` IPC endpoint with AppID-based dedupe and normalized download URLs.

## 0.2.6 - 2026-03-20
- Unified updater UX with a single `Update Now` button (no more confusing `Open GitHub` wording).
- Top update banner now also uses `Update Now` for consistency.

## 0.2.5 - 2026-03-20
- Fixed update check priority: app now compares both GitHub Releases and `main/package.json`, then picks the newest version.
- Prevents false "up to date" when release tags are behind the repository version.

## 0.2.4 - 2026-03-20
- Improved Library UX with live search, installed-only filter, and visible-game counters.
- Added quick action to add all currently visible games to SteamTools in one click.
- Added staggered card motion and hover polish for a more modern feel.

## 0.2.3 - 2026-03-20
- Added real in-app updater flow for packaged builds (check, download, progress, install/restart).
- Added updater IPC actions: download update and install update.
- Updates page now shows download progress and install button after update is ready.
- Added Electron Builder packaging scripts and GitHub publish metadata.

## 0.2.2 - 2026-03-20
- Follow-up updater release to validate live version detection flow.
- Minor Updates page subtitle polish.

## 0.2.1 - 2026-03-20
- Added fallback update detection from GitHub `main/package.json` when Release API is unavailable.
- Added update channel badge on the Updates page.
- Improved reliability of in-app update checks for repos without formal releases.

## 0.2.0 - 2026-03-20
- Added global update notice banner triggered by background GitHub release checks.
- Added `Rebuild Plugin Now` in DLC Manager to regenerate `stplug-in/<AppID>.lua` on demand.
- DLC toggles now rewrite SteamTools plugin content immediately.
- Base game AppID is excluded from DLC lists.
- Added richer Updates page with `GitHub Release` and `Local Changelog` tabs.
- Improved motion polish across app cards and controls.

## 0.1.0 - 2026-03-20
- Initial Octopus-R2 desktop app structure.
- Library import from URL/local Lua and SteamTools export.
- Settings, updates check, feed moderation, and theme system.
