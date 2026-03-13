import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  autocompleteLocation,
  autocompleteRestaurant,
  getPlaceLocation,
  getRestaurantPlaceDetails,
  reverseGeocode,
  setApiSessionId,
} from './googlemaps'

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  setApiSessionId('')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('autocompleteLocation', () => {
  it('posts to /api/places:autocomplete and returns suggestions', async () => {
    const fetchMock = mockFetch({
      suggestions: [
        { placePrediction: { placeId: 'p1', text: { text: 'San Francisco, CA' } } },
        { placePrediction: { placeId: 'p2', text: { text: 'San Jose, CA' } } },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await autocompleteLocation('San')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/places:autocomplete')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as { input: string }
    expect(body.input).toBe('San')
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ placeId: 'p1', text: 'San Francisco, CA' })
  })

  it('returns empty array when suggestions is absent', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const results = await autocompleteLocation('xyz')
    expect(results).toEqual([])
  })

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 500))
    await expect(autocompleteLocation('foo')).rejects.toThrow('Autocomplete error: 500')
  })
})

describe('autocompleteRestaurant', () => {
  it('sends location bias and origin in the request body', async () => {
    const fetchMock = mockFetch({ suggestions: [] })
    vi.stubGlobal('fetch', fetchMock)

    await autocompleteRestaurant('pizza', 37.7, -122.4)
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      locationBias: { circle: { center: { latitude: number; longitude: number }; radius: number } }
      origin: { latitude: number; longitude: number }
      includedPrimaryTypes: string[]
    }
    expect(body.locationBias.circle.center).toMatchObject({ latitude: 37.7, longitude: -122.4 })
    expect(body.origin).toMatchObject({ latitude: 37.7, longitude: -122.4 })
    expect(body.includedPrimaryTypes).toContain('restaurant')
  })

  it('sorts suggestions by distanceMeters when origin is provided', async () => {
    const fetchMock = mockFetch({
      suggestions: [
        { placePrediction: { placeId: 'far', text: { text: 'Far Place' }, distanceMeters: 2000 } },
        { placePrediction: { placeId: 'near', text: { text: 'Near Place' }, distanceMeters: 500 } },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await autocompleteRestaurant('food', 37.7, -122.4)
    expect(results[0].placeId).toBe('near')
    expect(results[1].placeId).toBe('far')
  })
})

describe('getPlaceLocation', () => {
  it('returns lat/lng/label from place details response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        location: { latitude: 37.7, longitude: -122.4 },
        displayName: { text: 'Test Place' },
      }),
    )
    const result = await getPlaceLocation('place123')
    expect(result).toEqual({ lat: 37.7, lng: -122.4, label: 'Test Place' })
  })

  it('falls back to placeId as label when displayName is absent', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        location: { latitude: 1, longitude: 2 },
      }),
    )
    const result = await getPlaceLocation('place123')
    expect(result.label).toBe('place123')
  })

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 404))
    await expect(getPlaceLocation('bad')).rejects.toThrow('Place details error: 404')
  })
})

describe('reverseGeocode', () => {
  it('returns the formatted address from the first result', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ results: [{ formatted_address: '1 Infinite Loop, Cupertino, CA' }] }),
    )
    const address = await reverseGeocode(37.3318, -122.0312)
    expect(address).toBe('1 Infinite Loop, Cupertino, CA')
  })

  it('returns null when results is empty', async () => {
    vi.stubGlobal('fetch', mockFetch({ results: [] }))
    const address = await reverseGeocode(0, 0)
    expect(address).toBeNull()
  })

  it('returns null on non-OK response', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 403))
    const address = await reverseGeocode(0, 0)
    expect(address).toBeNull()
  })
})

describe('getRestaurantPlaceDetails', () => {
  it('maps response fields to PlaceResult shape', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        location: { latitude: 40.7, longitude: -74.0 },
        displayName: { text: 'Joe\'s Pizza' },
        formattedAddress: '7 Carmine St, New York, NY',
      }),
    )
    const result = await getRestaurantPlaceDetails('place456')
    expect(result).toEqual({
      lat: 40.7,
      lng: -74.0,
      name: 'Joe\'s Pizza',
      address: '7 Carmine St, New York, NY',
    })
  })

  it('uses empty string for address when formattedAddress is absent', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        location: { latitude: 0, longitude: 0 },
        displayName: { text: 'Place' },
      }),
    )
    const result = await getRestaurantPlaceDetails('p')
    expect(result.address).toBe('')
  })
})

describe('session header', () => {
  it('sends X-Session-Id header when a session ID is set', async () => {
    setApiSessionId('mysession')
    const fetchMock = mockFetch({ suggestions: [] })
    vi.stubGlobal('fetch', fetchMock)

    await autocompleteLocation('test')
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    expect(headers['X-Session-Id']).toBe('mysession')
  })

  it('omits X-Session-Id header when no session ID is set', async () => {
    setApiSessionId('')
    const fetchMock = mockFetch({ suggestions: [] })
    vi.stubGlobal('fetch', fetchMock)

    await autocompleteLocation('test')
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    expect(headers['X-Session-Id']).toBeUndefined()
  })
})
