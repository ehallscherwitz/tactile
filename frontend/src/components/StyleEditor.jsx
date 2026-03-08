import { useState } from 'react';
import {
  FONT_OPTIONS, FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS,
  LETTER_SPACINGS, TEXT_TRANSFORMS,
  COLOR_SCHEMES, OPACITY_OPTIONS,
  EFFECT_OPTIONS, BORDER_RADII, BORDER_WIDTHS, SHADOW_STYLES,
  PADDING_OPTIONS, GAP_OPTIONS,
  CONTENT_WIDTHS, ALIGNMENTS, HERO_LAYOUTS,
} from '../lib/components';

const TABS = [
  { id: 'type',    label: 'Type' },
  { id: 'color',   label: 'Color' },
  { id: 'effects', label: 'FX' },
  { id: 'spacing', label: 'Space' },
  { id: 'layout',  label: 'Layout' },
];

export default function StyleEditor({
  visible, styles, selectedComponent, onStyleChange, onClose,
}) {
  const [tab, setTab] = useState('type');
  if (!visible) return null;

  const label = selectedComponent
    ? `Editing: ${selectedComponent}`
    : 'Editing: Entire Frame';

  return (
    <div className="se-panel-left">
      <div className="se-header">
        <span className="se-title">STYLE</span>
        <button className="se-close" onClick={onClose} data-selectable="true">
          <span className="se-close-x">[x]</span>
        </button>
      </div>

      <div className="se-target">{label}</div>

      <div className="se-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`se-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            data-selectable="true"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="se-body">
        {tab === 'type'    && <TypePanel    styles={styles} onChange={onStyleChange} />}
        {tab === 'color'   && <ColorPanel   styles={styles} onChange={onStyleChange} />}
        {tab === 'effects' && <EffectsPanel styles={styles} onChange={onStyleChange} />}
        {tab === 'spacing' && <SpacingPanel styles={styles} onChange={onStyleChange} />}
        {tab === 'layout'  && <LayoutPanel  styles={styles} onChange={onStyleChange} />}
      </div>

      <div className="se-footer">
        <span className="se-hint">Click components on the frame to target them</span>
      </div>
    </div>
  );
}

// ── Shared pill row component ───────────────────────

