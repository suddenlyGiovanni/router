import { describe, it } from 'node:test'
import Router from '../src/router'
import { createServer, request } from './support/utils'

describe('req.params', () => {
	it('should default to empty object', (done) => {
		const router = new Router()
		const server = createServer(router)

		router.get('/', sawParams)

		request(server).get('/').expect(200, '{}', done)
	})

	it('should not exist outside the router', (done) => {
		const router = new Router()
		const server = createServer((req, res, next) => {
			router(req, res, function (err) {
				if (err) return next(err)
				sawParams(req, res)
			})
		})

		router.get('/', hitParams(1))

		request(server).get('/').expect('x-params-1', '{}').expect(200, '', done)
	})

	it('should overwrite value outside the router', (done) => {
		const router = new Router()
		const server = createServer((req, res, next) => {
			req.params = { foo: 'bar' }
			router(req, res, done)
		})

		router.get('/', sawParams)

		request(server).get('/').expect(200, '{}', done)
	})

	it('should restore previous value outside the router', (done) => {
		const router = new Router()
		const server = createServer((req, res, next) => {
			req.params = { foo: 'bar' }

			router(req, res, (err) => {
				if (err) {
					return next(err)
				}
				sawParams(req, res)
			})
		})

		router.get('/', hitParams(1))

		request(server).get('/').expect('x-params-1', '{}').expect(200, '{"foo":"bar"}', done)
	})

	describe('when "mergeParams: true"', () => {
		it('should merge outside object with params', (done) => {
			const router = new Router({ mergeParams: true })
			const server = createServer((req, res, next) => {
				req.params = { foo: 'bar' }

				router(req, res, (err) => {
					if (err) {
						return next(err)
					}
					sawParams(req, res)
				})
			})

			router.get('/:fizz', hitParams(1))

			request(server)
				.get('/buzz')
				.expect('x-params-1', '{"foo":"bar","fizz":"buzz"}')
				.expect(200, '{"foo":"bar"}', done)
		})

		it('should ignore non-object outside object', (done) => {
			const router = new Router({ mergeParams: true })
			const server = createServer((req, res, next) => {
				req.params = 42

				router(req, res, (err) => {
					if (err) {
						return next(err)
					}
					sawParams(req, res)
				})
			})

			router.get('/:fizz', hitParams(1))

			request(server).get('/buzz').expect('x-params-1', '{"fizz":"buzz"}').expect(200, '42', done)
		})

		it('should overwrite outside keys that are the same', (done) => {
			const router = new Router({ mergeParams: true })
			const server = createServer((req, res, next) => {
				req.params = { foo: 'bar' }

				router(req, res, (err) => {
					if (err) {
						return next(err)
					}
					sawParams(req, res)
				})
			})

			router.get('/:foo', hitParams(1))

			request(server)
				.get('/buzz')
				.expect('x-params-1', '{"foo":"buzz"}')
				.expect(200, '{"foo":"bar"}', done)
		})

		describe('with numeric properties in req.params', () => {
			it('should merge numeric properties by offsetting', (done) => {
				const router = new Router({ mergeParams: true })
				const server = createServer((req, res, next) => {
					req.params = { '0': 'foo', '1': 'bar' }

					router(req, res, (err) => {
						if (err) {
							return next(err)
						}
						sawParams(req, res)
					})
				})

				router.get('/*', hitParams(1))

				request(server)
					.get('/buzz')
					.expect('x-params-1', '{"0":"foo","1":"bar","2":"buzz"}')
					.expect(200, '{"0":"foo","1":"bar"}', done)
			})

			it('should merge with same numeric properties', (done) => {
				const router = new Router({ mergeParams: true })
				const server = createServer((req, res, next) => {
					req.params = { '0': 'foo' }

					router(req, res, (err) => {
						if (err) {
							return next(err)
						}
						sawParams(req, res)
					})
				})

				router.get('/*', hitParams(1))

				request(server)
					.get('/bar')
					.expect('x-params-1', '{"0":"foo","1":"bar"}')
					.expect(200, '{"0":"foo"}', done)
			})
		})
	})
})

function hitParams(num: number) {
	const name = `x-params-${String(num)}`
	return function hit({ params }, res, next): void {
		res.setHeader(name, JSON.stringify(params))
		next()
	}
}

function sawParams({ params }, res): void {
	res.statusCode = 200
	res.setHeader('Content-Type', 'application/json')
	res.end(JSON.stringify(params))
}
