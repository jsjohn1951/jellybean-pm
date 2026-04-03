/** Centralized design tokens for JellyBean PM — Cormonity purple/glass theme */
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bgPage:       '#111927',                  // root page / board canvas
  bgPanel:      'rgba(17, 25, 39, 0.98)',   // nav, sidebar, modal panels, column headers
  bgCard:       'rgba(30, 20, 50, 0.75)',   // issue cards
  bgDropZone:   '#0d1117',                  // kanban column drop area
  bgInput:      'rgba(30, 20, 50, 0.6)',    // inputs, selects, pill bg

  // ── Borders ───────────────────────────────────────────────────────────────
  borderSubtle: 'rgba(168, 85, 247, 0.15)', // cards, panels, modal edges
  borderMuted:  'rgba(168, 85, 247, 0.25)', // input borders, dividers

  // ── Accent (purple) ───────────────────────────────────────────────────────
  accent:       '#a855f7',                  // primary buttons, active pills, brand color
  accentHover:  '#9333ea',                  // hover state for accent elements
  accentBg:     'rgba(168, 85, 247, 0.15)', // selected item background (sidebar, sprint pill)
  accentText:   '#c084fc',                  // accent-colored text on dark bg

  // ── Secondary accents ─────────────────────────────────────────────────────
  accentCyan:   '#06b6d4',
  accentPink:   '#ec4899',
  accentGreen:  '#10b981',
  accentAmber:  '#f59e0b',

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:  '#f1f5f9',   // headings, body text
  textSecond:   '#a8bbd0',   // secondary labels, metadata
  textMuted:    '#8899b0',   // form labels, icon colors
  textFaint:    '#6b7a94',   // very quiet text, placeholder hints

  // ── Semantic ──────────────────────────────────────────────────────────────
  dangerBg:     '#450a0a',   // delete button background
  dangerText:   '#fca5a5',   // delete button text
  statusOnline: '#10b981',   // "System Online" green dot

  // ── Glassmorphism ─────────────────────────────────────────────────────────
  glassBlur:         'blur(19px) saturate(162%)',
  glassBorder:       '1px solid rgba(168, 85, 247, 0.2)',
  glassBorderHover:  '1px solid rgba(168, 85, 247, 0.45)',
  glowShadow:        '0 0 12px rgba(168, 85, 247, 0.35)',
  glowShadowCyan:    '0 0 12px rgba(6, 182, 212, 0.35)',

  // ── Typography ────────────────────────────────────────────────────────────
  fontPrimary:   "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono:      "'Space Mono', 'Courier New', monospace",
  fontSizeBase:  '13px',  // standard UI text (was inconsistent 12/13px)
  fontSizeSmall: '12px',  // small labels (was 11px — too small on mobile)

  // ── Column accent pool ────────────────────────────────────────────────────
  columnAccents: [
    '#a855f7', '#06b6d4', '#ec4899', '#10b981',
    '#f59e0b', '#e879f9', '#38bdf8', '#34d399',
  ],
} as const;

export type ThemeToken = keyof typeof T;
