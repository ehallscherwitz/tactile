import { BREAKPOINTS } from '../lib/components';

export default function StatusBar({ status, breakpoint, frameVisible }) {
  return (
    <div id="statusbar">
      <div className={`stat${status.cam ? ' live' : ''}`}>
        <div className={`dot${status.cam ? ' on' : ''}`} />
        <span>Camera</span>
      </div>
      <div className={`stat${status.mp ? ' live' : ''}`}>
        <div className={`dot${status.mp ? ' on' : ''}`} />
        <span>MediaPipe</span>
      </div>
      <div className={`stat${status.hand ? ' live' : ''}`}>
        <div className={`dot${status.hand ? ' on' : ''}`} />
        <span>Hand</span>
      </div>

      <div className="stat stat-push">
        {frameVisible ? (
          <>
            <div className="dot on" />
            <span>Frame: {BREAKPOINTS[breakpoint]?.label || breakpoint}</span>
          </>
        ) : (
          <span>No frame</span>
        )}
      </div>

      <div className="stat">
        <span className="stat-keys">
          <kbd>F</kbd> frame
          <kbd>1-4</kbd> size
          <kbd>E</kbd> edit
        </span>
      </div>
    </div>
  );
}
