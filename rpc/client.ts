import type { InferInput, InputSchemas, Procedure } from '../procedure/mod.ts'
import type { RpcRedirect, RpcResult } from './redirect.ts'

/**
 * The single payload an RPC procedure accepts over the wire: the output of its
 * `body` schema, or nothing. RPC procedures use a single `body` input by
 * convention — there is no path/query/header split once you're past HTTP.
 */
export type RpcInput<I extends InputSchemas> = InferInput<I> extends { body: infer B } ? B : void

/**
 * The client-side result of a procedure. A resolver returning `redirect(...)`
 * navigates the client away, so the caller gets nothing back — `RpcRedirect`
 * collapses to `void`. `ok(value, ...)` unwraps to its inner value.
 */
export type RpcOutput<O> = O extends RpcRedirect ? void : O extends RpcResult<infer V> ? V : O

/**
 * Maps a procedure (or a namespace of procedures) to its client-callable shape.
 * A leaf `Procedure` becomes `(input) => Promise<output>`; a namespace recurses.
 */
export type RpcCaller<P> = P extends Procedure<infer _C, infer I extends InputSchemas, infer O>
	? RpcInput<I> extends void ? () => Promise<RpcOutput<O>>
	: (input: RpcInput<I>) => Promise<RpcOutput<O>>
	: P extends Record<string, unknown> ? { [K in keyof P]: RpcCaller<P[K]> }
	: never

/** The fully-typed client, derived purely from the exported router *type*. */
export type RpcClient<R> = { [K in keyof R]: RpcCaller<R[K]> }

/** Thrown when the server returns a non-2xx envelope. Carries the status + error payload. */
export class RpcClientError extends Error {
	constructor(readonly status: number, readonly payload: unknown) {
		super(`RPC call failed (${status})`)
		this.name = 'RpcClientError'
	}
}

export type ClientOptions = {
	/** Base URL the RPC handler is mounted at, e.g. '/rpc' or 'https://app/rpc'. */
	url: string
	/** Override the fetch implementation (e.g. to call the Router in-process in tests). */
	fetch?: (input: string, init: RequestInit) => Promise<Response>
	/** Per-call headers (auth, etc.). */
	headers?: () => HeadersInit | Promise<HeadersInit>
	/**
	 * Executes server-informed navigation when a procedure returns `redirect(...)`.
	 * Pass your client runtime's navigation for SPA-feel; defaults to a full-page
	 * `location.assign`. Only same-origin targets are honored.
	 */
	navigate?: (url: string) => void
	/**
	 * Called whenever a response carries flash (from `redirect(.., { flash })` or
	 * `ok(.., { flash })`). Wire it to your toast system. The payload is opaque.
	 */
	onFlash?: (flash: unknown) => void
}

/**
 * Create a typed RPC client from an exported router type. No codegen: property
 * access builds the dotted procedure path, and calling it POSTs the payload.
 *
 *   import type { AppRouter } from '../server/router.ts'   // type-only
 *   const rpc = createClient<AppRouter>({ url: '/rpc' })
 *   const order = await rpc.orders.show({ id: 42 })        // typed end-to-end
 */
export function createClient<R>(options: ClientOptions): RpcClient<R> {
	const doFetch = options.fetch ?? ((input: string, init: RequestInit) => fetch(input, init))

	const build = (path: string[]): unknown =>
		new Proxy(noop, {
			get: (_t, key) => (typeof key === 'string' ? build([...path, key]) : undefined),
			apply: async (_t, _this, args: unknown[]) => {
				const extra = options.headers ? await options.headers() : {}
				const res = await doFetch(`${options.url}/${path.join('.')}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...extra },
					body: JSON.stringify(args[0] ?? null),
				})
				const json = await res.json().catch(() => undefined) as
					| { result?: unknown; redirect?: string; flash?: unknown; error?: unknown }
					| undefined
				if (!res.ok) throw new RpcClientError(res.status, json?.error)
				// Flash rides any response — surface it before navigating.
				if (json?.flash !== undefined) options.onFlash?.(json.flash)
				// Server-informed navigation: execute it, resolve with nothing.
				if (typeof json?.redirect === 'string') {
					if (isSameOrigin(json.redirect)) (options.navigate ?? defaultNavigate)(json.redirect)
					return undefined
				}
				return json?.result
			},
		})

	return build([]) as RpcClient<R>
}

function noop(): void {}

/** Allow only relative paths or same-origin absolute URLs (open-redirect guard). */
function isSameOrigin(url: string): boolean {
	if (url.startsWith('/') && !url.startsWith('//')) return true
	try {
		return new URL(url).origin === globalThis.location?.origin
	} catch {
		return false
	}
}

function defaultNavigate(url: string): void {
	globalThis.location?.assign(url)
}

/**
 * Map a thrown RpcClientError from a `ValidationError` (422) into the flat
 * `{ fieldKey: message }` shape the form layer expects — `path` joined with dots
 * (e.g. `items.0.qty`). Returns `{}` for any other error, so it's safe to call
 * unconditionally in a catch.
 *
 *   onSubmit: async (state) => {
 *     try { await rpc.orders.create(state) }
 *     catch (e) { errors.set(fieldErrors(e)) }
 *   }
 */
export function fieldErrors(error: unknown): Record<string, string> {
	if (
		!(error instanceof RpcClientError) || typeof error.payload !== 'object' ||
		error.payload === null
	) {
		return {}
	}
	const issues = (error.payload as {
		issues?: Array<{ path?: ReadonlyArray<PropertyKey>; message: string }>
	}).issues
	if (!Array.isArray(issues)) return {}

	const out: Record<string, string> = {}
	for (const issue of issues) {
		const key = (issue.path ?? [])
			.filter((p): p is string | number => typeof p === 'string' || typeof p === 'number')
			.join('.')
		if (key) out[key] = issue.message
	}
	return out
}
