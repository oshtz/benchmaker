import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/use-toast'
import { useUpdateStore } from '@/stores/updateStore'

export function AutoUpdater() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [prompted, setPrompted] = useState(false)
  const { status, updateInfo, updatePath, checkNow, downloadNow, installNow } = useUpdateStore()

  useEffect(() => {
    let active = true

    const runUpdateCheck = async () => {
      try {
        const info = await checkNow()
        if (!active || !info) return

        toast({
          title: 'Update available',
          description: `Version ${info.version} is available. Downloading now...`,
        })

        const path = await downloadNow(info)
        if (!active) return

        if (path) {
          setDialogOpen(true)
          setPrompted(true)
        }
      } catch (error) {
        if (active) {
          console.warn('Auto-update check failed:', error)
        }
      }
    }

    void runUpdateCheck()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!prompted && status === 'ready' && updateInfo && updatePath) {
      setDialogOpen(true)
      setPrompted(true)
    }
  }, [prompted, status, updateInfo, updatePath])

  const handleInstall = async () => {
    if (!updatePath) return

    toast({
      title: 'Installing update',
      description: 'Benchmaker will restart to finish installing.',
    })

    try {
      await installNow()
    } catch (error) {
      console.error('Update install failed:', error)
      toast({
        title: 'Update failed',
        description: 'Could not install the update. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  if (!updateInfo) {
    return null
  }

  return (
    <ConfirmDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title={`Update ready (${updateInfo.version})`}
      description="Benchmaker has downloaded the latest version. Restart now to finish installing."
      confirmLabel="Restart now"
      cancelLabel="Later"
      onConfirm={handleInstall}
    />
  )
}
