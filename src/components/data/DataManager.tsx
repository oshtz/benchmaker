import { LocalDbPanel } from './LocalDbPanel'

export function DataManager() {
  return (
    <div className="h-full min-h-0 flex flex-col gap-6 w-full">
      <div className="surface-strong rounded-3xl p-5 shrink-0">
        <h2 className="headline">Data Vault</h2>
        <p className="text-sm text-muted-foreground">
          Inspect the live JSON store and patch it directly for reproducible runs.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <LocalDbPanel />
      </div>
    </div>
  )
}
