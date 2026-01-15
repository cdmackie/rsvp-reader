# QuickReader

A web-based RSVP (Rapid Serial Visual Presentation) speed reader for ebooks, documents, and text content.

**Live site:** https://quickreader.app

## Project Overview

This application displays text one word at a time using the Spritz-style ORP (Optimal Recognition Point) technique, allowing users to read at speeds of 100-900 words per minute without eye movement. All file processing happens locally in the browser - no uploads, no tracking.

## Tech Stack

- **Framework:** Svelte (SvelteKit for build tooling)
- **Styling:** CSS (no external framework)
- **Storage:** localStorage for progress persistence
- **File Parsing:** Adapter-based system supporting multiple formats

## Supported Formats

### Ebooks
- **EPUB** - Full chapter navigation, formatting, and images
- **MOBI/AZW3** - Kindle format ebooks (DRM-free only)
- **FB2** - FictionBook format

### Documents
- **PDF** - Text extraction with bookmark navigation
- **DOCX** - Microsoft Word documents
- **ODT** - OpenDocument text files
- **RTF** - Rich Text Format

### Text
- **Markdown** - Formatted text with preview support (code blocks excluded from reading)
- **HTML** - Web pages and HTML documents
- **TXT** - Plain text files

### Future Input Sources
- URL content extraction (requires backend)

### RSVP Display

**ORP (Optimal Recognition Point) Positioning:**
- The ORP letter is highlighted in red and aligned to a fixed focal point (CSS Grid layout)
- Word positioning based on length:
  - 1-2 letters: 1st letter is ORP
  - 3-6 letters: 2nd letter is ORP
  - 7-9 letters: 3rd letter is ORP
  - 10+ letters: 4th letter is ORP

**Text Formatting:**
- Italic text from EPUB `<i>` and `<em>` tags is displayed in italics
- Bold text from EPUB `<b>` and `<strong>` tags is displayed in bold

**Word Splitting:**
- Em-dashes (—) and en-dashes (–): "consciousness—seemed" → ["consciousness—", "seemed"]
- Ellipsis (… or ...): "delusion…created" → ["delusion…", "created"]
- Long hyphenated compounds (3+ parts): "forty-nine-year-old" → ["forty-", "nine-", "year-", "old"]
- Two-part compounds like "forty-nine" are kept together

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
- Visual progress bar (clickable to jump to position)
- Current position indicator (word X of Y, page X of Y)
- Time remaining estimate at current speed
- "Last read" position tracking - shows where you were actively reading (not just navigating), clickable to return

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
│  QuickReader RSVP          [Open File] [Settings] │
├─────────────────────────────────────────────────┤
│                                                   │
│            ┌─────────────────────┐               │
│            │    ───|───          │               │
│            │   amaz|ing          │               │
│            │    ───|───          │               │
│            └─────────────────────┘               │
│                                                   │
│              [Progress Bar]                       │
│         Word 1,234 of 50,000 | ~15 min left      │
│                                                   │
│               [Chapter: ▼]                        │
│  [|◀] [◀◀] [◀] [ ▶/❚❚ ] [▶] [▶▶] [▶|]          │
│        Speed: [====●=====] 300 WPM               │
│                                                   │
├─────────────────────────────────────────────────┤
│     About · Help · Privacy · GitHub              │
│   © 2025 QuickReader. Open source under MIT.     │
└─────────────────────────────────────────────────┘
```

## File Structure

```
rsvp/
├── CLAUDE.md              # This file
├── README.md              # GitHub readme
├── LICENSE                # MIT license
├── package.json
├── svelte.config.js
├── vite.config.js
├── src/
│   ├── app.html           # SEO meta tags, OG, Twitter cards, JSON-LD
│   ├── app.css            # Global styles, CSS variables for themes
│   ├── routes/
│   │   ├── +layout.svelte # Layout with Footer
│   │   ├── +page.svelte   # Main reader page
│   │   ├── about/         # About RSVP technology
│   │   ├── help/          # Keyboard shortcuts & guide
│   │   └── privacy/       # Privacy policy
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Redicle.svelte      # The RSVP display box
│   │   │   ├── Controls.svelte     # Playback controls
│   │   │   ├── SpeedSlider.svelte  # WPM control
│   │   │   ├── ProgressBar.svelte  # Reading progress
│   │   │   ├── FileLoader.svelte   # File input handling
│   │   │   ├── Settings.svelte     # Theme/font settings modal
│   │   │   ├── Preview.svelte      # Context preview panel
│   │   │   └── Footer.svelte       # Site footer with nav links
│   │   ├── stores/
│   │   │   ├── reader.ts           # Reading state (words, position, playing)
│   │   │   ├── settings.ts         # User preferences (includes preview settings)
│   │   │   └── document.ts         # Loaded document data
│   │   ├── utils/
│   │   │   ├── adapters/           # File format adapter system
│   │   │   │   ├── types.ts        # Adapter interfaces
│   │   │   │   ├── registry.ts     # Adapter registry singleton
│   │   │   │   ├── index.ts        # Exports + auto-registration
│   │   │   │   ├── epub-adapter.ts
│   │   │   │   ├── pdf-adapter.ts
│   │   │   │   ├── text-adapter.ts
│   │   │   │   ├── markdown-adapter.ts
│   │   │   │   ├── html-adapter.ts
│   │   │   │   ├── docx-adapter.ts
│   │   │   │   ├── rtf-adapter.ts
│   │   │   │   ├── odt-adapter.ts
│   │   │   │   ├── fb2-adapter.ts
│   │   │   │   └── mobi-adapter.ts
│   │   │   ├── orp.ts              # ORP calculation + timing + name detection
│   │   │   ├── epub-parser.ts      # EPUB parsing with formatting + preview HTML
│   │   │   ├── pdf-parser.ts       # PDF parsing with pdf.js + preview content
│   │   │   ├── text-parser.ts      # Plain text parsing
│   │   │   └── storage.ts          # localStorage + IndexedDB helpers
│   │   └── constants.ts            # Theme presets, speed limits, etc.
├── static/
│   ├── robots.txt         # SEO: Allow all crawling
│   ├── sitemap.xml        # SEO: Page listing for search engines
│   └── samples/           # Sample files for new users
│       ├── welcome.txt
│       ├── the-signal.epub
│       ├── markdown-demo.md
│       └── short-story.txt
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

