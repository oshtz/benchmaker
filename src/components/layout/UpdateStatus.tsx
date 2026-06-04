import { useEffect, useMemo } from 'react'
import { ArrowUpRight, RefreshCw, CheckCircle2, AlertTriangle, DownloadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useUpdateStore } from '@/stores/updateStore'

const statusLabels: Record<string, string> = {
  idle: 'Not checked yet.',
  checking: 'Checking for updates...',
  'up-to-date': 'You are up to date.',
  available: 'Update available.',
  downloading: 'Downloading update...',
  ready: 'Update ready to install.',
  installing: 'Installing update...',
  disabled: 'Updates are disabled in this build.',
  error: 'Update check failed.',
}

export function UpdateStatus() {
  const {
    currentVersion,
    status,
    updateInfo,
    updatePath,
    error,
    lastCheckedAt,
    loadCurrentVersion,
    checkNow,
    downloadNow,
    installNow,
  } = useUpdateStore()

  useEffect(() => {
    void loadCurrentVersion()
  }, [loadCurrentVersion])

  const statusLabel = statusLabels[status] ?? 'Update status unavailable.'
  const canCheck = status !== 'checking' && status !== 'downloading' && status !== 'installing'
  const canDownload = status === 'available'
  const canInstall = status === 'ready' && !!updatePath
  const hasUpdate = status === 'available' || status === 'downloading' || status === 'ready'

  const lastCheckedText = useMemo(() => {
    if (!lastCheckedAt) return 'Never'
    return new Date(lastCheckedAt).toLocaleString()
  }, [lastCheckedAt])

  const handleCheck = async () => {
    const info = await checkNow()
    if (info) {
      await downloadNow(info)
    }
  }

  const handleDownload = async () => {
    await downloadNow()
  }

  const handleInstall = async () => {
    await installNow()
  }

  const versionLabel = currentVersion ? `v${currentVersion}` : 'v--'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowUpRight className="h-4 w-4" />
          <span className="text-xs font-mono">{versionLabel}</span>
          {hasUpdate && <Badge className="text-[10px] uppercase">Update</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About Benchmaker</DialogTitle>
          <DialogDescription>Version and update status</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current version</span>
            <span className="font-mono">{versionLabel}</span>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-sm">
            {status === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
            <span>{statusLabel}</span>
          </div>

          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}

          <div className="text-xs text-muted-foreground">
            Last checked: {lastCheckedText}
          </div>

          {updateInfo && (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latest version</span>
                <span className="font-mono">v{updateInfo.version}</span>
              </div>
              {updateInfo.publishedAt && (
                <div className="text-xs text-muted-foreground">
                  Released {new Date(updateInfo.publishedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {updateInfo?.notes && (
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">
                Release notes
              </div>
              <ScrollArea className="h-24 rounded-lg border border-border/60 bg-muted/30 p-3">
                <pre className="text-xs whitespace-pre-wrap">{updateInfo.notes}</pre>
              </ScrollArea>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCheck} disabled={!canCheck}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for updates
            </Button>
            {canDownload && (
              <Button size="sm" onClick={handleDownload}>
                <DownloadCloud className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            {canInstall && (
              <Button size="sm" onClick={handleInstall}>
                Restart to update
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
