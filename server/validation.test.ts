import { describe, expect, it } from 'vitest'
import { sanitize, validCoords } from './validation'

describe('sanitize', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitize(123, 50)).toBe('')
    expect(sanitize(null, 50)).toBe('')
    expect(sanitize(undefined, 50)).toBe('')
    expect(sanitize({}, 50)).toBe('')
    expect(sanitize([], 50)).toBe('')
    expect(sanitize(true, 50)).toBe('')
  })

  it('passes a valid string through unchanged when under maxLen', () => {
    expect(sanitize('hello', 50)).toBe('hello')
    expect(sanitize('', 50)).toBe('')
  })

  it('trims string to maxLen', () => {
    expect(sanitize('abcdef', 3)).toBe('abc')
    expect(sanitize('hello world', 5)).toBe('hello')
  })

  it('returns exactly maxLen characters when string is exactly maxLen', () => {
    expect(sanitize('abc', 3)).toBe('abc')
  })
})

describe('validCoords', () => {
  it('returns true for valid lat/lng', () => {
    expect(validCoords(37.7749, -122.4194)).toBe(true)
    expect(validCoords(0, 0)).toBe(true)
    expect(validCoords(-90, -180)).toBe(true)
    expect(validCoords(90, 180)).toBe(true)
  })

  it('returns false for NaN', () => {
    expect(validCoords(Number.NaN, 0)).toBe(false)
    expect(validCoords(0, Number.NaN)).toBe(false)
    expect(validCoords(Number.NaN, Number.NaN)).toBe(false)
  })

  it('returns false for Infinity', () => {
    expect(validCoords(Infinity, 0)).toBe(false)
    expect(validCoords(0, Infinity)).toBe(false)
    expect(validCoords(-Infinity, 0)).toBe(false)
  })

  it('returns false for out-of-range lat', () => {
    expect(validCoords(90.001, 0)).toBe(false)
    expect(validCoords(-90.001, 0)).toBe(false)
    expect(validCoords(91, 0)).toBe(false)
    expect(validCoords(-91, 0)).toBe(false)
  })

  it('returns false for out-of-range lng', () => {
    expect(validCoords(0, 180.001)).toBe(false)
    expect(validCoords(0, -180.001)).toBe(false)
    expect(validCoords(0, 181)).toBe(false)
    expect(validCoords(0, -181)).toBe(false)
  })

  it('returns false for wrong types', () => {
    expect(validCoords('37.7', -122)).toBe(false)
    expect(validCoords(37.7, '-122')).toBe(false)
    expect(validCoords(null, 0)).toBe(false)
    expect(validCoords(0, undefined)).toBe(false)
  })
})
