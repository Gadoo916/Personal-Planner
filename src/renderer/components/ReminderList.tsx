import { useState } from 'react'
import { formatClock, formatDayDate } from '../lib/dates'
import { remainingTime } from '../lib/relativeTime'
import type { Reminder } from '../storage/types'
import { Button, EmptyState, IconButton, IconEdit, IconTrash } from './ui'

interface ReminderListProps {
  reminders: Reminder[]
  ready: boolean
  editingId: string | null
  now: Date
  onEdit: (reminder: Reminder) => void
  onDelete: (id: string) => void
}

export function ReminderList({
  reminders,
  ready,
  editingId,
  now,
  onEdit,
  onDelete,
}: ReminderListProps) {
  if (ready && reminders.length === 0) {
    return (
      <EmptyState title="No reminders yet" body="Add a reminder and see how much time is left." />
    )
  }

  return (
    <ul className="reminder-list">
      {reminders.map((reminder) => (
        <ReminderCard
          key={reminder.id}
          reminder={reminder}
          now={now}
          editing={editingId === reminder.id}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}

interface ReminderCardProps {
  reminder: Reminder
  now: Date
  editing: boolean
  onEdit: (reminder: Reminder) => void
  onDelete: (id: string) => void
}

function ReminderCard({ reminder, now, editing, onEdit, onDelete }: ReminderCardProps) {
  const [confirming, setConfirming] = useState(false)
  const remaining = remainingTime(reminder.date, reminder.time, now)

  const classes = [
    'reminder-card',
    remaining.overdue ? 'reminder-card--overdue' : '',
    editing ? 'task-item--editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={classes}>
      <div className="reminder-card__head">
        <span className="reminder-card__title">{reminder.title}</span>
        <div className="reminder-card__actions">
          {confirming ? (
            <span className="confirm-row">
              Delete?
              <Button variant="text" onClick={() => onDelete(reminder.id)}>
                Yes
              </Button>
              <Button variant="text" onClick={() => setConfirming(false)}>
                No
              </Button>
            </span>
          ) : (
            <>
              <IconButton label={`Edit "${reminder.title}"`} onClick={() => onEdit(reminder)}>
                <IconEdit />
              </IconButton>
              <IconButton
                label={`Delete "${reminder.title}"`}
                tone="danger"
                onClick={() => setConfirming(true)}
              >
                <IconTrash />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <div className="reminder-card__meta">
        <span>
          {formatDayDate(reminder.date)} · {formatClock(reminder.time)}
        </span>
        <span className="remaining-time">{remaining.text}</span>
      </div>
    </li>
  )
}
