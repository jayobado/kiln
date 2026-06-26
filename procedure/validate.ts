import type { ValidationIssue } from '../route/types.ts'
import { ValidationError } from './errors.ts'
import type { InferInput, InputSchemas, RawInput } from './builder.ts'

const SOURCES = ['body', 'query', 'params', 'headers'] as const

/**
 * Validate raw input against a set of Standard Schema validators, one per
 * source. Returns the typed, parsed input. Throws ValidationError carrying all
 * issues (across every source) if any validator fails.
 *
 * Shared by the in-process caller and the action router so both paths validate
 * identically.
 */
export async function validateInput<I extends InputSchemas>(
	schemas: I,
	raw: RawInput,
): Promise<InferInput<I>> {
	const issues: ValidationIssue[] = []
	const out: Record<string, unknown> = {}

	for (const source of SOURCES) {
		const schema = schemas[source]
		if (!schema) continue

		let result = schema['~standard'].validate(raw[source])
		if (result instanceof Promise) result = await result

		if (result.issues) {
			for (const issue of result.issues) {
				issues.push({
					source,
					path: issue.path?.map((p) => (typeof p === 'object' ? p.key : p)) ?? [],
					message: issue.message,
				})
			}
		} else {
			out[source] = result.value
		}
	}

	if (issues.length > 0) throw new ValidationError(issues)
	return out as InferInput<I>
}
