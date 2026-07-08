# Manual PWA Test Checklist

## Baseline Webapp Safety

- Open `/` and confirm Capture, Items, Memory, and Pending views still render.
- Save a dump and confirm it appears in Pending Review.
- Generate suggestions from a dump and confirm cards still render.
- Save a memory entry and confirm it appears in Memory.
- Edit or archive an item and confirm the action still works.
- Open `/capture` and confirm quick dump save and memory add still work.

## Installability

- Open `/` and confirm the page includes a manifest, theme color, and app icon.
- Confirm `/manifest.webmanifest` loads.
- Confirm `/icons/icon-192.png`, `/icons/icon-512.png`, and `/icons/apple-touch-icon-180.png` load.
- Confirm `/sw.js` loads.

## iPhone-Specific Checks

- In Safari on iPhone, open the app and confirm content is not clipped by the notch or bottom safe area.
- Add the app to the home screen and confirm the app launches with the MemoFlow name and icon.
- Confirm the standalone launch opens the main MemoFlow app at `/`.
- Open `/capture` in Safari and confirm the compact capture screen is usable on iPhone width.

## Conservative Offline Behavior

- If testing on `localhost` or HTTPS, confirm the service worker registers without blocking app use.
- Confirm navigation and API-backed app content still use live network behavior rather than stale cached pages.
- Confirm icons and manifest remain available after registration.

## Persistence

- Save a dump, reload, and confirm it persists.
- Save a memory entry, reload, and confirm it persists.
- Confirm no data migration or reset occurs after launching from the home screen.
