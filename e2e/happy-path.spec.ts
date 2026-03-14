import { expect, type Page, test } from '@playwright/test'

// Fake place IDs used in mock responses
const LOCATION_PLACE_ID = 'fake-location-place-id'
const RESTAURANT_PLACE_ID = 'fake-restaurant-place-id'

// Mock data
const FAKE_LOCATION = {
  location: { latitude: 37.7749, longitude: -122.4194 },
  displayName: { text: 'San Francisco, CA' },
  formattedAddress: 'San Francisco, CA, USA',
}

const FAKE_RESTAURANT = {
  location: { latitude: 37.776, longitude: -122.418 },
  displayName: { text: 'Test Burger Joint' },
  formattedAddress: '123 Main St, San Francisco, CA 94105',
}

/**
 * Intercept all Google Maps API calls for a page so no real requests are made.
 * Both the location autocomplete and the restaurant autocomplete hit the same
 * POST /api/places:autocomplete endpoint; the place details GET endpoint is
 * shared too. We differentiate via the request body's `includedPrimaryTypes`.
 */
async function mockGoogleMapsRoutes(page: Page) {
  // POST /api/places:autocomplete  – return appropriate suggestion based on context
  await page.route('**/api/places:autocomplete', async (route) => {
    const body = route.request().postDataJSON() as { includedPrimaryTypes?: string[] }
    const isRestaurant = body.includedPrimaryTypes != null

    const placeId = isRestaurant ? RESTAURANT_PLACE_ID : LOCATION_PLACE_ID
    const text = isRestaurant ? 'Test Burger Joint, San Francisco' : 'San Francisco, CA, USA'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestions: [
          {
            placePrediction: {
              placeId,
              text: { text },
              distanceMeters: 100,
            },
          },
        ],
      }),
    })
  })

  // GET /api/places/:placeId – return location or restaurant data depending on placeId
  await page.route('**/api/places/*', async (route) => {
    const url = route.request().url()
    const isRestaurant = url.includes(RESTAURANT_PLACE_ID)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isRestaurant ? FAKE_RESTAURANT : FAKE_LOCATION),
    })
  })
}

