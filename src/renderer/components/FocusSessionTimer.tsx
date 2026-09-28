import { useState } from 'react'
import {
  canStepManualBreak,
  canStepSession,
  DEFAULT_MANUAL_BREAK_MINUTES,
  FOCUS_SESSION_GIFS,
  focusBlockCount,
  formatClock,
  formatDuration,
  getFocusSessionGif,
  HOUR_STEP_MINUTES,
  LONG_BREAK_CHOICES,
  MINUTE_STEP_MINUTES,
  phaseLabel,
  planProgress,
  remainingFocusMinutes,
  SHORT_BREAK_CHOICES,
  sessionLength,
  stepManualBreak,
  stepSession,
} from '../domain/focusSession'
import type { FocusSession } from '../hooks/useFocusSession'
import {
  Button,
  IconButton,
  IconPause,
  IconPlay,
  IconReset,
  IconSkip,
  PillGroup,
  type PillOption,
  Wheel,
} from './ui'

const SHORT_BREAK_OPTIONS: readonly PillOption<number>[] = SHORT_BREAK_CHOICES.map((minutes) => ({
  value: minutes,
  label: `${minutes}m`,
}))

const LONG_BREAK_OPTIONS: readonly PillOption<number>[] = LONG_BREAK_CHOICES.map((minutes) => ({
  value: minutes,
  label: `${minutes}m`,
}))

const BREAKS_OPTIONS: readonly PillOption<boolean>[] = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
]

interface FocusSessionTimerProps {
  /**
   * The clock, owned by `App` rather than by this panel. A session outlives the
   * view it was started in, so the state that describes it cannot be scoped to
   * the face that draws it: switching to Home and back must not stop the clock.
   */
  timer: FocusSession
}

/**
 * One study session, planned up front. Nothing is counted until the user asks
 * for it: the panel opens on a single Focus button, Focus opens the setup, and
 * Start puts the running clock in the middle of the panel.
 */
export function FocusSessionTimer({ timer }: FocusSessionTimerProps) {
  // `finished` wins over the view it was reached from, so the complete face is
  // the one thing an ended session can show.
  const face = timer.finished ? 'complete' : timer.view

  return (
    <section
      className={`focus-session focus-session--${face}`}
      aria-labelledby="focus-session-heading"
    >
      {timer.view === 'setup' ? (
        <SetupPanel timer={timer} />
      ) : timer.view === 'breakSetup' ? (
        <BreakSetupPanel timer={timer} />
      ) : timer.finished ? (
        <CompletePanel timer={timer} />
      ) : timer.view === 'session' ? (
        <SessionPanel timer={timer} />
      ) : (
        <IdlePanel timer={timer} />
      )}
    </section>
  )
}

/**
 * The one way in. Three lines, stacked in the panel's own column: the title, the
 * idle animation, and the button under them. No bar, because there is no action
 * to push to the far side, and nothing pretending to be running.
 */
function IdlePanel({ timer }: { timer: FocusSession }) {
  return (
    <>
      <h2 id="focus-session-heading" className="focus-session__title">
        Focus Session
      </h2>
      <img
        src={FOCUS_SESSION_GIFS.idle}
        alt="Idle cat animation"
        className="focus-session__animation"
      />
      <Button onClick={timer.openSetup}>
        <IconPlay />
        Focus
      </Button>
    </>
  )
}

/**
 * The setup: the three numbers a session is made of, then Start. Centred in the
 * middle of the panel, and the only face that has no clock on it.
 */
function SetupPanel({ timer }: { timer: FocusSession }) {
  const length = sessionLength(timer.focusMinutes)

  return (
    <>
      <div className="focus-session__bar">
        <h2 id="focus-session-heading" className="focus-session__title">
          Focus Session
        </h2>
        <Button variant="text" onClick={timer.closeSetup}>
          Cancel
        </Button>
      </div>

      <fieldset className="focus-session__setup">
        <legend className="focus-session__setup-title">Setup</legend>

        <div className="focus-session__setup-lengths">
          <Wheel
            label="Hours"
            value={length.hours}
            decreaseLabel="Take off an hour"
            increaseLabel="Add an hour"
            canDecrease={canStepSession(timer.focusMinutes, -HOUR_STEP_MINUTES)}
            canIncrease={canStepSession(timer.focusMinutes, HOUR_STEP_MINUTES)}
            onStep={(delta) =>
              timer.setFocusMinutes(stepSession(timer.focusMinutes, delta * HOUR_STEP_MINUTES))
            }
          />
          <Wheel
            label="Minutes"
            value={length.minutes}
            decreaseLabel="Take off five minutes"
            increaseLabel="Add five minutes"
            canDecrease={canStepSession(timer.focusMinutes, -MINUTE_STEP_MINUTES)}
            canIncrease={canStepSession(timer.focusMinutes, MINUTE_STEP_MINUTES)}
            onStep={(delta) =>
              timer.setFocusMinutes(stepSession(timer.focusMinutes, delta * MINUTE_STEP_MINUTES))
            }
          />
        </div>

        <div className="focus-session__row">
          <span className="focus-session__row-label">Breaks</span>
          <PillGroup
            label="Breaks"
            value={timer.plan.breaks}
            options={BREAKS_OPTIONS}
            onChange={timer.setBreaks}
          />
        </div>

        {/* Removed from the tree, not hidden: a length that has no effect must
            not be something a screen reader walks. Turning Breaks back on
            restores the same plan object, so the two lengths are remembered. */}
        {timer.plan.breaks ? (
          <>
            <div className="focus-session__row">
              <span className="focus-session__row-label">Short break</span>
              <PillGroup
                label="Short break length"
                value={timer.plan.shortBreakMinutes}
                options={SHORT_BREAK_OPTIONS}
                onChange={timer.setShortBreak}
              />
            </div>

            <div className="focus-session__row">
              <span className="focus-session__row-label">Long break</span>
              <PillGroup
                label="Long break length"
                value={timer.plan.longBreakMinutes}
                options={LONG_BREAK_OPTIONS}
                onChange={timer.setLongBreak}
              />
            </div>
          </>
        ) : null}

        <p className="focus-session__summary">
          {timer.plan.breaks
            ? `${timer.plan.focusBlocks} focus blocks · ${formatDuration(
                timer.plan.totalMinutes,
              )} with breaks`
            : `${formatDuration(timer.plan.focusMinutes)} focus session`}
        </p>

        <Button onClick={timer.start}>
          <IconPlay />
          Start
        </Button>
      </fieldset>
    </>
  )
}

