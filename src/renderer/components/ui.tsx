import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'

/**
 * The reusable half of the design system. Every visual value comes from
 * tokens.css — no hex, radius or spacing literal appears in this file.
 */

/* ----------------------------------------------------------------- icons */

interface IconProps {
  size?: number
}

/** Every icon is decorative: the accessible name always lives on the control. */
function Icon({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconPlus({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  )
}

export function IconMinus({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 8h10" />
    </Icon>
  )
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M3 8.5l3.5 3.5L13 5" />
    </Icon>
  )
}

export function IconEdit({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10z" />
    </Icon>
  )
}

export function IconTrash({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 8.2a1 1 0 001 .8h4.6a1 1 0 001-.8L12 4.5" />
    </Icon>
  )
}

export function IconClose({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  )
}

export function IconRepeat({ size = 14 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2.5 6.5A3.5 3.5 0 016 3h7M13.5 9.5A3.5 3.5 0 0110 13H3" />
      <path d="M11 1l2 2-2 2M5 11l-2 2 2 2" />
    </Icon>
  )
}

export function IconPlay({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M5 3.5l7 4.5-7 4.5z" />
    </Icon>
  )
}

export function IconPause({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6 3.5v9M10 3.5v9" />
    </Icon>
  )
}

export function IconSkip({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 3.5l6 4.5-6 4.5z" />
      <path d="M12.5 3.5v9" />
    </Icon>
  )
}

export function IconReset({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M13.5 8a5.5 5.5 0 11-1.8-4.1" />
      <path d="M13.5 2v3.5H10" />
    </Icon>
  )
}

export function IconCalendar({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2.5 4.5h11v9h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3" />
    </Icon>
  )
}

export function IconClock({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8 2.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM8 5v3.2l2.2 1.3" />
    </Icon>
  )
}

export function IconChevronLeft({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M10 3.5L5.5 8l4.5 4.5" />
    </Icon>
  )
}

export function IconChevronRight({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </Icon>
  )
}

/* --------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'text'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  text: 'button-text-link',
}

export function Button({ variant = 'primary', className, type, ...rest }: ButtonProps) {
  const classes = [BUTTON_CLASS[variant], className].filter(Boolean).join(' ')
  return <button type={type ?? 'button'} className={classes} {...rest} />
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({ label, tone = 'default', className, type, ...rest }: IconButtonProps) {
  const classes = ['button-icon-circular', tone === 'danger' ? 'danger-link' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      aria-label={label}
      title={label}
      {...rest}
    />
  )
}

/* ---------------------------------------------------------------- badges */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'strong'

const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: '',
  accent: 'badge-pill--accent',
  success: 'badge-pill--success',
  warning: 'badge-pill--warning',
  error: 'badge-pill--error',
  strong: 'badge-pill--strong',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  const classes = ['badge-pill', BADGE_CLASS[tone], className].filter(Boolean).join(' ')
  return <span className={classes}>{children}</span>
}

export function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return (
    <Badge className={`priority-badge priority-badge--${priority}`}>
      <span className="priority-badge__dot" />
      {priority[0]?.toUpperCase()}
      {priority.slice(1)}
    </Badge>
  )
}

/* ------------------------------------------------------------ pill group */

/** A pill's value, and a group's: booleans included, because an On/Off choice
 *  is a segmented control too and a string round-trip would only hide it. */
export type PillValue = string | number | boolean

export interface PillOption<T extends PillValue> {
  value: T
  label: string
  /** BEM modifier for an option that needs its own treatment, e.g. a priority. */
  className?: string
}

interface PillGroupProps<T extends PillValue> {
  label: string
  value: T
  options: readonly PillOption<T>[]
  onChange: (value: T) => void
}

