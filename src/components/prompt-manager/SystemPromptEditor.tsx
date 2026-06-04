import { useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { TestSuite } from '@/types'
import { PromptEnhancerDialog } from './PromptEnhancerDialog'

interface SystemPromptEditorProps {
  testSuite: TestSuite
}

export function SystemPromptEditor({ testSuite }: SystemPromptEditorProps) {
  const { updateSystemPrompt } = useTestSuiteStore()
  const { theme } = useSettingsStore()

  const editorTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'light'
    }
    return theme === 'dark' ? 'vs-dark' : 'light'
  }, [theme])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        updateSystemPrompt(testSuite.id, value)
      }
    },
    [testSuite.id, updateSystemPrompt]
  )

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden bg-transparent">
      <div className="p-4 border-b border-border/40 shrink-0 bg-background/60 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">System Prompt</h3>
            <p className="text-xs text-muted-foreground mt-1">
              The instruction that will be sent to all models as the system message
            </p>
          </div>
          <PromptEnhancerDialog
            testSuite={testSuite}
            target="system"
            currentPrompt={testSuite.systemPrompt}
            onApply={(value) => updateSystemPrompt(testSuite.id, value)}
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-0 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={testSuite.systemPrompt}
          onChange={handleChange}
          theme={editorTheme}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            fontSize: 14,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  )
}
