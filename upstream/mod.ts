/**
 * @module
 * Upstream HTTP client. Composes with auth's credential relay to attach
 * Authorization headers (and forwarded cookies) to outbound requests.
 *
 *   import { createUpstream } from '@jayobado/kiln/upstream'
 *
 *   const api = createUpstream({ baseUrl: 'https://api.example.com', auth })
 *
 *   // server-side / inside a procedure ctx (the main path):
 *   const orders = await api.forSession(session).get<Order[]>('/orders')
 *
 *   // straight from a request:
 *   const me = await (await api.forRequest(req)).get<User>('/me')
 *
 * For non-REST protocols (Connect, tRPC, GraphQL), use `.headers()` with the
 * protocol's own client.
 */

export { createUpstream } from './factory.ts'
export type {
	BoundUpstream,
	RequestOptions,
	Upstream,
	UpstreamCredentials,
	UpstreamOptions,
} from './factory.ts'

export { mergeCredentialHeaders } from './headers.ts'
export { UpstreamError } from './error.ts'
