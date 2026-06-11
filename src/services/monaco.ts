type MonacoLoader = {
  config: (options: { monaco: unknown }) => void
}

export interface MonacoWorkers {
  editor: new () => Worker
  json: new () => Worker
  css: new () => Worker
  html: new () => Worker
  typescript: new () => Worker
}

export function configureMonacoLoader(loader: MonacoLoader, monaco: unknown): void {
  loader.config({ monaco })
}

export function configureMonacoEnvironment(workers: MonacoWorkers): void {
  const target = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_moduleId: string, label: string) => Worker
    }
  }

  target.MonacoEnvironment = {
    getWorker: (_moduleId, label) => {
      if (label === 'json') return new workers.json()
      if (label === 'css' || label === 'scss' || label === 'less') return new workers.css()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new workers.html()
      if (label === 'typescript' || label === 'javascript') return new workers.typescript()
      return new workers.editor()
    },
  }
}
