/**
 * @module
 * Thin, dependency-free RPC over the procedure layer — the typed seam between
 * the kiln BFF and the lolo client. The client owns routing; views call typed
 * procedures. (The browser-side `createClient` is exported separately from
 * `@jayobado/kiln/client/rpc`.)
 *
 * Server: mount a nested router of procedures at one endpoint.
 *
 *   // server/router.ts
 *   const t = createProcedures<AppCtx>()
 *   export const appRouter = {
 *     orders: {
 *       show:   t.input({ body: ById }).query(({ ctx, input }) => ctx.api.get(`/orders/${input.body.id}`)),
 *       create: t.input({ body: OrderSchema }).mutation(({ ctx, input }) => ctx.api.post('/orders', input.body)),
 *     },
 *   }
 *   export type AppRouter = typeof appRouter
 *
 *   // inside serve({ routes }):
 *   createRpcHandler({ router: appRouter, context: buildCtx }).mount(router)
 *
 * Client (from '@jayobado/kiln/client/rpc'): a typed proxy from the exported
 * *type* — no codegen, no dependency.
 *
 *   import type { AppRouter } from '../server/router.ts'
 *   const rpc = createClient<AppRouter>({ url: '/rpc' })
 *   const order = await rpc.orders.show({ id: 42 })   // input + output fully typed
 */

export { createRpcHandler } from './server.ts'
export type { RpcHandler, RpcHandlerConfig, RpcRouter } from './server.ts'

export { isRpcRedirect, isRpcResult, ok, redirect, RpcRedirect, RpcResult } from './redirect.ts'
export type { FlashOptions } from './redirect.ts'
