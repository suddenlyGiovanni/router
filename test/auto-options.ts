import { describe, it } from 'node:test'
import Router from '../src/router'
import type * as Types from '../src/types'
import { createServer, request } from './support/utils'

describe('OPTIONS', () => {
	it('should respond with defined routes', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.delete('/', saw)
		router.get('/users', saw)
		router.post('/users', saw)
		router.put('/users', saw)

		request(server)
			.options('/users')
			.expect('Allow', 'GET, HEAD, POST, PUT')
			.expect(200, 'GET, HEAD, POST, PUT', done)
	})

	it('should not contain methods multiple times', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.delete('/', saw)
		router.get('/users', saw)
		router.put('/users', saw)
		router.get('/users', saw)

		request(server)
			.options('/users')
			.expect('GET, HEAD, PUT')
			.expect('Allow', 'GET, HEAD, PUT', done)
	})

	it('should not include "all" routes', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.get('/', saw)
		router.get('/users', saw)
		router.put('/users', saw)
		router.all('/users', sethit(1))

		request(server)
			.options('/users')
			.expect('x-fn-1', 'hit')
			.expect('Allow', 'GET, HEAD, PUT')
			.expect(200, 'GET, HEAD, PUT', done)
	})

	it('should not respond if no matching path', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.get('/users', saw)

		request(server).options('/').expect(404, done)
	})

	it('should do nothing with explicit options route', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.get('/users', saw)
		router.options('/users', saw)

		request(server).options('/users').expect(200, 'saw OPTIONS /users', done)
	})

	describe('when error occurs in respone handler', () => {
		it('should pass error to callback', (done) => {
			const router = new Router()
			const server = createServer((_req, res, _next) => {
				res.writeHead(200)
				router(req, res, (err) => {
					res.end(String(Boolean(err)))
				})
			})

			router.get('/users', saw)

			request(server).options('/users').expect(200, 'true', done)
		})
	})
})

function saw({ method, url }: Types.RoutedRequest, res: Types.OutgoingMessage): void {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sethit(num: number): Types.RouteHandler {
	const name = `x-fn-${String(num)}`
	return (_req, res, next) => {
		res.setHeader(name, 'hit')
		next()
	}
}
