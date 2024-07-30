import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import finalhandler from 'finalhandler'
import { Buffer } from 'safe-buffer'
export { default as request } from 'supertest'

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
		router.handle(req, res, finalhandler(req, res))
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

export function shouldHaveBody(buf: Buffer) {
	return (res: Types.Response): void => {
		const body = !Buffer.isBuffer(res.body)
			? Buffer.from(res.text) //
			: res.body
		assert.ok(body, 'response has body')
		assert.strictEqual(body.toString('hex'), buf.toString('hex'))
	}
}

export function shouldHitHandle(num: number): (res: Types.Response) => void {
	const header = `x-fn-${String(num)}`
	return (res) => {
		assert.equal(res.headers[header], 'hit', `should hit handle ${num}`)
	}
}

export function shouldNotHaveBody(): (res: Types.Response) => void {
	return (res) => {
		assert.ok(res.text === '' || res.text === undefined)
	}
}

export function shouldNotHitHandle(num: number): (res: Types.Response) => void {
	return shouldNotHaveHeader(`x-fn-${String(num)}`)
}

function shouldNotHaveHeader(header: string): (res: Types.Response) => void {
	return (res) => {
		assert.ok(!(header.toLowerCase() in res.headers), `should not have header ${header}`)
	}
}
