import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useCodeArenaStore } from '@/stores/codeArenaStore'
import { DEFAULT_FRONTEND_SYSTEM_PROMPT } from '@/services/codeExtractor'

export function CodeArenaHeader() {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const { prompt, systemPrompt, setPrompt, setSystemPrompt, resetSystemPrompt } = useCodeArenaStore()

  const isDefaultSystemPrompt = systemPrompt === DEFAULT_FRONTEND_SYSTEM_PROMPT

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Main prompt input */}
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-sm font-medium">
            What would you like to build?
          </Label>
          <Textarea
            id="prompt"
            placeholder="Describe the frontend you want to create... (e.g., 'A modern landing page for a coffee shop with a hero section, menu, and contact form')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Collapsible system prompt editor */}
        <Collapsible open={systemPromptOpen} onOpenChange={setSystemPromptOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                <Settings2 className="h-4 w-4" />
                System Prompt
                {systemPromptOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>

            {!isDefaultSystemPrompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSystemPrompt}
                className="gap-2 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default
              </Button>
            )}
          </div>

          <CollapsibleContent className="mt-2">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Customize the system prompt to control how models generate frontend code.
              </p>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                placeholder="Enter system prompt..."
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
