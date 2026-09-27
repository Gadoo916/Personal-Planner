import { useId, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import {
  formatDayDate,
  formatDayLabel,
  formatMonthYear,
  latestSelectableDate,
  monthMatrix,
  shiftMonth,
  todayISO,
  WEEKDAY_INITIALS,
} from '../lib/dates'
import { Button, IconButton, IconCalendar, IconChevronLeft, IconChevronRight } from './ui'

interface DatePickerProps {
  /** Matches the Field label, so the trigger is the labelled control. */
  id: string
  value: string
  onChange: (iso: string) => void
}

/**
 * The app's own date control: a trigger showing the chosen day, and a month grid
 * anchored under it. No native picker and no system chrome, so it reads as part
 * of Personal Planner rather than as the operating system.
 */
export function DatePicker({ id, value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(value)
  const container = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  useDismiss(open, container, () => setOpen(false))

  const today = todayISO()
  const { days } = monthMatrix(month, { max: latestSelectableDate() })

  function choose(iso: string) {
    onChange(iso)
    setMonth(iso)
    setOpen(false)
  }

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
        onClick={() => {
          setMonth(value)
          setOpen((was) => !was)
        }}
      >
        <IconCalendar />
        {formatDayLabel(value)}
      </button>

      {open ? (
        <div className="picker-popover" id={popoverId} role="dialog" aria-label="Choose a day">
          <div className="picker-popover__head">
            <IconButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
              <IconChevronLeft />
            </IconButton>
            <span className="picker-popover__title">{formatMonthYear(month)}</span>
            <IconButton label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
              <IconChevronRight />
            </IconButton>
          </div>

          <div className="picker-week" aria-hidden="true">
            {WEEKDAY_INITIALS.map((initial) => (
              <span key={initial} className="picker-week__day">
                {initial}
              </span>
            ))}
          </div>

          <div className="picker-grid">
            {days.map((day) => {
              const classes = [
                'picker-grid__day',
                day.inMonth ? '' : 'picker-grid__day--outside',
                day.isToday ? 'picker-grid__day--today' : '',
                day.iso === value ? 'picker-grid__day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={classes}
                  disabled={day.disabled}
                  aria-label={formatDayDate(day.iso)}
                  aria-pressed={day.iso === value}
                  onClick={() => choose(day.iso)}
                >
                  {day.day}
                </button>
              )
            })}
          </div>

          <div className="picker-popover__foot">
            <Button variant="text" onClick={() => choose(today)}>
              Today
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
