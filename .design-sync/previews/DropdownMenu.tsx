import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Button,
} from 'benchmaker'

// Rendered open so the card shows the popper menu (cfg.overrides.DropdownMenu:
// cardMode 'single', 440x460). If the open menu mispositions/escapes the card,
// fall back to the closed trigger Button (remove `open`) — see learnings.
export const Default = () => (
  <DropdownMenu open>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Run actions</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>Opus 4.8 vs GPT-5</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>View results</DropdownMenuItem>
      <DropdownMenuItem>Export results</DropdownMenuItem>
      <DropdownMenuItem>Duplicate run</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Delete run</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)
