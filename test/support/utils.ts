import { AssertionError } from 'node:assert'
import assert from 'node:assert/strict'
import * as http from 'node:http'
import finalhandler from 'finalhandler'
import { Buffer } from 'safe-buffer'
export { request } from 'supertest'
import { methods } from '../../src/methods'

export function createHitHandle(num: number) {
	const name = `x-fn-${String(num)}`
	return function hit(req, res, next) {
		res.setHeader(name, 'hit')
		next()
	}
}

export function createServer(router): http.Server {
	return http.createServer(function onRequest(req, res) {
		router(req, res, finalhandler(req, res))
	})
}

export function rawrequest(server: http.Server) {
	const _headers: http.IncomingHttpHeaders = {}
	let _method: undefined | string
	let _path: string | null | undefined
	const _test: Record<
		string,
		(
			method: string,
			path: string,
		) => {
			expect: (
				status: `${number}`,
				body: string,
				callback?: (err: Error | AssertionError | null) => void,
			) => unknown
		}
	> = {}

	for (const method of methods) {
		_test[method] = go.bind(null, method)
	}

	function expect(
		status: `${number}`,
		body: string,
		callback?: (err: null | Error | AssertionError) => void,
	) {
		if (!callback) {
			_headers[status.toLowerCase()] = body
			// FIXME: add type definition for what `this` should point to in this context...
			return this
		}

		let _server: InstanceType<typeof http.Server>

		if (!server.address()) {
			_server = server.listen(0, onListening)
			return
		}

		onListening.call(server)

		function onListening(this: http.Server): void {
			const addr = this.address()
			const port = addr === null ? null : typeof addr === 'object' ? addr.port : addr

			const req = http.request({
				host: '127.0.0.1',
				method: _method,
				path: _path,
				port: port,
			})
			req.on('response', (res) => {
				let buf = ''

				res.setEncoding('utf8')
				res.on('data', (s) => {
					buf += s
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
	}

	function go(
		method: string,
		path: string,
	): {
		expect: (
			status: `${number}`,
			body: string,
			callback?: (err: Error | AssertionError | null) => void,
		) => unknown
	} {
		_method = method
		_path = path

		return {
			expect: expect,
		}
	}

	return _test
}

export function shouldHaveBody(buf: Buffer) {
	return (res): void => {
		const body = !Buffer.isBuffer(res.body)
			? Buffer.from(res.text) //
			: res.body
		assert.ok(body, 'response has body')
		assert.strictEqual(body.toString('hex'), buf.toString('hex'))
	}
}

export function shouldHitHandle(num: number) {
	const header = `x-fn-${String(num)}`
	return (res) => {
		assert.equal(res.headers[header], 'hit', `should hit handle ${num}`)
	}
}

export function shouldNotHaveBody() {
	return (res) => {
		assert.ok(res.text === '' || res.text === undefined)
	}
}

export function shouldNotHitHandle(num: number) {
	return shouldNotHaveHeader(`x-fn-${String(num)}`)
}

function shouldNotHaveHeader(header: string) {
	return (res) => {
		assert.ok(!(header.toLowerCase() in res.headers), `should not have header ${header}`)
	}
}

export { assert }
