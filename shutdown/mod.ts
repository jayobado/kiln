/**
 * @module
 * Process-level graceful-shutdown registry.
 *
 * kiln's `serve()` already drains the HTTP server and flushes logs on
 * SIGINT/SIGTERM. This registry lets any part of the app (auth, upstream,
 * application code) register cleanup that all runs together at that point —
 * `serve()` calls `runShutdown()` for you.
 *
 *   import { onShutdown } from '@jayobado/kiln/shutdown'
 *
 *   onShutdown(async () => { await db.close() })
 *   onShutdown(() => { metrics.flush() })
 *
 * Outside of `serve()` (e.g. a one-off script), wire it to your signals
 * yourself and call `runShutdown()` after draining.
 */

const callbacks: Array<() => void | Promise<void>> = []

/**
 * Register a function to run during graceful shutdown.
 *
 * Callbacks run in registration order. Failures are logged but don't block
 * other callbacks. Not idempotent — registering the same function twice runs
 * it twice (so don't).
 */
export function onShutdown(fn: () => void | Promise<void>): void {
	callbacks.push(fn)
}

/**
 * Run all registered shutdown callbacks, in registration order. `serve()` calls
 * this from its signal handler after draining the HTTP server.
 */
export async function runShutdown(): Promise<void> {
	for (const fn of callbacks) {
		try {
			await fn()
		} catch (err) {
			console.error('Shutdown callback failed:', err)
		}
	}
}
