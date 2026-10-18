# Habitizer

A phone-first PWA for building and running daily routines — live timer, streaks, spaced practice, and local backups.

Designed for a phone screen first (bottom tabs, big taps, home-screen install). It also runs in a desktop browser as a centered phone-sized app.

## Features

- **Routines & activities** — Create routines, add steps with time estimates, colors, drag-to-reorder
- **Live timer** — Start from Home (▶), auto-advance steps, pause/resume, leave and continue later
- **Streaks & history** — Daily streaks, contribution graph, weekly stats, History tab with day drill-down
- **Spaced practice** — Optional schedule (1 → 2 → 4 → 7 → 14 → 30 days) with due/overdue badges and “Every N days”
- **Due reminders** — Optional browser notifications when spaced-practice items are due
- **Backup** — Export/import JSON (merge or replace); 14-day export reminder in Settings
- **Polish** — Dark mode, EN/ES/ZH, completion sound, haptics (where supported), installable PWA with splash and frosted chrome

All data stays in the browser (`localStorage`). No account required.

## Quick start

```bash
git clone https://github.com/amberouyang/habitizer.git
cd habitizer
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

For phone testing on the same Wi‑Fi (no-cache server):

```bash
python3 serve.py --port 8000
```

Then open `http://YOUR_MAC_IP:8000` on your phone.

> **Data note:** Progress is stored **per origin**. `localhost`, `127.0.0.1`, and `http://YOUR_IP:8000` are separate stores. Use **Settings → Export**, then **Import** (Merge or Replace all) to move data between them.

## Install on your phone (PWA)

A PWA is still the same website — “install” means Add to Home Screen (no App Store).

**iPhone (Safari):** open the site → Share → **Add to Home Screen**.

**Android (Chrome):** menu → **Install app** / **Add to Home screen**. Local `http://` may not show Install; HTTPS (e.g. GitHub Pages) is more reliable.

You get a home-screen icon and a fullscreen window. You do **not** get a native App Store app.

## Usage

### Tabs

- **Home** — Weekly stats and routines
- **History** — Recent runs; tap a row for that day’s details
- **Settings** — Theme, language, widgets, backup, recently deleted

### Home

- Tap a card to open a routine; tap ▶ to start the timer
- In-progress banner appears if you left a live run
- Spaced-practice due/overdue badges sort to the top
- Drag **⋮⋮** to reorder widgets or routines (when nothing is due)

### Running a routine

1. Start from Home or routine detail  
2. Tap an activity to start, tap again to finish — the next step starts automatically  
3. Pause / resume as needed; Back or tabs leave the run without ending it  
4. **End Routine** → completion summary → **Done**

### Spaced practice

1. On a routine, turn on **Spaced practice**  
2. First due date is **today**  
3. On-time completions grow the gap: **1 → 2 → 4 → 7 → 14 → 30** days  
4. Overdue completions step the interval back one level  
5. Home, routine detail, and completion show **Every N days** under Next practice  

### Settings highlights

- Dark mode (status bar color follows theme on install / supported browsers)
- Cumulative Habit Tracker, completion sound, haptics
- Due reminders (needs notification permission)
- Language: English, Español, 中文
- **Backup → Export** — downloads `habitizer-backup-YYYY-MM-DD.json`; nudges if it’s been 14+ days (or never)
- **Import** — Merge or Replace all
- Recently deleted — 30-day restore

## Technical details

### Stack

- HTML / CSS / vanilla JS (ES modules) — no build step, no framework
- `localStorage` for all data
- PWA: `manifest.webmanifest`, icons, service worker (skipped on localhost / LAN for fresher reloads)

### Storage keys

| Key | Purpose |
|-----|---------|
| `habitizer-routines-v1` | Routines, activities, completions, run history, spaced-practice fields |
| `habitizer-settings-v1` | Theme, language, sound, haptics, due reminders, widgets, last backup export |
| `habitizer-deleted-routines-v1` | Recently deleted (30-day retention) |
| `habitizer-timer-v1` | In-progress timer session (cleared when the run ends; max 24h) |
| `habitizer-due-notified-v1` | Due-reminder dedupe (per day) |
| `habitizer-build` | Build stamp for cache refresh |

### Project structure

```
habitizer/
├── index.html           # Shell, settings, modals, boot splash
├── styles.css
├── serve.py             # Dev server with Cache-Control: no-store
├── manifest.webmanifest
├── sw.js                # Offline shell (non-local hosts)
├── icons/
├── js/
│   ├── main.js          # Boot
│   ├── views.js         # Home, history, routine, timer, completion
│   ├── timer.js         # Live run, auto-advance, pause/resume
│   ├── schedule.js      # Spaced practice / due status
│   ├── reminders.js     # Due notifications
│   ├── backup.js        # Export, merge/replace import, backup reminder
│   ├── persistence.js   # localStorage load/save
│   ├── splash.js        # Launch splash dismiss
│   ├── haptics.js       # Optional vibration
│   ├── emptyArt.js      # Empty-state illustrations
│   ├── i18n.js          # EN / ES / ZH
│   └── …                # state, models, modals, drag, etc.
└── README.md
```

### Browser support

- Modern browsers with ES modules (Chrome, Firefox, Safari, Edge)
- Requires `localStorage`
- Due reminders need notification permission; on iPhone they work best when installed to the home screen
- Haptics use the Vibration API (common on Android Chrome; usually unavailable on iPhone)
