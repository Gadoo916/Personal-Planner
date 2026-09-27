import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addDaysISO, defaultReminderTime, formatDayDate, todayISO } from './lib/dates'
import type { AppData, Reminder, Task } from './storage/types'

const KEY = 'planner:data:v1'
const TODAY = todayISO()
const TOMORROW = addDaysISO(TODAY, 1)
const USER = 'Hisham'

function task(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    date: TODAY,
    priority: 'medium',
    repeat: 'none',
    done: false,
    createdAt: 0,
    completedAt: null,
    ...overrides,
  }
}

function reminder(overrides: Partial<Reminder> & { id: string; title: string }): Reminder {
  return {
    date: TODAY,
    time: '09:00',
    createdAt: 0,
    ...overrides,
  }
}

function seed(data: Partial<AppData> = {}) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      schemaVersion: 1,
      tasks: [],
      reminders: [],
      profile: { name: USER },
      ...data,
    }),
  )
}

function readStored(): AppData {
  return JSON.parse(localStorage.getItem(KEY) ?? '{}') as AppData
}

async function renderApp() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Personal Planner')
  return user
}

async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add task' }))
  await screen.findByRole('form', { name: 'Add task' })
}

/** The two hops every session starts with: the Focus button, then Start. */
async function startDefaultSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Focus' }))
  await user.click(screen.getByRole('button', { name: 'Start' }))
}

/**
 * The session panel is a view of its own, so a test that drives the clock has to
 * go and find it the way a user does, rather than finding it on the way in.
 */
async function renderFocusView() {
  const user = await renderApp()
  await user.click(screen.getByRole('button', { name: 'Focus Session' }))
  await screen.findByRole('button', { name: 'Focus' })
  return user
}

/** The date control is a button, not an input, so it is read as its label. */
function pickerLabel(label: string): string {
  return screen.getByLabelText(label).textContent ?? ''
}

/** Picks a day through the app's own calendar, the way a person would. */
async function pickDay(user: ReturnType<typeof userEvent.setup>, label: string, iso: string) {
  await user.click(screen.getByLabelText(label))
  await user.click(screen.getByRole('button', { name: formatDayDate(iso) }))
}

/** Picks a priority in the composer's choice group: a tab, so a plain click. */
async function pickPriority(
  user: ReturnType<typeof userEvent.setup>,
  option: 'High' | 'Medium' | 'Low',
) {
  await user.click(screen.getByRole('tab', { name: option }))
}

/** Repeat stays a native select, so it is driven the way a select is driven. */
async function pickRepeat(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: 'none' | 'daily' | 'weekly',
) {
  await user.selectOptions(screen.getByLabelText(label), value)
}

/** Reads the task rows currently rendered, in document order. */
function taskTitles(): string[] {
  return [...document.querySelectorAll('.task-item__title')].map((node) => node.textContent ?? '')
}

function reminderTitles(): string[] {
  return [...document.querySelectorAll('.reminder-card__title')].map(
    (node) => node.textContent ?? '',
  )
}

