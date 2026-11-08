import '../src/env.ts'
import { createClient } from '@supabase/supabase-js'
import { db } from '../src/db.ts'
import { supabaseAdmin } from '../src/supabase.ts'

// Read-only diagnosis. Never print passwords, keys, tokens or connection strings.
try {
  const email = process.env.ASCENT_OWNER_EMAIL
  if (!email || !process.env.ASCENT_OWNER_PASSWORD)
    throw new Error(
      'Configure ASCENT_OWNER_EMAIL and ASCENT_OWNER_PASSWORD locally.',
    )
  let owner
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    })
    if (error)
      throw new Error(
        'Auth lookup failed: ' + (error.code || error.status || error.name),
      )
    owner = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    )
    if (owner || data.users.length < 100) break
  }
  const profile = owner
    ? await db.profile.findUnique({ where: { id: owner.id } })
    : null
  const retainedProfiles = await db.profile.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { role: true, isActive: true, authDeletedAt: true },
  })
  console.log('Configured owner account:', {
    authExists: !!owner,
    emailConfirmed: !!owner?.email_confirmed_at,
    profileExists: !!profile,
    role: profile?.role,
    active: profile?.isActive,
    deleted: !!profile?.authDeletedAt,
    retainedProfiles: retainedProfiles.map((item) => ({
      role: item.role,
      active: item.isActive,
      deleted: !!item.authDeletedAt,
    })),
  })
  if (!owner) {
    console.error(
      'Configured owner is missing from Supabase Auth. Saved credentials cannot sign in until that account is restored.',
    )
    process.exitCode = 1
  } else {
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const signed = await client.auth.signInWithPassword({
      email,
      password: process.env.ASCENT_OWNER_PASSWORD,
    })
    console.log('Configured owner sign-in:', {
      ok: !!signed.data.session,
      code: signed.error?.code,
      status: signed.error?.status,
    })
    if (
      !signed.data.session ||
      profile?.role !== 'owner' ||
      !profile?.isActive ||
      profile?.authDeletedAt
    )
      process.exitCode = 1
    if (signed.data.session) {
      const verified = await supabaseAdmin.auth.getUser(
        signed.data.session.access_token,
      )
      console.log('Server session verification:', {
        ok: !!verified.data.user,
        code: verified.error?.code,
      })
      if (verified.error) process.exitCode = 1
    }
  }
} catch (caught) {
  const error = caught as Error & {
    code?: string
    status?: number
    cause?: { code?: string }
  }
  console.error(
    error.message?.startsWith('Configure') ||
      error.message?.startsWith('Auth lookup')
      ? error.message
      : 'Owner check failed: ' + (error.code || error.name),
  )
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
