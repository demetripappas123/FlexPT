/**
 * Helper to get the trainer_id from the authenticated user
 * This can be used in components to get the current trainer's ID
 */

import { getUser } from './auth-helpers'

export async function getTrainerId(): Promise<string | null> {
  try {
    const { user, error } = await getUser()
    if (error || !user) {
      return null
    }
    return user.id
  } catch (err) {
    console.error('Error getting trainer ID:', err)
    return null
  }
}






