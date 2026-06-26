/**
 * Merge the header layers for an outbound upstream request, in increasing
 * precedence:
 *
 *   1. static default headers from createUpstream config
 *   2. credential headers derived from the bound session
 *   3. forwarded cookies (request path only — server-side calls have none)
 *   4. per-request headers passed to the call
 *
 * Later layers override earlier ones. Credential resolution (override vs auth
 * mapper) happens in the factory; this helper just merges the resolved pieces.
 */
export function mergeCredentialHeaders(args: {
	defaults: Record<string, string>
	credHeaders: Record<string, string>
	cookie: string | null
	perRequest?: Record<string, string>
}): Record<string, string> {
	const out: Record<string, string> = { ...args.defaults }

	for (const [k, v] of Object.entries(args.credHeaders)) out[k] = v
	if (args.cookie) out['Cookie'] = args.cookie
	if (args.perRequest) {
		for (const [k, v] of Object.entries(args.perRequest)) out[k] = v
	}

	return out
}
