/** The app's three views. A view is component state: there is no route and no URL. */
export type AppView = 'home' | 'profile' | 'focus'

const ITEMS: readonly { id: AppView; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'profile', label: 'Profile' },
  { id: 'focus', label: 'Focus Session' },
]

interface BottomNavigationProps {
  view: AppView
  onChange: (view: AppView) => void
}

/**
 * The whole of the app's navigation. The bar never changes which items it holds
 * and never hides itself: all three views have it, and there is no view that
 * could be reached without passing through it.
 */
export function BottomNavigation({ view, onChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="Views">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="bottom-nav__item"
          aria-current={view === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
