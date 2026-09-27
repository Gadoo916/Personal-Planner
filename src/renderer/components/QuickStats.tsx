import type { PlannerStats } from '../domain/model'
import { formatClock } from '../lib/dates'
import { remainingTime } from '../lib/relativeTime'

interface QuickStatsProps {
  stats: PlannerStats
  now: Date
}

/**
 * Four counts read off the document that is already open, above the tasks they
 * describe. There is no history and nothing to click: a figure is here because
 * the rows behind it already exist, and it cannot disagree with them.
 */
export function QuickStats({ stats, now }: QuickStatsProps) {
  const next = stats.nextReminder

  return (
    <section className="quick-stats" aria-label="Quick stats">
      <div className="quick-stat">
        <span className="quick-stat__label">Today&apos;s Tasks</span>
        <span className="quick-stat__value">{stats.todayTotal}</span>
      </div>

      <div className="quick-stat">
        <span className="quick-stat__label">Completed Today</span>
        <span className="quick-stat__value">{stats.todayDone}</span>
      </div>

      <div className="quick-stat">
        <span className="quick-stat__label">All Tasks</span>
        <span className="quick-stat__value">{stats.allTotal}</span>
      </div>

      <div className="quick-stat">
        <span className="quick-stat__label">Next Reminder</span>
        <span className="quick-stat__value">{next ? formatClock(next.time) : 'None'}</span>
        <span className="quick-stat__note">
          {next ? remainingTime(next.date, next.time, now).text : 'Nothing scheduled'}
        </span>
      </div>
    </section>
  )
}
