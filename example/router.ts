// Shared between server and client. The client imports only the *type* of
// `appRouter`; the server mounts the value.

import type { StandardSchemaV1 } from '@standard-schema/spec'
import { createProcedures, ProcedureError } from '@jayobado/kiln/procedure'
import { ok } from '@jayobado/kiln/rpc'

export type Session = { userId: string; name: string; accessToken: string }
export type Ctx = { session: Session | null }

// A tiny inline Standard Schema, so the example needs no validator dependency.
function field<T>(check: (v: unknown) => v is T, message: string): StandardSchemaV1<unknown, T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'example',
			validate: (input) => check(input) ? { value: input } : { issues: [{ message, path: [] }] },
		},
	}
}

const NameInput = field<{ name: string }>(
	(v): v is { name: string } =>
		typeof v === 'object' && v !== null && typeof (v as { name?: unknown }).name === 'string',
	'name is required',
)
const NoteInput = field<{ text: string }>(
	(v): v is { text: string } =>
		typeof v === 'object' && v !== null && typeof (v as { text?: unknown }).text === 'string' &&
		(v as { text: string }).text.length > 0,
	'text is required',
)

const t = createProcedures<Ctx>()

// A guard that narrows `session` to non-null for every downstream stage.
const authed = t.use(({ ctx, next }) => {
	if (!ctx.session) throw new ProcedureError('UNAUTHORIZED')
	return next({ ctx: { ...ctx, session: ctx.session } })
})

export const appRouter = {
	// Public query.
	greet: t.input({ body: NameInput }).query(({ input }) => ({ message: `Hello, ${input.body.name}!` })),

	// Auth-gated query — 401 without a session cookie.
	me: authed.query(({ ctx }) => ({ id: ctx.session.userId, name: ctx.session.name })),

	notes: {
		// Auth-gated mutation that returns a value plus a flash payload.
		create: authed.input({ body: NoteInput }).mutation(({ ctx, input }) =>
			ok({ author: ctx.session.name, text: input.body.text }, {
				flash: { kind: 'success', message: 'Note saved' },
			})
		),
	},
}

export type AppRouter = typeof appRouter
