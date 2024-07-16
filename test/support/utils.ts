import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import finalhandler from 'finalhandler'
import { Buffer } from 'safe-buffer'
export * as request from 'supertest'
import { methods } from '../../src/methods'
import type Router from '../../src/router'
import type * as Types from '../../src/types'

export function createHitHandle(num: number): Types.RouteHandler {
	const name = `x-fn-${String(num)}`
	return function hit(_req, res, next) {
		res.setHeader(name, 'hit')
		next()
	}
}

export function createServer(router: Router): http.Server {
	return http.createServer(function onRequest(req, res) {
		router(req, res, finalhandler(req, res))
	})
}

interface Expected {
	expect: (
		status: string,
		body: string,
		callback?: (err: Error | AssertionError | null) => void,
	) => this
}
type Test = Record<Types.HttpMethods, (path: string) => Expected>

export function rawrequest(server: http.Server): Test {
	const _headers: http.IncomingHttpHeaders = {}
	let _method: undefined | string = undefined
	let _path: string | null | undefined = undefined
	const _test: Test = {}

	for (const method of methods) {
		_test[method] = go.bind(null, method)
	}

	function expect(
		this: Expected,
		status: string,
		body: string,
		callback?: (err: null | Error | AssertionError) => void,
	): Expected {
		function onListening(this: http.Server): void {
			const addr = this.address()
			const port =
				addr === null
					? null //
					: typeof addr === 'object' //
						? addr.port //
						: addr

			const req = http.request({
				host: '127.0.0.1',
				method: _method,
				path: _path,
				port: port,
			})

			req.on('response', (res) => {
				let buf: string = ''

				res.setEncoding('utf8')
				res.on('data', (chunk) => {
					assert(typeof chunk === 'string')
					buf += chunk
				})
				res.on('end', () => {
					let err: null | AssertionError | Error = null

					try {
						for (const key in _headers) {
							assert.equal(res.headers[key], _headers[key])
						}
						assert.equal(res.statusCode, status)
						assert.equal(buf, body)
					} catch (e: unknown) {
						if (!(e instanceof AssertionError) || !(e instanceof Error)) {
							err = new Error('test failed', { cause: e })
						}
						if (e instanceof AssertionError) {
							err = e
						}
						if (e instanceof Error) {
							err = e
						}
					}

					if (_server) {
						_server.close()
					}

					callback?.(err)
				})
			})
			req.end()
		}

		if (!callback) {
			_headers[status.toLowerCase()] = body
			// FIXME: add type definition for what `this` should point to in this context...
			return this
		}

		let _server: InstanceType<typeof http.Server>

		if (!server.address()) {
			_server = server.listen(0, onListening)
			return this
		}

		onListening.call(server)
		return this
	}

	function go(method: string, path: string): Expected {
		_method = method
		_path = path

		return { expect }
	}

	return _test
}

type Res = InstanceType<typeof http.ServerResponse> & {
	req: InstanceType<typeof http.IncomingMessage>
}
export function shouldHaveBody(buf: Buffer): (res: unknown) => void {
	return (res: Res): void => {
		const body = !Buffer.isBuffer(res.body)
			? Buffer.from(res.text) //
			: res.body
		assert.ok(body, 'response has body')
		assert.strictEqual(body.toString('hex'), buf.toString('hex'))
	}
}

export function shouldHitHandle(num: number): (res: Res) => void {
	const header = `x-fn-${String(num)}`
	return (res): void => {
		assert.equal(res.headers[header], 'hit', `should hit handle ${num}`)
	}
}

export function shouldNotHaveBody(): (res: Res) => void {
	return (res): void => {
		assert.ok(res.text === '' || res.text === undefined)
	}
}

export function shouldNotHitHandle(
	num: number,
): (res: InstanceType<typeof http.ServerResponse>) => void {
	return shouldNotHaveHeader(`x-fn-${String(num)}`)
}

function shouldNotHaveHeader(header: string): (res: Res) => void {
	return (res) => {
		assert.ok(!(header.toLowerCase() in res.headers), `should not have header ${header}`)
	}
}

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
	proxy.count = count

	function proxy(err: null | Error, data: undefined | T): void {
		if (proxy.count <= 0) {
			throw new Error('after called too many times')
		}
		--proxy.count

		// after first error, rest are passed to errorCallback
		if (err) {
			bail = true
			callback(err)
			// future error callbacks will go to error handler
			callback = errorCallback
		} else if (proxy.count === 0 && !bail) {
			callback(null, data)
		}
	}

	return count === 0
		? callback() //
		: proxy
}

export { assert }
