import { BREAKPOINTS } from '../lib/components';

export default function TopBar({
  hudInfo,
  breakpoint,
  frameVisible,
  workflowId,
  pullBusy,
  pushBusy,
  onPullFromFigma,
  onPushToFigma,
}) {
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
        <div className="sync-controls">
          <button
            type="button"
            className="sync-btn"
            onClick={onPullFromFigma}
            disabled={pullBusy}
          >
            {pullBusy ? 'Pulling...' : 'Pull from Figma'}
          </button>
          <button
            type="button"
            className="sync-btn primary"
            onClick={onPushToFigma}
            disabled={pushBusy || !workflowId}
            title={!workflowId ? 'Pull first to create workflow session' : ''}
          >
            {pushBusy ? 'Pushing...' : 'Push to Figma'}
          </button>
        </div>
      </div>
    </div>
  );
}