beforeEach(() => {
  localStorage.clear()
  seed()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('task flow', () => {
  it('shows the empty state once the stored document has loaded', async () => {
    render(<App />)
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByText('No reminders yet')).toBeInTheDocument()
  })

  it('adds a task, defaults it to today, then completes and reopens it', async () => {
    const user = await renderApp()
    await openAddForm(user)

    await user.type(screen.getByLabelText('Title'), 'Read chapter 4')
    expect(pickerLabel('Day')).toBe('Today')
    await pickPriority(user, 'High')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Read chapter 4')).toBeInTheDocument()
    expect(taskTitles()).toEqual(['Read chapter 4'])
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Mark "Read chapter 4" as done' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-pressed', 'true')
    })
    expect(toggle.closest('.task-item')).toHaveClass('task-item--completed')

    const reopened = screen.getByRole('button', { name: 'Mark "Read chapter 4" as not done' })
    await user.click(reopened)
    await waitFor(() => {
      expect(reopened).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('rejects a blank title without creating a task', async () => {
    const user = await renderApp()
    await openAddForm(user)
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A title is required.')
    expect(taskTitles()).toEqual([])
    expect(readStored().tasks).toEqual([])
  })

  it('edits a task in place', async () => {
    seed({ tasks: [task({ id: 't1', title: 'Read chapter 4' })] })
    const user = await renderApp()
    await screen.findByText('Read chapter 4')

    await user.click(screen.getByRole('button', { name: 'Edit "Read chapter 4"' }))
    const form = await screen.findByRole('form', { name: 'Edit task' })
    const title = within(form).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Read chapter 5')
    await pickPriority(user, 'Low')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Read chapter 5')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit task' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(readStored().tasks[0]).toMatchObject({
        id: 't1',
        title: 'Read chapter 5',
        priority: 'low',
      })
    })
  })

  it('cancels an edit without saving', async () => {
    seed({ tasks: [task({ id: 't1', title: 'Read chapter 4' })] })
    const user = await renderApp()
    await screen.findByText('Read chapter 4')

    await user.click(screen.getByRole('button', { name: 'Edit "Read chapter 4"' }))
    const title = within(await screen.findByRole('form', { name: 'Edit task' })).getByLabelText(
      'Title',
    )
    await user.clear(title)
    await user.type(title, 'Something else')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Read chapter 4')).toBeInTheDocument()
    expect(screen.queryByText('Something else')).not.toBeInTheDocument()
  })

  it('deletes only after confirmation, and No backs out', async () => {
    seed({ tasks: [task({ id: 't1', title: 'Read chapter 4' })] })
    const user = await renderApp()
    await screen.findByText('Read chapter 4')

    await user.click(screen.getByRole('button', { name: 'Delete "Read chapter 4"' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.getByText('Read chapter 4')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete "Read chapter 4"' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => {
      expect(screen.queryByText('Read chapter 4')).not.toBeInTheDocument()
    })
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('groups tasks by day and orders each day by priority', async () => {
    seed({
      tasks: [
        task({ id: 'a', title: 'Low today', priority: 'low' }),
        task({ id: 'b', title: 'High today', priority: 'high' }),
        task({ id: 'c', title: 'Tomorrow item', date: TOMORROW, priority: 'high' }),
        task({ id: 'd', title: 'Done today', priority: 'high', done: true, completedAt: 1 }),
      ],
    })
    render(<App />)
    await screen.findByText('High today')

    expect(taskTitles()).toEqual(['High today', 'Done today', 'Low today', 'Tomorrow item'])
    const days = [...document.querySelectorAll('.task-group__day')].map((node) => node.textContent)
    expect(days).toEqual(['Today', 'Tomorrow'])
  })

  it('emphasises only the current day group', async () => {
    seed({
      tasks: [
        task({ id: 'a', title: 'Today item', date: TODAY }),
        task({ id: 'b', title: 'Later item', date: TOMORROW }),
      ],
    })
    render(<App />)
    await screen.findByText('Today item')
    await screen.findByText('Later item')

    await waitFor(() => {
      const groups = [...document.querySelectorAll('.task-group')]
      expect(groups).toHaveLength(2)
    })
    const groups = [...document.querySelectorAll('.task-group')]
    const todayGroups = groups.filter((g) => g.classList.contains('task-group--today'))
    expect(todayGroups).toHaveLength(1)
  })
})

describe('repeating tasks', () => {
  it('completes a daily task and rolls the next occurrence forward', async () => {
    const user = await renderApp()
    await openAddForm(user)
    await user.type(screen.getByLabelText('Title'), 'Stretch')
    await pickRepeat(user, 'Repeat', 'daily')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Stretch')).toBeInTheDocument()
    expect(taskTitles()).toEqual(['Stretch'])

    await user.click(screen.getByRole('button', { name: 'Mark "Stretch" as done' }))

    await waitFor(() => {
      expect(taskTitles()).toHaveLength(2)
    })
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument()
    expect(screen.getAllByText('Daily')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mark "Stretch" as done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() => {
      expect(readStored().tasks).toHaveLength(2)
    })
  })
})

describe('reminder flow', () => {
  it('adds a reminder with a countdown from the reminders column', async () => {
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: 'Add reminder' }))

    const form = await screen.findByRole('form', { name: 'Add reminder' })
    // The column decides what is being added, so there is no type to choose.
    expect(within(form).queryByRole('tab', { name: 'Task' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Repeat')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'Surgery exam')
    await pickDay(user, 'Date', TOMORROW)
    const chosenTime = pickerLabel('Time')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Surgery exam')).toBeInTheDocument()
    expect(reminderTitles()).toEqual(['Surgery exam'])
    const card = document.querySelector('.reminder-card')
    expect(card).toHaveTextContent(chosenTime)
    expect(card).toHaveTextContent('tomorrow')
    await waitFor(() => {
      expect(readStored().reminders[0]).toMatchObject({
        title: 'Surgery exam',
        date: TOMORROW,
      })
    })
    expect(readStored().reminders[0]?.time).toBe(defaultReminderTime())
  })

  it('marks a past reminder overdue instead of hiding it', async () => {
    seed({
      reminders: [
        reminder({ id: 'r1', title: 'Pay rent', date: addDaysISO(TODAY, -2) }),
        reminder({ id: 'r2', title: 'Dentist', date: addDaysISO(TODAY, 30), time: '11:00' }),
      ],
    })
    render(<App />)
    await screen.findByText('Pay rent')

    const overdue = document.querySelector('.reminder-card--overdue')
    expect(overdue).not.toBeNull()
    expect(overdue).toHaveTextContent('Pay rent')
    expect(overdue?.querySelector('.remaining-time')?.textContent).toMatch(/ago$/)
    expect(screen.getByText('Dentist')).toBeInTheDocument()
  })

  it('sorts reminders by date then time', async () => {
    seed({
      reminders: [
        reminder({ id: 'r1', title: 'Later today', time: '18:00' }),
        reminder({ id: 'r2', title: 'Tomorrow early', date: TOMORROW, time: '07:00' }),
        reminder({ id: 'r3', title: 'Today earlier', time: '08:00' }),
      ],
    })
    render(<App />)
    await screen.findByText('Later today')
    expect(reminderTitles()).toEqual(['Today earlier', 'Later today', 'Tomorrow early'])
  })

  it('edits and deletes a reminder', async () => {
    seed({ reminders: [reminder({ id: 'r1', title: 'Pay rent' })] })
    const user = await renderApp()
    await screen.findByText('Pay rent')

    await user.click(screen.getByRole('button', { name: 'Edit "Pay rent"' }))
    const form = await screen.findByRole('form', { name: 'Edit reminder' })
    const title = within(form).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Pay council tax')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Pay council tax')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete "Pay council tax"' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => {
      expect(screen.getByText('No reminders yet')).toBeInTheDocument()
    })
  })
})

