// The lolo client. It imports only the *type* of the server router, then calls
// procedures with full end-to-end type safety over RPC.

import { createApp, defineContainer, h, signal } from '@jayobado/kiln/client'
import { createClient, fieldErrors } from '@jayobado/kiln/client/rpc'
import type { AppRouter } from '../router.ts'

const rpc = createClient<AppRouter>({
	url: '/rpc',
	onFlash: (f) => console.log('flash:', f),
})

const home = defineContainer({
	route: { path: '/', title: 'kiln example' },

	setup() {
		const greeting = signal('—')
		const who = signal<string | null>(null)
		const error = signal<Record<string, string>>({})

		async function sayHi() {
			const { message } = await rpc.greet({ name: 'world' })
			greeting.set(message)
		}

		async function login() {
			await fetch('/login', { method: 'POST' })
			const me = await rpc.me() // typed; 401 until logged in
			who.set(me.name)
		}

		async function addNote(text: string) {
			try {
				await rpc.notes.create({ text })
				error.set({})
			} catch (e) {
				error.set(fieldErrors(e)) // 422 issues -> { field: message }
			}
		}

		return { greeting, who, sayHi, login, addNote }
	},

	content: ({ greeting, who, sayHi, login }) => {
		const root = h('div', { class: 'page' })
		root.append(h('h1', null, 'kiln full-stack example'))
		root.append(h('button', { onclick: () => sayHi() }, 'Greet'))
		root.append(h('p', null, greeting.get()))
		root.append(h('button', { onclick: () => login() }, 'Log in + load me'))
		root.append(h('p', null, who.get() ? `Signed in as ${who.get()}` : 'Not signed in'))
		return root
	},
})

createApp({ containers: [home], mountPoint: '#app' }).mount()
