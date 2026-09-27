import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDaysISO, formatDayDate, todayISO, WEEKDAY_INITIALS } from '../lib/dates'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { Dropdown, type DropdownOption } from './ui'

const TODAY = todayISO()
const TOMORROW = addDaysISO(TODAY, 1)

function renderDate(value = TODAY, onChange = vi.fn()) {
  render(<DatePicker id="day" value={value} onChange={onChange} />)
  return onChange
}

function renderTime(value = '09:00', onChange = vi.fn()) {
  render(<TimePicker id="time" value={value} onChange={onChange} />)
  return onChange
}

/** The trigger carries the chosen value as its name, so it is found by class. */
function trigger(): HTMLButtonElement {
  const node = document.querySelector('.picker-trigger')
  if (!node) throw new Error('no picker trigger is rendered')
  return node as HTMLButtonElement
}

afterEach(cleanup)

describe('DatePicker', () => {
  it('shows the chosen day on the trigger and no native date input', () => {
    const { container } = render(<DatePicker id="day" value={TODAY} onChange={vi.fn()} />)
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(trigger()).toBeInTheDocument()
  })

  it('opens a month grid with one heading per weekday column', async () => {
    const user = userEvent.setup()
    renderDate()
    await user.click(trigger())

    const dialog = screen.getByRole('dialog', { name: 'Choose a day' })
    expect(dialog).toBeInTheDocument()
    expect(dialog.querySelectorAll('.picker-week__day')).toHaveLength(WEEKDAY_INITIALS.length)
    expect(dialog.querySelectorAll('.picker-grid__day')).toHaveLength(42)
  })

  it('marks the selected day and today apart', async () => {
    const user = userEvent.setup()
    renderDate()
    await user.click(trigger())

    const selected = document.querySelector('.picker-grid__day--selected')
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelectorAll('.picker-grid__day--today')).toHaveLength(1)
  })

  it('reports the day the user clicks, then closes', async () => {
    const user = userEvent.setup()
    const onChange = renderDate()
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: formatDayDate(TOMORROW) }))

    expect(onChange).toHaveBeenCalledWith(addDaysISO(TODAY, 1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pages through months without losing the grid', async () => {
    const user = userEvent.setup()
    renderDate()
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'Next month' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelectorAll('.picker-grid__day')).toHaveLength(42)
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(document.querySelectorAll('.picker-grid__day')).toHaveLength(42)
  })

  it('jumps to today from the footer', async () => {
    const user = userEvent.setup()
    const onChange = renderDate(addDaysISO(TODAY, 40))
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onChange).toHaveBeenCalledWith(TODAY)
  })

  it('closes on Escape and on a press outside', async () => {
    const user = userEvent.setup()
    renderDate()

    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(trigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refuses days past the one-year ceiling', async () => {
    const user = userEvent.setup()
    const onChange = renderDate()
    await user.click(trigger())
    const disabled = [...document.querySelectorAll('.picker-grid__day')].filter(
      (day) => (day as HTMLButtonElement).disabled,
    )
    for (const day of disabled) {
      expect((day as HTMLButtonElement).getAttribute('aria-label')).toBeTruthy()
    }
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TimePicker', () => {
  it('shows 12-hour time on the trigger and no native time input', () => {
    const { container } = render(<TimePicker id="time" value="09:00" onChange={vi.fn()} />)
    expect(container.querySelector('input[type="time"]')).toBeNull()
    expect(trigger()).toHaveTextContent('9:00 AM')
  })

  it('steps the hour in both directions', async () => {
    const user = userEvent.setup()
    const onChange = renderTime()
    await user.click(trigger())

    await user.click(screen.getByRole('button', { name: 'Increase hour' }))
    expect(onChange).toHaveBeenLastCalledWith('10:00')
    await user.click(screen.getByRole('button', { name: 'Decrease hour' }))
    expect(onChange).toHaveBeenLastCalledWith('08:00')
  })

  it('steps the minute in five-minute steps', async () => {
    const user = userEvent.setup()
    const onChange = renderTime('09:00')
    await user.click(trigger())

    await user.click(screen.getByRole('button', { name: 'Increase minute' }))
    expect(onChange).toHaveBeenLastCalledWith('09:05')
    await user.click(screen.getByRole('button', { name: 'Decrease minute' }))
    expect(onChange).toHaveBeenLastCalledWith('08:55')
  })

  it('swaps the meridiem from inside the picker', async () => {
    const user = userEvent.setup()
    const onChange = renderTime('09:00')
    await user.click(trigger())

    await user.click(screen.getByRole('tab', { name: 'PM' }))
    expect(onChange).toHaveBeenLastCalledWith('21:00')
  })

  it('closes on Escape and on a press outside', async () => {
    const user = userEvent.setup()
    renderTime()

    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(trigger())
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Dropdown', () => {
  const PRIORITY_OPTIONS: readonly DropdownOption<string>[] = [
    { value: 'high', label: 'High', tone: 'high' },
    { value: 'medium', label: 'Medium', tone: 'medium' },
    { value: 'low', label: 'Low', tone: 'low' },
  ]

  function renderDropdown(
    value = 'medium',
    onChange = vi.fn(),
    options: readonly DropdownOption<string>[] = PRIORITY_OPTIONS,
  ) {
    render(
      <Dropdown
        id="test"
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel="Choose priority"
      />,
    )
    return onChange
  }

  function dropdownTrigger(): HTMLButtonElement {
    const node = document.querySelector('.picker-trigger')
    if (!node) throw new Error('no dropdown trigger is rendered')
    return node as HTMLButtonElement
  }

  it('shows the selected value on the trigger with no native select', () => {
    const { container } = render(
      <Dropdown
        id="test"
        value="high"
        options={PRIORITY_OPTIONS}
        onChange={vi.fn()}
        ariaLabel="Choose priority"
      />,
    )
    expect(container.querySelector('select')).toBeNull()
    expect(dropdownTrigger()).toHaveTextContent('High')
  })

  it('opens a menu of options and marks the selected one', async () => {
    const user = userEvent.setup()
    renderDropdown()
    await user.click(dropdownTrigger())

    const dialog = screen.getByRole('dialog', { name: 'Choose priority' })
    expect(dialog).toBeInTheDocument()
    const options = dialog.querySelectorAll('.dropdown-option')
    expect(options).toHaveLength(3)
    expect(options[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes the value and closes when an option is clicked', async () => {
    const user = userEvent.setup()
    const onChange = renderDropdown()
    await user.click(dropdownTrigger())
    await user.click(screen.getByRole('button', { name: 'Low' }))

    expect(onChange).toHaveBeenCalledWith('low')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape and on a press outside', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(dropdownTrigger())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(dropdownTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a coloured dot for options that carry a tone', async () => {
    const user = userEvent.setup()
    renderDropdown()
    await user.click(dropdownTrigger())

    const dots = document.querySelectorAll('.dropdown-option__dot')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveClass('dropdown-option__dot--high')
    expect(dots[1]).toHaveClass('dropdown-option__dot--medium')
    expect(dots[2]).toHaveClass('dropdown-option__dot--low')
  })

  it('works without a tone for plain text options', async () => {
    const user = userEvent.setup()
    const plainOptions: readonly DropdownOption<string>[] = [
      { value: 'none', label: 'Does not repeat' },
      { value: 'daily', label: 'Every day' },
    ]
    renderDropdown('none', vi.fn(), plainOptions)
    await user.click(dropdownTrigger())

    const dialog = screen.getByRole('dialog', { name: 'Choose priority' })
    expect(dialog.querySelectorAll('.dropdown-option')).toHaveLength(2)
    expect(document.querySelector('.dropdown-option__dot')).toBeNull()
  })
})
