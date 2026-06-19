import { ConfirmDialog } from 'benchmaker'

// ConfirmDialog wraps AlertDialog; rendered open so the card shows the modal
// itself (cfg.overrides.ConfirmDialog: cardMode 'single', 700x460). The
// destructive variant adds the warning icon next to the title.
export const Destructive = () => (
  <ConfirmDialog
    open
    onOpenChange={() => {}}
    onConfirm={() => {}}
    variant="destructive"
    title="Delete benchmark run?"
    description="This permanently removes the run and all 128 of its results, including every judge score for Claude Opus 4.8 and Gemini 2.5 Pro. This action cannot be undone."
    confirmLabel="Delete run"
    cancelLabel="Cancel"
  />
)
