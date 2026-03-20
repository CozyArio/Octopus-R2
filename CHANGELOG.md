# Changelog

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
