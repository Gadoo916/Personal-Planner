/**
 * The name the user gave, and the app it belongs to. It heads the main column
 * and carries nothing else: no counts, no date, and no actions. The Profile is
 * reached from the bottom navigation, so a button here would only duplicate it.
 */
export function Welcome({ name }: { name: string }) {
  return (
    <header className="welcome">
      <p className="welcome__greeting">{`Welcome, ${name}`}</p>
      <h1 className="app-title">Personal Planner</h1>
    </header>
  )
}
