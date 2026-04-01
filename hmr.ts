import { Log } from './logger.ts'
import type { HmrMessage } from './types.ts'

// ─── Connected clients ────────────────────────────────────────────────────────

const clients = new Set<WebSocket>()

// ─── Broadcast ────────────────────────────────────────────────────────────────

export function broadcast(msg: HmrMessage): void {
	const data = JSON.stringify(msg)
	for (const ws of clients) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(data)
		}
	}
}

// ─── WebSocket upgrade handler ────────────────────────────────────────────────

export function hmrHandler(req: Request): Response {
	if (req.headers.get('upgrade') !== 'websocket') {
		return new Response('Expected WebSocket upgrade', { status: 426 })
	}

	const { socket, response } = Deno.upgradeWebSocket(req)

	socket.onopen = () => {
		clients.add(socket)
		Log.debug(`[hmr] client connected (${clients.size} total)`)
	}

	socket.onclose = () => {
		clients.delete(socket)
		Log.debug(`[hmr] client disconnected (${clients.size} total)`)
	}

	socket.onerror = () => {
		clients.delete(socket)
	}

	return response
}

// ─── File watcher ─────────────────────────────────────────────────────────────

export async function watchFs(
	fsRoot: string,
	invalidateCache: (path: string) => void
): Promise<void> {
	const watcher = Deno.watchFs(fsRoot, { recursive: true })

	await Log.info('[hmr] watching for file changes...')

	for await (const event of watcher) {
		if (event.kind !== 'modify' && event.kind !== 'create') continue

		for (const path of event.paths) {
			const rel = path.replace(fsRoot, '') || path

			if (path.endsWith('.css')) {
				await Log.debug(`[hmr] css change: ${rel}`)
				broadcast({ type: 'css-reload', path: rel })

			} else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
				await Log.debug(`[hmr] ts change: ${rel}`)
				invalidateCache(path)
				broadcast({ type: 'invalidate', path: rel })

			} else if (path.endsWith('.html')) {
				await Log.debug(`[hmr] html change: ${rel}`)
				broadcast({ type: 'reload', path: rel })

			} else {
				await Log.debug(`[hmr] asset change: ${rel}`)
				broadcast({ type: 'reload', path: rel })
			}
		}
	}
}

// ─── Client script ────────────────────────────────────────────────────────────

export const hmrClientScript = `
<script type="module">
(function () {
  const url = new URL('/__hmr', location.href)
  url.protocol = url.protocol.replace('http', 'ws')

  let ws
  let reconnectTimer

  function connect() {
    ws = new WebSocket(url.href)

    ws.onopen = () => {
      console.debug('[hmr] connected')
      clearTimeout(reconnectTimer)
    }

    ws.onclose = () => {
      console.debug('[hmr] disconnected — reconnecting in 1s...')
      reconnectTimer = setTimeout(connect, 1000)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'reload') {
        console.debug('[hmr] reloading:', msg.path)
        location.reload()
        return
      }

      if (msg.type === 'css-reload') {
        console.debug('[hmr] css reload:', msg.path)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          const url = new URL(link.href)
          url.searchParams.set('_hmr', Date.now())
          link.href = url.toString()
        })
        return
      }

      if (msg.type === 'invalidate') {
        console.debug('[hmr] invalidated:', msg.path)
        location.reload()
        return
      }
    }
  }

  connect()
})()
</script>
`