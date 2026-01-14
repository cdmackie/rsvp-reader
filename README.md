# QuickReader

A web-based RSVP (Rapid Serial Visual Presentation) speed reader that displays text one word at a time, allowing you to read at 100-900+ words per minute without eye movement.

**Live site:** [quickreader.app](https://quickreader.app)

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **EPUB, PDF & Text Support** - Load EPUB ebooks, PDF documents, or plain text files
- **ORP Highlighting** - Optimal Recognition Point letter highlighted for faster reading
- **Adjustable Speed** - 100-900 WPM with real-time adjustment
- **Smart Pauses** - Extra time on punctuation, long words, and names
- **Text Formatting** - Preserves italic and bold from EPUBs
- **Progress Tracking** - Saves your position per file automatically
- **Last Read Position** - Tracks where you were actively reading, clickable to return
- **Preview Panel** - Side panel shows current page with click-to-navigate
- **Keyboard Navigation** - Full keyboard control for hands-free reading
- **Themes** - Dark, Light, Sepia, and High Contrast modes
- **Responsive** - Works on desktop and mobile
- **Privacy First** - All processing happens locally, no uploads

## Demo

```
        ───────|───────
           ama|zing
        ───────|───────
```

The ORP (red letter) stays fixed while words flow past, eliminating eye movement and dramatically increasing reading speed.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:5173](http://localhost:5173) and load an EPUB, PDF, or text file to start reading.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` / `→` | Previous/Next word |
| `Ctrl+←` / `Ctrl+→` | Previous/Next paragraph |
| `Page Up` / `Page Down` | Previous/Next page |
| `[` / `]` | Decrease/Increase speed by 50 WPM |
| `Esc` | Close modals |

## How It Works

RSVP displays words one at a time at a fixed focal point. The **Optimal Recognition Point (ORP)** - the letter your eye naturally focuses on - is highlighted and centered, eliminating the need for eye movement across the page.

**ORP positioning by word length:**
- 1-2 letters: 1st letter
- 3-6 letters: 2nd letter
- 7-9 letters: 3rd letter
- 10+ letters: 4th letter

**Smart timing adjustments:**
- Punctuation (. , ! ?) adds 50% pause
- Long words (10+ chars) add 20% pause
- Names/proper nouns add 30% pause

## Tech Stack

- **Framework:** [SvelteKit](https://kit.svelte.dev/) with Svelte 5 runes
- **Language:** TypeScript
- **EPUB Parsing:** [epub.js](https://github.com/futurepress/epub.js)
- **PDF Parsing:** [pdf.js](https://mozilla.github.io/pdf.js/) (pdfjs-dist)
- **Storage:** localStorage for settings and progress
- **Styling:** CSS (no framework)

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   │   ├── Redicle.svelte      # Word display with ORP
│   │   ├── Controls.svelte     # Playback controls
│   │   ├── FileLoader.svelte   # File input
│   │   ├── Preview.svelte      # Context preview panel
│   │   └── Settings.svelte     # Theme/font settings
│   ├── stores/         # Svelte stores
│   │   ├── reader.ts   # Playback state
│   │   ├── document.ts # Loaded document
│   │   └── settings.ts # User preferences
│   └── utils/          # Utilities
│       ├── orp.ts      # ORP calculation
│       ├── epub-parser.ts
│       ├── pdf-parser.ts
│       └── text-parser.ts
└── routes/
    ├── +page.svelte    # Main reader page
    ├── about/          # About RSVP technology
    ├── help/           # Keyboard shortcuts & guide
    └── privacy/        # Privacy policy
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by [Spritz](https://spritz.com/) speed reading technology
- Built with [Svelte](https://svelte.dev/), [epub.js](https://github.com/futurepress/epub.js), and [pdf.js](https://mozilla.github.io/pdf.js/)
