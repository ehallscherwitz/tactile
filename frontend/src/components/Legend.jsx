export default function Legend() {
  return (
    <div id="legend">
      <div className="leg-head">Gesture Key</div>
      <div className="leg-sub">All signs work with either hand</div>

      <div className="leg-sec">Frame</div>
      <div className="leg-row">
        <span className="leg-em leg-em-double">✋✋</span>
        <div className="leg-info">
          <span className="leg-name">Create</span>
          <span className="leg-txt">Both palms open, hold briefly</span>
        </div>
      </div>
      <div className="leg-row">
        <span className="leg-em leg-em-double">✌️✌️</span>
        <div className="leg-info">
          <span className="leg-name">Resize</span>
          <span className="leg-txt">Both peace signs, spread apart</span>
        </div>
      </div>
      <div className="leg-row">
        <span className="leg-em">🤘</span>
        <div className="leg-info">
          <span className="leg-name">Delete</span>
          <span className="leg-txt">Rock sign, hold briefly to delete</span>
        </div>
      </div>

      <div className="leg-sec">Point &amp; Click</div>
      <div className="leg-row">
        <span className="leg-em">☝️</span>
        <div className="leg-info">
          <span className="leg-name">Point</span>
          <span className="leg-txt">Index finger, cursor follows</span>
        </div>
      </div>
      <div className="leg-row">
        <span className="leg-em">👌</span>
        <div className="leg-info">
          <span className="leg-name">Click</span>
          <span className="leg-txt">Pinch to select</span>
        </div>
      </div>
      <div className="leg-row">
        <span className="leg-em">✌️</span>
        <div className="leg-info">
          <span className="leg-name">Scroll</span>
          <span className="leg-txt">Peace sign, move to scroll</span>
        </div>
      </div>

      <div className="leg-sec">Edit</div>
      <div className="leg-row">
        <span className="leg-em">✋</span>
        <div className="leg-info">
          <span className="leg-name">Grab &amp; Drag</span>
          <span className="leg-txt">Open palm over frame, move to drag</span>
        </div>
      </div>
      <div className="leg-row">
        <span className="leg-em">👍</span>
        <div className="leg-info">
          <span className="leg-name">Style Editor</span>
          <span className="leg-txt">Thumbs up to toggle</span>
        </div>
      </div>

      <div className="leg-sec">Keyboard</div>
      <div className="leg-keys">
        <span><kbd>F</kbd> Create frame</span>
        <span><kbd>1-4</kbd> Breakpoints</span>
        <span><kbd>E</kbd> Style editor</span>
        <span><kbd>Esc</kbd> Close panel</span>
        <span><kbd>Del</kbd> Delete frame</span>
        <span><kbd>Click+Drag</kbd> Move frame</span>
      </div>
    </div>
  );
}
