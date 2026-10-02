# Habitizer

A phone-first web app for building, running, and sticking with daily routines — with live timing, streaks, spaced practice, and local backups.

## Features

- **Bottom tabs** — Home, History, and Settings
- **Custom routines** — Create routines for mornings, evenings, workouts, and more
- **Activities** — Add, rename, set time estimates, drag to reorder, and delete
- **Estimated time** — Per-activity estimates; routine total sums from activities
- **Routine colors** — Presets, custom colors, and saved swatches (tinted cards + timer progress)
- **Start from Home** — Tap ▶ on a card to jump straight into the live timer
- **Live timer** — Total and per-activity time vs estimates; finish a step to auto-start the next; pause/resume; survives refresh
- **Leave & resume** — Back or switch tabs without ending a run; continue from the Home banner
- **Completion screen** — Results, streak, personal best, and next practice date (when spaced practice is on)
- **Streaks** — Daily completion tracking, calendar history, and streak badges
- **Contribution graph** — GitHub-style yearly activity on routine detail
- **Weekly stats** — Home widget for this week’s completions, active days, and total time
- **History tab** — Recent runs across all routines; tap a run for that day’s details
- **Spaced practice** — Optional spaced-repetition schedule (1 → 2 → 4 → 7 → 14 → 30 days) with due/overdue badges and due-first sorting on Home
- **Due reminders** — Optional browser notifications when spaced-practice routines are due or overdue
- **Languages** — English, Español, 中文
- **Home widgets** — Collapse, show/hide, and drag home sections (This week, Routines)
- **Run history** — Past run durations per routine (best + recent runs, up to 50)
- **Duplicate / undo / recently deleted** — Copy routines, brief undo after delete, 30-day restore archive
- **Dark mode** — Status bar / theme-color follow light & dark
- **Completion sound** — Optional chime when a routine finishes
- **Haptics** — Optional light vibration on step finish / routine complete (where supported)
- **Export / import** — JSON backup; import can **merge** or **replace all**
- **Reset app data** — Wipe local data for the current browser origin
- **Auto-save** — Everything persists in `localStorage`
- **Installable (PWA)** — Add to home screen for an app-like experience; frosted top/bottom bars while content scrolls underneath; illustrated empty states; light motion on tabs, modals, and step finish

## Installation

1. Clone the repository:

```bash
git clone https://github.com/amberouyang/habitizer.git
cd habitizer
```

2. Start a local web server from the project folder (the one containing `index.html`):

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000` in your browser

Or use the no-cache LAN server (recommended for phone testing):

```bash
python3 serve.py --port 8000
```

Then open `http://YOUR_MAC_IP:8000` on your phone (same Wi‑Fi). This disables browser caching so you always see the latest code.

> **Note:** Serve from the inner `habitizer/` folder that contains `index.html`, not the parent directory.
>
> **Data note:** Progress is stored in the browser (`localStorage`), **per origin**. `localhost`, `127.0.0.1`, and `http://YOUR_IP:8000` are separate stores. Use **Settings → Export** on the copy that still has your data, then **Import** on the other (Merge or Replace all).

## Test on your phone (PWA)

A **PWA** is still the same website — install means “Add to Home Screen.” You get an icon and a fullscreen window. No App Store needed.

### iPhone (Safari)

1. Start the server from the `habitizer/` folder
2. Phone and Mac on the **same Wi‑Fi**
3. Find your Mac’s IP (System Settings → Network / Wi‑Fi → Details)
4. On iPhone Safari open `http://YOUR_MAC_IP:8000`
5. Tap **Share** → **Add to Home Screen** → Add

### Android (Chrome)

Local `http://` often won’t show Install. Use the menu **Add to Home screen** if offered, or deploy to HTTPS (e.g. GitHub Pages) for a reliable install prompt.

### What install does / doesn’t do

- **Does:** home-screen icon, fullscreen/standalone, basic offline shell caching (on supported hosts)
- **Doesn’t:** App Store listing, or a native `.ipa` / `.apk`

## Usage

### Navigation

Use the bottom tab bar:

- **Home** — Weekly stats and routines
- **History** — Recent completions across routines
- **Settings** — Theme, language, widgets, backup, recently deleted

### Home

- **This week** — Completions, active days, total time, Mon–Sun strip
- **Widgets** — Drag **⋮⋮** to reorder; **Hide** / **Show** to collapse; turn off fully in Settings
- **Add routine** — Empty state CTA when you have none; top **+** once you have routines
- **Open** — Tap the card body
- **Start** — Tap ▶ on the card (disabled if the routine has no activities)
- **In progress** — Banner appears if you left a live run; tap to continue
- **Due / overdue** — Badges when spaced practice is on; overdue and due today sort to the top
- **Reorder** — Drag **⋮⋮** when you have 2+ routines and nothing is due/overdue
- **Duplicate / rename / delete** — ⎘ / ✎ / 🗑 on the card

