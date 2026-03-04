import type { RestaurantWithVotes } from '../types'

const NO_VOTE_PENALTY = 10

export function sortRestaurants(
  restaurants: RestaurantWithVotes[],
  userIds: string[]
): RestaurantWithVotes[] {
  return [...restaurants].sort((a, b) => {
    const scoreA = computeScore(a, userIds)
    const scoreB = computeScore(b, userIds)
    return scoreA - scoreB
  })
}

function computeScore(restaurant: RestaurantWithVotes, userIds: string[]): number {
  return userIds.reduce((sum, userId) => {
    const vote = restaurant.votes.find((v) => v.user_id === userId)
    return sum + (vote?.score ?? NO_VOTE_PENALTY)
  }, 0)
}

export function checkAgreement(
  restaurants: RestaurantWithVotes[],
  userIds: string[]
): RestaurantWithVotes | null {
  if (userIds.length < 2) return null

  for (const restaurant of restaurants) {
    const allVotedOne = userIds.every((userId) => {
      const vote = restaurant.votes.find((v) => v.user_id === userId)
      return vote?.score === 1
    })
    if (allVotedOne) return restaurant
  }

  return null
}
