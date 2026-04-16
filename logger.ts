type Level = 'debug' | 'info' | 'warn' | 'error'

const DIR = './logs'

let dirCreated = false
const buffer: string[] = []
let flushTimer: number | undefined
const FLUSH_INTERVAL = 1000
const FLUSH_SIZE = 50

async function ensureDir(): Promise<void> {
	if (dirCreated) return
	try {
		await Deno.mkdir(DIR, { recursive: true })
	} catch { /* already exists */ }
	dirCreated = true
}

function dateStamp(): string {
	return new Date().toISOString().split('T')[0].replace(/-/g, '')
}

async function flushBuffer(): Promise<void> {
	if (buffer.length === 0) return

	const entries = buffer.splice(0)
	await ensureDir()

	// Group by level+date
	const groups = new Map<string, string[]>()
	for (const entry of entries) {
		// entries are stored as "level\tcontent"
		const tab = entry.indexOf('\t')
		const level = entry.slice(0, tab)
		const content = entry.slice(tab + 1)
		const filename = `${level}_${dateStamp()}.log`
		const list = groups.get(filename) ?? []
		list.push(content)
		groups.set(filename, list)
	}

	for (const [filename, lines] of groups) {
		try {
			await Deno.writeTextFile(
				`${DIR}/${filename}`,
				lines.join('\n') + '\n',
				{ append: true }
			)
		} catch (err) {
			console.error('Failed to write log file:', err)
		}
	}
}

function scheduleFlush(): void {
	if (flushTimer !== undefined) return
	flushTimer = setTimeout(async () => {
		flushTimer = undefined
		await flushBuffer()
	}, FLUSH_INTERVAL) as unknown as number
}

function enqueue(level: Level, content: string): void {
	if (level === 'error' || level === 'warn') {
		console.error(content)
	} else {
		console.log(content)
	}

	buffer.push(`${level}\t${content}`)

	if (buffer.length >= FLUSH_SIZE) {
		flushBuffer()
	} else {
		scheduleFlush()
	}
}

export const Log = {
	debug: (content: string): void => enqueue('debug', content),
	info: (content: string): void => enqueue('info', content),
	warn: (content: string): void => enqueue('warn', content),
	error: (content: string): void => enqueue('error', content),
	flush: (): Promise<void> => flushBuffer(),
}