/**
 * Outcome markers a procedure resolver can return to attach transport concerns
 * — navigation and flash — to its result, without the resolver knowing about
 * HTTP. The RPC handler unwraps them into the response envelope; the client
 * executes navigation (`navigate`) and surfaces flash (`onFlash`).
 *
 *   return redirect(`/orders/${id}`, { flash: { kind: 'success', message: 'Created' } })
 *   return ok(order, { flash: { kind: 'success', message: 'Saved' } })  // no navigation
 *   return order                                                         // plain result
 *
 * Flash is decoupled from navigation: it rides any response. The payload is
 * opaque (`unknown`) — the client's `onFlash` interprets it. The recommended
 * shape is `{ kind, message }`, which maps 1:1 to a toast call.
 *
 * Server-informed navigation preserves PRG's "the server decides the
 * destination" in an RPC/XHR world, where an HTTP 302 wouldn't move the browser.
 */

const REDIRECT = Symbol.for('kiln.rpc.redirect')
const RESULT = Symbol.for('kiln.rpc.result')

export type FlashOptions = { flash?: unknown }

export class RpcRedirect {
	readonly [REDIRECT] = true as const
	constructor(readonly url: string, readonly flash?: unknown) {}
}

export class RpcResult<T> {
	readonly [RESULT] = true as const
	constructor(readonly value: T, readonly flash?: unknown) {}
}

/** Signal server-informed navigation (optionally with flash) from a resolver. */
export function redirect(url: string, options: FlashOptions = {}): RpcRedirect {
	return new RpcRedirect(url, options.flash)
}

/** Return a value while attaching flash — for the stay-on-page (no-navigation) case. */
export function ok<T>(value: T, options: FlashOptions = {}): RpcResult<T> {
	return new RpcResult(value, options.flash)
}

export function isRpcRedirect(value: unknown): value is RpcRedirect {
	return typeof value === 'object' && value !== null &&
		(value as Record<symbol, unknown>)[REDIRECT] === true
}

export function isRpcResult(value: unknown): value is RpcResult<unknown> {
	return typeof value === 'object' && value !== null &&
		(value as Record<symbol, unknown>)[RESULT] === true
}
