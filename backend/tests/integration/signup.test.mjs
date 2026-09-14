import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { databaseConfig } from '../../src/database-config.mjs'

test('signup lifecycle preserves history and permits registration after Auth deletion', async (t) => {
  const client = new pg.Client(databaseConfig(process.env.DIRECT_URL || undefined))
  await client.connect()
  try {
    const scenario = async (name, run) =>
      t.test(name, async () => {
        await client.query('BEGIN')
        try {
          await run()
        } finally {
          await client.query('ROLLBACK')
        }
      })
    const signup = async (email, metadata = {}) => {
      const id = randomUUID()
      await client.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)', [
        id,
        email,
        JSON.stringify({ name: 'Rollback signup test', ...metadata }),
      ])
      return id
    }
    await scenario(
      'a deleted owner email registers as a fresh customer without inheriting history',
      async () => {
        const email = 'test-' + randomUUID() + '@example.com'
        const oldId = await signup(email)
        await client.query("UPDATE public.profiles SET role='owner' WHERE id=$1", [oldId])
        const orderId = randomUUID()
        await client.query(
          "INSERT INTO public.orders(id,user_id,fulfillment,subtotal,total) VALUES ($1,$2,'Store pickup',0,0)",
          [orderId, oldId],
        )
        await client.query('DELETE FROM auth.users WHERE id=$1', [oldId])
        const newId = await signup(email, { requested_role: 'owner', role: 'owner' })
        const { rows: profiles } = await client.query(
          'SELECT id,role,requested_role,is_active,auth_deleted_at FROM public.profiles WHERE email=$1',
          [email],
        )
        const old = profiles.find((p) => p.id === oldId),
          current = profiles.find((p) => p.id === newId)
        assert.equal(old.is_active, false)
        assert.ok(old.auth_deleted_at)
        assert.equal(current.role, 'customer')
        assert.equal(current.requested_role, 'owner')
        assert.equal(current.auth_deleted_at, null)
        assert.equal(
          (await client.query('SELECT user_id FROM public.orders WHERE id=$1', [orderId])).rows[0]
            .user_id,
          oldId,
        )
      },
    )
    await scenario('old orphan profiles no longer block signup', async () => {
      const email = 'test-' + randomUUID() + '@example.com'
      await client.query(
        "INSERT INTO public.profiles(id,name,email,role,updated_at) VALUES ($1,'Old profile',$2,'staff',now())",
        [randomUUID(), email],
      )
      const id = await signup(email)
      assert.equal(
        (await client.query('SELECT role FROM public.profiles WHERE id=$1', [id])).rows[0].role,
        'customer',
      )
      assert.equal(
        (
          await client.query(
            'SELECT count(*)::int AS total FROM public.profiles WHERE email=$1 AND auth_deleted_at IS NULL',
            [email],
          )
        ).rows[0].total,
        1,
      )
    })
    await scenario('soft-deleting an Auth account archives its profile', async () => {
      const email = 'test-' + randomUUID() + '@example.com',
        id = await signup(email)
      await client.query('UPDATE auth.users SET deleted_at=now() WHERE id=$1', [id])
      const {
        rows: [profile],
      } = await client.query('SELECT is_active,auth_deleted_at FROM public.profiles WHERE id=$1', [
        id,
      ])
      assert.equal(profile.is_active, false)
      assert.ok(profile.auth_deleted_at)
    })
    await scenario('active profile emails remain unique regardless of case', async () => {
      const email = 'test-' + randomUUID() + '@example.com'
      await signup(email)
      await assert.rejects(
        client.query(
          "INSERT INTO public.profiles(id,name,email,updated_at) VALUES ($1,'Duplicate',$2,now())",
          [randomUUID(), email.toUpperCase()],
        ),
        (error) => error.code === '23505' && error.constraint === 'profiles_current_email_key',
      )
    })
  } finally {
    await client.end()
  }
})
