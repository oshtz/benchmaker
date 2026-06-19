import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from 'benchmaker'

// Rendered open so the card shows the modal itself (cfg.overrides.AlertDialog:
// cardMode 'single', 700x460). The overlay fills the card; content centers.
export const Default = () => (
  <AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard unsaved benchmark?</AlertDialogTitle>
        <AlertDialogDescription>
          You have an in-progress run comparing Claude Opus 4.8 and GPT-5 across
          48 prompts. Leaving now discards the configuration and any partial
          results.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep editing</AlertDialogCancel>
        <AlertDialogAction>Discard</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
