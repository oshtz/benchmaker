type MonacoLoader = {
  config: (options: { monaco: unknown }) => void
}

export function configureMonacoLoader(loader: MonacoLoader, monaco: unknown): void {
  loader.config({ monaco })
}
