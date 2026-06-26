/**
 * Path utilities shared by the route table and the action router.
 *
 * Kept separate so route mounting and the action router join prefixes and
 * interpolate `:param` segments identically.
 */

/** Join a parent prefix and a child path, normalising slashes. */
export function joinPath(a: string, b: string): string {
	if (!a) return b.startsWith('/') ? b : `/${b}`
	if (!b) return a
	const left = a.replace(/\/$/, '')
	const right = b.startsWith('/') ? b : `/${b}`
	return left + right
}

/**
 * Replace `:param` segments with values from `params`. Throws if any segment
 * is left unfilled — URL generation is runtime-checked, not compile-time.
 */
export function interpolatePath(path: string, params: Record<string, string | number>): string {
	let result = path
	for (const [key, value] of Object.entries(params)) {
		result = result.replace(`:${key}`, encodeURIComponent(String(value)))
	}
	if (/:[a-zA-Z]/.test(result)) {
		throw new Error(`Missing params when generating URL for '${path}': result was '${result}'`)
	}
	return result
}
