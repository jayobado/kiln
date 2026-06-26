export interface RouteParams { [key: string]: string }
export interface QueryParams { [key: string]: string }

export interface RouteContext {
	params: RouteParams
	query: QueryParams
	path: string
}

export type GuardFn = (
	context: RouteContext,
) => boolean | string | Promise<boolean | string>