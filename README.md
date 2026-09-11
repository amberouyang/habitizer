# Habitizer

A modern web app for building, managing, and running daily routines with built-in timing and streak tracking.

## Features

- **Custom routines** — Create routines for mornings, evenings, workouts, and more
- **Activities** — Add, rename, set time estimates, drag to reorder, and delete activities
- **Estimated time** — Set how long each activity should take; routine total sums from activities
- **Routine colors** — Pick a preset, tap **+** to pick a custom color then **Add** to save it, or tap **×** on a saved swatch to remove it (card stripe + timer progress bar)
- **Live timer** — Track total time and per-activity time vs estimates while you run a routine (survives page refresh)
- **Completion screen** — See your results, streak, and personal best after finishing
- **Streaks** — Daily completion tracking with calendar history and streak badges
- **Run history** — Past run durations per routine (best time + recent runs, up to 50)
- **Drag to reorder** — Reorder routines on the home screen and activities within a routine
- **Duplicate routines** — Copy a routine with all activities and settings
- **Undo delete** — Brief undo window after deleting a routine or activity
- **Recently deleted** — Deleted routines are kept in settings for 30 days and can be restored
- **Dark mode** — Toggle in settings
- **Export / import** — Back up and restore routines, settings, and recently deleted items as JSON
- **Auto-save** — Everything persists in your browser via localStorage

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

> **Note:** Serve from the inner `habitizer/` folder that contains `index.html`, not the parent directory.

## Usage

### Home screen

- **Add routine** — Tap the **Add routine** button below your routine list
- **Open a routine** — Tap a routine card
- **Reorder** — Drag the **⋮⋮** handle on the left (when you have 2+ routines)
- **Streak badge** — Routines with a 2+ day streak show a **🔥** badge on the card
- **Last completed** — Each card shows when the routine was last finished (Today, Yesterday, or a date)
- **Duplicate** — Tap **⎘** on a routine card
- **Rename** — Tap **✎** on a routine card
- **Delete** — Tap **🗑** on a routine card (confirmation required; undo available for 5 seconds)
- **Settings** — Tap **⋯** in the top bar

When you have no routines yet, the home screen shows a short hint to help you get started.

### Creating a routine

1. Tap **Add routine**
2. Enter a name
3. Set estimated time (minutes)
4. Pick a color — presets, your saved swatches, or **+** to add a custom color
5. Tap **Create**

### Creating an activity

1. Open a routine, then tap **Add activity**
2. Enter a name
3. Set estimated time (minutes)
4. Tap **Add**

The routine total estimate updates from the sum of activity estimates.

### Routine detail

- **Add activity** — Tap **Add activity** at the bottom
- **Start from an activity** — Tap an activity name to start the routine with that step already in progress
- **Edit activity** — Tap **✎** (name and estimated minutes)
- **Reorder activities** — Drag the **⋮⋮** handle
- **Delete activity** — Tap **✕** (confirmation required; undo available for 5 seconds)
- **Start routine** — Tap **Start Routine** (or tap any activity)
- **Header actions:**
  - **⎘** — Duplicate routine
  - **📅** — Completion history calendar and recent run durations (green dot if completed today)
  - **🎨** — Change color
  - **⏱** — Edit estimated time (overridden when activities have estimates)
- **Rename routine** — Tap the routine name in the top bar
- **Estimated time** — Totals from activity estimates; tap the row or **⏱** to set manually when needed

### Running a routine

1. Tap **Start Routine** to open the live timer (clock waits)
2. Tap an activity once to **start** it — this also starts the routine clock
3. Tap it again to **finish** it
4. Watch the progress bar against your estimated time (tinted with your routine color)
5. Check activity times as `actual / estimate` (turns amber if over estimate)
6. Tap **Pause** / **Resume** as needed
7. Tap **End Routine** to finish (confirmation required)
8. Review your completion summary, then tap **Done**

Tip: From the routine detail screen, tap an activity name to jump straight in with that step already running.

### Settings

Open **⋯** from the home screen:

- **Dark mode** — Switch between light and dark themes
- **Cumulative Habit Tracker** — When on, activity times accumulate across runs; when off, times reset each session
- **Backup** — Export or import a JSON file with your routines, settings, and recently deleted items
  - **Export** — Download a `habitizer-backup-YYYY-MM-DD.json` file
  - **Import** — Replace current data from a backup (confirmation required)
- **Recently deleted** — View routines deleted in the last 30 days
  - **Restore** — Bring a routine back to your list
  - **✕** — Permanently delete a routine from the archive (confirmation required)

## Technical details

### Stack

- **HTML5** — Semantic markup with accessibility features
- **CSS3** — CSS variables, dark mode, responsive layout
- **Vanilla JavaScript** — No dependencies, pure ES6+

### Data storage

| Key | Purpose |
|-----|---------|
| `habitizer-routines-v1` | Active routines and activities |
| `habitizer-settings-v1` | Dark mode and cumulative timer preference |
| `habitizer-deleted-routines-v1` | Recently deleted routines (30-day retention) |
| `habitizer-timer-v1` | In-progress timer session (cleared when the run ends; max 24h) |

### Project structure

```
habitizer/
├── index.html      # Main HTML structure and modals
├── js/             # ES module application code
│   ├── main.js     # Entry point and initialization
│   ├── backup.js   # JSON export/import
│   ├── persistence.js
│   └── ...         # state, views, timer, modals, etc.
├── app.js          # Legacy re-export to js/main.js (optional)
├── styles.css      # Styling and layout
└── README.md       # This file
```

### Browser compatibility

- Modern browsers with ES6 support (Chrome, Firefox, Safari, Edge)
- Requires localStorage
