import { expect, test } from '@playwright/test'

test('renders the app shell and empty benchmark state', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Benchmaker/)
  await expect(page.getByRole('button', { name: /Set API Key/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Prompts/i })).toBeVisible()
  await expect(page.getByText('Build your first benchmark suite')).toBeVisible()
})

test('opens update status dialog and degrades cleanly outside Tauri', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /About Benchmaker/i }).click()

  await expect(page.getByRole('dialog', { name: /About Benchmaker/i })).toBeVisible()
  await expect(page.getByText('Version and update status')).toBeVisible()
  await expect(page.getByText('Updates are disabled in this build.')).toBeVisible()
  await expect(page.getByText('Updates are only available in the desktop app.')).toBeVisible()
})

test('loads prompt editors without Monaco CDN access', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort())
  await page.goto('/')

  await page.getByRole('button', { name: /Create manually/i }).click()
  await page.getByLabel(/Name/i).fill('Prompt editor smoke')
  await page.getByRole('button', { name: /^Create Suite$/i }).click()

  await expect(page.getByRole('heading', { name: 'System Prompt', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Judge System Prompt', exact: true })).toBeVisible()
  await expect(page.locator('.monaco-editor').first()).toBeVisible()
  await expect(page.getByText('Loading...')).toHaveCount(0)
})
