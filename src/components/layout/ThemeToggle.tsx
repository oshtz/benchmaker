import { useEffect } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Settings } from '@/types'

export function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore()

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (resolvedTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)
    }

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      applyTheme(systemTheme)

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      applyTheme(theme)
    }
  }, [theme])

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const themeLabel =
    theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as Settings['theme'])}>
      <SelectTrigger className="w-[130px]">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span>{themeLabel}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Light
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Dark
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            System
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
