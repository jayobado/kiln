import type { ValidationIssue } from '../route/types.ts'

/**
 * Coded application error a procedure (or its middleware) can throw. The HTTP
 * adapter maps the code to a status; the in-process caller lets it propagate.
 */
export type ProcedureErrorCode =
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'BAD_REQUEST'
	| 'CONFLICT'
	| 'INTERNAL'

export class ProcedureError extends Error {
	override readonly name = 'ProcedureError'
	readonly code: ProcedureErrorCode

	constructor(code: ProcedureErrorCode, message?: string, options?: { cause?: unknown }) {
		super(message ?? code, options)
		this.code = code
	}
}

/**
 * Thrown by `procedure.call` when input fails Standard Schema validation.
 * Distinct from ProcedureError so the form-submission path can special-case it
 * with a clean `instanceof` check.
 */
export class ValidationError extends Error {
	override readonly name = 'ValidationError'

	constructor(readonly issues: ValidationIssue[]) {
		super('Validation failed')
	}
}
