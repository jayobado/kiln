import type { StandardSchemaV1 } from '@standard-schema/spec'
import { validateInput } from './validate.ts'

export type ProcedureKind = 'query' | 'mutation'

/** Standard Schema validators per input source. All optional. */
export type InputSchemas = {
	body?: StandardSchemaV1
	query?: StandardSchemaV1
	params?: StandardSchemaV1
	headers?: StandardSchemaV1
}

/** Raw, unvalidated input handed to `call` (and extracted from a request by the action router). */
export type RawInput = {
	body?: unknown
	query?: unknown
	params?: unknown
	headers?: unknown
}

/**
 * The validated input shape a resolver receives: one typed field per declared
 * schema, inferred via Standard Schema. Undeclared sources are absent.
 */
export type InferInput<I extends InputSchemas> = {
	[K in keyof I as I[K] extends StandardSchemaV1 ? K : never]: I[K] extends StandardSchemaV1
		? StandardSchemaV1.InferOutput<I[K]>
		: never
}

export type Resolver<C, I extends InputSchemas, O> = (
	args: { ctx: C; input: InferInput<I> },
) => O | Promise<O>

/**
 * Opaque carrier of the (possibly refined) context a middleware produced. You
 * never build it — it's the return type of `next(...)`, and the builder reads
 * the context type back out of it to type the next stage.
 */
export type NextResult<C> = { readonly __ctx: C }

/** The `next` continuation handed to middleware. Call `next({ ctx })` to refine the context. */
export type Next<CIn> = {
	(): Promise<NextResult<CIn>>
	<C2>(args: { ctx: C2 }): Promise<NextResult<C2>>
}

/**
 * Transport-neutral middleware. Operates on `ctx`, optionally refines it by
 * returning `next({ ctx })`, and signals failure by throwing (never by
 * returning a Response). Runs identically on the HTTP and in-process paths.
 *
 * The refined context type is inferred from what you pass to `next`, so a guard
 * that does `return next({ ctx: { ...ctx, session: ctx.session } })` narrows
 * `session` to non-null for every downstream stage.
 */
export type MiddlewareFn<CIn, R extends NextResult<unknown> = NextResult<CIn>> = (
	args: { ctx: CIn; next: Next<CIn> },
) => Promise<R>

/** Read the context type carried by a middleware's NextResult. */
type NextCtx<R> = R extends NextResult<infer C2> ? C2 : never

type AnyMiddleware = (
	args: { ctx: unknown; next: (args?: { ctx?: unknown }) => Promise<unknown> },
) => Promise<unknown>

export type ProcedureDef<I extends InputSchemas, O> = {
	kind: ProcedureKind
	schemas: I
	middleware: AnyMiddleware[]
	/** Resolver, stored loosely — it sees the middleware-refined ctx, typed at build time. */
	resolver: (args: { ctx: unknown; input: InferInput<I> }) => O | Promise<O>
}

export type Procedure<C, I extends InputSchemas, O> = {
	kind: ProcedureKind
	/**
	 * In-process caller: validates, runs middleware, resolves. Throws on failure.
	 * `ctx` is the *base* context (what the action router or a server caller
	 * builds) — middleware refines it internally for the resolver.
	 */
	call(args: { ctx: C; input?: RawInput }): Promise<O>
	/** @internal — consumed by the action router. */
	__def: ProcedureDef<I, O>
}

/**
 * The builder threads two context types: `CBase` is what a caller must supply
 * (fixed by createProcedures); `CCur` is the running context the next stage
 * sees, refined by each `.use`. A finalised Procedure's `call` takes `CBase`;
 * its resolver sees `CCur`.
 */
export type ProcedureBuilder<CBase, CCur, I extends InputSchemas> = {
	/** Declare and validate input. Merges with any previously-declared schemas. */
	input<S extends InputSchemas>(schemas: S): ProcedureBuilder<CBase, CCur, I & S>
	/** Add transport-neutral middleware; refines the running context to whatever it passes to `next`. */
	use<R extends NextResult<unknown>>(
		mw: MiddlewareFn<CCur, R>,
	): ProcedureBuilder<CBase, NextCtx<R>, I>
	/** Finalise as a read procedure. */
	query<O>(resolver: Resolver<CCur, I, O>): Procedure<CBase, I, O>
	/** Finalise as a write procedure. */
	mutation<O>(resolver: Resolver<CCur, I, O>): Procedure<CBase, I, O>
}

/**
 * Create a procedure builder bound to a transport-neutral context type `C`.
 *
 *   const t = createProcedures<AppCtx>()
 *   const createOrder = t
 *     .input({ body: OrderSchema })
 *     .mutation(({ ctx, input }) => ctx.api.post('/orders', input.body))
 */
export function createProcedures<C>(): ProcedureBuilder<C, C, Record<never, never>> {
	return makeBuilder<C, C, Record<never, never>>({}, [])
}

function makeBuilder<CBase, CCur, I extends InputSchemas>(
	schemas: I,
	middleware: AnyMiddleware[],
): ProcedureBuilder<CBase, CCur, I> {
	return {
		input<S extends InputSchemas>(more: S): ProcedureBuilder<CBase, CCur, I & S> {
			return makeBuilder<CBase, CCur, I & S>({ ...schemas, ...more }, middleware)
		},
		use<R extends NextResult<unknown>>(
			mw: MiddlewareFn<CCur, R>,
		): ProcedureBuilder<CBase, NextCtx<R>, I> {
			return makeBuilder<CBase, NextCtx<R>, I>(schemas, [
				...middleware,
				mw as unknown as AnyMiddleware,
			])
		},
		query<O>(resolver: Resolver<CCur, I, O>): Procedure<CBase, I, O> {
			return finalize<CBase, I, O>(
				'query',
				schemas,
				middleware,
				resolver as Resolver<unknown, I, O>,
			)
		},
		mutation<O>(resolver: Resolver<CCur, I, O>): Procedure<CBase, I, O> {
			return finalize<CBase, I, O>(
				'mutation',
				schemas,
				middleware,
				resolver as Resolver<unknown, I, O>,
			)
		},
	}
}

function finalize<CBase, I extends InputSchemas, O>(
	kind: ProcedureKind,
	schemas: I,
	middleware: AnyMiddleware[],
	resolver: Resolver<unknown, I, O>,
): Procedure<CBase, I, O> {
	const def: ProcedureDef<I, O> = { kind, schemas, middleware, resolver }
	return {
		kind,
		__def: def,
		call: ({ ctx, input }) => runProcedure<I, O>(def, ctx, input ?? {}),
	}
}

async function runProcedure<I extends InputSchemas, O>(
	def: ProcedureDef<I, O>,
	ctx: unknown,
	raw: RawInput,
): Promise<O> {
	const input = await validateInput(def.schemas, raw)
	let prevIndex = -1

	const dispatch = (index: number, currentCtx: unknown): Promise<unknown> => {
		if (index <= prevIndex) {
			return Promise.reject(
				new Error('next() called multiple times in a procedure middleware'),
			)
		}
		prevIndex = index
		const mw = def.middleware[index]
		if (!mw) {
			return Promise.resolve(def.resolver({ ctx: currentCtx, input }))
		}
		const next = (args?: { ctx?: unknown }): Promise<unknown> =>
			dispatch(index + 1, args && 'ctx' in args ? args.ctx : currentCtx)
		return Promise.resolve(mw({ ctx: currentCtx, next }))
	}

	return (await dispatch(0, ctx)) as O
}
