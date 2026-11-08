import '../src/env.ts'
import { createClient } from '@supabase/supabase-js'
import { db } from '../src/db.ts'
import { supabaseAdmin } from '../src/supabase.ts'

// Recovery of the configured, previously deleted owner only. Default is read-only.
// Reuse its ID so existing orders, receipts and audit history remain associated.
try {
  if (process.argv.slice(2).some((arg) => arg !== '--apply'))
    throw new Error('Usage: node scripts/restore-owner.mts [--apply]')
  const email = process.env.ASCENT_OWNER_EMAIL?.trim()
  const password = process.env.ASCENT_OWNER_PASSWORD
  if (!email || !password || password.length < 12)
    throw new Error(
      'The private owner email and a password of at least 12 characters are required.',
    )
  const profiles = await db.profile.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
  })
  if (
    profiles.length !== 1 ||
    profiles[0].role !== 'owner' ||
    !profiles[0].authDeletedAt
  )
    throw new Error(
      'Expected exactly one retained, deleted owner profile. No changes made.',
    )
  const profile = profiles[0]
  let existing
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    })
    if (error)
      throw new Error('Auth lookup failed: ' + (error.code || error.status))
    existing = data.users.find(
      (user) =>
        user.id === profile.id ||
        user.email?.toLowerCase() === email.toLowerCase(),
    )
    if (existing || data.users.length < 100) break
    if (page === 100)
      throw new Error('Auth lookup limit reached. No changes made.')
  }
  if (
    existing &&
    (existing.id !== profile.id ||
      existing.email?.toLowerCase() !== email.toLowerCase())
  )
    throw new Error(
      'A different identity uses the owner email or ID. No changes made.',
    )
  console.log('Owner recovery plan:', {
    email,
    createAuthAccount: !existing,
    reuseHistoricalId: true,
    restoreOwnerProfile: true,
    resetExistingPassword: false,
    apply: process.argv.includes('--apply'),
  })
  if (process.argv.includes('--apply')) {
    if (!existing) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        id: profile.id,
        email,
        password,
        email_confirm: true,
        user_metadata: { name: profile.name },
      })
      if (error || data.user?.id !== profile.id)
        throw new Error(
          'Owner account creation failed: ' +
            (error?.code || 'identity mismatch'),
        )
    }
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const signed = await client.auth.signInWithPassword({ email, password })
    if (signed.error || signed.data.user?.id !== profile.id)
      throw new Error(
        'Owner credential verification failed. Existing password was not changed.',
      )
    await db.profile.update({
      where: { id: profile.id },
      data: { isActive: true, authDeletedAt: null, requestedRole: null },
    })
    console.log(
      'Owner access restored; historical profile ID and existing business records preserved.',
    )
  }
} catch (caught) {
  const error = caught as Error & {
    code?: string
    status?: number
    cause?: { code?: string }
  }
  console.error(
    error.code ? 'Owner recovery failed: ' + error.code : error.message,
  )
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
