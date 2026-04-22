import { useTheme } from 'next-themes'
import { useSyncExternalStore, useCallback } from 'react'
import { Sun, Moon, Contrast, CloudMoon, Circle } from 'lucide-react'

const themes = [
  { name: 'light', label: 'Light', icon: Sun },
  { name: 'dark', label: 'Dark', icon: Moon },
  { name: 'high-contrast', label: 'High Contrast', icon: Contrast },
  { name: 'night-mode', label: 'Night', icon: CloudMoon },
  { name: 'pitch-dark', label: 'Pitch Dark', icon: Circle },
] as const

function useMounted() {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false
  )
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    return (
      <button className="w-8 h-8 flex items-center justify-center text-muted">
        <Sun className="w-5 h-5" />
      </button>
    )
  }

  const currentTheme = themes.find((t) => t.name === theme) || themes[0]
  const Icon = currentTheme.icon

  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.name === theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex].name)
  }

  return (
    <button
      onClick={cycleTheme}
      className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
      title={`Theme: ${currentTheme.label}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-muted">THEME</span>
      <div className="flex flex-wrap gap-2">
        {themes.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`flex items-center gap-2 px-3 py-2 border text-sm transition-colors ${
                theme === t.name
                  ? 'bg-primary-container text-on-primary border-primary-container'
                  : 'bg-surface text-foreground border-outline-variant hover:border-primary-container'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
