import type { Middleware } from '../types.ts'
import type { BaseSessionData, SessionStore } from './store.ts'
import { type CookieIO, type CookieOptions, createCookieIO } from './cookie.ts'
import { type CredentialOptions, type CredentialRelay, createCredentialRelay } from './credentials.ts'
import { createRefreshRunner, type RefreshOptions, type RefreshRunner } from './refresh.ts'

export type AuthOptions<S extends BaseSessionData = BaseSessionData> = {
	store: SessionStore<S>
	cookie?: CookieOptions
	credentials?: CredentialOptions<S>
	refresh?: RefreshOptions
	/**
	 * Optional hook called after every successful session read — useful for
	 * "extend session on activity" semantics. Return value is ignored.
	 */
	onSessionRead?: (req: Request, session: S) => void | Promise<void>
}

/** Result of `login` — the new session id plus the `Set-Cookie` header to send. */
export type LoginResult = { sessionId: string; setCookie: string }

export type Auth<S extends BaseSessionData = BaseSessionData> = {
	/**
	 * Read the current session: parse the cookie, load from the store, refresh
	 * if needed (persisting the new tokens), and return it — or null if absent
	 * or unrecoverable. Call once per request (the action router's `context`
	 * builder is the natural place).
	 */
	getSession(req: Request): Promise<S | null>

	/**
	 * Create a session and return its id plus the `Set-Cookie` header value to
	 * attach to the response. Call after successful authentication.
	 */
	login(data: S): Promise<LoginResult>

	/**
	 * Delete the current session from the store and return the `Set-Cookie`
	 * header value that clears the cookie.
	 */
	logout(req: Request): Promise<{ setCookie: string }>

	/**
	 * Guard middleware: blocks requests without a session. 401 JSON by default;
	 * pass `redirectTo` for an HTML-friendly auth wall (302).
	 */
	require(options?: { redirectTo?: string }): Middleware

	/** Cookie I/O bound to this auth instance. */
	cookie: CookieIO

	/** Credential relay, if configured. */
	credentials: CredentialRelay<S> | null

	/** Refresh runner, if configured. */
	refresh: RefreshRunner | null
}

export function createAuth<S extends BaseSessionData = BaseSessionData>(
	options: AuthOptions<S>,
): Auth<S> {
	const cookie = createCookieIO(options.cookie)
	const credentials = options.credentials ? createCredentialRelay(options.credentials) : null
	const refresh = options.refresh ? createRefreshRunner(options.refresh) : null

	const getSession = async (req: Request): Promise<S | null> => {
		const sessionId = cookie.read(req)
		if (!sessionId) return null

		let session = await options.store.get(sessionId)
		if (!session) return null

		if (refresh && refresh.shouldRefresh(session)) {
			const refreshed = await refresh.run(session)
			if (refreshed) {
				// run() does {...session, ...newTokens}, preserving S-specific fields.
				const typed = refreshed as S
				await options.store.set(sessionId, typed)
				session = typed
			} else {
				// Refresh failed — kill the session. The stale cookie is harmless;
				// the next read finds no session and treats the request as logged out.
				await options.store.delete(sessionId)
				return null
			}
		}

		if (options.onSessionRead) {
			try {
				await options.onSessionRead(req, session)
			} catch { /* swallow */ }
		}

		return session
	}

	const login = async (data: S): Promise<LoginResult> => {
		const sessionId = crypto.randomUUID()
		await options.store.set(sessionId, data)
		return { sessionId, setCookie: cookie.serialize(sessionId) }
	}

	const logout = async (req: Request): Promise<{ setCookie: string }> => {
		const sessionId = cookie.read(req)
		if (sessionId) await options.store.delete(sessionId)
		return { setCookie: cookie.serializeClear() }
	}

	const require = (opts: { redirectTo?: string } = {}): Middleware => {
		return async (req, next) => {
			const session = await getSession(req)
			if (session) return next()
			if (opts.redirectTo) {
				return new Response(null, { status: 302, headers: { Location: opts.redirectTo } })
			}
			return new Response(
				JSON.stringify({ error: { message: 'Unauthorized' } }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } },
			)
		}
	}

	return { getSession, login, logout, require, cookie, credentials, refresh }
}
