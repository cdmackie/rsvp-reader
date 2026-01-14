# RSVP Speed Reader

A web-based Rapid Serial Visual Presentation (RSVP) reader for speed reading PDFs, ebooks, and text content.

## Project Overview

This application displays text one word at a time using the Spritz-style ORP (Optimal Recognition Point) technique, allowing users to read at speeds of 100-900 words per minute without eye movement.

## Tech Stack

- **Framework:** Svelte (SvelteKit for build tooling)
- **Styling:** CSS (no external framework)
- **Storage:** localStorage for progress persistence
- **File Parsing:**
  - EPUB: epub.js or similar client-side library
  - PDF: pdf.js (phase 2)
  - URL extraction: Backend service (phase 2)

## Core Features

### Input Sources (Phase 1)
- EPUB file upload and parsing
- Plain text file upload

### Input Sources (Phase 2)
- PDF file upload (client-side pdf.js)
- URL content extraction (requires backend)

### RSVP Display

**ORP (Optimal Recognition Point) Positioning:**
- The ORP letter is highlighted in red and aligned to a fixed focal point
- Word positioning based on length:
  - 1 letter: 1st letter is ORP
  - 2-6 letters: 2nd letter is ORP
  - 7-9 letters: 3rd letter is ORP
  - 10+ letters: 4th letter is ORP

**Redicle Display Box:**
- Fixed-width display area centered on page
- Horizontal guide lines to direct eye to ORP
- Responsive scaling for mobile devices

### Controls

**Playback:**
- Play/Pause: Spacebar or click on reading area
- Speed: 100-900 WPM slider (default: 300 WPM)

**Navigation:**
- Word: Arrow keys or buttons (←/→)
- Paragraph: Ctrl+Arrow or dedicated buttons
- Page: Page Up/Down or dedicated buttons (uses original page boundaries if available)
- Chapter: For EPUB files with chapter markers

**Progress:**
- Visual progress bar
- Current position indicator (word X of Y, page X of Y)
- Time remaining estimate at current speed

### Color Themes

**Default (Dark Mode):**
- Background: `#1a1a1a` (soft black)
- Text: `#e0e0e0` (soft white)
- ORP Letter: `#ff4444` (bright red)
- Guide lines: `#444444`

**Available Presets:**
- Dark (default)
- Light: `#f5f5f5` bg, `#1a1a1a` text, `#cc0000` ORP
- Sepia: `#f4ecd8` bg, `#5c4b37` text, `#8b0000` ORP
- High Contrast: `#000000` bg, `#ffffff` text, `#ff0000` ORP

**Customization:**
- Users can customize background, text, and ORP colors
- Font size adjustment (default: 48px for reading word)
- Font family selection (default: system sans-serif stack)

### Persistence (localStorage)

- Reading position per file (keyed by filename + file size hash)
- User preferences (speed, theme, font settings)
- Recently opened files list

## UI Layout

```
┌─────────────────────────────────────────────────┐
│  [Logo/Title]              [Open File] [Settings] │
├─────────────────────────────────────────────────┤
│                                                   │
│                                                   │
│            ┌─────────────────────┐               │
│            │    ───|───          │               │
│            │   amaz|ing          │               │
│            │    ───|───          │               │
│            └─────────────────────┘               │
│                                                   │
│              [Progress Bar]                       │
│         Word 1,234 of 50,000 | Page 12           │
│                                                   │
├─────────────────────────────────────────────────┤
│  [|◀] [◀◀] [◀] [ ▶/❚❚ ] [▶] [▶▶] [▶|]          │
│                                                   │
│        Speed: [====●=====] 300 WPM               │
│                                                   │
│  [Chapter ▼]                    ~15 min left     │
└─────────────────────────────────────────────────┘
```

## File Structure

```
rsvp/
├── CLAUDE.md              # This file
├── package.json
├── svelte.config.js
├── vite.config.js
├── src/
│   ├── app.html
│   ├── app.css            # Global styles, CSS variables for themes
│   ├── routes/
│   │   └── +page.svelte   # Main (only) page
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Redicle.svelte      # The RSVP display box
│   │   │   ├── Controls.svelte     # Playback controls
│   │   │   ├── SpeedSlider.svelte  # WPM control
│   │   │   ├── ProgressBar.svelte  # Reading progress
│   │   │   ├── FileLoader.svelte   # File input handling
│   │   │   └── Settings.svelte     # Theme/font settings modal
│   │   ├── stores/
│   │   │   ├── reader.js           # Reading state (words, position, playing)
│   │   │   ├── settings.js         # User preferences
│   │   │   └── document.js         # Loaded document data
│   │   ├── utils/
│   │   │   ├── orp.js              # ORP calculation
│   │   │   ├── epub-parser.js      # EPUB parsing
│   │   │   ├── text-parser.js      # Plain text parsing
│   │   │   └── storage.js          # localStorage helpers
│   │   └── constants.js            # Theme presets, speed limits, etc.
│   └── static/
│       └── (any static assets)
└── tests/                  # Future: component tests
```

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## Key Implementation Notes

### ORP Calculation (`src/lib/utils/orp.js`)
```javascript
function getORPIndex(word) {
  const len = word.length;
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  if (len <= 9) return 2;
  return 3;
}
```

### Timing Calculation
- Base interval: `60000 / wpm` milliseconds per word
- Adjust for punctuation: add 50% delay after periods, commas
- Adjust for word length: longer words may need slightly more time

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← | Previous word |
| → | Next word |
| Ctrl+← | Previous paragraph |
| Ctrl+→ | Next paragraph |
| Page Up | Previous page |
| Page Down | Next page |
| [ | Decrease speed by 50 WPM |
| ] | Increase speed by 50 WPM |
| Esc | Close modals |

## Phase 2 Features (Future)

- PDF parsing with pdf.js
- URL content extraction (backend required)
- Cloud sync for progress/settings
- Import/export settings
- Reading statistics and history
- Multiple bookmark support
- Text-to-speech fallback option

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome for Android)
- No IE11 support required

## Accessibility Considerations

- Keyboard navigation throughout
- ARIA labels on controls
- Respect `prefers-reduced-motion` for animations
- Screen reader announcements for state changes
- Adjustable font sizes
