import { assertEquals } from '@std/assert'
import { createAuth, createMemoryStore } from './mod.ts'

type Session = { userId: string; accessToken: string }

const fakeInfo = {
	remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
	completed: Promise.resolve(),
} as unknown as Deno.ServeHandlerInfo

function reqWithCookie(sid?: string): Request {
	return new Request('http://x/', sid ? { headers: { Cookie: `sid=${sid}` } } : {})
}

Deno.test('login + getSession round-trip through the cookie', async () => {
	const auth = createAuth<Session>({ store: createMemoryStore<Session>() })
	const { sessionId, setCookie } = await auth.login({ userId: 'u1', accessToken: 'a1' })

	assertEquals(setCookie.includes(`sid=${sessionId}`), true)
	assertEquals(setCookie.includes('HttpOnly'), true)

	const session = await auth.getSession(reqWithCookie(sessionId))
	assertEquals(session?.userId, 'u1')
})

Deno.test('getSession: null without a cookie or for an unknown id', async () => {
	const auth = createAuth<Session>({ store: createMemoryStore<Session>() })
	assertEquals(await auth.getSession(reqWithCookie()), null)
	assertEquals(await auth.getSession(reqWithCookie('nope')), null)
})

Deno.test('logout clears the cookie and deletes the session', async () => {
	const auth = createAuth<Session>({ store: createMemoryStore<Session>() })
	const { sessionId } = await auth.login({ userId: 'u1', accessToken: 'a1' })

	const { setCookie } = await auth.logout(reqWithCookie(sessionId))
	assertEquals(setCookie.includes('Max-Age=0'), true)
	assertEquals(await auth.getSession(reqWithCookie(sessionId)), null)
})

Deno.test('require(): 401 without a session, passes through with one', async () => {
	const auth = createAuth<Session>({ store: createMemoryStore<Session>() })
	const guard = auth.require()
	const ok = () => Promise.resolve(new Response('ok'))

	const denied = await guard(reqWithCookie(), ok, fakeInfo)
	assertEquals(denied.status, 401)
	await denied.body?.cancel()

	const { sessionId } = await auth.login({ userId: 'u1', accessToken: 'a1' })
	const allowed = await guard(reqWithCookie(sessionId), ok, fakeInfo)
	assertEquals(allowed.status, 200)
	assertEquals(await allowed.text(), 'ok')
})
