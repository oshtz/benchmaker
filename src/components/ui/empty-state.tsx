import { type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { cn } from '@/lib/utils'

interface Step {
  number: number
  title: string
  description: string
  completed?: boolean
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  steps?: Step[]
  action?: React.ReactNode
  variant?: 'default' | 'warning' | 'info'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const iconColors = {
    default: 'text-primary',
    warning: 'text-amber-500',
    info: 'text-sky-500',
  }

  return (
    <Card className={cn('max-w-2xl mx-auto relative overflow-hidden', className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardHeader className="text-center pb-2 space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 shadow-sm">
          <Icon className={cn('h-8 w-8', iconColors[variant])} />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </div>
      </CardHeader>

      {steps && steps.length > 0 && (
        <CardContent className="pt-2">
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                  step.completed
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-muted/40 border-border/60'
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold',
                    step.completed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {step.completed ? 'OK' : step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium text-sm',
                      step.completed && 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {action && (
        <CardContent className={cn('flex justify-center', steps ? 'pt-2' : 'pt-0')}>
          {action}
        </CardContent>
      )}
    </Card>
  )
}
