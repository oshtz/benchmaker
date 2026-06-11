import { useEffect, useState } from 'react'
import { Eye, EyeOff, Check, X, Loader2, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/settingsStore'
import { clearOpenRouterClient, getOpenRouterClient } from '@/services/openrouter'
import { clearStoredApiKey, loadStoredApiKey, saveStoredApiKey } from '@/services/secureApiKey'
import { useToast } from '@/components/ui/use-toast'

export function ApiKeyManager() {
  const { apiKey, setApiKey, clearApiKey } = useSettingsStore()
  const [inputKey, setInputKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let active = true

    void loadStoredApiKey()
      .then((storedKey) => {
        if (!active || !storedKey) return
        if (!useSettingsStore.getState().apiKey) {
          setApiKey(storedKey)
          setInputKey(storedKey)
        }
      })
      .catch((error) => {
        toast({
          title: 'API Key Unavailable',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to read the API key from the OS credential store',
          variant: 'destructive',
        })
      })

    return () => {
      active = false
    }
  }, [setApiKey, toast])

  const handleValidateAndSave = async () => {
    const trimmedKey = inputKey.trim()

    if (!trimmedKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      })
      return
    }

    setIsValidating(true)
    setIsValid(null)

    try {
      const client = getOpenRouterClient(trimmedKey)
      const valid = await client.validateApiKey()

      if (valid) {
        await saveStoredApiKey(trimmedKey)
        setApiKey(trimmedKey)
        setIsValid(true)
        toast({
          title: 'Success',
          description: 'API key validated and saved',
        })
        setOpen(false)
      } else {
        setIsValid(false)
        toast({
          title: 'Invalid API Key',
          description: 'The API key could not be validated',
          variant: 'destructive',
        })
      }
    } catch (error) {
      setIsValid(false)
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Failed to validate API key',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleClear = async () => {
    try {
      await clearStoredApiKey()
      clearOpenRouterClient()
      clearApiKey()
      setInputKey('')
      setIsValid(null)
      toast({
        title: 'API Key Cleared',
        description: 'Your API key has been removed',
      })
    } catch (error) {
      toast({
        title: 'Clear Failed',
        description:
          error instanceof Error ? error.message : 'Failed to remove the API key from storage',
        variant: 'destructive',
      })
    }
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={apiKey ? 'outline' : 'default'}
          size="sm"
          aria-label={apiKey ? 'API Key Set' : 'Set API Key'}
          className="gap-2 px-2.5 sm:px-3"
        >
          <Key className="h-4 w-4" />
          <span className="hidden sm:inline">{apiKey ? 'API Key Set' : 'Set API Key'}</span>
          <span className="sm:hidden">Key</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OpenRouter API Key</DialogTitle>
          <DialogDescription>
            Enter your OpenRouter API key to enable model access. In the desktop app, your key is stored in the OS credential store.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {apiKey && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/50 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Saved key
                </div>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {maskedKey}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear} aria-label="Clear API key">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value)
                  setIsValid(null)
                }}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleValidateAndSave}
              disabled={isValidating || !inputKey.trim()}
              className="flex-1"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Validate & Save
                </>
              )}
            </Button>

            {isValid === true && (
              <div className="flex items-center text-green-600">
                <Check className="h-5 w-5" />
              </div>
            )}
            {isValid === false && (
              <div className="flex items-center text-red-600">
                <X className="h-5 w-5" />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              openrouter.ai/keys
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
