import type { Restaurant } from '../types'

export function sortRestaurants(restaurants: Restaurant[]): Restaurant[] {
  return [...restaurants].sort((a, b) => {
    // More votes = ranked higher (descending)
    const diff = b.votes.length - a.votes.length
    if (diff !== 0) return diff
    // Tiebreaker: earliest first vote
    const aFirst = a.votes.length > 0 ? a.votes[0].votedAt : a.addedAt
    const bFirst = b.votes.length > 0 ? b.votes[0].votedAt : b.addedAt
    return aFirst.localeCompare(bFirst)
  })
}

export function getRestaurantName(restaurant: Pick<Restaurant, 'foundName' | 'inputName'>): string {
  return restaurant.foundName ?? restaurant.inputName
}

export function getTopTied(restaurants: Restaurant[]): { top: Restaurant[]; maxVotes: number } {
  const withVotes = restaurants.filter((r) => r.votes.length > 0)
  if (withVotes.length === 0) return { top: [], maxVotes: 0 }
  const maxVotes = Math.max(...withVotes.map((r) => r.votes.length))
  const top = withVotes.filter((r) => r.votes.length === maxVotes)
  return { top, maxVotes }
}
