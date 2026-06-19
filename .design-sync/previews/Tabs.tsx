import { Tabs, TabsList, TabsTrigger, TabsContent } from 'benchmaker'

const body = { marginTop: 4, fontSize: 14, lineHeight: 1.5, color: 'var(--color-muted-foreground)' }

export const Default = () => (
  <div style={{ padding: 24, maxWidth: 480 }}>
    <Tabs defaultValue="results">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="prompts">Prompts</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="results">
        <p style={body}>Comparison across 4 models over 128 test cases, scored by an LLM judge.</p>
      </TabsContent>
      <TabsContent value="prompts">
        <p style={body}>Manage system prompts and per-case test inputs for this suite.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p style={body}>Configure temperature, max tokens, and the judge model.</p>
      </TabsContent>
    </Tabs>
  </div>
)
