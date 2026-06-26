/**
 * @module
 * BFF auth — OAuth-refresh-shaped: session id in an HttpOnly cookie, tokens in a
 * store, credentials relayed to upstream services. Built on the Web
 * `Request`/`Set-Cookie` model (no mutable request context): read the session
 * once in the action router's `context` builder, and apply the `Set-Cookie`
 * values returned by `login`/`logout` to your response.
 *
 *   import { createAuth, createMemoryStore } from '@jayobado/kiln/auth'
 *
 *   const auth = createAuth({
 *     store: createMemoryStore(),
 *     cookie: { secure: true, sameSite: 'Lax' },
 *     credentials: { toHeaders: (s) => ({ Authorization: `Bearer ${s.accessToken}` }) },
 *     refresh: { refresh: (token) => fetchNewToken(token) },
 *   })
 *
 *   // in a login handler:
 *   const { setCookie } = await auth.login(sessionData)
 *   return new Response(null, { status: 204, headers: { 'Set-Cookie': setCookie } })
 */

export { createAuth } from './factory.ts'
export type { Auth, AuthOptions, LoginResult } from './factory.ts'

export { createMemoryStore } from './memory.ts'
export type { BaseSessionData, SessionStore } from './store.ts'

export { createCookieIO, readCookie } from './cookie.ts'
export type { CookieIO, CookieOptions } from './cookie.ts'

export { createCredentialRelay } from './credentials.ts'
export type { CredentialOptions, CredentialRelay } from './credentials.ts'

export { createRefreshRunner } from './refresh.ts'
export type { RefreshOptions, RefreshResult, RefreshRunner } from './refresh.ts'
