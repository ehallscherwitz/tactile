import {
  BREAKPOINTS, FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS,
  LETTER_SPACINGS, TEXT_TRANSFORMS, OPACITY_OPTIONS,
  BORDER_RADII, BORDER_WIDTHS, SHADOW_STYLES,
  PADDING_OPTIONS, GAP_OPTIONS, CONTENT_WIDTHS, ALIGNMENTS,
  COLOR_SCHEMES,
} from '../lib/components';

const lookup = (arr, id) => arr.find((o) => o.id === id) || arr[2] || arr[0];

function resolveOverridesToCss(overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return {};
  const css = {};
  if (overrides.fontSize != null) {
    const o = lookup(FONT_SIZES, overrides.fontSize);
    if (o) css.fontSize = o.value;
  }
  if (overrides.fontWeight != null) {
    const o = lookup(FONT_WEIGHTS, overrides.fontWeight);
    if (o) css.fontWeight = o.value;
  }
  if (overrides.lineHeight != null) {
    const o = lookup(LINE_HEIGHTS, overrides.lineHeight);
    if (o) css.lineHeight = o.value;
  }
  if (overrides.letterSpacing != null) {
    const o = lookup(LETTER_SPACINGS, overrides.letterSpacing);
    if (o) css.letterSpacing = o.value;
  }
  if (overrides.textTransform != null) {
    const o = lookup(TEXT_TRANSFORMS, overrides.textTransform);
    if (o) css.textTransform = o.value;
  }
  if (overrides.opacity != null) {
    const o = lookup(OPACITY_OPTIONS, overrides.opacity);
    if (o) css.opacity = o.value;
  }
  if (overrides.borderRadius != null) {
    const o = lookup(BORDER_RADII, overrides.borderRadius);
    if (o) css.borderRadius = o.value;
  }
  if (overrides.borderWidth != null) {
    const o = lookup(BORDER_WIDTHS, overrides.borderWidth);
    if (o) css.borderWidth = o.value;
  }
  if (overrides.shadow != null) {
    const o = lookup(SHADOW_STYLES, overrides.shadow);
    if (o) css.boxShadow = o.value;
  }
  if (overrides.font?.family) css.fontFamily = overrides.font.family;
  return css;
}

export default function DesignFrame({
  breakpoint, styles, componentStyles,
  selectedComponent, onSelectComponent,
  framePos, dragging,
}) {
  const bp = BREAKPOINTS[breakpoint] || BREAKPOINTS.desktop;
  const maxViewW = window.innerWidth - 320;
  const maxViewH = window.innerHeight - 160;
  const scale = Math.min(maxViewW / bp.width, maxViewH / 900, 1);

  const s = styles;
  const fontSize = lookup(FONT_SIZES, s.fontSize);
  const fontWeight = lookup(FONT_WEIGHTS, s.fontWeight);
  const lineHeight = lookup(LINE_HEIGHTS, s.lineHeight);
  const letterSpacing = lookup(LETTER_SPACINGS, s.letterSpacing);
  const textTransform = lookup(TEXT_TRANSFORMS, s.textTransform);
  const opacity = lookup(OPACITY_OPTIONS, s.opacity);
  const borderRadius = lookup(BORDER_RADII, s.borderRadius);
  const borderWidth = lookup(BORDER_WIDTHS, s.borderWidth);
  const shadow = lookup(SHADOW_STYLES, s.shadow);
  const padding = lookup(PADDING_OPTIONS, s.padding);
  const sectionGap = lookup(GAP_OPTIONS, s.sectionGap);
  const elementGap = lookup(GAP_OPTIONS, s.elementGap);
  const contentWidth = lookup(CONTENT_WIDTHS, s.contentWidth);
  const alignment = lookup(ALIGNMENTS, s.alignment);

  const hasEffect = (id) => (s.effects || []).includes(id);

  return (
    <div
      className={`design-frame-wrapper${dragging ? ' dragging' : ''}`}
      style={framePos ? { left: framePos.x + 'px', top: framePos.y + 'px' } : {}}
    >
      <div className="frame-chrome">
        <span className="frame-bp-label">{bp.label}</span>
        <span className="frame-bp-size">{bp.width}px</span>
        <div className="frame-bp-pills">
          {Object.entries(BREAKPOINTS).map(([key, val]) => (
            <span key={key} className={`frame-pill${key === breakpoint ? ' active' : ''}`}>
              {val.shortcut}
            </span>
          ))}
        </div>
      </div>

      <div
        className="design-frame"
        style={{
          width: bp.width + 'px',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          fontFamily: s.font?.family || "'Inter', sans-serif",
          fontSize: fontSize.value,
          fontWeight: fontWeight.value,
          lineHeight: lineHeight.value,
          letterSpacing: letterSpacing.value,
          textTransform: textTransform.value,
          opacity: opacity.value,
          borderRadius: borderRadius.value,
          borderWidth: borderWidth.value,
          borderStyle: borderWidth.id !== 'none' ? 'solid' : 'none',
          boxShadow: shadow.value,
        }}
      >
        <FrameContent
          colorScheme={s.colorScheme && s.colorScheme.bg ? s.colorScheme : COLOR_SCHEMES[0]}
          effects={s.effects || []}
          heroLayout={s.heroLayout || 'side-by-side'}
          padding={padding}
          sectionGap={sectionGap}
          elementGap={elementGap}
          contentWidth={contentWidth}
          alignment={alignment}
          borderRadius={borderRadius}
          hasEffect={hasEffect}
          selectedComponent={selectedComponent}
          onSelectComponent={onSelectComponent}
          componentStyles={componentStyles}
        />
      </div>
    </div>
  );
}

