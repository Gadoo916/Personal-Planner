import { useState } from 'react'
import type { TaskDayGroup } from '../domain/model'
import { isPastDay } from '../lib/relativeTime'
import type { Task } from '../storage/types'
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  IconCheck,
  IconEdit,
  IconRepeat,
  IconTrash,
  PriorityBadge,
} from './ui'

interface TaskListProps {
  groups: TaskDayGroup[]
  ready: boolean
  editingId: string | null
  now: Date
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

export function TaskList({
  groups,
  ready,
  editingId,
  now,
  onToggle,
  onEdit,
  onDelete,
}: TaskListProps) {
  if (ready && groups.length === 0) {
    return <EmptyState title="No tasks yet" body="Add your first task to start planning the day." />
  }

  return (
    <>
      {groups.map((group) => (
        <section
          className={`task-group${group.isToday ? ' task-group--today' : ''}`}
          key={group.key}
        >
          <div className="task-group__header">
            <h3 className="task-group__day">{group.label}</h3>
            <span className="task-group__date">{group.dateLabel}</span>
          </div>
          <ul className="task-group__list">
            {group.tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                now={now}
                editing={editingId === task.id}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

interface TaskItemProps {
  task: Task
  now: Date
  editing: boolean
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

function TaskItem({ task, now, editing, onToggle, onEdit, onDelete }: TaskItemProps) {
  const [confirming, setConfirming] = useState(false)
  const overdue = !task.done && isPastDay(task.date, now)

  const classes = [
    'task-item',
    task.done ? 'task-item--completed' : '',
    editing ? 'task-item--editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={classes}>
      <button
        type="button"
        className={`completion-toggle${task.done ? ' completion-toggle--done' : ''}`}
        aria-pressed={task.done}
        aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onClick={() => onToggle(task.id)}
      >
        <IconCheck />
      </button>

      <div className="task-item__body">
        <span className="task-item__title">{task.title}</span>
        <div className="task-item__meta">
          <PriorityBadge priority={task.priority} />
          {task.repeat !== 'none' ? (
            <Badge>
              <IconRepeat />
              {task.repeat === 'daily' ? 'Daily' : 'Weekly'}
            </Badge>
          ) : null}
          {overdue ? <Badge tone="error">Overdue</Badge> : null}
        </div>
      </div>

      <div className="task-item__actions">
        {confirming ? (
          <span className="confirm-row">
            Delete?
            <Button variant="text" onClick={() => onDelete(task.id)}>
              Yes
            </Button>
            <Button variant="text" onClick={() => setConfirming(false)}>
              No
            </Button>
          </span>
        ) : (
          <>
            <IconButton label={`Edit "${task.title}"`} onClick={() => onEdit(task)}>
              <IconEdit />
            </IconButton>
            <IconButton
              label={`Delete "${task.title}"`}
              tone="danger"
              onClick={() => setConfirming(true)}
            >
              <IconTrash />
            </IconButton>
          </>
        )}
      </div>
    </li>
  )
}
