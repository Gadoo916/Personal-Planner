import { useId, useState } from 'react'
import type { ReminderDraft, TaskDraft } from '../domain/model'
import { defaultReminderTime, todayISO } from '../lib/dates'
import type { Priority, Reminder, Repeat, Task } from '../storage/types'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { Button, Field, IconClose, PillGroup, type PillOption } from './ui'

export type EditTarget = { kind: 'task'; item: Task } | { kind: 'reminder'; item: Reminder } | null

type Kind = 'task' | 'reminder'

interface AddFormProps {
  target: EditTarget
  /** The column the composer sits in decides what is being added. */
  kind: Kind
  onSubmitTask: (draft: TaskDraft) => void
  onSubmitReminder: (draft: ReminderDraft) => void
  onCancel: () => void
}

/** A choice group, not a dropdown: three plain words fit in a row, and the
 *  BEM modifier is what puts the priority's own colour on the active line. */
const PRIORITY_OPTIONS: readonly PillOption<Priority>[] = [
  { value: 'high', label: 'High', className: 'category-tab--high' },
  { value: 'medium', label: 'Medium', className: 'category-tab--medium' },
  { value: 'low', label: 'Low', className: 'category-tab--low' },
]

/** Repeat stays a native select: a closed set of three words that are never
 *  read at a glance, where the operating system's own control is lighter. */
const REPEAT_OPTIONS: readonly { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
]

/**
 * The inline composer, rendered inside the column it belongs to: no dialog, no
 * type tabs, and only the fields that kind of item actually has. Editing reuses
 * the same form so a field can never behave differently in the two modes.
 */
export function AddForm({
  target,
  kind: columnKind,
  onSubmitTask,
  onSubmitReminder,
  onCancel,
}: AddFormProps) {
  const fieldId = useId()
  const editing = target !== null
  const kind = target?.kind ?? columnKind
  const [title, setTitle] = useState(target?.item.title ?? '')
  const [date, setDate] = useState(target?.item.date ?? todayISO())
  const [time, setTime] = useState(
    target?.kind === 'reminder' ? target.item.time : defaultReminderTime(),
  )
  const [priority, setPriority] = useState<Priority>(
    target?.kind === 'task' ? target.item.priority : 'medium',
  )
  const [repeat, setRepeat] = useState<Repeat>(
    target?.kind === 'task' ? target.item.repeat : 'none',
  )
  const [error, setError] = useState<string | null>(null)

  const titleId = `${fieldId}-title`
  const dateId = `${fieldId}-date`
  const timeId = `${fieldId}-time`
  const repeatId = `${fieldId}-repeat`
  const label = `${editing ? 'Edit' : 'Add'} ${kind}`

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (cleanTitle === '') {
      setError('A title is required.')
      return
    }
    if (date === '') {
      setError('A date is required.')
      return
    }
    setError(null)

    if (kind === 'task') {
      onSubmitTask({ title: cleanTitle, date, priority, repeat })
    } else {
      if (time === '') {
        setError('A time is required.')
        return
      }
      onSubmitReminder({ title: cleanTitle, date, time })
    }

    setTitle('')
    setDate(todayISO())
    setTime(defaultReminderTime())
  }

  return (
    <form className="add-form" onSubmit={handleSubmit} aria-label={label}>
      <div className="add-form__fields">
        <Field label="Title" htmlFor={titleId} className="field--grow">
          <input
            id={titleId}
            className="text-input"
            type="text"
            value={title}
            maxLength={200}
            placeholder={kind === 'task' ? 'Read chapter 4' : 'Surgery exam'}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label={kind === 'task' ? 'Day' : 'Date'} htmlFor={dateId}>
          <DatePicker id={dateId} value={date} onChange={setDate} />
        </Field>

        {kind === 'task' ? (
          <>
            <Field label="Priority">
              <PillGroup
                label="Priority"
                value={priority}
                options={PRIORITY_OPTIONS}
                onChange={(next) => {
                  setPriority(next)
                  setError(null)
                }}
              />
            </Field>
            <Field label="Repeat" htmlFor={repeatId}>
              <select
                id={repeatId}
                className="select-input"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as Repeat)}
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Time" htmlFor={timeId}>
            <TimePicker id={timeId} value={time} onChange={setTime} />
          </Field>
        )}
      </div>

      <div className="add-form__actions">
        <Button type="submit">{editing ? 'Save changes' : 'Add'}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          <IconClose />
          Cancel
        </Button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  )
}
