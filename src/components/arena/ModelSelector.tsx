import { useState, useMemo } from 'react'
import { Search, Loader2, X, SlidersHorizontal, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { useModelStore } from '@/stores/modelStore'
import { useCodeArenaStore } from '@/stores/codeArenaStore'

type PriceRange = 'all' | 'free' | 'cheap' | 'medium' | 'expensive'
type ContextRange = 'all' | '8k+' | '32k+' | '128k+' | '200k+'

const PRICE_RANGES: { value: PriceRange; label: string; max?: number; min?: number }[] = [
  { value: 'all', label: 'All Prices' },
  { value: 'free', label: 'Free', max: 0 },
  { value: 'cheap', label: '<$1/M', max: 0.000001 },
  { value: 'medium', label: '$1-10/M', min: 0.000001, max: 0.00001 },
  { value: 'expensive', label: '>$10/M', min: 0.00001 },
]

const CONTEXT_RANGES: { value: ContextRange; label: string; min?: number }[] = [
  { value: 'all', label: 'Any Context' },
  { value: '8k+', label: '8K+', min: 8000 },
  { value: '32k+', label: '32K+', min: 32000 },
  { value: '128k+', label: '128K+', min: 128000 },
  { value: '200k+', label: '200K+', min: 200000 },
]

interface ModelSelectorProps {
  useCodeArenaStore?: boolean
}

export function ModelSelector({ useCodeArenaStore: useCodeArena = false }: ModelSelectorProps) {
  const modelStore = useModelStore()
  const codeArenaStore = useCodeArenaStore()
  
  // Use the appropriate store based on the prop
  const {
    availableModels,
    isLoadingModels,
    modelsError,
  } = modelStore
  
  const selectedModelIds = useCodeArena
    ? codeArenaStore.selectedModelIds
    : modelStore.selectedModelIds
    
  const toggleModelSelection = useCodeArena
    ? codeArenaStore.toggleModelSelection
    : modelStore.toggleModelSelection
    
  const clearSelectedModels = useCodeArena
    ? () => codeArenaStore.setSelectedModelIds([])
    : modelStore.clearSelectedModels

  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [priceFilter, setPriceFilter] = useState<PriceRange>('all')
  const [contextFilter, setContextFilter] = useState<ContextRange>('all')
  const [showFilters, setShowFilters] = useState(false)
  const searchTerm = searchQuery.trim().toLowerCase()

  // Extract unique providers
  const providers = useMemo(() => {
    const providerSet = new Set<string>()
    availableModels.forEach((model) => {
      const matchesSearch =
        !searchTerm ||
        model.id.toLowerCase().includes(searchTerm) ||
        model.name.toLowerCase().includes(searchTerm)
      if (!matchesSearch) return

      const provider = model.id.split('/')[0]
      if (provider) providerSet.add(provider)
    })
    return Array.from(providerSet).sort()
  }, [availableModels, searchTerm])

  // Filter models
  const filteredModels = useMemo(() => {
    return availableModels.filter((model) => {
      const matchesSearch =
        !searchTerm ||
        model.id.toLowerCase().includes(searchTerm) ||
        model.name.toLowerCase().includes(searchTerm)

      const matchesProvider =
        !providerFilter || model.id.startsWith(`${providerFilter}/`)

      // Price filter
      const promptPrice = parseFloat(model.pricing.prompt) || 0
      const priceRange = PRICE_RANGES.find((r) => r.value === priceFilter)
      let matchesPrice = true
      if (priceRange && priceFilter !== 'all') {
        if (priceRange.max !== undefined && priceRange.min !== undefined) {
          matchesPrice = promptPrice >= priceRange.min && promptPrice <= priceRange.max
        } else if (priceRange.max !== undefined) {
          matchesPrice = promptPrice <= priceRange.max
        } else if (priceRange.min !== undefined) {
          matchesPrice = promptPrice >= priceRange.min
        }
      }

      // Context length filter
      const contextRange = CONTEXT_RANGES.find((r) => r.value === contextFilter)
      const matchesContext =
        contextFilter === 'all' || (contextRange?.min !== undefined && model.context_length >= contextRange.min)

      return matchesSearch && matchesProvider && matchesPrice && matchesContext
    })
  }, [availableModels, searchTerm, providerFilter, priceFilter, contextFilter])

  const activeFilterCount = [
    priceFilter !== 'all',
    contextFilter !== 'all',
    providerFilter !== null,
  ].filter(Boolean).length

  const providersForTags = useMemo(() => {
    if (providerFilter && !providers.includes(providerFilter)) {
      return [providerFilter, ...providers]
    }
    return providers
  }, [providers, providerFilter])

  const handleProviderWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    if (container.scrollWidth <= container.clientWidth) return
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY
      event.preventDefault()
    }
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price)
    if (num === 0) return 'Free'
    return `$${(num * 1000000).toFixed(2)}/M`
  }

  if (isLoadingModels) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading models...</span>
        </CardContent>
      </Card>
    )
  }

  if (modelsError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{modelsError}</p>
        </CardContent>
      </Card>
    )
  }

  const clearAllFilters = () => {
    setProviderFilter(null)
    setPriceFilter('all')
    setContextFilter('all')
    setSearchQuery('')
  }

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Model Selection</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {filteredModels.length} of {availableModels.length} models
              {selectedModelIds.length > 0 && ` • ${selectedModelIds.length} selected`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <SlidersHorizontal className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {selectedModelIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelectedModels}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-4 overflow-hidden p-0 px-4 pb-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {showFilters && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filters
              </span>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAllFilters}>
                  Clear all
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Price (per 1M tokens)</span>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_RANGES.map((range) => (
                  <Badge
                    key={range.value}
                    variant={priceFilter === range.value ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setPriceFilter(range.value)}
                  >
                    {range.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Context Length</span>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_RANGES.map((range) => (
                  <Badge
                    key={range.value}
                    variant={contextFilter === range.value ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setContextFilter(range.value)}
                  >
                    {range.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hidden"
          onWheel={handleProviderWheel}
        >
          <Badge
            variant={providerFilter === null ? 'default' : 'outline'}
            className="cursor-pointer shrink-0"
            onClick={() => setProviderFilter(null)}
          >
            All
          </Badge>
          {providersForTags.map((provider) => (
            <Badge
              key={provider}
              variant={providerFilter === provider ? 'default' : 'outline'}
              className="cursor-pointer shrink-0"
              onClick={() =>
                setProviderFilter(providerFilter === provider ? null : provider)
              }
            >
              {provider}
            </Badge>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 pb-4">
            {filteredModels.map((model) => {
              const isSelected = selectedModelIds.includes(model.id)
              return (
                <div
                  key={model.id}
                  className={`flex items-center gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-l-2 border-l-primary shadow-none'
                      : 'hover:bg-muted/50 hover:border-l-2 hover:border-l-primary'
                  }`}
                  onClick={() => toggleModelSelection(model.id)}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{model.name}</div>
                      {isSelected && (
                        <Badge variant="outline" className="text-[10px]">
                          selected
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {model.id}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">
                      {model.context_length.toLocaleString()} ctx
                    </div>
                    <div className="text-xs font-medium">
                      {formatPrice(model.pricing.prompt)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
