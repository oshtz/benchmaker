import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

test('renders sandboxed Code Arena preview output with visible pixels', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 })
  await page.setContent(`
    <main style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif">
      <iframe
        id="preview"
        title="Code Preview"
        sandbox="allow-scripts"
        style="width:640px;height:420px;border:0;background:white"
      ></iframe>
    </main>
  `)

  const generatedCode = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #fff7ed;
            color: #111827;
            font-family: Arial, sans-serif;
          }
          [data-testid="generated-preview"] {
            width: 420px;
            padding: 36px;
            border: 6px solid #0f766e;
            background: linear-gradient(135deg, #14b8a6, #f97316);
            color: white;
            font-size: 42px;
            font-weight: 800;
            text-align: center;
          }
          #script-state {
            display: block;
            margin-top: 18px;
            font-size: 18px;
          }
        </style>
      </head>
      <body>
        <section data-testid="generated-preview">
          Rendered
          <span id="script-state">JS pending</span>
          <span id="parent-access" hidden>unknown</span>
        </section>
        <script>
          document.getElementById('script-state').textContent = 'JS OK';
          try {
            window.parent.document.body.dataset.previewEscaped = 'no';
            document.getElementById('parent-access').textContent = 'open';
          } catch (error) {
            document.getElementById('parent-access').textContent = 'blocked';
          }
        </script>
      </body>
    </html>
  `

  await page.locator('#preview').evaluate((iframe, srcdoc) => {
    ;(iframe as HTMLIFrameElement).srcdoc = srcdoc
  }, generatedCode)

  const frame = page.frameLocator('#preview')
  await expect(frame.getByTestId('generated-preview')).toContainText('Rendered')
  await expect(frame.locator('#script-state')).toHaveText('JS OK')
  await expect(frame.locator('#parent-access')).toHaveText('blocked')
  await expect(page.locator('body')).not.toHaveAttribute('data-preview-escaped', 'no')

  const screenshot = await page.locator('#preview').screenshot()
  const png = PNG.sync.read(screenshot)
  let saturatedPixels = 0

  for (let index = 0; index < png.data.length; index += 4) {
    const red = png.data[index]
    const green = png.data[index + 1]
    const blue = png.data[index + 2]
    const alpha = png.data[index + 3]
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)

    if (alpha > 0 && max - min > 80) {
      saturatedPixels += 1
    }
  }

  expect(saturatedPixels).toBeGreaterThan(10_000)
})
