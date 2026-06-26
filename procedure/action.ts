import type { Router } from '../router.ts'
import type { Handler, Middleware } from '../types.ts'
import type { HttpMethod } from '../route/types.ts'
import { interpolatePath, joinPath } from '../route/path.ts'
import type { InputSchemas, Procedure, RawInput } from './builder.ts'
import { ProcedureError, type ProcedureErrorCode, ValidationError } from './errors.ts'

export type ActionErrorHandler = (
	args: { req: Request; error: unknown },
) => Response | Promise<Response>

export type ActionRouterConfig<C> = {
	/** Build the transport-neutral ctx from each request. Registered once. */
	context: (req: Request, params: Record<string, string>) => C | Promise<C>
	/** Default error → Response mapping. Overridable per action. */
	onError?: ActionErrorHandler
}

export type ActionDescriptor<C, I extends InputSchemas, O> = {
	name?: string
	method: HttpMethod
	path: string
	/** HTTP guards (rate limit, etc.) — run before the procedure, as kiln middleware. */
	guards?: Middleware[]
	procedure: Procedure<C, I, O>
	/** Map the resolved value to a Response. */
	render: (args: { req: Request; ctx: C; value: O }) => Response | Promise<Response>
	/** Per-action error override; falls back to the router's onError, then the default. */
	onError?: ActionErrorHandler
}

export type ActionGroupConfig<C> = {
	prefix?: string
	guards?: Middleware[]
	routes: (r: ActionRouter<C>) => void
}

export type ActionRouter<C> = {
	/** Register a procedure as an HTTP endpoint. */
	add<I extends InputSchemas, O>(descriptor: ActionDescriptor<C, I, O>): void
	/** Create a prefix/guards-scoped group of actions. */
	group(config: ActionGroupConfig<C>): void
	/** Generate a URL from a registered action name. Throws if the name is unknown. */
	url(name: string, params?: Record<string, string | number>): string
	/** Mount the registered actions onto a kiln Router (e.g. inside `serve({ routes })`). */
	mount(router: Router): void
}

type StoredAction = {
	name?: string
	method: HttpMethod
	path: string
	guards: Middleware[]
	procedure: Procedure<unknown, InputSchemas, unknown>
	render: (args: { req: Request; ctx: unknown; value: unknown }) => Response | Promise<Response>
	onError?: ActionErrorHandler
}

/**
 * Create an action router: the HTTP adapter that turns transport-neutral
 * procedures into kiln routes. The context builder runs once per request; each
 * action validates via `procedure.call`, then renders the value (or maps the
 * error) to a Response.
 */
export function createActionRouter<C>(config: ActionRouterConfig<C>): ActionRouter<C> {
	const stored: StoredAction[] = []
	const looseConfig = config as unknown as ActionRouterConfig<unknown>
	return makeScope(looseConfig, stored, '', []) as ActionRouter<C>
}

function makeScope(
	config: ActionRouterConfig<unknown>,
	stored: StoredAction[],
	parentPrefix: string,
	parentGuards: Middleware[],
): ActionRouter<unknown> {
	const self: ActionRouter<unknown> = {
		add(descriptor) {
			stored.push({
				name: descriptor.name,
				method: descriptor.method,
				path: joinPath(parentPrefix, descriptor.path),
				guards: [...parentGuards, ...(descriptor.guards ?? [])],
				procedure: descriptor.procedure as unknown as Procedure<unknown, InputSchemas, unknown>,
				render: descriptor.render as StoredAction['render'],
				onError: descriptor.onError,
			})
		},

		group(config2) {
			const child = makeScope(
				config,
				stored,
				joinPath(parentPrefix, config2.prefix ?? ''),
				[...parentGuards, ...(config2.guards ?? [])],
			)
			config2.routes(child)
		},

		url(name, params = {}) {
			const action = stored.find((a) => a.name === name)
			if (!action) {
				const known = stored.filter((a) => a.name).map((a) => a.name).join(', ')
				throw new Error(
					`Unknown action name: '${name}'. Known names: ${known || '(none registered)'}`,
				)
			}
			return interpolatePath(action.path, params)
		},

		mount(router) {
			for (const action of stored) mountAction(router, action, config)
		},
	}
	return self
}

function mountAction(router: Router, action: StoredAction, config: ActionRouterConfig<unknown>): void {
	const handler: Handler = async (req, params, info) => {
		const run = async (): Promise<Response> => {
			try {
				const ctx = await config.context(req, params)
				const raw = await extractRawInput(req, params, action.procedure.__def.schemas)
				const value = await action.procedure.call({ ctx, input: raw })
				return await action.render({ req, ctx, value })
			} catch (error) {
				const onError = action.onError ?? config.onError ?? defaultErrorResponse
				return await onError({ req, error })
			}
		}
		// Run HTTP guards (if any) as a kiln middleware chain ahead of the procedure.
		return await runGuards(action.guards, req, info, run)
	}

	router.on(action.method, action.path, handler)
}

function runGuards(
	guards: Middleware[],
	req: Request,
	info: Deno.ServeHandlerInfo,
	final: () => Promise<Response>,
): Promise<Response> {
	let index = 0
	const next = (): Promise<Response> => {
		if (index < guards.length) {
			const guard = guards[index++]
			return Promise.resolve(guard(req, next, info))
		}
		return final()
	}
	return next()
}

/** Extract only the input sources the procedure actually declares. */
async function extractRawInput(
	req: Request,
	params: Record<string, string>,
	schemas: InputSchemas,
): Promise<RawInput> {
	const raw: RawInput = {}

	if (schemas.body) {
		raw.body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
	}
	if (schemas.query) {
		raw.query = Object.fromEntries(new URL(req.url).searchParams.entries())
	}
	if (schemas.params) {
		raw.params = params
	}
	if (schemas.headers) {
		const headers: Record<string, string> = {}
		for (const [k, v] of req.headers.entries()) headers[k] = v
		raw.headers = headers
	}

	return raw
}

async function readBody(req: Request): Promise<unknown> {
	const contentType = req.headers.get('Content-Type') ?? ''
	if (contentType.includes('application/json')) {
		try {
			return await req.json()
		} catch {
			return undefined
		}
	}
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		try {
			return Object.fromEntries((await req.formData()).entries())
		} catch {
			return undefined
		}
	}
	try {
		return await req.json()
	} catch {
		return undefined
	}
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Default error → Response mapping. ValidationError → 422 with issues;
 * ProcedureError → its coded status; anything else → 500.
 */
export function defaultErrorResponse({ error }: { req: Request; error: unknown }): Response {
	if (error instanceof ValidationError) {
		return new Response(
			JSON.stringify({ error: { message: 'Validation failed', issues: error.issues } }),
			{ status: 422, headers: JSON_HEADERS },
		)
	}
	if (error instanceof ProcedureError) {
		return new Response(
			JSON.stringify({ error: { message: error.message, code: error.code } }),
			{ status: statusForCode(error.code), headers: JSON_HEADERS },
		)
	}
	return new Response(
		JSON.stringify({ error: { message: 'Internal server error' } }),
		{ status: 500, headers: JSON_HEADERS },
	)
}

function statusForCode(code: ProcedureErrorCode): number {
	switch (code) {
		case 'UNAUTHORIZED':
			return 401
		case 'FORBIDDEN':
			return 403
		case 'NOT_FOUND':
			return 404
		case 'BAD_REQUEST':
			return 400
		case 'CONFLICT':
			return 409
		case 'INTERNAL':
			return 500
	}
}
