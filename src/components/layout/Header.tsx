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
      <div className="flex min-h-14 flex-wrap items-center gap-2 px-2 py-2 sm:min-h-16 sm:px-4 lg:flex-nowrap lg:gap-4 lg:px-6 lg:py-0">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 sm:gap-4 lg:flex-none">
          <div className="flex items-center gap-2 p-1 sm:gap-3 sm:p-1.5">
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
              className="hidden h-7 w-auto shrink-0 logo-adaptive sm:block sm:h-8"
            />
          </div>
          {activeSuite && (
            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex whitespace-nowrap bg-background/50 backdrop-blur-md">
              {activeSuite.name}
            </Badge>
          )}
        </div>

        <div className="order-3 flex w-full min-w-0 justify-start lg:order-2 lg:flex-1 lg:justify-center lg:px-4">
          <MainTabsList className="w-full justify-start shadow-[0_2px_10px_rgb(0,0,0,0.05)] lg:w-auto lg:max-w-fit" />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:order-3 lg:ml-0 lg:gap-4">
          <div className="hidden md:block">
            <BenchmarkProgress />
          </div>
          <UpdateStatus />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <ApiKeyManager />
          </div>
        </div>
      </div>
    </header>
  )
}
