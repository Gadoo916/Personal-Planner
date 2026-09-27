import { useId, useState } from 'react'
import { Button, Field } from './ui'

interface ProfileGateProps {
  onSave: (name: string) => void
}

/**
 * The one thing the first launch asks for: a name. No account, no email, no
 * password, because the planner has no backend to authenticate against and a
 * name is the only thing the welcome line is ever going to read.
 */
export function ProfileGate({ onSave }: ProfileGateProps) {
  const nameId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (cleanName === '') {
      setError('A name is required.')
      return
    }
    setError(null)
    onSave(cleanName)
  }

  return (
    <div className="app-shell">
      <form className="onboarding" onSubmit={handleSubmit} aria-label="Set up your planner">
        <div className="onboarding__panel">
          <h1 className="app-title">Personal Planner</h1>
          <p className="onboarding__greeting">Welcome</p>

          <Field label="Your name" htmlFor={nameId}>
            <input
              id={nameId}
              className="text-input"
              type="text"
              value={name}
              maxLength={200}
              placeholder="Hisham"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <div className="onboarding__actions">
            <Button type="submit">Start planning</Button>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  )
}