function compStyle(componentStyles, id) {
  const raw = componentStyles?.[id] || {};
  return resolveOverridesToCss(raw);
}

function FrameContent({
  colorScheme, effects, heroLayout, padding, sectionGap, elementGap,
  contentWidth, alignment, borderRadius, hasEffect,
  selectedComponent, onSelectComponent, componentStyles,
}) {
  const cs = colorScheme;
  const glass = hasEffect('liquid-glass');
  const hasShadow = hasEffect('drop-shadow');
  const hasBlur = hasEffect('layer-blur');
  const hasGlow = hasEffect('glow');
  const hasGrain = hasEffect('grain');
  const hasGradBorder = hasEffect('gradient-border');

  const sel = (id) => selectedComponent === id ? ' comp-selected' : '';
  const click = (id) => (e) => { e.stopPropagation(); onSelectComponent(id); };
  const cs2 = (id) => compStyle(componentStyles, id);

  const isStacked = heroLayout === 'stacked';
  const isCentered = heroLayout === 'centered';

  return (
    <div
      className={`fc-page${hasGrain ? ' fc-grain' : ''}`}
      style={{ background: cs.bg, color: cs.text, padding: padding.value }}
      onClick={() => onSelectComponent(null)}
    >
      {/* Nav */}
      <nav
        className={`fc-nav${sel('nav')}`}
        onClick={click('nav')}
        style={{
          ...(glass ? {
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            borderBottom: '1px solid rgba(255,255,255,0.35)',
            borderRadius: borderRadius.value,
          } : {}),
          ...cs2('nav'),
        }}
      >
        <div className="fc-nav-logo" style={cs2('nav-logo')}>tactile</div>
        <div className="fc-nav-links">
          <span>Examples</span>
          <span>Docs</span>
          <span>Pricing</span>
        </div>
        <div className="fc-nav-actions">
          <button className="fc-btn-outline" style={{ borderColor: cs.text, borderRadius: borderRadius.value, ...cs2('btn-signin') }}>
            Sign In
          </button>
          <button
            className={`fc-btn-primary${sel('btn-cta-nav')}`}
            onClick={click('btn-cta-nav')}
            style={{
              background: cs.primary, color: cs.accent,
              borderRadius: borderRadius.value,
              ...(hasShadow ? { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' } : {}),
              ...(hasGlow ? { boxShadow: `0 0 20px ${cs.primary}66` } : {}),
              ...cs2('btn-cta-nav'),
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div
        className={`fc-hero${sel('hero')}`}
        onClick={click('hero')}
        style={{
          flexDirection: isStacked || isCentered ? 'column' : 'row',
          alignItems: isCentered ? 'center' : 'center',
          textAlign: isCentered ? 'center' : 'left',
          gap: sectionGap.value,
          maxWidth: contentWidth.value,
          margin: '0 auto',
          justifyContent: alignment.value,
          ...cs2('hero'),
        }}
      >
        <div className="fc-hero-left" style={isCentered ? { maxWidth: '600px', alignItems: 'center' } : {}}>
          <h1
            className={`fc-heading${sel('heading')}`}
            onClick={click('heading')}
            style={cs2('heading')}
          >
            Give your design{' '}
            <span style={{ color: cs.primary }}> soul</span>
          </h1>
          <p
            className={`fc-body${sel('body')}`}
            onClick={click('body')}
            style={cs2('body')}
          >
            Transform your ideas into meaningful products without technical barriers.
            Describe your vision with human words like &ldquo;warm&rdquo; or &ldquo;approachable&rdquo;
            &mdash; we&rsquo;ll create soulful interfaces that feel intentional, not cheap.
          </p>
          <div className="fc-cta-row" style={{ gap: elementGap.value, ...(isCentered ? { justifyContent: 'center' } : {}) }}>
            <button
              className={`fc-btn-primary fc-btn-lg${sel('btn-cta')}`}
              onClick={click('btn-cta')}
              style={{
                background: cs.primary, color: '#fff',
                borderRadius: borderRadius.value,
                ...(hasShadow ? { boxShadow: '0 6px 24px rgba(0,0,0,0.15)' } : {}),
                ...(hasGlow ? { boxShadow: `0 0 28px ${cs.primary}55` } : {}),
                ...(hasGradBorder ? {
                  border: '2px solid transparent',
                  backgroundImage: `linear-gradient(${cs.bg}, ${cs.bg}), linear-gradient(135deg, ${cs.primary}, ${cs.accent})`,
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                } : {}),
                ...cs2('btn-cta'),
              }}
            >
              Start Building with Tactile
            </button>
            <div className="fc-social-proof">
              <div className="fc-avatar-stack">
                <div className="fc-avatar" style={{ background: cs.primary, opacity: 0.7, borderRadius: borderRadius.value === '0' ? '4px' : '50%' }} />
                <div className="fc-avatar" style={{ background: cs.primary, opacity: 0.5, borderRadius: borderRadius.value === '0' ? '4px' : '50%' }} />
                <div className="fc-avatar" style={{ background: cs.primary, opacity: 0.3, borderRadius: borderRadius.value === '0' ? '4px' : '50%' }} />
              </div>
              <span className="fc-social-text">Design meets impact</span>
            </div>
          </div>
        </div>

        {!isCentered && (
          <div className="fc-hero-right" style={isStacked ? { width: '100%', maxWidth: '500px', margin: '0 auto' } : {}}>
            <div
              className={`fc-mockup${sel('mockup')}`}
              onClick={click('mockup')}
              style={{
                background: hasBlur
                  ? 'rgba(255,255,255,0.15)'
                  : `linear-gradient(135deg, ${cs.primary}33 0%, ${cs.primary}11 100%)`,
                border: `1px solid ${cs.primary}22`,
                borderRadius: borderRadius.value === '0' ? '0' : '20px',
                ...(hasShadow ? { boxShadow: '0 24px 60px rgba(0,0,0,0.12)' } : {}),
                ...(hasBlur ? { backdropFilter: 'blur(40px)' } : {}),
                ...(hasGlow ? { boxShadow: `0 0 40px ${cs.primary}33` } : {}),
                ...cs2('mockup'),
              }}
            >
              <div className="fc-mockup-inner">
                <div className="fc-mockup-bar">
                  <div className="fc-dot" /><div className="fc-dot" /><div className="fc-dot" />
                </div>
                <div className="fc-mockup-content">
                  <div className="fc-mock-block fc-mock-block-lg" style={{ background: cs.primary + '22', borderRadius: borderRadius.value === '0' ? '0' : '8px' }} />
                  <div className="fc-mock-block fc-mock-block-sm" style={{ background: cs.primary + '18', borderRadius: borderRadius.value === '0' ? '0' : '8px' }} />
                  <div className="fc-mock-block fc-mock-block-md" style={{ background: cs.primary + '14', borderRadius: borderRadius.value === '0' ? '0' : '8px' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Cards */}
      <div
        className="fc-features"
        style={{ gap: sectionGap.value, maxWidth: contentWidth.value, margin: '0 auto' }}
      >
        {[
          { id: 'card-0', title: 'Gesture Control', desc: 'Navigate designs with natural hand movements', icon: '[~]' },
          { id: 'card-1', title: 'Live Preview', desc: 'See changes instantly across breakpoints', icon: '</>' },
          { id: 'card-2', title: 'Figma Sync', desc: 'Push designs directly to your Figma workspace', icon: '{*}' },
        ].map((f) => (
          <div
            key={f.id}
            className={`fc-feature-card${sel(f.id)}`}
            onClick={click(f.id)}
            style={{
              background: glass ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
              backdropFilter: glass ? 'blur(16px)' : 'none',
              border: glass
                ? '1px solid rgba(255,255,255,0.35)'
                : `1px solid ${cs.primary}18`,
              borderRadius: borderRadius.value === '0' ? '0' : '12px',
              ...(hasShadow ? { boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } : {}),
              ...(hasGlow ? { boxShadow: `0 0 16px ${cs.primary}22` } : {}),
              ...cs2(f.id),
            }}
          >
            <div
              className="fc-feature-icon"
              style={{
                background: cs.primary + '22', color: cs.accent,
                borderRadius: borderRadius.value === '0' ? '0' : '8px',
              }}
            >
              {f.icon}
            </div>
            <h3 className="fc-feature-title">{f.title}</h3>
            <p className="fc-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
