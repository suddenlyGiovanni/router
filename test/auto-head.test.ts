import { describe, it } from 'node:test'

import Router from '../src/router'
import type * as Types from '../src/types'
import * as Utils from './support'

describe('HEAD', () => {
	it('should invoke get without head', (_, done) => {
		const router = new Router()
		const server = Utils.createServer(router)

		router.get('/users', sethit(1), saw)

		Utils.request(server)
			.head('/users')
			.expect('Content-Type', 'text/plain')
			.expect('x-fn-1', 'hit')
			.expect(200, done)
	})

	it('should invoke head if prior to get', (_, done) => {
		const router = new Router()
		const server = Utils.createServer(router)

		router.head('/users', sethit(1), saw)
		router.get('/users', sethit(2), saw)

		Utils.request(server)
			.head('/users')
			.expect('Content-Type', 'text/plain')
			.expect('x-fn-1', 'hit')
			.expect(200, done)
	})
})

function saw({ method, url }: Types.IncomingRequest, res: Types.ServerResponse): void {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sethit(num: number): Types.RequestHandler {
	const name = `x-fn-${String(num)}`
	return (_req, res, next) => {
		res.setHeader(name, 'hit')
		next()
	}
}