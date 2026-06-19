import { Button } from 'benchmaker'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'

const row = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 24 } as const

export const Variants = () => (
  <div style={row}>
    <Button>Run benchmark</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Delete run</Button>
    <Button variant="link">View details</Button>
  </div>
)

export const Sizes = () => (
  <div style={row}>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add model">
      <Plus className="h-4 w-4" />
    </Button>
  </div>
)

export const States = () => (
  <div style={row}>
    <Button disabled>Disabled</Button>
    <Button>
      Continue <ArrowRight className="h-4 w-4" />
    </Button>
    <Button variant="destructive">
      <Trash2 className="h-4 w-4" /> Remove
    </Button>
  </div>
)
