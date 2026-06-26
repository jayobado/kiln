import { assertEquals, assertInstanceOf, assertRejects } from '@std/assert'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Router } from '../router.ts'
import { createActionRouter, createProcedures, ProcedureError, ValidationError } from './mod.ts'

// ─── Minimal Standard Schema for tests (no validator dependency) ────────────

function schema<T>(
	validate: (input: unknown) => StandardSchemaV1.Result<T>,
): StandardSchemaV1<unknown, T> {
	return { '~standard': { version: 1, vendor: 'test', validate } }
}

const Name = schema<{ name: string }>((input) => {
	if (
		typeof input === 'object' && input !== null &&
		typeof (input as { name?: unknown }).name === 'string'
	) {
		return { value: input as { name: string } }
	}
	return { issues: [{ message: 'name is required', path: ['name'] }] }
})

type Ctx = { session: { userId: string } | null }

const fakeInfo = {
	remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
	completed: Promise.resolve(),
} as unknown as Deno.ServeHandlerInfo

// ─── In-process caller ──────────────────────────────────────────────────────

Deno.test('call: validates and returns the resolver value', async () => {
	const t = createProcedures<Ctx>()
	const create = t.input({ body: Name }).mutation(({ input }) => ({ created: input.body.name }))
	const out = await create.call({ ctx: { session: null }, input: { body: { name: 'acme' } } })
	assertEquals(out, { created: 'acme' })
})

Deno.test('call: throws ValidationError on bad input', async () => {
	const t = createProcedures<Ctx>()
	const create = t.input({ body: Name }).mutation(({ input }) => input.body.name)
	const err = await assertRejects(() =>
		create.call({ ctx: { session: null }, input: { body: {} } })
	)
	assertInstanceOf(err, ValidationError)
	assertEquals(err.issues[0].source, 'body')
})

Deno.test('middleware: narrows ctx and throws when unauthorized', async () => {
	const t = createProcedures<Ctx>()
	const authed = t.use(({ ctx, next }) => {
		if (!ctx.session) throw new ProcedureError('UNAUTHORIZED')
		return next({ ctx: { ...ctx, session: ctx.session } })
	})
	const me = authed.query(({ ctx }) => ctx.session.userId)

	assertEquals(await me.call({ ctx: { session: { userId: 'u1' } } }), 'u1')
	await assertRejects(() => me.call({ ctx: { session: null } }), ProcedureError)
})

// ─── HTTP adapter (kiln Router) ──────────────────────────────────────────────

Deno.test('action router: mounts and round-trips a request', async () => {
	const t = createProcedures<Ctx>()
	const create = t.input({ body: Name }).mutation(({ input }) => ({ id: 1, name: input.body.name }))

	const actions = createActionRouter<Ctx>({ context: () => ({ session: { userId: 'u1' } }) })
	actions.add({
		name: 'create',
		method: 'POST',
		path: '/things',
		procedure: create,
		render: ({ value }) => Response.json(value, { status: 201 }),
	})

	const router = new Router()
	actions.mount(router)

	const ok = await router.handle(
		new Request('http://x/things', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'widget' }),
		}),
		fakeInfo,
	)
	assertEquals(ok.status, 201)
	assertEquals(await ok.json(), { id: 1, name: 'widget' })

	const bad = await router.handle(
		new Request('http://x/things', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		}),
		fakeInfo,
	)
	assertEquals(bad.status, 422)

	assertEquals(actions.url('create'), '/things')
})

Deno.test('action router: maps ProcedureError to its coded status', async () => {
	const t = createProcedures<Ctx>()
	const guarded = t.use(({ ctx, next }) => {
		if (!ctx.session) throw new ProcedureError('UNAUTHORIZED')
		return next({ ctx })
	}).query(() => 'secret')

	const actions = createActionRouter<Ctx>({ context: () => ({ session: null }) })
	actions.add({
		method: 'GET',
		path: '/me',
		procedure: guarded,
		render: ({ value }) => Response.json(value),
	})

	const router = new Router()
	actions.mount(router)

	const res = await router.handle(new Request('http://x/me'), fakeInfo)
	assertEquals(res.status, 401)
	await res.body?.cancel()
})
