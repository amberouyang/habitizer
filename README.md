# Habitizer

A modern web app for building, managing, and running daily routines with built-in timing and streak tracking.

## Features

- **Custom routines** — Create routines for mornings, evenings, workouts, and more
- **Activities** — Add, rename, drag to reorder, and delete activities
- **Estimated time** — Set how long a routine should take when creating or editing it
- **Routine colors** — Pick a color for each routine (card stripe + timer progress bar)
- **Live timer** — Track total time and per-activity time while you run a routine
- **Completion screen** — See your results, streak, and personal best after finishing
- **Streaks** — Track daily completions with a calendar and streak badges
- **Dark mode** — Toggle in settings
- **Undo delete** — Brief undo window after deleting a routine or activity
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
- **Duplicate** — Tap **⎘** on a routine card
- **Rename** — Tap **✎** on a routine card
- **Delete** — Tap **🗑** on a routine card (undo available for 5 seconds)
- **Settings** — Tap **⋯** in the top bar

### Creating a routine

1. Tap **Add routine**
2. Enter a name
3. Set estimated time (minutes)
4. Pick a color (optional — a default is pre-selected)
5. Tap **Create**

### Routine detail

- **Add activity** — Tap **Add activity** at the bottom
- **Rename activity** — Tap the activity name
- **Reorder activities** — Drag the **⋮⋮** handle
- **Delete activity** — Tap **✕** (undo available for 5 seconds)
- **Start routine** — Tap **Start Routine**
- **Header actions:**
  - **⎘** — Duplicate routine
  - **📅** — Completion history calendar (dot shows if completed today)
  - **🎨** — Change color
  - **⏱** — Edit estimated time
- **Rename routine** — Tap the routine name in the top bar

### Running a routine

1. Tap **Start Routine**
2. Check off activities as you complete them
3. Watch the progress bar against your estimated time
4. Tap **Pause** / **Resume** as needed
5. Tap **End Routine** to finish (confirmation required)
6. Review your completion summary, then tap **Done**

### Settings

Open **⋯** from the home screen:

- **Dark mode** — Switch between light and dark themes
- **Cumulative Habit Tracker** — When on, activity times accumulate across runs; when off, times reset each session

## Technical details

### Stack

- **HTML5** — Semantic markup with accessibility features
- **CSS3** — CSS variables, dark mode, responsive layout
- **Vanilla JavaScript** — No dependencies, pure ES6+

### Project structure

```
habitizer/
├── index.html      # Main HTML structure and modals
├── app.js          # Application logic and state management
├── styles.css      # Styling and layout
└── README.md       # This file
```

### Browser compatibility

- Modern browsers with ES6 support (Chrome, Firefox, Safari, Edge)
- Requires localStorage
