import { useId, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import {
  clockParts,
  formatClock,
  hour12,
  MINUTE_STEP,
  shiftClock,
  toggleMeridiem,
} from '../lib/dates'
import { IconClock, PillGroup, type PillOption, Stepper } from './ui'

interface TimePickerProps {
  /** Matches the Field label, so the trigger is the labelled control. */
  id: string
  value: string
  onChange: (time: string) => void
}

const MERIDIEM_OPTIONS: readonly PillOption<string>[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

/**
 * The app's own time control: a trigger showing the chosen time, and three
 * steppers under it. Stepping beats typing here because the value is always a
 * valid clock time, and a native time input would bring system chrome with it.
 */
export function TimePicker({ id, value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  useDismiss(open, container, () => setOpen(false))

  const { minute, meridiem } = clockParts(value)
  const classes = ['picker-trigger', open ? 'picker-trigger--open' : ''].filter(Boolean).join(' ')

  return (
    <div className="picker-anchor" ref={container}>
      <button
        type="button"
        id={id}
        className={classes}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        <IconClock />
        {formatClock(value)}
      </button>

      {open ? (
        <div
          className="picker-popover picker-popover--compact"
          id={popoverId}
          role="dialog"
          aria-label="Choose a time"
        >
          <Stepper
            label="Hour"
            rowClassName="picker-row"
            value={String(hour12(value))}
            decreaseLabel="Decrease hour"
            increaseLabel="Increase hour"
            onStep={(delta) => onChange(shiftClock(value, delta * 60))}
          />
          <Stepper
            label="Minute"
            rowClassName="picker-row"
            value={String(minute).padStart(2, '0')}
            decreaseLabel="Decrease minute"
            increaseLabel="Increase minute"
            onStep={(delta) => onChange(shiftClock(value, delta * MINUTE_STEP))}
          />
          <div className="picker-row">
            <span className="picker-row__label">AM or PM</span>
            <PillGroup
              label="AM or PM"
              value={meridiem}
              options={MERIDIEM_OPTIONS}
              onChange={(next) => {
                if (next !== meridiem) onChange(toggleMeridiem(value))
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
