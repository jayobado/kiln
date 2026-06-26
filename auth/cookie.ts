export type CookieOptions = {
	/** Cookie name. Default: 'sid'. */
	name?: string
	/** Domain scope. Omit for browser-default (request host). */
	domain?: string
	/** Path scope. Default: '/'. */
	path?: string
	/** Same-site policy. Default: 'Lax'. */
	sameSite?: 'Strict' | 'Lax' | 'None'
	/** Require HTTPS. Default: true. */
	secure?: boolean
	/** Max-age in seconds. Default: 7 days. */
	maxAge?: number
}

/**
 * Cookie I/O bound to a configuration. Unlike the Hono version this is built on
 * the Web `Request`/`Set-Cookie` model: `read` parses the inbound Cookie header,
 * and `serialize`/`serializeClear` return `Set-Cookie` header values the caller
 * attaches to the outgoing Response.
 */
export type CookieIO = {
	/** Read the session cookie value from a request, or undefined. */
	read(req: Request): string | undefined
	/** Build the `Set-Cookie` header value that writes the session id. */
	serialize(sessionId: string): string
	/** Build the `Set-Cookie` header value that clears the cookie. */
	serializeClear(): string
}

const DEFAULTS: Required<Omit<CookieOptions, 'domain'>> = {
	name: 'sid',
	path: '/',
	sameSite: 'Lax',
	secure: true,
	maxAge: 60 * 60 * 24 * 7,
}

/** Parse a single cookie value out of a `Cookie` header by name. */
export function readCookie(req: Request, name: string): string | undefined {
	const header = req.headers.get('Cookie')
	if (!header) return undefined
	for (const pair of header.split(';')) {
		const eq = pair.indexOf('=')
		if (eq < 0) continue
		if (pair.slice(0, eq).trim() === name) {
			return decodeURIComponent(pair.slice(eq + 1).trim())
		}
	}
	return undefined
}

export function createCookieIO(options: CookieOptions = {}): CookieIO {
	const cfg = { ...DEFAULTS, ...options }
	const { name, domain, path, sameSite, secure, maxAge } = cfg

	const base = (value: string, maxAgeSeconds: number): string => {
		const parts = [
			`${name}=${encodeURIComponent(value)}`,
			`Path=${path}`,
			'HttpOnly',
			`SameSite=${sameSite}`,
			`Max-Age=${maxAgeSeconds}`,
		]
		if (secure) parts.push('Secure')
		if (domain) parts.push(`Domain=${domain}`)
		return parts.join('; ')
	}

	return {
		read(req) {
			return readCookie(req, name)
		},
		serialize(sessionId) {
			return base(sessionId, maxAge)
		},
		serializeClear() {
			return base('', 0)
		},
	}
}
