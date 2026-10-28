# Habitizer developer notes

## Run it locally

```bash
npm run dev
```

Then open [http://localhost:8000](http://localhost:8000). `npm run dev` runs `python3 serve.py --port 8000`, a small server with caching turned off.

To test on a phone on the same Wi-Fi, open `http://YOUR_COMPUTER_IP:8000` on the phone.

Browser storage is separate for each address, so `localhost`, `127.0.0.1`, and your IP address each have their own data. Use Export and Import to move data between them.

## Tests

```bash
npm install
npm test
```

GitHub Actions runs the same tests on every push and pull request (`.github/workflows/test.yml`).

The tests in `tests/` load sample data from older versions (`tests/fixtures/`) and check that it upgrades correctly and that corrupted data doesn't crash the app. When you add a new data version, add a fixture for the version it replaces.

## Project layout

```
index.html            App shell, settings, dialogs, launch splash
styles.css            All styles
manifest.webmanifest  Home screen install settings
sw.js                 Offline caching (off on localhost and LAN)
serve.py              Dev server with caching disabled
icons/                App icons
docs/screenshots/     Images used in the README
tests/                Vitest tests and sample saved data
js/
  main.js             Startup
  views.js            Home, History, routine, timer, and results screens
  timer.js            Live timer
  schedule.js         Spaced practice
  backup.js           Export, import, and backup reminder
  persistence.js      Saving and loading
  storage.js          The only place that touches localStorage
  migrations.js       Saved data versions and upgrades
  samples.js          Example routines for "Try sample routines"
  i18n.js             Translations
```

## Storage keys

All keys start with `habitizer_` so they can't clash with other apps on the same domain.

| Key | What it stores |
|-----|----------------|
| `habitizer_routines` | Routines, steps, completions, run history, spaced practice |
| `habitizer_settings` | Preferences and last backup date |
| `habitizer_deleted_routines` | Recently deleted routines (30 days) |
| `habitizer_timer_session` | The routine currently in progress |
| `habitizer_due_notified` | Which reminders were already sent today |
| `habitizer_demo_cleared` | One-time cleanup of old sample routines already ran |
| `habitizer_build` | App version, used to refresh cached files |

Older versions used names like `habitizer-routines-v1`. They are moved to the new names on startup (`LEGACY_KEY_RENAMES` in `js/constants.js`).

## Saved data versions

Routines, settings, deleted routines, the timer session, and reminder state are saved as `{ "version": N, "data": ... }`. On load, older data is upgraded one version at a time before the app uses it, and the original text is kept under `<key>_backup_v<N>`. To change a saved format, follow the steps at the top of `js/migrations.js`.

If saved data can't be read, the app doesn't crash: it copies the bad text to `<key>_corrupt_<timestamp>` and starts that part fresh.
