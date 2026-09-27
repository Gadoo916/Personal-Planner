import { useCallback, useEffect, useState } from 'react'
import { AddForm, type EditTarget } from './components/AddForm'
import { type AppView, BottomNavigation } from './components/BottomNavigation'
import { FocusSessionTimer } from './components/FocusSessionTimer'
import { PlannerColumn } from './components/PlannerColumn'
import { Profile } from './components/Profile'
import { ProfileGate } from './components/ProfileGate'
import { QuickStats } from './components/QuickStats'
import { ReminderList } from './components/ReminderList'
import { TaskList } from './components/TaskList'
import { UpdateBanner } from './components/UpdateBanner'
import { Welcome } from './components/Welcome'
import type { ReminderDraft, TaskDraft } from './domain/model'
import { groupTasksByDay, plannerStats, sortReminders } from './domain/model'
import { useFocusSession } from './hooks/useFocusSession'
import { usePlanner } from './hooks/usePlanner'
import { useUpdates } from './hooks/useUpdates'
import { todayISO } from './lib/dates'
import type { Reminder, Task } from './storage/types'

/** Keeps the remaining-time labels honest without a re-render storm. */
const TICK_MS = 60_000

type Kind = 'task' | 'reminder'

export default function App() {
  const planner = usePlanner()
  const [target, setTarget] = useState<EditTarget>(null)
  const [adding, setAdding] = useState<Kind | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [view, setView] = useState<AppView>('home')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [])

  const handleSessionResult = useCallback(
    (result: { focusMinutes: number; breakMinutes: number; focusBlocks: number }) => {
      planner.recordFocusSession(todayISO(new Date()), result)
    },
    [planner.recordFocusSession],
  )

  // The clock lives above the views, not inside the panel that draws it, so a
  // session keeps its plan, its remaining time and its running state while the
  // user is looking at Home or the Profile.
  const timer = useFocusSession({ onSessionResult: handleSessionResult })

  // The one piece of state about the app rather than the document. It is a no-op
  // in a plain browser, which is what keeps the planner runnable there.
  const updates = useUpdates()

  // The document decides which screen opens: unreadable until it loads, and the
  // onboarding gate while it holds no name.
  if (!planner.ready) return null
  if (planner.profile === null) return <ProfileGate onSave={planner.saveProfile} />

  const groups = groupTasksByDay(planner.tasks, now)
  const reminders = sortReminders(planner.reminders)
  const editingId = target?.item.id ?? null
  const stats = plannerStats(planner.tasks, planner.reminders, now)

  function openAdd(kind: Kind) {
    setTarget(null)
    setAdding(kind)
  }

  function closeForm() {
    setTarget(null)
    setAdding(null)
  }

  function editTask(task: Task) {
    setAdding(null)
    setTarget({ kind: 'task', item: task })
  }

  function editReminder(reminder: Reminder) {
    setAdding(null)
    setTarget({ kind: 'reminder', item: reminder })
  }

  function submitTask(draft: TaskDraft) {
    if (target?.kind === 'task') planner.saveTask(target.item.id, draft)
    else planner.addTask(draft)
    closeForm()
  }

  function submitReminder(draft: ReminderDraft) {
    if (target?.kind === 'reminder') planner.saveReminder(target.item.id, draft)
    else planner.addReminder(draft)
    closeForm()
  }

  function composer(kind: Kind) {
    return (
      <AddForm
        key={target ? `${target.kind}:${target.item.id}` : `new:${kind}`}
        target={target}
        kind={kind}
        onSubmitTask={submitTask}
        onSubmitReminder={submitReminder}
        onCancel={closeForm}
      />
    )
  }

  return (
    <div className="app-shell">
      {view === 'home' ? (
        <main className="planner-grid">
          <div className="planner-main">
            {updates.state ? (
              <UpdateBanner
                state={updates.state}
                onInstall={updates.install}
                onDismiss={updates.dismiss}
              />
            ) : null}

            <Welcome name={planner.profile.name} />

            <QuickStats stats={stats} now={now} />

            <PlannerColumn
              title="Tasks"
              addLabel="Add task"
              formOpen={target?.kind === 'task' || adding === 'task'}
              onAdd={() => openAdd('task')}
              composer={composer('task')}
            >
              <TaskList
                groups={groups}
                ready={planner.ready}
                editingId={editingId}
                now={now}
                onToggle={planner.toggleTask}
                onEdit={editTask}
                onDelete={planner.deleteTask}
              />
            </PlannerColumn>
          </div>

          <div className="planner-side">
            <PlannerColumn
              title="Reminders"
              addLabel="Add reminder"
              formOpen={target?.kind === 'reminder' || adding === 'reminder'}
              onAdd={() => openAdd('reminder')}
              composer={composer('reminder')}
            >
              <ReminderList
                reminders={reminders}
                ready={planner.ready}
                editingId={editingId}
                now={now}
                onEdit={editReminder}
                onDelete={planner.deleteReminder}
              />
            </PlannerColumn>
          </div>
        </main>
      ) : view === 'profile' ? (
        <Profile planner={planner} />
      ) : (
        <FocusSessionTimer timer={timer} />
      )}

      <BottomNavigation view={view} onChange={setView} />
    </div>
  )
}
