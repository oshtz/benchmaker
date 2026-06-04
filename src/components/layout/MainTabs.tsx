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
    <TabsList className={cn("inline-flex gap-2 bg-black/10 dark:bg-black/30 border border-border/40 p-2 px-3 sm:px-4 rounded-2xl backdrop-blur-xl shadow-inner overflow-x-auto max-w-full scrollbar-hidden", className)}>
      {tabs.map(({ value, label, Icon }) => (
        <TabsTrigger key={value} value={value} className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground data-[state=active]:bg-background/60 data-[state=active]:text-foreground data-[state=active]:shadow-sm whitespace-nowrap shrink-0">
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
