import { db } from './db.mjs'
import { supabaseAdmin } from './supabase.mjs'
import { fail } from './validation.mjs'
export async function optionalAuth(req, _res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return next()
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (
      error &&
      (error.status === 429 || error.status >= 500 || error.name === 'AuthRetryableFetchError')
    )
      fail(503, 'The account service is temporarily unavailable. Please try again shortly.')
    if (error || !data.user) fail(401, 'Your session has expired. Please sign in again.')
    req.actor = await db.profile.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        role: 'customer',
      },
      update: { email: data.user.email },
    })
    if (!req.actor.isActive || req.actor.authDeletedAt) fail(403, 'This account is disabled.')
    req.accessToken = token
    next()
  } catch (error) {
    next(error)
  }
}
export const roles =
  (...allowed) =>
  (req, _res, next) => {
    try {
      if (!req.actor) fail(401, 'Please sign in.')
      if (allowed.length && !allowed.includes(req.actor.role))
        fail(403, 'You do not have access to this operation.')
      next()
    } catch (error) {
      next(error)
    }
  }
