import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from 'benchmaker'

// Rendered open so the card shows the dialog itself (see cfg.overrides.Dialog:
// cardMode 'single'). The overlay fills the card; the content centers in it.
export const Default = () => (
  <Dialog open>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete benchmark run?</DialogTitle>
        <DialogDescription>
          This permanently removes the run and all 128 of its results. This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete run</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