### ORP Calculation (`src/lib/utils/orp.ts`)
```typescript
function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 2) return 0;  // 1-2 letters: 1st letter
  if (len <= 6) return 1;  // 3-6 letters: 2nd letter
  if (len <= 9) return 2;  // 7-9 letters: 3rd letter
  return 3;                // 10+ letters: 4th letter
}
```

### Timing Calculation
- Base interval: `60000 / wpm` milliseconds per word
- Punctuation delay: 1.5x multiplier after . , ; : ! ? — –
- Long word delay: 1.2x multiplier for words with 10+ characters
- Name/proper noun delay: 1.3x multiplier for capitalized words (not all-caps)

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

## Preview Panel Feature

A side panel showing the current page like an e-reader with highlighting and click-to-navigate.

**Features:**
- Shows current page content with natural pagination (like an e-reader)
- EPUB support: Preserves original HTML formatting, links, images via blob URLs
- PDF support: Text extraction mode or rendered page mode (toggle button)
- Plain text support: Shows current page with paragraph formatting
- Click any word to jump to that position
- Mouse wheel scrolling to change pages (scroll to bottom/top then continue to advance)
- Toggle visibility with button in header (book icon)
- Responsive: Hidden on screens < 1024px
- Memory safe: Blob URLs cleaned up when documents change

**Pagination:**
- Pages break at natural paragraph boundaries (targeting ~250 words per page)
- Each chapter starts on a new page
- Preserves document structure unlike arbitrary word-count pagination

**Current Word Highlighting:**
- When paused: Bright red highlight (ORP color) for easy visibility
- When actively reading: Subtle gray tint (15% opacity) to avoid peripheral distraction

**Key Data Structures:**
```typescript
interface ChapterContent {
  chapterIndex: number;
  htmlWithMarkers: string;  // HTML with <span data-word-index="N"> wrappers
  wordRange: [number, number];
  imageUrls: Map<string, string>;  // original src → blob URL
}

interface ParsedEpubWithContent extends ParsedEpub {
  chapterContents: ChapterContent[];
}
```

**Settings:**
- `previewVisible: boolean` - default: true
- `previewWidth: number` - default: 35 (percentage, range 20-50)

## Future Features

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
