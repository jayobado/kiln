import type { Handler, Router } from '../types.ts'
import { joinPath } from '../route/path.ts'
import { defaultErrorResponse, type Procedure } from '../procedure/mod.ts'
import { isRpcRedirect, isRpcResult } from './redirect.ts'

// Fully-loose: a procedure's input schema sits in a contravariant position
// (its resolver), so pinning it here would reject concrete procedures.
// deno-lint-ignore no-explicit-any
type AnyProcedure = Procedure<any, any, any>

/** A nested registry of procedures. The object's *type* is the client contract. */
export type RpcRouter = { [key: string]: AnyProcedure | RpcRouter }

export type RpcHandlerConfig<C> = {
	router: RpcRouter
	/** Build the transport-neutral ctx from each request. Runs once per call. */
	context: (req: Request, params: Record<string, string>) => C | Promise<C>
	/** Error → Response mapping. Defaults to the procedure layer's defaultErrorResponse. */
	onError?: (args: { req: Request; error: unknown }) => Response | Promise<Response>
}

/** Mountable RPC endpoint — registers `POST {basePath}/{dotted.path}` on a kiln Router. */
export type RpcHandler = {
	mount(router: Router, basePath?: string): void
}

/** Attach a flash payload to an envelope only when one is present. */
function withFlash<E extends Record<string, unknown>>(envelope: E, flash: unknown): E {
	return flash === undefined ? envelope : { ...envelope, flash }
}

function isProcedure(v: AnyProcedure | RpcRouter): v is AnyProcedure {
	return typeof (v as AnyProcedure).call === 'function' && '__def' in v
}

/** Flatten a nested router into a 'a.b.c' → procedure map. */
function flatten(
	router: RpcRouter,
	prefix: string[],
	out: Map<string, AnyProcedure>,
): Map<string, AnyProcedure> {
	for (const [key, value] of Object.entries(router)) {
		if (isProcedure(value)) out.set([...prefix, key].join('.'), value)
		else flatten(value, [...prefix, key], out)
	}
	return out
}

/**
 * Build a mountable RPC endpoint from a router of procedures. Each call is
 * `POST {basePath}/{dotted.path}` with the JSON payload as the procedure's
 * `body` input; the resolved value comes back as `{ result }`, a `redirect(...)`
 * as `{ redirect }`, errors via onError.
 *
 *   const rpc = createRpcHandler({ router: appRouter, context: buildCtx })
 *   // inside serve({ routes }): rpc.mount(router)            // default '/rpc'
 */
export function createRpcHandler<C>(config: RpcHandlerConfig<C>): RpcHandler {
	const procedures = flatten(config.router, [], new Map())
	const onError = config.onError ?? defaultErrorResponse

	const handler: Handler = async (req, params) => {
		const name = params.path
		const proc = procedures.get(name)
		if (!proc) {
			return Response.json(
				{ error: { code: 'NOT_FOUND', message: `Unknown procedure '${name}'` } },
				{ status: 404 },
			)
		}
		try {
			const ctx = await config.context(req, params)
			const body = await req.json().catch(() => undefined)
			const value = await proc.call({ ctx, input: { body } })
			// Unwrap outcome markers into the envelope (flash rides either shape).
			if (isRpcRedirect(value)) {
				return Response.json(withFlash({ redirect: value.url }, value.flash))
			}
			if (isRpcResult(value)) {
				return Response.json(withFlash({ result: value.value }, value.flash))
			}
			return Response.json({ result: value })
		} catch (error) {
			return await onError({ req, error })
		}
	}

	return {
		mount(router: Router, basePath = '/rpc'): void {
			router.post(joinPath(basePath, '/:path'), handler)
		},
	}
}
