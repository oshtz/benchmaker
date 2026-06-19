import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from 'benchmaker'

const muted = { color: 'var(--color-muted-foreground)' }
const stat = { display: 'flex', justifyContent: 'space-between', fontSize: 14 }

export const Default = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <Card>
      <CardHeader>
        <CardTitle>Claude Opus 4.8</CardTitle>
        <CardDescription>Latest run · 128 test cases</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={stat}><span style={muted}>Accuracy</span><strong>94.2%</strong></div>
          <div style={stat}><span style={muted}>Avg latency</span><strong>1.8s</strong></div>
          <div style={stat}><span style={muted}>Total cost</span><strong>$0.42</strong></div>
        </div>
      </CardContent>
      <CardFooter style={{ justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="ghost" size="sm">Dismiss</Button>
        <Button size="sm">View report</Button>
      </CardFooter>
    </Card>
  </div>
)
