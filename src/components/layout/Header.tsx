import { ApiKeyManager } from '@/components/settings/ApiKeyManager'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { BenchmarkProgress } from '@/components/layout/BenchmarkProgress'
import { MainTabsList } from '@/components/layout/MainTabs'
import { Badge } from '@/components/ui/badge'
import { useTestSuiteStore } from '@/stores/testSuiteStore'
import logoBlack from '/logo-black.png'
import appWhite from '/app-white.png'
import appBlack from '/app-black.png'
import { UpdateStatus } from '@/components/layout/UpdateStatus'

export function Header() {
  const { testSuites, activeTestSuiteId } = useTestSuiteStore()
  const activeSuite = testSuites.find((suite) => suite.id === activeTestSuiteId)

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-brand-gradient" />
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-6">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 p-1.5">
            <img
              src={appWhite}
              alt="App Icon"
              className="h-7 sm:h-8 w-auto shrink-0 hidden dark:block rounded-[8px] shadow-sm"
            />
            <img
              src={appBlack}
              alt="App Icon"
              className="h-7 sm:h-8 w-auto shrink-0 block dark:hidden rounded-[8px] shadow-sm"
            />
            <img
              src={logoBlack}
              alt="Benchmaker"
              className="h-7 sm:h-8 w-auto logo-adaptive shrink-0"
            />
          </div>
          {activeSuite && (
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex whitespace-nowrap bg-background/50 backdrop-blur-md">
              {activeSuite.name}
            </Badge>
          )}
        </div>

        <div className="flex-1 px-3 sm:px-4 min-w-0 flex justify-center">
          <MainTabsList className="max-w-fit shadow-[0_2px_10px_rgb(0,0,0,0.05)]" />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <BenchmarkProgress />
          <UpdateStatus />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ApiKeyManager />
          </div>
        </div>
      </div>
    </header>
  )
}
