import type { ReactNode } from 'react'
import { Button, IconPlus } from './ui'

interface PlannerColumnProps {
  title: string
  addLabel: string
  formOpen: boolean
  onAdd: () => void
  /** The inline composer, rendered under the header only while it is open. */
  composer: ReactNode
  children: ReactNode
}

/**
 * One column of the planner: heading, the Add that opens this column's composer,
 * and the items themselves. Both columns are this component, so the tasks and the
 * reminders can never drift apart.
 */
export function PlannerColumn({
  title,
  addLabel,
  formOpen,
  onAdd,
  composer,
  children,
}: PlannerColumnProps) {
  const headingId = `${title.toLowerCase()}-heading`
  const composerId = `${headingId}-composer`

  return (
    <section className="planner-column" aria-labelledby={headingId}>
      <div className="planner-column__header">
        <h2 id={headingId} className="planner-column__title">
          {title}
        </h2>
        <Button
          variant="secondary"
          onClick={onAdd}
          aria-expanded={formOpen}
          aria-controls={composerId}
        >
          <IconPlus />
          {addLabel}
        </Button>
      </div>

      {formOpen ? (
        <div className="planner-column__composer" id={composerId}>
          {composer}
        </div>
      ) : null}

      {children}
    </section>
  )
}