/** Segmented control for switching between closely related views or modes. */
export function PillGroup<T extends PillValue>({
  label,
  value,
  options,
  onChange,
}: PillGroupProps<T>) {
  return (
    <div className="nav-pill-group" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="tab"
          className={['category-tab', option.className].filter(Boolean).join(' ')}
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- dropdown */

export interface DropdownOption<T extends string | number> {
  value: T
  label: string
  /** Semantic indicator tone for options that carry a colour mark. */
  tone?: 'low' | 'medium' | 'high'
}

interface DropdownProps<T extends string | number> {
  id: string
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

/**
 * A custom dropdown that replaces native `<select>`. Shares the picker trigger
 * and popover pattern so every custom control in the app feels like one system.
 */
export function Dropdown<T extends string | number>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  useDismiss(open, container, () => setOpen(false))

  const selected = options.find((opt) => opt.value === value)
  const classes = ['picker-trigger', open ? 'picker-trigger--open' : ''].filter(Boolean).join(' ')

  return (
    <div className="picker-anchor" ref={container}>
      <button
        type="button"
        id={id}
        className={classes}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        {selected?.tone ? (
          <span className={`dropdown-trigger__dot dropdown-trigger__dot--${selected.tone}`} />
        ) : null}
        {selected?.label ?? ''}
      </button>

      {open ? (
        <div
          className="picker-popover picker-popover--menu"
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={[
                'dropdown-option',
                option.value === value ? 'dropdown-option--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={option.value === value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.tone ? (
                <span className={`dropdown-option__dot dropdown-option__dot--${option.tone}`} />
              ) : null}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------- empty states */

/** No action slot: the column header owns the one add trigger, so a second one
 *  inside the empty state would be a duplicate. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{body}</p>
    </div>
  )
}

/* ----------------------------------------------------------------- field */

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  const classes = ['field', className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- stepper */

/**
 * A label with a pair of buttons around a value. The app's own stepper, so the
 * hour and minute of a time never fall back to a number input, which is the one
 * control the operating system would dress up on its own. It is a `fieldset`
 * with a `legend`, so the group is named the way a form names a group and the
 * label belongs to the whole row. A quantity that deserves to be read as a
 * wheel rather than as a row is `Wheel` instead.
 */
export function Stepper({
  label,
  rowClassName,
  value,
  decreaseLabel,
  increaseLabel,
  canDecrease = true,
  canIncrease = true,
  onStep,
}: {
  label: string
  rowClassName?: string
  value: string
  decreaseLabel: string
  increaseLabel: string
  canDecrease?: boolean
  canIncrease?: boolean
  onStep: (delta: -1 | 1) => void
}) {
  const classes = ['stepper-row', rowClassName].filter(Boolean).join(' ')
  return (
    <fieldset className={classes}>
      <legend className="stepper-row__label">{label}</legend>
      <div className="stepper">
        <IconButton label={decreaseLabel} disabled={!canDecrease} onClick={() => onStep(-1)}>
          <IconMinus />
        </IconButton>
        <span className="stepper__value">{value}</span>
        <IconButton label={increaseLabel} disabled={!canIncrease} onClick={() => onStep(1)}>
          <IconPlus />
        </IconButton>
      </div>
    </fieldset>
  )
}

/* ----------------------------------------------------------------- wheel */

/** '02' and '00': a wheel writes its value the way a clock does. */
const pad = (value: number) => String(value).padStart(2, '0')

/**
 * One column of a wheel: the chosen value in the middle with a plus above it and a
 * minus below it rather than beside it, the order a phone stacks a wheel in, so
 * the column reads as a wheel and not as a row of controls. The value is the only
 * number in the column, so it is also the only thing a screen reader announces.
 */
export function Wheel({
  label,
  value,
  decreaseLabel,
  increaseLabel,
  canDecrease = true,
  canIncrease = true,
  unit,
  onStep,
}: {
  label: string
  value: number
  decreaseLabel: string
  increaseLabel: string
  canDecrease?: boolean
  canIncrease?: boolean
  unit?: string
  onStep: (delta: -1 | 1) => void
}) {
  return (
    <fieldset className="wheel">
      <legend className="wheel__label">{label}</legend>

      <IconButton label={increaseLabel} disabled={!canIncrease} onClick={() => onStep(1)}>
        <IconPlus />
      </IconButton>
      <span className="wheel__value" key={value}>
        {pad(value)}
      </span>
      {unit ? <span className="wheel__unit">{unit}</span> : null}
      <IconButton label={decreaseLabel} disabled={!canDecrease} onClick={() => onStep(-1)}>
        <IconMinus />
      </IconButton>
    </fieldset>
  )
}
