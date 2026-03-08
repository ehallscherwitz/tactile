# Tactile

---

## Inspiration
The tools that shape how a product *feels* have always required years of design training to use well. We wanted to close that gap, giving anyone with vision the ability to translate instinct into a real design system.

## Research
*We looked at what designers & aspiring designers actually care about — and what they wish existed.*

* What's existing & inspo: Went deep on Figma Makeathon submissions — understood what had been built and where the ceiling was.
* Scrolled X to hear how designers actually talk: what frustrates them, what they repost, what makes them stop.
* We weren't just looking for cool & interesting. We were looking for what's useful.
* Found the same tension everywhere: accessible tools feel dumbed down, serious tools shut non-designers out.
* That gap became our target — something a non-designer picks up in 60 seconds, that a designer still respects.

## Ideation
*We didn't start with features. We started with what already resonated.*

* Coming up with solutions: Used FigJam to map out makeathon submissions we genuinely liked — what made them stick.
* Asked: what worked across both audiences? What could a non-designer use and a designer still respect?
* Patterns emerged — the best submissions had a strong point of view, not just clever tech.
* That became our filter: every idea had to have soul before it had a feature list.
* Brand identity, gestures, feeling-based language — all came from chasing that same quality we saw in the work we admired.

## Rapid Prototyping
*Build fast. Break things. Decide early.*

* Creating fast & failing fast: Started in Figma — lo-fi screens, rough layouts, just enough to see if an idea held up.
* Fed those frames directly into Claude and Cursor as context for building.
* Each iteration informed the next — design decisions made in Figma showed up as real code within hours.
* Failing fast meant we could solidify features early before getting locked into the wrong direction.
* The loop was: sketch in Figma -> build in Claude + Cursor -> break it -> go back to Figma.

## Iteration
*Every version taught us something the last one couldn't.*

* Lo-fi screens showed us layout before we got attached to aesthetics.
* Cursor and Claude helped us move from concept to working code in hours, not days.
* The gesture map went through four complete rewrites — open palm, finger counting, then finally distinct shapes.
* We kept asking: does this feel like Tactile, or does it feel like a tool?

## What It Does
**Tactile** turns hand movement into direct design control and keeps everything synced with Figma in real time.

### The Core Workflow
1. Pull from Figma Context
   * Tactile reads the current Figma page/snapshot and generates an editable frame based on existing typography, color, and structure.
2. Manipulate in Real Time with Gestures
   * The camera tracks hands at ~60fps. Users can move, resize, and style the frame live inside Tactile.
3. Push Back as a Derived Figma Frame
   * The final frontend state is treated as the source of truth, reconciled to the design context, and sent back to Figma as a new derived frame.

---

## Control Systems

### Hand Gestures
* Point: Cursor mode; hover/select.
* Pinch: Click/select.
* Peace: Scroll mode in style editor.
* Thumbs up: Toggle style editor (short hold).
* Open palm: Drag frame when hand is over it.
* Rock / Horns: Hold to delete frame.
* Two palms: Create/pull frame.
* Two peace signs: Resize by hand spread (see breakpoints below).

Breakpoints (Two Peace Signs):
* Small -> Mobile (375px)
* Medium -> Tablet (768px)
* Large -> Laptop (1024px)
* Widest -> Desktop (1440px)

### Keyboard + Mouse Fallback
* F: Create frame
* 1-4: Breakpoints
* E: Style editor
* Esc: Close editor
* Delete/Backspace: Delete frame
* Mouse: Supports click, wheel scroll, and frame drag for non-camera fallback.

---

## Challenges We Ran Into
Gesture recognition at this fidelity required distinguishing intentional input from ambient hand movement with very low latency. Calibrating detection thresholds to feel responsive without being noisy was the most technically demanding part of the build.

## What We Learned
The measure of a good interface is how quickly it disappears. When the tool no longer demands attention, the user can focus entirely on the work. Achieving that required more iteration on feel than on functionality.

## What's Next
**Natural language input.** The ability to describe a desired aesthetic in plain terms and have Tactile generate a complete design language from it. Gesture handles the spatial layer; language handles the rest.

---

## Tech Stack
* State + Reliability Layer: FastAPI + MongoDB stores card/frame state, gesture events, plugin session context, page snapshots, and patch history.
* Realtime Sync Protocol: WebSocket bridge for realtime sync with Figma.
* Pull/Push Workflow Contract:
  * Pull-from-Figma reads latest page snapshot and creates a frontend-editable generated frame.
  * Push-to-Figma takes frontend final state as source of truth and creates a new derived frame in Figma.
* AI + Deterministic Hybrid: Style extraction from snapshot gives reliable defaults; LangChain/Groq layer generates/reconciles content and structure.
