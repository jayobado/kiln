type Level = 'debug' | 'info' | 'warn' | 'error'

const DIR = './logs'

async function mkdir(): Promise<void> {
	try {
		await Deno.mkdir(DIR, { recursive: true })
	} catch {
		// already exists
	}
}

async function write(filename: string, content: string): Promise<void> {
	try {
		await Deno.writeTextFile(
			`${DIR}/${filename}`,
			content + '\n',
			{ append: true }
		)
	} catch (err) {
		console.error('Failed to write log file:', err)
	}
}

async function generate(level: Level, content: string): Promise<void> {
	if (level === 'error' || level === 'warn') {
		console.error(content)
	} else {
		console.log(content)
	}

	const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
	const filename = `${level}_${date}.log`

	await mkdir()
	await write(filename, content)
}

export const Log = {
	debug: (content: string): Promise<void> => generate('debug', content),
	info: (content: string): Promise<void> => generate('info', content),
	warn: (content: string): Promise<void> => generate('warn', content),
	error: (content: string): Promise<void> => generate('error', content),
}