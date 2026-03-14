import { expect, test } from '@playwright/test'

test('invalid session code shows error and offers recovery', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Food Picker' })).toBeVisible()

  // Navigate to the join-code step
  await page.getByRole('button', { name: 'Join Session' }).click()

  await expect(page.getByLabel('Enter session code')).toBeVisible()
  await page.getByLabel('Enter session code').fill('BADCODE12')
  await page.getByRole('button', { name: 'Join' }).click()

  // Name step — enter a name and attempt to join the non-existent session
  await expect(page.getByLabel('Your name')).toBeVisible()
  await page.getByLabel('Your name').fill('Ghost')
  await page.getByRole('button', { name: "Let's Go!" }).click()

  // Server should respond with an error; error text should be visible
  await expect(page.locator('.error-text')).toBeVisible()
  await expect(page.locator('.error-text')).toContainText('Session not found')

  // Recovery: user can click "Enter Different Code" to try again
  await page.getByRole('button', { name: 'Enter Different Code' }).click()
  await expect(page.getByLabel('Enter session code')).toBeVisible()
})
