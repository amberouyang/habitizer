# Habitizer

A modern web application for building, managing, and executing daily routines with built-in timing capabilities.

## Features

**Create Your Own Routines** - Build custom routines tailored to your lifestyle (morning, evening, workout, etc.)

**Manage Your Activities** - Add, rename, reorder, or remove activities from your routines anytime

**Quick Editing** - Click any routine name to rename it right away (no complicated menus)

**Track Your Time** - Set how long you think a routine should take, then see how long it actually takes

**Live Timer** - Start a routine and watch a timer count up as you complete each activity

**Auto-Saves** - Everything is saved automatically to your browser, so you never lose your routines

**Works Everywhere** - Use it on your phone, tablet, or computer, get the same beautiful interface on all devices

## Installation

1. Clone the repository:
```bash
git clone https://github.com/amberouyang/habitizer.git
cd habitizer
```

2. Start a local web server:
```bash
# Using Python 3
python3 -m http.server 8000

# Or using Node.js
npx http-server

# Or using any other local server
```

3. Open your browser and navigate to `http://localhost:8000`

## Usage

### Creating a Routine
1. Click the **+** button to create a new routine
2. Enter a name for your routine
3. Click **Create**

### Managing Routines
- **Rename**: Click the pencil icon (✎) on a routine card, or click the routine name at the top of the routine detail view
- **Edit Duration**: Click the clock icon (⏱) in the routine detail view to set estimated time
- **Delete**: Click the trash icon (🗑) on a routine card

### Managing Activities
1. Open a routine
2. Click **+** to add a new activity
3. Manage activities:
   - Click activity name to rename
   - Use ↑/↓ arrows to reorder
   - Click ✕ to delete

### Running a Routine
1. Open a routine
2. Click **Start Routine** to begin the timer
3. The timer tracks elapsed time and individual activity times
4. Complete activities as you go through your routine

## Technical Details

### Stack
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern styling with CSS variables and custom design
- **Vanilla JavaScript**: No dependencies, pure ES6+

### Project Structure
```
habitizer/
├── index.html      # Main HTML structure
├── app.js          # Application logic and state management
├── styles.css      # Styling and layout
└── README.md       # This file
```

## Development

### Browser Compatibility
- Modern browsers supporting ES6 (Chrome, Firefox, Safari, Edge)
- Requires localStorage support