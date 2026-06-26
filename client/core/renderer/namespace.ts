export const NS = {
	HTML: 'http://www.w3.org/1999/xhtml',
	SVG: 'http://www.w3.org/2000/svg',
	MATHML: 'http://www.w3.org/1998/Math/MathML',
} as const

export type Namespace = typeof NS[keyof typeof NS]

/**
 * Given the current namespace and an element tag, determine the
 * namespace the new element should be created in.
 *
 * - Entering `<svg>` switches to SVG namespace
 * - Entering `<math>` switches to MathML
 * - Entering `<foreignObject>` while in SVG returns to HTML (the
 *   standard escape hatch for embedding HTML inside SVG)
 * - Everything else inherits the current namespace
 */
export function nextNamespace(tag: string, current: Namespace): Namespace {
	if (tag === 'svg') return NS.SVG
	if (tag === 'math') return NS.MATHML
	if (tag === 'foreignObject' && current === NS.SVG) return NS.HTML
	return current
}

/**
 * Create a DOM element in the given namespace. HTML uses the simpler
 * `createElement`; SVG and MathML need `createElementNS` with the
 * exact URI to render correctly.
 */
export function createElementInNS(tag: string, ns: Namespace): Element {
	return ns === NS.HTML
		? document.createElement(tag)
		: document.createElementNS(ns, tag)
}