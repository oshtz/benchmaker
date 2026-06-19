import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'benchmaker'

// Rendered open so the card shows the popper list (cfg.overrides.Select:
// cardMode 'single', 420x460). If the open list mispositions/escapes the card,
// fall back to the closed trigger (remove `open`) — see learnings.
export const Default = () => (
  <Select defaultValue="opus" open>
    <SelectTrigger style={{ width: 280 }}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="opus">Claude Opus 4.8</SelectItem>
      <SelectItem value="sonnet">Claude Sonnet 4.6</SelectItem>
      <SelectItem value="gpt5">GPT-5</SelectItem>
      <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
    </SelectContent>
  </Select>
)
