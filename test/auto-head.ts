import { describe, it } from 'node:test'
import Router from '../src/router'
import { createServer, request } from './support/utils'

describe('HEAD', () => {
	it('should invoke get without head', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.get('/users', sethit(1), saw)

		request(server)
			.head('/users')
			.expect('Content-Type', 'text/plain')
			.expect('x-fn-1', 'hit')
			.expect(200, done)
	})

	it('should invoke head if prior to get', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.head('/users', sethit(1), saw)
		router.get('/users', sethit(2), saw)

		request(server)
			.head('/users')
			.expect('Content-Type', 'text/plain')
			.expect('x-fn-1', 'hit')
			.expect(200, done)
	})
})

function saw({ method, url }, res) {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sethit(num: number) {
	const name = `x-fn-${String(num)}`
	return function hit(_req, res, next) {
		res.setHeader(name, 'hit')
		next()
	}
}