test('full happy path: two users add & vote on a restaurant, pick winner', async ({ browser }) => {
  // --- Create two independent browser contexts (simulating two users) ---
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()

  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // Set up API mocks for both pages
  await mockGoogleMapsRoutes(pageA)
  await mockGoogleMapsRoutes(pageB)

  // -----------------------------------------------------------------------
  // 1. User A: navigate to home and create a session
  // -----------------------------------------------------------------------
  await pageA.goto('/')
  await expect(pageA.getByRole('heading', { name: 'Food Picker' })).toBeVisible()

  await pageA.getByRole('button', { name: 'Create Session' }).click()

  // After creating, the page moves to the name step
  await expect(pageA.getByLabel('Your name')).toBeVisible()

  // Grab the session code shown in the hint
  const sessionCodeHint = pageA.locator('.session-code-hint strong')
  await expect(sessionCodeHint).toBeVisible()
  const sessionCode = await sessionCodeHint.innerText()
  expect(sessionCode).toMatch(/^[A-Z0-9_-]+$/)

  // Enter user A's name and join
  await pageA.getByLabel('Your name').fill('Alice')
  await pageA.getByRole('button', { name: "Let's Go!" }).click()

  // Should land on /:sessionId
  await expect(pageA).toHaveURL(new RegExp(`/${sessionCode}`))

  // -----------------------------------------------------------------------
  // 2. User A: set a location so the restaurant search becomes available
  // -----------------------------------------------------------------------
  // LocationSetup is shown first — wait for it
  await expect(pageA.getByPlaceholder('City, neighborhood, or address')).toBeVisible()

  await pageA.getByPlaceholder('City, neighborhood, or address').fill('San Francisco')
  // Wait for the autocomplete suggestion and click it
  const locationSuggestion = pageA.locator('.autocomplete-dropdown li').first()
  await expect(locationSuggestion).toBeVisible()
  await locationSuggestion.click()

  // After location is set, the location banner and restaurant input should appear
  await expect(pageA.locator('.location-banner')).toBeVisible()
  await expect(pageA.getByPlaceholder("Add a restaurant (e.g. McDonald's)")).toBeVisible()

  // -----------------------------------------------------------------------
  // 3. User B: navigate to home, join the session using the session code
  // -----------------------------------------------------------------------
  await pageB.goto('/')
  await pageB.getByRole('button', { name: 'Join Session' }).click()

  await expect(pageB.getByLabel('Enter session code')).toBeVisible()
  await pageB.getByLabel('Enter session code').fill(sessionCode)
  await pageB.getByRole('button', { name: 'Join' }).click()

  // Name step
  await expect(pageB.getByLabel('Your name')).toBeVisible()
  await pageB.getByLabel('Your name').fill('Bob')
  await pageB.getByRole('button', { name: "Let's Go!" }).click()

  // Should land on the same session page
  await expect(pageB).toHaveURL(new RegExp(`/${sessionCode}`))

  // Bob sees the location banner (Alice already set a location, server broadcasts it)
  await expect(pageB.locator('.location-banner')).toBeVisible()

  // -----------------------------------------------------------------------
  // 4. User A: add a restaurant
  // -----------------------------------------------------------------------
  const restaurantInput = pageA.getByPlaceholder("Add a restaurant (e.g. McDonald's)")
  await restaurantInput.fill('Burger')

  // Wait for the autocomplete dropdown to appear and click the suggestion
  const restaurantSuggestion = pageA.locator('.autocomplete-dropdown li').first()
  await expect(restaurantSuggestion).toBeVisible()
  await restaurantSuggestion.click()

  // The restaurant card should appear for both users
  await expect(pageA.locator('.restaurant-card')).toBeVisible()
  await expect(pageA.locator('.card-name')).toHaveText('Test Burger Joint')

  // Bob should also see the restaurant (server broadcast)
  await expect(pageB.locator('.restaurant-card')).toBeVisible()
  await expect(pageB.locator('.card-name')).toHaveText('Test Burger Joint')

  // -----------------------------------------------------------------------
  // 5. Both users vote for the restaurant
  // -----------------------------------------------------------------------
  // Alice votes
  const thumbsA = pageA.locator('.thumbs-up-btn').first()
  await thumbsA.click()
  // After voting the button gets the 'active' class
  await expect(thumbsA).toHaveClass(/active/)

  // Bob votes
  const thumbsB = pageB.locator('.thumbs-up-btn').first()
  await thumbsB.click()
  await expect(thumbsB).toHaveClass(/active/)

  // -----------------------------------------------------------------------
  // 6. User A: click "Pick Now!" and see the celebration overlay
  // -----------------------------------------------------------------------
  const pickButton = pageA.locator('.pick-button')
  await expect(pickButton).toBeVisible()
  await expect(pickButton).toHaveText('Pick Now!')
  await pickButton.click()

  // CelebrationOverlay should appear with the restaurant name
  await expect(pageA.locator('.celebration-overlay')).toBeVisible()
  await expect(pageA.locator('.celebration-name')).toHaveText('Test Burger Joint')
  await expect(pageA.locator('h2', { hasText: "It's decided!" })).toBeVisible()

  // Clean up
  await ctxA.close()
  await ctxB.close()
})

test('duplicate restaurant: adding same place twice shows a toast, list stays at one entry', async ({ page }) => {
  await mockGoogleMapsRoutes(page)

  // Create session and set location
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Session' }).click()
  await expect(page.getByLabel('Your name')).toBeVisible()
  await page.getByLabel('Your name').fill('Alice')
  await page.getByRole('button', { name: "Let's Go!" }).click()

  await expect(page.getByPlaceholder('City, neighborhood, or address')).toBeVisible()
  await page.getByPlaceholder('City, neighborhood, or address').fill('San Francisco')
  await expect(page.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await page.locator('.autocomplete-dropdown li').first().click()
  await expect(page.locator('.location-banner')).toBeVisible()

  // Add the restaurant once
  const restaurantInput = page.getByPlaceholder("Add a restaurant (e.g. McDonald's)")
  await restaurantInput.fill('Burger')
  await expect(page.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await page.locator('.autocomplete-dropdown li').first().click()
  await expect(page.locator('.restaurant-card')).toHaveCount(1)

  // Try to add the exact same restaurant again — use different search text so the
  // debounced value actually changes (filling "Burger" again would be a no-op since
  // debouncedValue never transitions through "" before we re-fill)
  await restaurantInput.fill('Test Burger')
  await expect(page.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await page.locator('.autocomplete-dropdown li').first().click()

  // Sonner toast with duplicate message should appear
  await expect(page.locator('[data-sonner-toast]')).toBeVisible()
  await expect(page.locator('[data-sonner-toast]')).toContainText('already been added')

  // List must still have exactly one entry
  await expect(page.locator('.restaurant-card')).toHaveCount(1)
})
