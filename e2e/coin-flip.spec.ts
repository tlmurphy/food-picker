import { expect, type Page, test } from '@playwright/test'

const LOCATION_PLACE_ID = 'fake-location-place-id'
const BURGER_PLACE_ID = 'fake-burger-place-id'
const PIZZA_PLACE_ID = 'fake-pizza-place-id'

const FAKE_LOCATION = {
  location: { latitude: 37.7749, longitude: -122.4194 },
  displayName: { text: 'San Francisco, CA' },
  formattedAddress: 'San Francisco, CA, USA',
}

const FAKE_BURGER = {
  location: { latitude: 37.776, longitude: -122.418 },
  displayName: { text: 'Test Burger Joint' },
  formattedAddress: '123 Main St, San Francisco, CA 94105',
}

const FAKE_PIZZA = {
  location: { latitude: 37.778, longitude: -122.42 },
  displayName: { text: 'Test Pizza Place' },
  formattedAddress: '456 Elm St, San Francisco, CA 94107',
}

async function mockGoogleMapsRoutes(page: Page) {
  await page.route('**/api/places:autocomplete', async (route) => {
    const body = route.request().postDataJSON() as { includedPrimaryTypes?: string[]; input?: string }
    const isRestaurant = body.includedPrimaryTypes != null

    if (!isRestaurant) {
      // Location autocomplete
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: LOCATION_PLACE_ID,
                text: { text: 'San Francisco, CA, USA' },
                distanceMeters: 0,
              },
            },
          ],
        }),
      })
      return
    }

    // Restaurant autocomplete — differentiate by search input
    const isPizza = (body.input ?? '').toLowerCase().includes('pizza')
    const placeId = isPizza ? PIZZA_PLACE_ID : BURGER_PLACE_ID
    const text = isPizza ? 'Test Pizza Place, San Francisco' : 'Test Burger Joint, San Francisco'

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

  await page.route('**/api/places/*', async (route) => {
    const url = route.request().url()
    let data = FAKE_LOCATION
    if (url.includes(BURGER_PLACE_ID)) data = FAKE_BURGER
    else if (url.includes(PIZZA_PLACE_ID)) data = FAKE_PIZZA
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
}

test('tie → coin flip → celebration overlay', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  await mockGoogleMapsRoutes(pageA)
  await mockGoogleMapsRoutes(pageB)

  // -----------------------------------------------------------------------
  // 1. User A: create session and set location
  // -----------------------------------------------------------------------
  await pageA.goto('/')
  await pageA.getByRole('button', { name: 'Create Session' }).click()
  await expect(pageA.getByLabel('Your name')).toBeVisible()

  const sessionCode = await pageA.locator('.session-code-hint strong').innerText()

  await pageA.getByLabel('Your name').fill('Alice')
  await pageA.getByRole('button', { name: "Let's Go!" }).click()
  await expect(pageA).toHaveURL(new RegExp(`/${sessionCode}`))

  // Set location
  await expect(pageA.getByPlaceholder('City, neighborhood, or address')).toBeVisible()
  await pageA.getByPlaceholder('City, neighborhood, or address').fill('San Francisco')
  await expect(pageA.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await pageA.locator('.autocomplete-dropdown li').first().click()
  await expect(pageA.locator('.location-banner')).toBeVisible()

  // -----------------------------------------------------------------------
  // 2. User B: join session
  // -----------------------------------------------------------------------
  await pageB.goto('/')
  await pageB.getByRole('button', { name: 'Join Session' }).click()
  await pageB.getByLabel('Enter session code').fill(sessionCode)
  await pageB.getByRole('button', { name: 'Join' }).click()
  await pageB.getByLabel('Your name').fill('Bob')
  await pageB.getByRole('button', { name: "Let's Go!" }).click()
  await expect(pageB).toHaveURL(new RegExp(`/${sessionCode}`))
  await expect(pageB.locator('.location-banner')).toBeVisible()

  // -----------------------------------------------------------------------
  // 3. User A adds "Burger", User B adds "Pizza"
  // -----------------------------------------------------------------------
  await pageA.getByPlaceholder("Add a restaurant (e.g. McDonald's)").fill('Burger')
  await expect(pageA.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await pageA.locator('.autocomplete-dropdown li').first().click()
  await expect(pageA.locator('.card-name').first()).toHaveText('Test Burger Joint')

  await pageB.getByPlaceholder("Add a restaurant (e.g. McDonald's)").fill('Pizza')
  await expect(pageB.locator('.autocomplete-dropdown li').first()).toBeVisible()
  await pageB.locator('.autocomplete-dropdown li').first().click()
  // Both pages should now show two restaurant cards
  await expect(pageA.locator('.restaurant-card')).toHaveCount(2)
  await expect(pageB.locator('.restaurant-card')).toHaveCount(2)

  // -----------------------------------------------------------------------
  // 4. Alice votes for Burger, Bob votes for Pizza (1-1 tie)
  // -----------------------------------------------------------------------
  // Cards are sorted by votes; find each by name
  const burgerCardA = pageA.locator('.restaurant-card', { hasText: 'Test Burger Joint' })
  await burgerCardA.locator('.thumbs-up-btn').click()

  const pizzaCardB = pageB.locator('.restaurant-card', { hasText: 'Test Pizza Place' })
  await pizzaCardB.locator('.thumbs-up-btn').click()

  // -----------------------------------------------------------------------
  // 5. Alice clicks the pick button — should say "Coin Flip!"
  // -----------------------------------------------------------------------
  const pickButton = pageA.locator('.pick-button')
  await expect(pickButton).toBeVisible()
  await expect(pickButton).toHaveText('Coin Flip!')
  await pickButton.click()

  // -----------------------------------------------------------------------
  // 6. Coin flip overlay appears, animation plays, Continue is clicked
  // -----------------------------------------------------------------------
  await expect(pageA.locator('.coin-flip-overlay')).toBeVisible()

  // Wait for the flip animation (2s) + result reveal, then the Continue button
  const continueBtn = pageA.locator('.coin-flip-continue')
  await expect(continueBtn).toBeVisible({ timeout: 5000 })
  await continueBtn.click()

  // -----------------------------------------------------------------------
  // 7. Celebration overlay appears with a winner name
  // -----------------------------------------------------------------------
  await expect(pageA.locator('.celebration-overlay')).toBeVisible()
  await expect(pageA.locator('h2', { hasText: "It's decided!" })).toBeVisible()
  // The winner must be one of the two restaurants
  const winnerName = await pageA.locator('.celebration-name').innerText()
  expect(['Test Burger Joint', 'Test Pizza Place']).toContain(winnerName)

  await ctxA.close()
  await ctxB.close()
})