describe('screen composition', () => {
  it('gives the work the main area and the widgets the narrow one', async () => {
    await renderApp()
    const columns = [...document.querySelectorAll('.planner-grid > div')]
    expect(columns).toHaveLength(2)
    const main = columns[0] as HTMLElement
    const side = columns[1] as HTMLElement
    expect(main).toHaveClass('planner-main')
    expect(side).toHaveClass('planner-side')
    expect(within(main).getByRole('region', { name: 'Tasks' })).toBeInTheDocument()
    expect(within(side).getByRole('region', { name: 'Reminders' })).toBeInTheDocument()
  })

  it('gives each column a header of a title and its own Add, and no counter', async () => {
    await renderApp()
    for (const [column, add] of [
      ['Tasks', 'Add task'],
      ['Reminders', 'Add reminder'],
    ]) {
      const header = screen
        .getByRole('region', { name: column })
        .querySelector('.planner-column__header')
      if (!header) throw new Error(`the ${column} column is missing its header`)

      // The Add is the title's neighbour in the same row, not a second line
      // under it, so the header holds those two things and nothing else.
      expect(within(header as HTMLElement).getByRole('button', { name: add })).toBeInTheDocument()
      expect(header.children).toHaveLength(2)
      // No counter of any kind sits beside the title.
      expect(header.querySelector('.planner-column__count')).toBeNull()
      expect(header.textContent).not.toMatch(/[0-9]/)
    }
  })

  it('opens the composer inside the column that owns it', async () => {
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: 'Add reminder' }))

    const reminders = screen.getByRole('region', { name: 'Reminders' })
    const tasks = screen.getByRole('region', { name: 'Tasks' })
    expect(within(reminders).getByRole('form', { name: 'Add reminder' })).toBeInTheDocument()
    expect(within(tasks).queryByRole('form')).not.toBeInTheDocument()
  })

  it('uses no native date or time input', async () => {
    const user = await renderApp()
    await openAddForm(user)
    await user.click(screen.getByRole('button', { name: 'Add reminder' }))

    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(document.querySelector('input[type="time"]')).toBeNull()
  })

  it('colours the priority options with the existing palette', async () => {
    const user = await renderApp()
    await openAddForm(user)

    // Priority is a choice group, so the colour rides the option's own active
    // line: one of the three existing semantic tokens, never a fourth.
    const high = screen.getByRole('tab', { name: 'High' })
    expect(high).toHaveClass('category-tab--high')
    expect(screen.getByRole('tab', { name: 'Medium' })).toHaveClass('category-tab--medium')
    expect(screen.getByRole('tab', { name: 'Low' })).toHaveClass('category-tab--low')

    await pickPriority(user, 'High')
    expect(high).toHaveAttribute('aria-selected', 'true')
    // The group is still a row of words: no track and no fill behind it.
    const group = screen.getByRole('tablist', { name: 'Priority' })
    expect(group).toHaveClass('nav-pill-group')
  })
})

