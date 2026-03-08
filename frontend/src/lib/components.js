export const BREAKPOINTS = {
  mobile:  { width: 375,  label: 'Mobile',  shortcut: '1' },
  tablet:  { width: 768,  label: 'Tablet',  shortcut: '2' },
  laptop:  { width: 1024, label: 'Laptop',  shortcut: '3' },
  desktop: { width: 1440, label: 'Desktop', shortcut: '4' },
};

export const BREAKPOINT_ORDER = ['mobile', 'tablet', 'laptop', 'desktop'];

export function spreadToBreakpoint(normalizedDist) {
  if (normalizedDist < 0.22) return 'mobile';
  if (normalizedDist < 0.40) return 'tablet';
  if (normalizedDist < 0.58) return 'laptop';
  return 'desktop';
}

// ── Typography ──────────────────────────────────────

export const FONT_OPTIONS = [
  { id: 'inter',         name: 'Inter',            family: "'Inter', sans-serif",              style: 'clean' },
  { id: 'dm-sans',       name: 'DM Sans',          family: "'DM Sans', sans-serif",            style: 'modern' },
  { id: 'poppins',       name: 'Poppins',          family: "'Poppins', sans-serif",            style: 'geometric' },
  { id: 'space-grotesk', name: 'Space Grotesk',    family: "'Space Grotesk', sans-serif",      style: 'technical' },
  { id: 'playfair',      name: 'Playfair Display', family: "'Playfair Display', serif",        style: 'editorial' },
  { id: 'roboto',        name: 'Roboto',           family: "'Roboto', sans-serif",             style: 'neutral' },
  { id: 'source-serif',  name: 'Source Serif 4',   family: "'Source Serif 4', serif",          style: 'classic' },
  { id: 'jetbrains',     name: 'JetBrains Mono',   family: "'JetBrains Mono', monospace",      style: 'code' },
];

export const FONT_SIZES = [
  { id: 'xs',   label: 'XS',     value: '12px',  scale: 0.75 },
  { id: 'sm',   label: 'Small',  value: '14px',  scale: 0.875 },
  { id: 'base', label: 'Base',   value: '16px',  scale: 1 },
  { id: 'lg',   label: 'Large',  value: '18px',  scale: 1.125 },
  { id: 'xl',   label: 'XL',     value: '20px',  scale: 1.25 },
  { id: '2xl',  label: '2XL',    value: '24px',  scale: 1.5 },
];

export const FONT_WEIGHTS = [
  { id: 'light',     label: 'Light',     value: 300 },
  { id: 'regular',   label: 'Regular',   value: 400 },
  { id: 'medium',    label: 'Medium',    value: 500 },
  { id: 'semibold',  label: 'Semi-bold', value: 600 },
  { id: 'bold',      label: 'Bold',      value: 700 },
  { id: 'extrabold', label: 'Extra-bold', value: 800 },
];

export const LINE_HEIGHTS = [
  { id: 'tight',   label: 'Tight',   value: 1.2 },
  { id: 'snug',    label: 'Snug',    value: 1.35 },
  { id: 'normal',  label: 'Normal',  value: 1.5 },
  { id: 'relaxed', label: 'Relaxed', value: 1.65 },
  { id: 'loose',   label: 'Loose',   value: 1.8 },
];

export const LETTER_SPACINGS = [
  { id: 'tighter', label: 'Tighter', value: '-0.03em' },
  { id: 'tight',   label: 'Tight',   value: '-0.01em' },
  { id: 'normal',  label: 'Normal',  value: '0' },
  { id: 'wide',    label: 'Wide',    value: '0.05em' },
  { id: 'wider',   label: 'Wider',   value: '0.1em' },
];

export const TEXT_TRANSFORMS = [
  { id: 'none',       label: 'None',       value: 'none' },
  { id: 'uppercase',  label: 'UPPER',      value: 'uppercase' },
  { id: 'lowercase',  label: 'lower',      value: 'lowercase' },
  { id: 'capitalize', label: 'Capitalize', value: 'capitalize' },
];

// ── Colors ──────────────────────────────────────────

export const COLOR_SCHEMES = [
  { id: 'ocean',   name: 'Ocean Blue',  primary: '#91bfed', bg: '#deeaf8', text: '#0d1117', accent: '#1a4a7a' },
  { id: 'violet',  name: 'Violet',      primary: '#b491ed', bg: '#ece0f8', text: '#0d1117', accent: '#4a1a7a' },
  { id: 'mint',    name: 'Mint',        primary: '#6dd4a0', bg: '#e0f5ec', text: '#0d1117', accent: '#1a6b42' },
  { id: 'amber',   name: 'Amber',       primary: '#edbb5a', bg: '#f8f0dc', text: '#0d1117', accent: '#7a5a1a' },
  { id: 'rose',    name: 'Rose',        primary: '#ed91a8', bg: '#f8dee6', text: '#0d1117', accent: '#7a1a3a' },
  { id: 'mono',    name: 'Monochrome',  primary: '#888888', bg: '#f0f0f0', text: '#111111', accent: '#333333' },
  { id: 'midnight', name: 'Midnight',   primary: '#7b8cde', bg: '#1a1a2e', text: '#e0e0e8', accent: '#3a3a6e' },
  { id: 'sunset',  name: 'Sunset',      primary: '#f4845f', bg: '#fdf0e8', text: '#2d1b0e', accent: '#c4522a' },
  { id: 'forest',  name: 'Forest',      primary: '#4a9e6d', bg: '#e8f4ec', text: '#0d1f14', accent: '#2a6e4d' },
];