function OptionRow({ label, options, activeId, onSelect, fieldKey }) {
  return (
    <div className="se-option-row">
      <div className="se-option-label">{label}</div>
      <div className="se-option-pills">
        {options.map((o) => (
          <button
            key={o.id}
            className={`se-pill${o.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(fieldKey, o.id)}
            data-selectable="true"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Type Tab ────────────────────────────────────────

function TypePanel({ styles, onChange }) {
  return (
    <div className="se-tab-content">
      <div className="se-section-label">Font Family</div>
      <div className="se-grid-2">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.id}
            className={`se-card${f.id === styles.font?.id ? ' selected' : ''}`}
            onClick={() => onChange('font', f)}
            data-selectable="true"
          >
            <div className="se-font-preview" style={{ fontFamily: f.family }}>Aa</div>
            <div className="se-card-name">{f.name}</div>
            <div className="se-card-meta">{f.style}</div>
          </button>
        ))}
      </div>

      <OptionRow label="Size" options={FONT_SIZES} activeId={styles.fontSize} onSelect={onChange} fieldKey="fontSize" />
      <OptionRow label="Weight" options={FONT_WEIGHTS} activeId={styles.fontWeight} onSelect={onChange} fieldKey="fontWeight" />
      <OptionRow label="Line Height" options={LINE_HEIGHTS} activeId={styles.lineHeight} onSelect={onChange} fieldKey="lineHeight" />
      <OptionRow label="Letter Spacing" options={LETTER_SPACINGS} activeId={styles.letterSpacing} onSelect={onChange} fieldKey="letterSpacing" />
      <OptionRow label="Transform" options={TEXT_TRANSFORMS} activeId={styles.textTransform} onSelect={onChange} fieldKey="textTransform" />
    </div>
  );
}

// ── Color Tab ───────────────────────────────────────

function ColorPanel({ styles, onChange }) {
  return (
    <div className="se-tab-content">
      <div className="se-section-label">Color Scheme</div>
      <div className="se-grid-2">
        {COLOR_SCHEMES.map((c) => (
          <button
            key={c.id}
            className={`se-card se-color-card${c.id === styles.colorScheme?.id ? ' selected' : ''}`}
            onClick={() => onChange('colorScheme', c)}
            data-selectable="true"
          >
            <div className="se-color-swatches">
              <div className="se-swatch" style={{ background: c.bg }} />
              <div className="se-swatch" style={{ background: c.primary }} />
              <div className="se-swatch" style={{ background: c.accent }} />
            </div>
            <div className="se-card-name">{c.name}</div>
          </button>
        ))}
      </div>

      <OptionRow label="Opacity" options={OPACITY_OPTIONS} activeId={styles.opacity} onSelect={onChange} fieldKey="opacity" />
    </div>
  );
}

// ── Effects Tab ─────────────────────────────────────

function EffectsPanel({ styles, onChange }) {
  const activeEffects = styles.effects || [];

  function toggleEffect(id) {
    const next = activeEffects.includes(id)
      ? activeEffects.filter((e) => e !== id)
      : [...activeEffects, id];
    onChange('effects', next);
  }

  return (
    <div className="se-tab-content">
      <div className="se-section-label">Visual Effects</div>
      <div className="se-effect-list">
        {EFFECT_OPTIONS.map((fx) => {
          const isOn = activeEffects.includes(fx.id);
          return (
            <button
              key={fx.id}
              className={`se-effect-row${isOn ? ' active' : ''}`}
              onClick={() => toggleEffect(fx.id)}
              data-selectable="true"
            >
              <div className="se-effect-info">
                <div className="se-effect-name">{fx.name}</div>
                <div className="se-effect-desc">{fx.desc}</div>
              </div>
              <div className={`se-toggle${isOn ? ' on' : ''}`}>
                <div className="se-toggle-knob" />
              </div>
            </button>
          );
        })}
      </div>

      <OptionRow label="Border Radius" options={BORDER_RADII} activeId={styles.borderRadius} onSelect={onChange} fieldKey="borderRadius" />
      <OptionRow label="Border Width" options={BORDER_WIDTHS} activeId={styles.borderWidth} onSelect={onChange} fieldKey="borderWidth" />
      <OptionRow label="Shadow" options={SHADOW_STYLES} activeId={styles.shadow} onSelect={onChange} fieldKey="shadow" />
    </div>
  );
}

// ── Spacing Tab ─────────────────────────────────────

function SpacingPanel({ styles, onChange }) {
  return (
    <div className="se-tab-content">
      <div className="se-section-label">Spacing</div>
      <OptionRow label="Padding" options={PADDING_OPTIONS} activeId={styles.padding} onSelect={onChange} fieldKey="padding" />
      <OptionRow label="Section Gap" options={GAP_OPTIONS} activeId={styles.sectionGap} onSelect={onChange} fieldKey="sectionGap" />
      <OptionRow label="Element Gap" options={GAP_OPTIONS} activeId={styles.elementGap} onSelect={onChange} fieldKey="elementGap" />
    </div>
  );
}

// ── Layout Tab ──────────────────────────────────────

function LayoutPanel({ styles, onChange }) {
  return (
    <div className="se-tab-content">
      <div className="se-section-label">Content</div>
      <OptionRow label="Max Width" options={CONTENT_WIDTHS} activeId={styles.contentWidth} onSelect={onChange} fieldKey="contentWidth" />
      <OptionRow label="Alignment" options={ALIGNMENTS} activeId={styles.alignment} onSelect={onChange} fieldKey="alignment" />

      <div className="se-section-label" style={{ marginTop: 16 }}>Hero Layout</div>
      <div className="se-grid-1">
        {HERO_LAYOUTS.map((h) => (
          <button
            key={h.id}
            className={`se-card se-layout-card${h.id === styles.heroLayout ? ' selected' : ''}`}
            onClick={() => onChange('heroLayout', h.id)}
            data-selectable="true"
          >
            <div className="se-card-name">{h.label}</div>
            <div className="se-card-meta">{h.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
