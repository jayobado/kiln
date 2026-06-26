import { assertEquals } from '@std/assert'
import { Router } from '../router.ts'
import { mountHealth } from './mod.ts'

const fakeInfo = {
	remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
	completed: Promise.resolve(),
} as unknown as Deno.ServeHandlerInfo

const hit = (router: Router, path: string) =>
	router.handle(new Request(`http://x${path}`), fakeInfo)

Deno.test('health: liveness, version, and readiness states', async () => {
	const router = new Router()
	let healthy = true
	mountHealth(router, { version: '1.2.3', ready: () => healthy })

	const live = await hit(router, '/health')
	assertEquals(live.status, 200)
	assertEquals(await live.json(), { status: 'ok' })

	const version = await hit(router, '/version')
	assertEquals((await version.json()).version, '1.2.3')

	const ready = await hit(router, '/ready')
	assertEquals(ready.status, 200)

	healthy = false
	const notReady = await hit(router, '/ready')
	assertEquals(notReady.status, 503)
	assertEquals((await notReady.json()).status, 'not_ready')
})

Deno.test('health: ready check that throws → 503', async () => {
	const router = new Router()
	mountHealth(router, { ready: () => { throw new Error('db down') } })
	const res = await hit(router, '/ready')
	assertEquals(res.status, 503)
	assertEquals((await res.json()).error, 'db down')
})
