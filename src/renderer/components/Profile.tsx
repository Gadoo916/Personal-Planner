import { useState } from 'react'
import { formatDuration } from '../domain/focusSession'
import {
  adaptiveComparison,
  type FocusIntensity,
  focusIntensity,
  growthPresentation,
  profileStats,
  tasksCompletedOnDay,
} from '../domain/productivity'
import type { Planner } from '../hooks/usePlanner'
import { addDaysISO, formatDayDate, todayISO } from '../lib/dates'
import type { Task } from '../storage/types'
import { Button, Field } from './ui'

interface ProfileProps {
  planner: Planner
}

const INTENSITY_LABEL: Record<FocusIntensity, string> = {
  empty: 'No focus',
  light: 'Light focus',
  medium: 'Medium focus',
  strong: 'Strong focus',
}

/**
 * The Profile page: the user's name, their streak, and the productivity record
 * the Focus Sessions and task completions have built. It reads only the stored
 * document, so every figure survives a restart.
 */
export function Profile({ planner }: ProfileProps) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(planner.profile?.name ?? '')
  const now = new Date()
  const today = todayISO(now)

  const stats = profileStats(planner.tasks, planner.productivity, now)
  const comparison = adaptiveComparison(planner.productivity, now)
  const growth = growthPresentation(comparison)

  const days = buildCalendarDays(planner.productivity, planner.tasks, today)

  function saveName() {
    const clean = name.trim()
    if (clean !== '') {
      planner.saveProfile(clean)
    }
    setEditingName(false)
  }

  return (
    <div className="profile">
      <h2 className="profile__title">Profile</h2>

      <div className="profile__header">
        {editingName ? (
          <div className="profile__name-edit">
            <Field label="Your name" htmlFor="profile-name">
              <input
                id="profile-name"
                className="text-input"
                type="text"
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Button onClick={saveName}>Save</Button>
          </div>
        ) : (
          <div className="profile__name-row">
            <span className="profile__name">{planner.profile?.name ?? 'User'}</span>
            <Button variant="text" onClick={() => setEditingName(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      <div className="profile__streak">
        <div className="profile__streak-item">
          <span className="profile__streak-value">{stats.currentStreak}</span>
          <span className="profile__streak-label">Current Streak</span>
        </div>
        <div className="profile__streak-item">
          <span className="profile__streak-value">{stats.longestStreak}</span>
          <span className="profile__streak-label">Longest Streak</span>
        </div>
      </div>

      <div className="profile__stats">
        <div className="profile__stat">
          <span className="profile__stat-value">{formatDuration(stats.todayFocusMinutes)}</span>
          <span className="profile__stat-label">Today Focus</span>
        </div>
        <div className="profile__stat">
          <span className="profile__stat-value">{formatDuration(stats.totalFocusMinutes)}</span>
          <span className="profile__stat-label">Total Focus</span>
        </div>
        <div className="profile__stat">
          <span className="profile__stat-value">{stats.totalTasksCompleted}</span>
          <span className="profile__stat-label">Tasks Completed</span>
        </div>
        <div className="profile__stat">
          <span className="profile__stat-value">{formatDuration(stats.averageFocusMinutes)}</span>
          <span className="profile__stat-label">Average Focus</span>
        </div>
      </div>

      {growth ? (
        <div className="profile__comparison">
          <p className="profile__comparison-text">{growth.text}</p>
          <p className="profile__comparison-detail">{growth.detail}</p>
        </div>
      ) : (
        <div className="profile__comparison">
          <p className="profile__comparison-text">Building your baseline</p>
          <p className="profile__comparison-detail">
            Complete a Focus Session to start tracking your progress.
          </p>
        </div>
      )}

      <div className="profile__calendar">
        <h3 className="profile__calendar-title">Productivity Calendar</h3>
        <div className="profile__calendar-grid">
          {days.map((day) => (
            <div
              key={day.iso}
              className={`profile__calendar-day profile__calendar-day--${focusIntensity(day.focusMinutes)}`}
              title={`${formatDayDate(day.iso)}: ${INTENSITY_LABEL[focusIntensity(day.focusMinutes)]}${day.tasksCompleted > 0 ? `, ${day.tasksCompleted} task${day.tasksCompleted === 1 ? '' : 's'} completed` : ''}`}
            >
              <span className="profile__calendar-date">{formatDayDate(day.iso)}</span>
              <span className="profile__calendar-focus">{formatDuration(day.focusMinutes)}</span>
              {day.tasksCompleted > 0 && (
                <span className="profile__calendar-tasks">{day.tasksCompleted}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface CalendarDay {
  iso: string
  focusMinutes: number
  tasksCompleted: number
}

/** Builds the last 30 days of productivity data for the calendar. */
function buildCalendarDays(
  productivity: Record<string, { focusMinutes: number }>,
  tasks: Task[],
  today: string,
): CalendarDay[] {
  const days: CalendarDay[] = []
  for (let i = 29; i >= 0; i -= 1) {
    const iso = addDaysISO(today, -i)
    days.push({
      iso,
      focusMinutes: productivity[iso]?.focusMinutes ?? 0,
      tasksCompleted: tasksCompletedOnDay(tasks, iso),
    })
  }
  return days
}
