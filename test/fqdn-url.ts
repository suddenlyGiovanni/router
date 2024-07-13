import { describe, it } from 'node:test'
import Router from '../src/router'
import type * as Types from '../src/types'
import { createServer, rawrequest } from './support/utils'

describe('FQDN url', () => {
	it('should not obscure FQDNs', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.use(saw)

		rawrequest(server)
			.get('http://example.com/foo')
			.expect('200', 'saw GET http://example.com/foo', done)
	})

	it('should strip/restore FQDN req.url', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.use('/blog', setsaw(1))
		router.use(saw)

		rawrequest(server)
			.get('http://example.com/blog/post/1')
			.expect('x-saw-1', 'GET http://example.com/post/1')
			.expect('200', 'saw GET http://example.com/blog/post/1', done)
	})

	it('should ignore FQDN in search', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.use('/proxy', setsaw(1))
		router.use(saw)

		rawrequest(server)
			.get('/proxy?url=http://example.com/blog/post/1')
			.expect('x-saw-1', 'GET /?url=http://example.com/blog/post/1')
			.expect('200', 'saw GET /proxy?url=http://example.com/blog/post/1', done)
	})

	it('should ignore FQDN in path', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.use('/proxy', setsaw(1))
		router.use(saw)

		rawrequest(server)
			.get('/proxy/http://example.com/blog/post/1')
			.expect('x-saw-1', 'GET /http://example.com/blog/post/1')
			.expect('200', 'saw GET /proxy/http://example.com/blog/post/1', done)
	})
})

function setsaw(num: number): Types.RouteHandler {
	const name = `x-saw-${String(num)}`
	return function hit({ method, url }, res, next) {
		res.setHeader(name, `${method} ${url}`)
		next()
	}
}

function saw({ method, url }: Types.RoutedRequest, res: Types.OutgoingMessage) {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}
