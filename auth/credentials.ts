import type { BaseSessionData } from './store.ts'

export type CredentialOptions<S extends BaseSessionData = BaseSessionData> = {
	/**
	 * Convert a session into the headers that should ride on upstream requests.
	 * Most apps return `{ Authorization: \`Bearer ${session.accessToken}\` }`,
	 * but the shape is yours.
	 */
	toHeaders: (session: S) => Record<string, string>

	/**
	 * Optional cookies to forward to upstream alongside the credential header —
	 * e.g. a session-affinity cookie the BFF should round-trip. Default: none.
	 */
	forwardCookies?: string[]
}

export type CredentialRelay<S extends BaseSessionData = BaseSessionData> = {
	headersFor(session: S): Record<string, string>
	forwardedCookies(req: Request): string | null
}

/**
 * Bound credential relay. Used by createUpstream to attach credentials to
 * outbound requests for the current session.
 */
export function createCredentialRelay<S extends BaseSessionData>(
	options: CredentialOptions<S>,
): CredentialRelay<S> {
	return {
		headersFor(session: S): Record<string, string> {
			return options.toHeaders(session)
		},

		forwardedCookies(req: Request): string | null {
			const names = options.forwardCookies
			if (!names || names.length === 0) return null

			const cookieHeader = req.headers.get('Cookie')
			if (!cookieHeader) return null

			const wanted = new Set(names)
			const kept: string[] = []
			for (const pair of cookieHeader.split(';').map((s) => s.trim())) {
				const eq = pair.indexOf('=')
				if (eq < 0) continue
				const cookieName = pair.slice(0, eq).trim()
				if (wanted.has(cookieName)) kept.push(pair)
			}
			return kept.length > 0 ? kept.join('; ') : null
		},
	}
}