/**
 * The manual break's own length. It lives in component state rather than in the
 * plan, because a break the user asked for on the spot is not part of the
 * session's shape: re-planning the session must not reset it.
 */
function BreakSetupPanel({ timer }: { timer: FocusSession }) {
  const [minutes, setMinutes] = useState(DEFAULT_MANUAL_BREAK_MINUTES)

  return (
    <>
      <div className="focus-session__bar">
        <h2 id="focus-session-heading" className="focus-session__title">
          Focus Session
        </h2>
        <Button variant="text" onClick={timer.closeSetup}>
          Cancel
        </Button>
      </div>

      <fieldset className="focus-session__setup">
        <legend className="focus-session__setup-title">Take a break</legend>

        {/* One column, because there is one number: a wheel with two columns
            would be asking about an hour nobody plans a break in. Five minute
            notches, like the session length, because this is a length and not a
            stopwatch. */}
        <div className="focus-session__setup-lengths">
          <Wheel
            label="Minutes"
            unit="min"
            value={minutes}
            decreaseLabel="Take off five minutes"
            increaseLabel="Add five minutes"
            canDecrease={canStepManualBreak(minutes, -1)}
            canIncrease={canStepManualBreak(minutes, 1)}
            onStep={(delta) => setMinutes((value) => stepManualBreak(value, delta))}
          />
        </div>

        <Button onClick={() => timer.startManualBreak(minutes)}>
          <IconPlay />
          Start Break
        </Button>
      </fieldset>
    </>
  )
}

/**
 * The session is over, so this is a moment and not a state to work in: a heading,
 * the celebration, what the run was actually worth, and the single way past it.
 */
function CompletePanel({ timer }: { timer: FocusSession }) {
  const { focusSeconds, breakSeconds, pausedSeconds, focusBlocks } = timer.totals
  // One string, not three interpolations: the caption is read aloud as one
  // phrase, and it is matched as one in the tests.
  const blocksRead = `${focusBlocks} ${focusBlocks === 1 ? 'focus block' : 'focus blocks'} completed`

  return (
    <>
      <h2 id="focus-session-heading" className="focus-session__title">
        Session complete
      </h2>
      <img
        src={FOCUS_SESSION_GIFS.complete}
        alt="Session complete celebration animation"
        className="focus-session__animation"
      />
      {/*
        One card, not three: a session is read as "I focused for two hours,
        stopped for twenty, and paused for a bit", so the three figures sit side
        by side inside a single outlined block. A <dl> is the honest element for
        a figure and its label, and styling it by element keeps this to one new
        class.

        Paused time is a figure of its own and is never added to Focused. A pause
        is the absence of work, and folding it in would report two hours of focus
        for a session that held a twenty minute break inside it.
      */}
      <dl className="focus-session__summary-card">
        <div>
          <dt>Focused</dt>
          <dd>{formatDuration(focusSeconds / 60)}</dd>
        </div>
        <div>
          <dt>On break</dt>
          <dd>{formatDuration(breakSeconds / 60)}</dd>
        </div>
        <div>
          <dt>Paused</dt>
          <dd>{formatDuration(pausedSeconds / 60)}</dd>
        </div>
      </dl>
      <p className="focus-session__summary">{blocksRead}</p>
      <Button onClick={timer.dismiss}>Done</Button>
    </>
  )
}

