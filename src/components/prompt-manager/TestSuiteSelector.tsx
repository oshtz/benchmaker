import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import { useState } from 'react'

export function TestSuiteSelector() {
  const { testSuites, activeTestSuiteId, setActiveTestSuite, deleteTestSuite } =
    useTestSuiteStore()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const activeTestSuite = testSuites.find((s) => s.id === activeTestSuiteId)

  const handleDelete = () => {
    if (activeTestSuiteId) {
      deleteTestSuite(activeTestSuiteId)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeTestSuiteId || ''} onValueChange={setActiveTestSuite}>
        <SelectTrigger className="h-auto w-auto border-0 bg-transparent shadow-none px-0 py-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 gap-2 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:opacity-70">
          <div className="text-left">
            <div className="headline">
              {activeTestSuite?.name || 'Select a suite'}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-normal">
              {activeTestSuite?.description || 'Choose a benchmark suite to edit'}
            </p>
          </div>
        </SelectTrigger>
        <SelectContent align="start" className="w-auto min-w-[280px]">
          {testSuites.map((suite) => (
            <SelectItem key={suite.id} value={suite.id} className="py-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{suite.name}</span>
                {suite.description && (
                  <span className="text-xs text-muted-foreground whitespace-normal">
                    {suite.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeTestSuite && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Test Suite</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{activeTestSuite.name}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
