export function after<T>(count: 0, callback: () => void): void
export function after<T, Cb extends () => void>(
	count: number,
	callback: () => void,
): Cb & { readonly count: number }
export function after<T, Cb extends (err: null | Error, data: undefined | T) => void>(
	count: number,
	callback: Cb,
): Cb & { readonly count: number }
export function after<
	T,
	Cb extends (err: null | Error, data: undefined | T) => void,
	CbError extends (err: null | Error, data: undefined | T) => void,
>(count: number, callback: Cb, errorCallback: CbError): Cb & { readonly count: number }
export function after<T>(
	count: number,
	callback: (...args: unknown[]) => void,
	errorCallback: (...args: unknown[]) => void = () => {},
) {
	let bail = false
	let fn = callback
	proxy.count = count

	function proxy(err: null | Error, data: undefined | T): void {
		if (proxy.count <= 0) {
			throw new Error('after called too many times')
		}
		--proxy.count

		// after first error, rest are passed to errorCallback
		if (err) {
			bail = true
			fn(err)
			// future error callbacks will go to error handler
			fn = errorCallback
		} else if (proxy.count === 0 && !bail) {
			fn(null, data)
		}
	}

	return count === 0 ? fn() : proxy
}