/** The running face: what is happening, how much is left, and the controls. */
function SessionPanel({ timer }: { timer: FocusSession }) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const {
    plan,
    index,
    remainingSeconds,
    manualBreak,
    manualBreakRemaining,
    paused,
    pausedSeconds,
  } = timer
  const block = plan.blocks[index]
  const elapsed = block ? block.minutes * 60 - remainingSeconds : 0
  const manualBreakPlannedSeconds = timer.manualBreakPlannedSeconds

  // A manual break borrows this face, so the ring and the clock show the break's
  // own time while the focus block is held exactly where it was. Spending the
  // focus clock to buy break time would mean finishing a two-hour session having
  // focused for an hour and three quarters.
  const secondsLeft = manualBreak ? manualBreakRemaining : remainingSeconds
  const progress = manualBreak
    ? manualBreakPlannedSeconds > 0
      ? 1 - manualBreakRemaining / manualBreakPlannedSeconds
      : 1
    : planProgress(plan, index, elapsed)
  const counter = focusBlockCount(plan, index)
  const gifSrc = manualBreak
    ? FOCUS_SESSION_GIFS.break
    : getFocusSessionGif({ view: 'session', phase: block?.phase, finished: false })
  const gifAlt =
    manualBreak || block?.phase === 'break' ? 'Break cat animation' : 'Focus cat animation'
  const phase = manualBreak ? 'Break' : block ? phaseLabel(block) : 'Focus'
  // The face borrows itself for a manual break, so the colour has to come from
  // the phase on screen. Reading `block` here would leave a manual break wearing
  // the focus colour while its clock counted down break minutes.
  const shownPhase = manualBreak ? 'break' : (block?.phase ?? 'focus')
  const caption = plan.breaks
    ? `Block ${counter.current} of ${counter.total} · ${formatDuration(
        remainingFocusMinutes(plan, index, elapsed),
      )} focus left · ${formatDuration(plan.totalMinutes)} total`
    : `${formatDuration(plan.focusMinutes)} focus session`

  return (
    <>
      <div className="focus-session__bar">
        <h2 id="focus-session-heading" className="focus-session__title">
          Focus Session
        </h2>
        <Button variant="text" onClick={timer.openSetup}>
          Change session
        </Button>
      </div>

      <div className="focus-session__centre">
        {/* No standalone animation on this face: the ring already carries one,
            and the same figure twice is two things to keep in step. */}
        <span className={`focus-session__phase focus-session__phase--${shownPhase}`}>{phase}</span>

        <div
          className="focus-session__ring"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          style={{ '--progress': Math.round(progress * 1000) / 1000 } as React.CSSProperties}
        >
          <svg
            className="focus-session__ring-svg"
            viewBox="0 0 176 176"
            aria-hidden="true"
            focusable="false"
          >
            <circle className="focus-session__ring-track" cx="88" cy="88" r="85" />
            <circle
              className={`focus-session__ring-arc focus-session__ring-arc--${shownPhase}`}
              cx="88"
              cy="88"
              r="85"
            />
          </svg>

          <div className="focus-session__ring-content">
            <img
              src={gifSrc}
              alt={gifAlt}
              className="focus-session__animation focus-session__animation--ring"
            />
            <span className="focus-session__clock">{formatClock(secondsLeft)}</span>
          </div>
        </div>

        {/*
          Glyphs only, so each control's name is its label and nothing on screen
          is repeated as text. Reset is the one destructive act on this face, so
          it asks first — in its own slot, without a dialog and without moving
          the two controls either side of it.

          Pause, Resume, and Skip stay live during a manual break: pausing and
          cutting short a break are both real acts, and a control that goes dead
          on the face you are looking at reads as a broken panel. The label is
          driven by `paused` rather than by `running`, because a break counts down
          with the focus clock beneath it deliberately held.
        */}
        <div className="focus-session__controls">
          <IconButton label={paused ? 'Resume session' : 'Pause session'} onClick={timer.toggle}>
            {paused ? <IconPlay /> : <IconPause />}
          </IconButton>
          <IconButton label="Skip this block" onClick={timer.skip}>
            <IconSkip />
          </IconButton>
          {confirmingReset ? (
            <span className="confirm-row">
              Reset?
              <Button
                variant="text"
                onClick={() => {
                  timer.reset()
                  setConfirmingReset(false)
                }}
              >
                Yes
              </Button>
              <Button variant="text" onClick={() => setConfirmingReset(false)}>
                No
              </Button>
            </span>
          ) : (
            <IconButton label="Reset the session" onClick={() => setConfirmingReset(true)}>
              <IconReset />
            </IconButton>
          )}
        </div>

        {/* Offered whether or not the plan scheduled breaks: turning the planned
            ones off is a statement about the schedule, not a promise never to
            stop. Labelled in full, because this one adds to the plan instead of
            steering the block already running. The face centres its own children,
            so the button needs no wrapper of its own. */}
        <Button variant="secondary" onClick={timer.takeBreak} disabled={manualBreak}>
          Take a Break
        </Button>

        {/* Counts up only while the clock is stopped, and only because someone
            deliberately stopped it. In the caption treatment, not the clock's
            display size: the ring is frozen and there is nothing to read there,
            and a second display-sized number would turn a caption into a second
            headline. Its own line above the caption, so a line about work is
            never also a line about not working. */}
        {paused ? (
          <p className="focus-session__summary">Paused for {formatClock(pausedSeconds)}</p>
        ) : null}

        <p className="focus-session__summary">{caption}</p>
      </div>
    </>
  )
}
