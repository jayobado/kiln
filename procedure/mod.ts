/**
 * @module
 * Transport-neutral server-side procedures (the tRPC server model). A procedure
 * is a typed unit — validated input, a context, a resolver that returns a plain
 * value (not a Response). Call it in-process with `procedure.call(...)`, or
 * mount it over HTTP via `createActionRouter`, which maps the value (or a thrown
 * ProcedureError / ValidationError) to a Response on kiln's Router.
 *
 *   import { createProcedures, createActionRouter } from '@jayobado/kiln/procedure'
 *
 *   const t = createProcedures<AppCtx>()
 *   const createOrder = t
 *     .input({ body: OrderSchema })
 *     .mutation(({ ctx, input }) => ctx.api.post('/orders', input.body))
 *
 *   const actions = createActionRouter<AppCtx>({ context: (req) => buildCtx(req) })
 *   actions.add({
 *     name: 'orders.create', method: 'POST', path: '/orders',
 *     procedure: createOrder,
 *     render: ({ value }) => Response.json(value, { status: 201 }),
 *   })
 *
 *   // inside serve({ routes }): actions.mount(router)
 */

export { createProcedures } from './builder.ts'
export type {
	InferInput,
	InputSchemas,
	MiddlewareFn,
	Next,
	NextResult,
	Procedure,
	ProcedureBuilder,
	ProcedureDef,
	ProcedureKind,
	RawInput,
	Resolver,
} from './builder.ts'

export { ProcedureError, ValidationError } from './errors.ts'
export type { ProcedureErrorCode } from './errors.ts'

export { validateInput } from './validate.ts'

export { createActionRouter, defaultErrorResponse } from './action.ts'
export type {
	ActionDescriptor,
	ActionErrorHandler,
	ActionGroupConfig,
	ActionRouter,
	ActionRouterConfig,
} from './action.ts'
