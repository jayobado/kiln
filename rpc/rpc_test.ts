import { assertEquals } from '@std/assert'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Router } from '../router.ts'
import { createProcedures } from '../procedure/mod.ts'
import { createRpcHandler, ok, redirect } from './mod.ts'
import { createClient, fieldErrors, RpcClientError } from './client.ts'

function schema<T>(
	validate: (input: unknown) => StandardSchemaV1.Result<T>,
): StandardSchemaV1<unknown, T> {
	return { '~standard': { version: 1, vendor: 'test', validate } }
}

const Msg = schema<{ msg: string }>((input) => {
	if (typeof input === 'object' && input !== null && typeof (input as { msg?: unknown }).msg === 'string') {
		return { value: input as { msg: string } }
	}
	return { issues: [{ message: 'msg required', path: ['msg'] }] }
})
const Pair = schema<{ a: number; b: number }>((input) => {
	const o = input as { a?: unknown; b?: unknown }
	if (typeof o?.a === 'number' && typeof o?.b === 'number') return { value: o as { a: number; b: number } }
	return { issues: [{ message: 'a and b required', path: [] }] }
})

type Ctx = { who: string }

const t = createProcedures<Ctx>()
const appRouter = {
	echo: t.input({ body: Msg }).query(({ ctx, input }) => ({ echoed: input.body.msg, by: ctx.who })),
	math: {
		add: t.input({ body: Pair }).mutation(({ input }) => input.body.a + input.body.b),
	},
	save: t.input({ body: Msg }).mutation(({ input }) => ok({ saved: input.body.msg }, { flash: { kind: 'success' } })),
	go: t.mutation(() => redirect('/done')),
}
type AppRouter = typeof appRouter

const fakeInfo = {
	remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
	completed: Promise.resolve(),
} as unknown as Deno.ServeHandlerInfo

function clientFor(router: Router) {
	return createClient<AppRouter>({
		url: 'http://x/rpc',
		fetch: (input, init) => router.handle(new Request(input, init), fakeInfo),
		navigate: () => {}, // capture below per-test if needed
	})
}

function mountedRouter() {
	const router = new Router()
	createRpcHandler<Ctx>({ router: appRouter, context: () => ({ who: 'kiln' }) }).mount(router)
	return router
}

Deno.test('end-to-end typed call: query + nested mutation', async () => {
	const rpc = clientFor(mountedRouter())
	assertEquals(await rpc.echo({ msg: 'hi' }), { echoed: 'hi', by: 'kiln' })
	assertEquals(await rpc.math.add({ a: 2, b: 3 }), 5)
})

Deno.test('ok(): unwraps to the inner value (flash rides along)', async () => {
	let flashed: unknown
	const rpc = createClient<AppRouter>({
		url: 'http://x/rpc',
		fetch: (input, init) => mountedRouter().handle(new Request(input, init), fakeInfo),
		onFlash: (f) => { flashed = f },
	})
	assertEquals(await rpc.save({ msg: 'x' }), { saved: 'x' })
	assertEquals(flashed, { kind: 'success' })
})

Deno.test('redirect(): navigates and resolves to undefined', async () => {
	let navigatedTo: string | undefined
	const rpc = createClient<AppRouter>({
		url: 'http://x/rpc',
		fetch: (input, init) => mountedRouter().handle(new Request(input, init), fakeInfo),
		navigate: (u) => { navigatedTo = u },
	})
	assertEquals(await rpc.go(), undefined)
	assertEquals(navigatedTo, '/done')
})

Deno.test('validation error surfaces as RpcClientError → fieldErrors', async () => {
	const rpc = clientFor(mountedRouter())
	let caught: unknown
	try {
		// deno-lint-ignore no-explicit-any
		await (rpc.echo as any)({})
	} catch (e) {
		caught = e
	}
	assertEquals(caught instanceof RpcClientError, true)
	assertEquals((caught as RpcClientError).status, 422)
	assertEquals(fieldErrors(caught), { msg: 'msg required' })
})

Deno.test('unknown procedure → 404 RpcClientError', async () => {
	const rpc = clientFor(mountedRouter())
	let caught: unknown
	try {
		// deno-lint-ignore no-explicit-any
		await (rpc as any).nope()
	} catch (e) {
		caught = e
	}
	assertEquals(caught instanceof RpcClientError, true)
	assertEquals((caught as RpcClientError).status, 404)
})
