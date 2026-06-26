/** HTTP methods the BFF route/action mounts understand. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/**
 * A single validation failure, normalised across input sources. Carried by
 * `ValidationError` and emitted by the default error response so clients (and
 * the form layer) can map issues back to fields.
 */
export type ValidationIssue = {
	source: 'body' | 'query' | 'params' | 'headers'
	path: ReadonlyArray<PropertyKey>
	message: string
}
