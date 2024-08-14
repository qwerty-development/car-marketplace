// utils/debounce.ts
export function debounce(func: Function, delay: number) {
	let timeoutId: number | undefined
	return (...args: any[]) => {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId)
		}
		timeoutId = setTimeout(() => func(...args), delay) as unknown as number
	}
}
