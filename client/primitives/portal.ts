export function createPortal(
	content: HTMLElement,
	target: HTMLElement = document.body,
): { element: HTMLElement; remove: () => void } {
	target.appendChild(content)
	return {
		element: content,
		remove: () => {
			if (content.parentNode === target) {
				target.removeChild(content)
			}
		},
	}
}