export const OPACITY_OPTIONS = [
  { id: '100', label: '100%', value: 1 },
  { id: '90',  label: '90%',  value: 0.9 },
  { id: '75',  label: '75%',  value: 0.75 },
  { id: '50',  label: '50%',  value: 0.5 },
  { id: '25',  label: '25%',  value: 0.25 },
];

// ── Effects ─────────────────────────────────────────

export const EFFECT_OPTIONS = [
  { id: 'liquid-glass', name: 'Liquid Glass',   desc: 'Frosted translucent panels' },
  { id: 'drop-shadow',  name: 'Drop Shadow',    desc: 'Soft depth shadow on elements' },
  { id: 'layer-blur',   name: 'Layer Blur',     desc: 'Background blur layers' },
  { id: 'glow',         name: 'Glow',           desc: 'Soft colored glow around elements' },
  { id: 'grain',        name: 'Film Grain',     desc: 'Subtle texture overlay' },
  { id: 'gradient-border', name: 'Gradient Border', desc: 'Animated gradient on borders' },
];

export const BORDER_RADII = [
  { id: 'none',   label: 'None',   value: '0' },
  { id: 'sm',     label: 'Small',  value: '4px' },
  { id: 'md',     label: 'Medium', value: '8px' },
  { id: 'lg',     label: 'Large',  value: '16px' },
  { id: 'xl',     label: 'XL',     value: '24px' },
  { id: 'full',   label: 'Full',   value: '999px' },
];

export const BORDER_WIDTHS = [
  { id: 'none',   label: 'None',   value: '0' },
  { id: 'thin',   label: 'Thin',   value: '1px' },
  { id: 'medium', label: 'Medium', value: '2px' },
  { id: 'thick',  label: 'Thick',  value: '3px' },
];

export const SHADOW_STYLES = [
  { id: 'none',    label: 'None',    value: 'none' },
  { id: 'sm',      label: 'Small',   value: '0 1px 3px rgba(0,0,0,0.1)' },
  { id: 'md',      label: 'Medium',  value: '0 4px 16px rgba(0,0,0,0.1)' },
  { id: 'lg',      label: 'Large',   value: '0 8px 32px rgba(0,0,0,0.12)' },
  { id: 'xl',      label: 'XL',      value: '0 16px 48px rgba(0,0,0,0.15)' },
  { id: 'inner',   label: 'Inner',   value: 'inset 0 2px 8px rgba(0,0,0,0.08)' },
];

// ── Spacing ─────────────────────────────────────────

export const PADDING_OPTIONS = [
  { id: 'none',     label: 'None',     value: '0' },
  { id: 'compact',  label: 'Compact',  value: '12px' },
  { id: 'normal',   label: 'Normal',   value: '24px' },
  { id: 'relaxed',  label: 'Relaxed',  value: '36px' },
  { id: 'spacious', label: 'Spacious', value: '48px' },
];

export const GAP_OPTIONS = [
  { id: 'none',   label: 'None',   value: '0' },
  { id: 'tight',  label: 'Tight',  value: '8px' },
  { id: 'normal', label: 'Normal', value: '16px' },
  { id: 'wide',   label: 'Wide',   value: '24px' },
  { id: 'extra',  label: 'Extra',  value: '40px' },
];

// ── Layout ──────────────────────────────────────────

export const CONTENT_WIDTHS = [
  { id: 'narrow',   label: 'Narrow',   value: '680px' },
  { id: 'standard', label: 'Standard', value: '960px' },
  { id: 'wide',     label: 'Wide',     value: '1200px' },
  { id: 'full',     label: 'Full',     value: '100%' },
];

export const ALIGNMENTS = [
  { id: 'left',   label: 'Left',   value: 'flex-start' },
  { id: 'center', label: 'Center', value: 'center' },
  { id: 'right',  label: 'Right',  value: 'flex-end' },
];

export const HERO_LAYOUTS = [
  { id: 'side-by-side', label: 'Side-by-side', desc: 'Text left, visual right' },
  { id: 'stacked',      label: 'Stacked',      desc: 'Text above, visual below' },
  { id: 'centered',     label: 'Centered',     desc: 'Everything centered' },
];

// ── Keyboard map ────────────────────────────────────

export const KEYBOARD_MAP = {
  'f':         'create_frame',
  '1':         'breakpoint_mobile',
  '2':         'breakpoint_tablet',
  '3':         'breakpoint_laptop',
  '4':         'breakpoint_desktop',
  'e':         'toggle_editor',
  'Escape':    'close_editor',
  'Delete':    'delete_frame',
  'Backspace': 'delete_frame',
};
