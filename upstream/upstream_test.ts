import { assertEquals } from '@std/assert'
import { createAuth, createMemoryStore } from '../auth/mod.ts'
import { createUpstream, UpstreamError } from './mod.ts'

type Session = { userId: string; accessToken: string }

function stubFetch(impl: (url: string, init?: RequestInit) => Response): {
	captured: { url?: string; headers?: Headers }
	restore: () => void
} {
	const orig = globalThis.fetch
	const captured: { url?: string; headers?: Headers } = {}
	globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
		captured.url = String(url)
		captured.headers = new Headers(init?.headers)
		return Promise.resolve(impl(String(url), init))
	}) as typeof fetch
	return { captured, restore: () => { globalThis.fetch = orig } }
}

Deno.test('forSession attaches credential + default headers', async () => {
	const auth = createAuth<Session>({
		store: createMemoryStore<Session>(),
		credentials: { toHeaders: (s) => ({ Authorization: `Bearer ${s.accessToken}` }) },
	})
	const api = createUpstream<Session>({
		baseUrl: 'https://api.test',
		auth,
		defaultHeaders: { Accept: 'application/json' },
	})

	const stub = stubFetch(() => Response.json({ ok: true }))
	try {
		const out = await api.forSession({ userId: 'u1', accessToken: 'a1' }).get<{ ok: boolean }>('/me')
		assertEquals(out.ok, true)
		assertEquals(stub.captured.url, 'https://api.test/me')
		assertEquals(stub.captured.headers?.get('Authorization'), 'Bearer a1')
		assertEquals(stub.captured.headers?.get('Accept'), 'application/json')
	} finally {
		stub.restore()
	}
})

Deno.test('non-2xx throws UpstreamError carrying status + body', async () => {
	const api = createUpstream({ baseUrl: 'https://api.test' })
	const stub = stubFetch(() => Response.json({ message: 'nope' }, { status: 404 }))
	try {
		let caught: unknown
		try {
			await api.forSession(null).get('/missing')
		} catch (e) {
			caught = e
		}
		assertEquals(caught instanceof UpstreamError, true)
		assertEquals((caught as UpstreamError).status, 404)
	} finally {
		stub.restore()
	}
})
