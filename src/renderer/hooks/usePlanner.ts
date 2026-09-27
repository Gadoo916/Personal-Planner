import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReminderDraft, TaskDraft } from '../domain/model'
import { normalizeAppData } from '../domain/model'
import {
  addReminder,
  addTask,
  deleteReminder,
  deleteTask,
  recordFocusSession,
  setProfile,
  toggleTask,
  updateReminder,
  updateTask,
} from '../domain/mutations'
import type { FocusSessionResult } from '../domain/productivity'
import { log, ref } from '../lib/log'
import { createStorage, type PlannerStorage } from '../storage/port'
import { type AppData, emptyAppData } from '../storage/types'

const SAVE_DEBOUNCE_MS = 300

interface PlannerState {
  ready: boolean
  data: AppData
}

type PlannerAction =
  | { type: 'hydrate'; data: AppData }
  | { type: 'profile/set'; name: string }
  | { type: 'task/add'; draft: TaskDraft }
  | { type: 'task/update'; id: string; draft: TaskDraft }
  | { type: 'task/toggle'; id: string }
  | { type: 'task/delete'; id: string }
  | { type: 'reminder/add'; draft: ReminderDraft }
  | { type: 'reminder/update'; id: string; draft: ReminderDraft }
  | { type: 'reminder/delete'; id: string }
  | { type: 'focus/session'; dayISO: string; result: FocusSessionResult }

const initialState: PlannerState = { ready: false, data: emptyAppData() }

function reducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'hydrate':
      return { ready: true, data: action.data }
    case 'profile/set':
      return { ...state, data: setProfile(state.data, action.name) }
    case 'task/add':
      return { ...state, data: addTask(state.data, action.draft) }
    case 'task/update':
      return { ...state, data: updateTask(state.data, action.id, action.draft) }
    case 'task/toggle':
      return { ...state, data: toggleTask(state.data, action.id) }
    case 'task/delete':
      return { ...state, data: deleteTask(state.data, action.id) }
    case 'reminder/add':
      return { ...state, data: addReminder(state.data, action.draft) }
    case 'reminder/update':
      return { ...state, data: updateReminder(state.data, action.id, action.draft) }
    case 'reminder/delete':
      return { ...state, data: deleteReminder(state.data, action.id) }
    case 'focus/session':
      return { ...state, data: recordFocusSession(state.data, action.dayISO, action.result) }
  }
}

export interface Planner {
  ready: boolean
  profile: AppData['profile']
  tasks: AppData['tasks']
  reminders: AppData['reminders']
  productivity: NonNullable<AppData['productivity']>
  saveProfile: (name: string) => void
  addTask: (draft: TaskDraft) => void
  saveTask: (id: string, draft: TaskDraft) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  addReminder: (draft: ReminderDraft) => void
  saveReminder: (id: string, draft: ReminderDraft) => void
  deleteReminder: (id: string) => void
  recordFocusSession: (dayISO: string, result: FocusSessionResult) => void
}

export function usePlanner(): Planner {
  const storage = useMemo<PlannerStorage>(() => createStorage(), [])
  const [state, dispatch] = useReducer(reducer, initialState)
  const latest = useRef(state.data)

  useEffect(() => {
    latest.current = state.data
  }, [state.data])

  useEffect(() => {
    let cancelled = false
    const started = performance.now()

    void (async () => {
      let data = emptyAppData()
      try {
        data = normalizeAppData(await storage.load())
      } catch (error) {
        log.error('storage.load_failed', error)
      }
      if (cancelled) return
      log.info('storage.load', {
        ms: Math.round(performance.now() - started),
        tasks: data.tasks.length,
        reminders: data.reminders.length,
      })
      dispatch({ type: 'hydrate', data })
    })()

    return () => {
      cancelled = true
    }
  }, [storage])

  // Debounced write. The flush listeners below cover the gap the debounce opens.
  useEffect(() => {
    if (!state.ready) return
    const timer = setTimeout(() => {
      void storage.save(state.data)
    }, SAVE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [state.data, state.ready, storage])

  useEffect(() => {
    if (!state.ready) return
    const flush = () => {
      void storage.save(latest.current)
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('blur', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('blur', flush)
    }
  }, [state.ready, storage])

  const saveProfile = useCallback((name: string) => {
    log.info('profile.saved')
    dispatch({ type: 'profile/set', name })
  }, [])

  const addTaskAction = useCallback((draft: TaskDraft) => {
    log.info('task.added', { priority: draft.priority, repeat: draft.repeat })
    dispatch({ type: 'task/add', draft })
  }, [])

  const saveTask = useCallback((id: string, draft: TaskDraft) => {
    log.info('task.updated', { id: ref(id) })
    dispatch({ type: 'task/update', id, draft })
  }, [])

  const toggleTaskAction = useCallback((id: string) => {
    log.info('task.toggled', { id: ref(id) })
    dispatch({ type: 'task/toggle', id })
  }, [])

  const deleteTaskAction = useCallback((id: string) => {
    log.info('task.deleted', { id: ref(id) })
    dispatch({ type: 'task/delete', id })
  }, [])

  const addReminderAction = useCallback((draft: ReminderDraft) => {
    log.info('reminder.added')
    dispatch({ type: 'reminder/add', draft })
  }, [])

  const saveReminder = useCallback((id: string, draft: ReminderDraft) => {
    log.info('reminder.updated', { id: ref(id) })
    dispatch({ type: 'reminder/update', id, draft })
  }, [])

  const deleteReminderAction = useCallback((id: string) => {
    log.info('reminder.deleted', { id: ref(id) })
    dispatch({ type: 'reminder/delete', id })
  }, [])

  const recordFocusSessionAction = useCallback((dayISO: string, result: FocusSessionResult) => {
    log.info('focus.session.recorded', {
      day: dayISO,
      focusMinutes: result.focusMinutes,
      breakMinutes: result.breakMinutes,
      focusBlocks: result.focusBlocks,
    })
    dispatch({ type: 'focus/session', dayISO, result })
  }, [])

  return {
    ready: state.ready,
    profile: state.data.profile,
    tasks: state.data.tasks,
    reminders: state.data.reminders,
    productivity: state.data.productivity ?? {},
    saveProfile,
    addTask: addTaskAction,
    saveTask,
    toggleTask: toggleTaskAction,
    deleteTask: deleteTaskAction,
    addReminder: addReminderAction,
    saveReminder,
    deleteReminder: deleteReminderAction,
    recordFocusSession: recordFocusSessionAction,
  }
}