### Creating a routine

1. Tap **+** (or **Add routine** on empty home)
2. Enter a name, estimated minutes, and color
3. Tap **Create**
4. Add activities on the routine detail screen

### Routine detail

- **Spaced practice** — Compact toggle; when on, shows **Next practice**
- **Past year** — Contribution graph of completions
- **Add / edit / reorder / delete** activities
- **Start** or **Continue** — Opens the live timer
- **Header:** ⎘ duplicate · 📅 calendar & run history · 🎨 color · ⏱ estimate
- **Rename** — Tap the title in the top bar

### Running a routine

1. Start from Home (▶) or routine detail
2. Tap an activity to **start**, tap again to **finish** — the next step starts automatically
3. Watch total / estimate progress (amber when over)
4. **Pause** / **Resume** as needed
5. Use **Back** or tabs to leave without ending — resume from the Home banner
6. **End Routine** to finish (confirmation required)
7. Review the completion summary, then **Done**

Starting a different routine while one is active asks before replacing the timer.

### History

- Scroll recent runs (routine name, duration, when)
- Tap a row to open that day’s details (duration, activities done, vs estimate), plus the routine calendar

### Settings

Open the **Settings** tab:

- **Dark mode** — Also syncs the system status bar color on install / supported browsers
- **Cumulative Habit Tracker** — Times accumulate across runs when on
- **Completion sound**
- **Haptics** — Light vibration on step/routine finish (Android Chrome and similar; often unavailable on iPhone)
- **Due reminders** — Notify when spaced-practice items are due/overdue (needs notification permission; works best on installed / supported browsers)
- **Language** — English, Español, 中文
- **Home widgets** — Show/hide sections (at least one must stay on)
- **Backup**
  - **Export** — Download `habitizer-backup-YYYY-MM-DD.json`
  - **Import** — Choose **Merge** (keep local + combine shared history) or **Replace all**
  - **Reset app data** — Wipe local data for this browser origin
- **Recently deleted** — Restore or permanently delete (30-day retention)

### Spaced practice

Per routine:

1. Turn on **Spaced practice**
2. First due date is **today**
3. After each on-time completion, the gap grows: **1 → 2 → 4 → 7 → 14 → 30** days
4. Overdue completions step the interval back one level

Home shows due/overdue labels and pins those routines first. Optional **Due reminders** notify when you open or return to the app.

## Technical details

### Stack

- **HTML5 / CSS3 / Vanilla JS (ES modules)** — No build step, no framework dependencies
- **localStorage** — All data stays in the browser
- **PWA** — `manifest.webmanifest`, icons, service worker (skipped on localhost / LAN IP for fresher dev reloads)

### Data storage

| Key | Purpose |
|-----|---------|
| `habitizer-routines-v1` | Active routines, activities, completions, run history, spaced-practice fields |
| `habitizer-settings-v1` | Theme, language, cumulative mode, sound, due reminders, saved colors, home widgets |
| `habitizer-deleted-routines-v1` | Recently deleted routines (30-day retention) |
| `habitizer-timer-v1` | In-progress timer session (cleared when the run ends; max 24h) |
| `habitizer-due-notified-v1` | Due-reminder dedupe (per day) |
| `habitizer-cleared-demo-routines-v1` | One-time flag after removing legacy sample routines |
| `habitizer-build` | Build stamp for cache refresh |

### Project structure

```
habitizer/
├── index.html           # Shell, settings, modals, boot + import map
├── styles.css
├── serve.py             # Dev server with Cache-Control: no-store
├── manifest.webmanifest
├── sw.js                # Offline shell (non-local hosts)
├── icons/
├── js/
│   ├── main.js          # Boot
│   ├── views.js         # Home, history, routine, timer, completion
│   ├── timer.js         # Live run, pause/resume, minimize/resume
│   ├── schedule.js      # Spaced practice / due status
│   ├── reminders.js     # Due notification checks
│   ├── backup.js        # Export, merge import, replace import
│   ├── persistence.js   # localStorage load/save
│   ├── i18n.js          # EN / ES / ZH
│   └── ...              # state, models, modals, drag, etc.
├── app.js               # Legacy re-export to js/main.js
└── README.md
```

### Browser compatibility

- Modern browsers with ES modules (Chrome, Firefox, Safari, Edge)
- Requires `localStorage`
- Notifications (due reminders) need permission and browser support; iOS works best when installed to the home screen
