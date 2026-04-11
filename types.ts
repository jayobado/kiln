// ─── Handler ──────────────────────────────────────────────────────────────────

export type Handler = (
  req: Request,
  params: Record<string, string>,
  info: Deno.ServeHandlerInfo
) => Response | Promise<Response>

// ─── Middleware ───────────────────────────────────────────────────────────────

export type Next = () => Promise<Response>

export type Middleware = (
  req: Request,
  next: Next,
  info: Deno.ServeHandlerInfo
) => Response | Promise<Response>

// ─── Route ────────────────────────────────────────────────────────────────────

export interface Route {
  pattern: URLPattern
  methods: string[]
  handler: Handler
}

// ─── Router ───────────────────────────────────────────────────────────────────

export interface Router {
  use(middleware: Middleware): this
  get(path: string, handler: Handler): this
  post(path: string, handler: Handler): this
  put(path: string, handler: Handler): this
  patch(path: string, handler: Handler): this
  delete(path: string, handler: Handler): this
  all(path: string, handler: Handler): this
}

// ─── HMR ─────────────────────────────────────────────────────────────────────

export type HmrEventType = 'reload' | 'css-reload' | 'invalidate'

export interface HmrMessage {
  type: HmrEventType
  path: string
}

// ─── Serve options ────────────────────────────────────────────────────────────

export interface ServeOptions {
  host: string
  port: number

  fsRoot?: string
  importMap?: string | { imports: Record<string, string> }

  githubToken?: string

  strategy?: 'lazy' | 'eager'

  // Enable HMR — default true when strategy is 'lazy'
  hmr?: boolean

  compilerOptions?: Record<string, unknown>

  routes?: (router: Router) => void

  middleware?: Middleware[]
}

// ─── Bundle options ───────────────────────────────────────────────────────────

export interface BundleOptions {
  entry: string

  outDir?: string
  importMap?: string | { imports: Record<string, string> }
  githubToken?: string

  // Compiler options e.g. { jsx: 'react-jsx', jsxImportSource: 'react' }
  compilerOptions?: Record<string, unknown>

  minify?: boolean
}

export interface BundleResult {
  outFile: string
  bytes: number
  elapsed: string
}