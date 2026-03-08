import { BREAKPOINTS } from '../lib/components';

export default function TopBar({ hudInfo, breakpoint, frameVisible }) {
  const bp = BREAKPOINTS[breakpoint];

  return (
    <div id="topbar">
      <div className="logo">tactile</div>
      <div id="hud">
        <span id="hud-text" className={hudInfo.active ? 'active' : ''}>
          {hudInfo.text}
        </span>
      </div>
      <div className="topright">
        {frameVisible && bp && (
          <div className="bp-indicator">
            <span className="bp-dot" />
            <span className="bp-label">{bp.label} {bp.width}px</span>
          </div>
        )}
        <div className="mode-tag">
          {frameVisible ? 'FRAME ACTIVE' : 'WAITING'}
        </div>
      </div>
    </div>
  );
}