describe('bottom navigation', () => {
  /** The three destinations, in the order the bar holds them. */
  const DESTINATIONS = ['Home', 'Profile', 'Focus Session']

  function nav(): HTMLElement {
    return screen.getByRole('navigation', { name: 'Views' })
  }

  async function goTo(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(within(nav()).getByRole('button', { name: label }))
  }

  it('holds exactly the three destinations, and marks the current one', async () => {
    const user = await renderApp()

    for (const label of DESTINATIONS) {
      expect(
        within(nav())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(DESTINATIONS)
      // The current view is announced, not merely coloured.
      const current = nav().querySelectorAll('[aria-current="page"]')
      expect(current).toHaveLength(1)
      await goTo(user, label)
      expect(within(nav()).getByRole('button', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
  })

  it('is on every view, because it is chrome rather than content', async () => {
    const user = await renderApp()
    for (const label of DESTINATIONS) {
      await goTo(user, label)
      expect(nav()).toBeInTheDocument()
    }
  })

  it('leaves the session panel off Home, which is the work and nothing else', async () => {
    const user = await renderApp()

    expect(screen.getByRole('region', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Reminders' })).toBeInTheDocument()
    expect(document.querySelector('.focus-session')).toBeNull()

    await goTo(user, 'Focus Session')
    expect(document.querySelector('.focus-session')).not.toBeNull()
    // And coming back does not leave the panel behind on Home.
    await goTo(user, 'Home')
    expect(document.querySelector('.focus-session')).toBeNull()
  })

  it('gives the Focus view the panel and the bar, and nothing else', async () => {
    const user = await renderApp()
    await goTo(user, 'Focus Session')

    expect(screen.getByRole('region', { name: 'Focus Session' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tasks' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument()
  })

  it('keeps a running session alive across a trip away and back', async () => {
    const user = await renderApp()
    await goTo(user, 'Focus Session')
    await startDefaultSession(user)

    const caption = document.querySelector('.focus-session__summary')?.textContent
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeInTheDocument()

    // Leave for Home and come back. The clock was never unmounted, so the plan,
    // the block, and the running state are all still where they were.
    await goTo(user, 'Home')
    expect(document.querySelector('.focus-session')).toBeNull()
    await goTo(user, 'Focus Session')

    expect(screen.getByRole('button', { name: 'Pause session' })).toBeInTheDocument()
    expect(document.querySelector('.focus-session__summary')?.textContent).toBe(caption)
    expect(document.querySelector('.focus-session__clock')?.textContent).not.toBe('')
  })

  it('makes the Profile a view rather than a dialog, with no way out but the bar', async () => {
    const user = await renderApp()
    await goTo(user, 'Profile')

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    // No backdrop, no dialog, and no Close: the bar is the only way out.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.profile-overlay')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

    await goTo(user, 'Home')
    expect(screen.queryByRole('heading', { name: 'Profile' })).not.toBeInTheDocument()
  })

  it('leaves the Profile out of the welcome band, so the bar is the only way in', async () => {
    await renderApp()
    const welcome = document.querySelector('.welcome')
    expect(welcome).not.toBeNull()
    expect(within(welcome as HTMLElement).queryByRole('button')).toBeNull()
  })

  it('does not offer the bar before a name is stored', async () => {
    localStorage.removeItem(KEY)
    render(<App />)

    await screen.findByRole('form', { name: 'Set up your planner' })
    expect(screen.queryByRole('navigation', { name: 'Views' })).not.toBeInTheDocument()
  })
})

describe('first launch', () => {
  it('asks for a name and nothing else when no profile is stored', async () => {
    localStorage.clear()
    render(<App />)
    expect(await screen.findByRole('form', { name: 'Set up your planner' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('rejects a blank name without saving', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('form', { name: 'Set up your planner' })
    await user.click(screen.getByRole('button', { name: 'Start planning' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A name is required.')
    expect(readStored().profile ?? null).toBeNull()
  })

  it('saves the name locally and opens the planner', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('form', { name: 'Set up your planner' })
    await user.type(screen.getByLabelText('Your name'), 'Hisham')
    await user.click(screen.getByRole('button', { name: 'Start planning' }))
    expect(await screen.findByText('Welcome, Hisham')).toBeInTheDocument()
    await waitFor(() => {
      expect(readStored().profile).toEqual({ name: 'Hisham' })
    })
  })

  it('does not ask again once a profile is stored', async () => {
    await renderApp()
    expect(screen.queryByRole('form', { name: 'Set up your planner' })).not.toBeInTheDocument()
    expect(screen.getByText(`Welcome, ${USER}`)).toBeInTheDocument()
  })
})

describe('welcome and quick stats', () => {
  it('shows the greeting and the app name at the top of the main column', async () => {
    await renderApp()
    const main = document.querySelector('.planner-main')
    if (!main) throw new Error('the screen is missing its main column')
    const welcome = document.querySelector('.welcome')
    expect(welcome).toBeInTheDocument()
    expect(within(main as HTMLElement).getByText(`Welcome, ${USER}`)).toBeInTheDocument()
    expect(
      within(main as HTMLElement).getByRole('heading', { name: 'Personal Planner' }),
    ).toBeInTheDocument()
    // Welcome sits above Quick Stats, which sits above Tasks.
    const welcomeEl = document.querySelector('.welcome') as HTMLElement
    const statsEl = document.querySelector('.quick-stats') as HTMLElement
    const tasksEl = screen.getByRole('region', { name: 'Tasks' })
    expect(
      welcomeEl.compareDocumentPosition(statsEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(statsEl.compareDocumentPosition(tasksEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("counts today's tasks, completed today, and all tasks", async () => {
    seed({
      tasks: [
        task({ id: 't1', title: 'Today open', done: false }),
        task({ id: 't2', title: 'Today done', done: true }),
        task({ id: 't3', title: 'Tomorrow', date: TOMORROW, done: false }),
      ],
    })
    await renderApp()
    const stats = [...document.querySelectorAll('.quick-stat')]
    expect(stats).toHaveLength(4)
    expect(stats[0]).toHaveTextContent("Today's Tasks")
    expect(stats[0]).toHaveTextContent('2')
    expect(stats[1]).toHaveTextContent('Completed Today')
    expect(stats[1]).toHaveTextContent('1')
    expect(stats[2]).toHaveTextContent('All Tasks')
    expect(stats[2]).toHaveTextContent('3')
  })

  it('shows the next upcoming reminder with its remaining time', async () => {
    seed({
      reminders: [
        reminder({ id: 'r1', title: 'Past', date: addDaysISO(TODAY, -1) }),
        reminder({ id: 'r2', title: 'Upcoming', date: TOMORROW, time: '09:00' }),
      ],
    })
    await renderApp()
    const stats = [...document.querySelectorAll('.quick-stat')]
    expect(stats[3]).toHaveTextContent('Next Reminder')
    expect(stats[3]).toHaveTextContent('9:00 AM')
    expect(stats[3]).toHaveTextContent('tomorrow')
  })

  it('shows a placeholder when there is no upcoming reminder', async () => {
    seed({ reminders: [reminder({ id: 'r1', title: 'Past', date: addDaysISO(TODAY, -1) })] })
    await renderApp()
    const stats = [...document.querySelectorAll('.quick-stat')]
    expect(stats[3]).toHaveTextContent('None')
  })
})

describe('focus session panel', () => {
  /** The phase label and the caption both hold these words, so ask for the label. */
  function phase(): string {
    return document.querySelector('.focus-session__phase')?.textContent ?? ''
  }

  function caption(): string {
    return document.querySelector('.focus-session__summary')?.textContent ?? ''
  }

  function clock(): string {
    return document.querySelector('.focus-session__clock')?.textContent ?? ''
  }

  function setup(): HTMLElement | null {
    return document.querySelector('.focus-session__setup')
  }

  /** The chosen value of one wheel column, which is its only number. */
  function length(column: 'Hours' | 'Minutes'): string {
    const wheel = screen.getByRole('group', { name: column })
    return wheel.querySelector('.wheel__value')?.textContent ?? ''
  }

  it('opens on a Focus button, with no clock and no ring', async () => {
    await renderFocusView()
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument()
    expect(clock()).toBe('')
    expect(document.querySelector('.focus-session__ring')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('stacks the idle face in one column, so Focus sits under the title', async () => {
    await renderFocusView()
    const panel = document.querySelector('.focus-session--idle')
    const heading = screen.getByRole('heading', { name: 'Focus Session' })
    const focus = screen.getByRole('button', { name: 'Focus' })

    // Both are children of the panel's own column, so they stack, and there is
    // no row left for the button to sit beside.
    expect(heading.parentElement).toBe(panel)
    expect(focus.parentElement).toBe(panel)
    expect(panel?.querySelector('.focus-session__bar')).toBeNull()
    // Three lines: title, animation, and the Focus button. Nothing else in the
    // panel to align them against.
    expect(panel?.children).toHaveLength(3)
    expect(document.querySelector('.focus-session__hint')).toBeNull()
  })

  it('keeps the bar for the two faces that carry an action in it', async () => {
    const user = await renderFocusView()

    await user.click(screen.getByRole('button', { name: 'Focus' }))
    expect(document.querySelector('.focus-session__setup')?.previousElementSibling).toHaveClass(
      'focus-session__bar',
    )

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(document.querySelector('.focus-session__centre')?.previousElementSibling).toHaveClass(
      'focus-session__bar',
    )
  })

  it('opens the setup from the Focus button, and closes it again', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    expect(screen.getByRole('region', { name: 'Focus Session' })).toBeInTheDocument()
    // The setup is a form, not a running timer.
    expect(clock()).toBe('')
    expect(screen.queryByRole('progressbar')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(setup()).toBeNull()
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument()
  })

  it('offers the three lengths the session is built from', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    expect(length('Hours')).toBe('02')
    expect(length('Minutes')).toBe('00')
    expect(screen.getByRole('tablist', { name: 'Short break length' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Long break length' })).toBeInTheDocument()
  })

  it('offers Breaks as an On or Off choice in the setup', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    const breaks = screen.getByRole('tablist', { name: 'Breaks' })
    expect(within(breaks).getByRole('tab', { name: 'On' })).toHaveAttribute('aria-selected', 'true')
    expect(within(breaks).getByRole('tab', { name: 'Off' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('runs as one continuous timer when Breaks is off', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(phase()).toBe('Focus')
    expect(clock()).toBe('2:00:00')
    expect(caption()).toBe('2h focus session')

    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
  })

  it('runs no break timer at all when Breaks is off', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(clock()).toBe('2:00:00')
    expect(phase()).toBe('Focus')
    expect(document.querySelector('.focus-session__phase--break')).toBeNull()
    expect(screen.getByAltText('Focus cat animation')).toBeInTheDocument()
    expect(screen.queryByAltText('Break cat animation')).toBeNull()

    expect(caption()).toBe('2h focus session')
    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
  })

  it('keeps the break lengths and restores them when Breaks is turned back on', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    await user.click(screen.getByRole('tab', { name: '10m' }))
    await user.click(screen.getByRole('tab', { name: '30m' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    // Short and Long break rows are hidden when Breaks is off.
    expect(screen.queryByRole('tab', { name: '10m' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '30m' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'On' }))
    // Turning Breaks back on restores the previous lengths.
    expect(screen.getByRole('tab', { name: '10m' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '30m' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(caption()).toBe('Block 1 of 5 · 2h focus left · 3h total')

    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    expect(phase()).toBe('Short break')
    expect(clock()).toBe('10:00')
  })

  it('shows a minute counter for the manual break duration', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))

    const wheel = screen.getByRole('group', { name: 'Minutes' })
    expect(wheel).toBeInTheDocument()
    expect(wheel.querySelector('.wheel__value')?.textContent).toBe('05')
    expect(wheel.querySelector('.wheel__unit')?.textContent).toBe('min')
    expect(screen.queryByRole('tab', { name: '5 min' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '10 min' })).not.toBeInTheDocument()
  })

  it('steps the manual break counter in five minute notches', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))

    const wheel = screen.getByRole('group', { name: 'Minutes' })
    const value = () => wheel.querySelector('.wheel__value')?.textContent

    await user.click(screen.getByRole('button', { name: 'Add five minutes' }))
    expect(value()).toBe('10')

    await user.click(screen.getByRole('button', { name: 'Take off five minutes' }))
    expect(value()).toBe('05')
  })

  it('clamps the manual break counter between 5 and 60 minutes', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))

    const wheel = screen.getByRole('group', { name: 'Minutes' })
    const value = () => wheel.querySelector('.wheel__value')?.textContent

    // The wheel opens on the floor already, so one notch is enough to lock it.
    expect(value()).toBe('05')
    expect(screen.getByRole('button', { name: 'Take off five minutes' })).toBeDisabled()

    for (let i = 0; i < 20; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Add five minutes' }))
    }
    expect(value()).toBe('60')
    expect(screen.getByRole('button', { name: 'Add five minutes' })).toBeDisabled()
  })

  it('starts the manual break with the counter value', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('tab', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await user.click(screen.getByRole('button', { name: 'Take a Break' }))

    await user.click(screen.getByRole('button', { name: 'Add five minutes' }))
    await user.click(screen.getByRole('button', { name: 'Add five minutes' }))
    await user.click(screen.getByRole('button', { name: 'Start Break' }))

    expect(phase()).toBe('Break')
    expect(clock()).toBe('15:00')
    expect(screen.getByAltText('Break cat animation')).toBeInTheDocument()
  })

  it('reads the session length as two wheel columns, each a plus over a value over a minus', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    const hours = screen.getByRole('group', { name: 'Hours' })
    const minutes = screen.getByRole('group', { name: 'Minutes' })
    // Two columns, side by side in the one control, each its own named group.
    expect(hours.parentElement).toBe(minutes.parentElement)
    expect(document.querySelectorAll('.wheel')).toHaveLength(2)

    // A column is its label, then a control, the value, and a control. The value
    // is the only number in it, so there is nothing around it to read.
    expect(hours.textContent).toBe('Hours02')
    expect(minutes.textContent).toBe('Minutes00')

    // The plus is above the value and the minus below it, the order a phone stacks
    // a wheel in, and the controls bracket the value rather than sit beside it.
    const stack = (column: HTMLElement, plus: string, minus: string) => {
      const [, above, value, below] = [...column.children]
      expect(above).toHaveAccessibleName(plus)
      expect(below).toHaveAccessibleName(minus)
      expect(value).toHaveClass('wheel__value')
    }
    stack(hours, 'Add an hour', 'Take off an hour')
    stack(minutes, 'Add five minutes', 'Take off five minutes')
  })

  it('steps the session length in hours and in minutes', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    await user.click(screen.getByRole('button', { name: 'Add five minutes' }))
    expect(length('Minutes')).toBe('05')
    expect(length('Hours')).toBe('02')

    await user.click(screen.getByRole('button', { name: 'Add an hour' }))
    expect(length('Hours')).toBe('03')
    // The two wheels move independently, so the minutes are not disturbed.
    expect(length('Minutes')).toBe('05')
  })

  it('never offers a length that leaves the readable range', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    // 2h less 60 leaves zero, which is under the 25 minute floor.
    await user.click(screen.getByRole('button', { name: 'Take off an hour' }))
    expect(length('Hours')).toBe('01')
    expect(screen.getByRole('button', { name: 'Take off an hour' })).toBeDisabled()

    // 1h down to the floor in five minute steps, then the button locks too.
    for (let step = 0; step < 7; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Take off five minutes' }))
    }
    expect(length('Minutes')).toBe('25')
    expect(screen.getByRole('button', { name: 'Take off five minutes' })).toBeDisabled()
  })

  it('starts a centred session when Start is pressed', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(setup()).toBeNull()
    expect(phase()).toBe('Focus')
    expect(clock()).toBe('25:00')
    // A two hour session is five focus blocks of 150 elapsed minutes.
    expect(caption()).toBe('Block 1 of 5 · 2h focus left · 2h 30m total')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(await screen.findByRole('button', { name: 'Pause session' })).toBeInTheDocument()
  })

  it('runs, pauses and skips into the break', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)
    expect(await screen.findByRole('button', { name: 'Pause session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause session' }))
    expect(await screen.findByRole('button', { name: 'Resume session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    expect(phase()).toBe('Short break')
    expect(clock()).toBe('05:00')
    // One 25-minute focus block of a 150-minute session is 17% of the way.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '17')
  })

  it('reaches a long break every fourth break', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)
    for (let block = 0; block < 7; block += 1) {
      await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    }
    expect(phase()).toBe('Long break')
    expect(clock()).toBe('15:00')
  })

  it('re-plans from the setup and Reset starts the session over', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))
    await user.click(screen.getByRole('button', { name: 'Add an hour' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(caption()).toBe('Block 1 of 8 · 3h focus left · 3h 45m total')

    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    await user.click(screen.getByRole('button', { name: 'Reset the session' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(caption()).toBe('Block 1 of 8 · 3h focus left · 3h 45m total')
    expect(phase()).toBe('Focus')
  })

  it('asks before Reset throws the session away, and No changes nothing', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)
    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    expect(phase()).toBe('Short break')

    await user.click(screen.getByRole('button', { name: 'Reset the session' }))
    // The confirmation is inline, and it takes over the Reset slot alone: the
    // clock and the other two controls have not moved.
    expect(phase()).toBe('Short break')
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip this block' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset the session' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(phase()).toBe('Short break')
    expect(screen.getByRole('button', { name: 'Reset the session' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset the session' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(phase()).toBe('Focus')
  })

  it('keeps the run totals through a Reset, and forgets them on Done', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)

    // Skip the first block so the run has banked a focus block, then reset.
    await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    await user.click(screen.getByRole('button', { name: 'Reset the session' }))
    await user.click(screen.getByRole('button', { name: 'Yes' }))

    // Skip through the whole plan to reach the summary. The block that was
    // skipped before the Reset is still counted, so the run is 1 + 5 and not 5.
    for (let block = 0; block < 9; block += 1) {
      await user.click(screen.getByRole('button', { name: 'Skip this block' }))
    }
    expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    expect(screen.getByText('6 focus blocks completed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument()
  })

  it('re-plans the chosen break lengths', async () => {
    const user = await renderFocusView()
    await user.click(screen.getByRole('button', { name: 'Focus' }))

    await user.click(screen.getByRole('tab', { name: '10m' }))
    await user.click(screen.getByRole('tab', { name: '30m' }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    // 120 focus + three 10s and one 30 = 180 elapsed minutes.
    expect(caption()).toBe('Block 1 of 5 · 2h focus left · 3h total')
  })

  it('lets a running session go back to the setup', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)
    await user.click(screen.getByRole('button', { name: 'Change session' }))

    expect(screen.getByRole('region', { name: 'Focus Session' })).toBeInTheDocument()
    expect(length('Hours')).toBe('02')

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(caption()).toBe('Block 1 of 5 · 2h focus left · 2h 30m total')
  })

  it('keeps the session out of storage', async () => {
    const user = await renderFocusView()
    await startDefaultSession(user)
    await user.click(screen.getByRole('button', { name: 'Pause session' }))
    // The document is there, but it carries no timer state of any kind.
    expect(readStored()).toEqual({
      schemaVersion: 1,
      profile: { name: USER },
      tasks: [],
      reminders: [],
    })
  })
})

describe('persistence', () => {
  it('writes through to storage after a change', async () => {
    const user = await renderApp()
    await openAddForm(user)
    await user.type(screen.getByLabelText('Title'), 'Read chapter 4')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await screen.findByText('Read chapter 4')
    await waitFor(() => {
      expect(readStored().tasks[0]).toMatchObject({ title: 'Read chapter 4', date: TODAY })
    })
  })

  it('rehydrates a stored document on load', async () => {
    seed({
      tasks: [task({ id: 't1', title: 'Read chapter 4', priority: 'high' })],
      reminders: [reminder({ id: 'r1', title: 'Pay rent' })],
    })
    render(<App />)

    expect(await screen.findByText('Read chapter 4')).toBeInTheDocument()
    expect(screen.getByText('Pay rent')).toBeInTheDocument()
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument()
  })

  it('recovers from a corrupt document by starting empty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(KEY, '{ not json')
    render(<App />)
    // A corrupt document degrades to an empty one, which has no profile, so
    // the onboarding gate appears. Saving a name then reveals the empty planner.
    await screen.findByRole('form', { name: 'Set up your planner' })
  })

  it('discards records that do not match the schema', async () => {
    seed({
      tasks: [
        { id: 'ok', title: 'Keeper', date: TODAY },
        { id: 'bad', title: '', date: 'nope' },
      ] as never,
    })
    render(<App />)
    expect(await screen.findByText('Keeper')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
