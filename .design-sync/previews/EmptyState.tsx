import { EmptyState, Button } from 'benchmaker'
import { FlaskConical, Plus, AlertTriangle } from 'lucide-react'

export const Default = () => (
  <div style={{ padding: 24 }}>
    <EmptyState
      icon={FlaskConical}
      title="No benchmarks yet"
      description="Create your first benchmark to compare models across a suite of test cases."
    />
  </div>
)

export const WithSteps = () => (
  <div style={{ padding: 24 }}>
    <EmptyState
      icon={Plus}
      title="Set up a new run"
      description="Three steps to compare models on your prompts."
      steps={[
        { number: 1, title: 'Add models', description: 'Pick from gpt-4o, claude-3.5-sonnet, llama-3.1-70b.', completed: true },
        { number: 2, title: 'Import test cases', description: 'Upload 128 prompts with reference answers.' },
        { number: 3, title: 'Choose a judge', description: 'Select the LLM that scores each response.' },
      ]}
      action={<Button size="sm">Start run</Button>}
    />
  </div>
)

export const Warning = () => (
  <div style={{ padding: 24 }}>
    <EmptyState
      variant="warning"
      icon={AlertTriangle}
      title="No results to show"
      description="The last run was cancelled before any cases completed. Re-run to populate results."
      action={<Button size="sm" variant="outline">Re-run benchmark</Button>}
    />
  </div>
)
