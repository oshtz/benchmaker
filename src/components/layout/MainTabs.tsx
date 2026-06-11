import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { BarChart, Database, FileText, Play, LineChart, Code2 } from 'lucide-react'
import { PromptManager } from '@/components/prompt-manager/PromptManager'
import { Arena } from '@/components/arena/Arena'
import { CodeArena } from '@/components/code-arena/CodeArena'
import { Results } from '@/components/results/Results'
import { Analytics } from '@/components/analytics/Analytics'
import { DataManager } from '@/components/data/DataManager'

const tabs = [
  { value: 'prompts', label: 'Prompts', Icon: FileText },
  { value: 'arena', label: 'Arena', Icon: Play },
  { value: 'code-arena', label: 'Code Arena', Icon: Code2 },
  { value: 'results', label: 'Results', Icon: BarChart },
  { value: 'analytics', label: 'Analytics', Icon: LineChart },
  { value: 'data', label: 'Data', Icon: Database },
]

export function MainTabsList({ className }: { className?: string }) {
  return (
    <TabsList className={cn("inline-flex max-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/40 bg-black/10 p-1.5 px-2 shadow-inner backdrop-blur-xl scrollbar-hidden dark:bg-black/30 sm:gap-2 sm:rounded-2xl sm:p-2 sm:px-3 lg:px-4", className)}>
      {tabs.map(({ value, label, Icon }) => (
        <TabsTrigger key={value} value={value} aria-label={label} className="group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background/60 data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:rounded-xl sm:px-4">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-data-[state=active]:text-primary" />
          <span className="hidden sm:inline font-semibold">{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

export function MainTabs() {
  return (
    <>
      <TabsContent value="prompts" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <PromptManager />
        </div>
      </TabsContent>

      <TabsContent value="arena" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <Arena />
        </div>
      </TabsContent>

      <TabsContent value="code-arena" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <CodeArena />
        </div>
      </TabsContent>

      <TabsContent value="results" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <Results />
        </div>
      </TabsContent>

      <TabsContent value="analytics" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <Analytics />
        </div>
      </TabsContent>

      <TabsContent value="data" className="mt-0 pt-4 flex-1 min-h-0 animate-fade-up">
        <div className="w-full h-full min-h-0">
          <DataManager />
        </div>
      </TabsContent>
    </>
  )
}
