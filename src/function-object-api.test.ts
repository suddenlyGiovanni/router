import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { R } from 'tsx/dist/types-Cxp8y2TL'

import type * as Types from './types'

describe('api', () => {
	interface RouteHandler {
		(req: Types.RoutedRequest, res: Types.Response, next: Types.NextFunction): void
	}
	interface RouterMatcher<T> {
		(path: string, handlers: RouteHandler): T
	}

	interface RequestHandler {
		(req: Types.IncomingRequest, res: Types.Response, next: Types.NextFunction): void
	}

	interface RouterInstance extends Record<'get', RouterMatcher<RouterInstance>> {
		handle: RequestHandler
	}

	interface RouterConstructor {
		new (): RouterInstance & RequestHandler
		(): RouterInstance & RequestHandler
	}

	describe('functionObject', () => {
		interface FunctionObject extends Function {
			someProperty: string
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			[key: string]: any
		}

		const functionObject: FunctionObject = () => {
			return 'I am a function'
		}

		functionObject.someProperty = 'I am a property'

		it('should be callable as a function', () => {
			const result = functionObject()
			assert(result, 'I am a function')
		})

		it('should have properties like an object', () => {
			assert(functionObject.someProperty, 'I am a property')
		})

		it('should allow adding new properties', () => {
			functionObject['newProperty'] = 'New Property'
			assert(functionObject['newProperty'], 'New Property')
		})
	})

	describe('implemented with prototype syntax', () => {
		function Router() {
			if (!(this instanceof Router)) {
				return new Router()
			}

			function router(req, res, next) {
				router.handle(req, res, next)
			}

			// inherit from the correct prototype
			Object.setPrototypeOf(router, this)

			return router
		}

		Router.prototype = function () {}

		Router.prototype.handle = function handle(req, res, next) {
			// TODO: sniff test call?
		}

		it('should return a function', () => {
			assert.equal(typeof Router(), 'function')
		})

		it('should return a function using new', () => {
			assert.equal(typeof new Router(), 'function')
		})

		it('should invoke callback ', (_, done) => {
			const router = Router()
			router({}, {}, done)
		})
	})

	describe('implemented with class syntax', () => {
		class _Router implements RouterInstance {
			constructor() {}

			get: RouterMatcher<RouterInstance> = (_path, _handler) => {
				return this
			}

			handle: RequestHandler = (_req, _res, next) => {
				console.log('Handling request', _req, _res)
				next()
			}
		}

		// Factory function to create a new Router instance
		function Router(): RouterInstance & RequestHandler {
			const router = new _Router()

			// Make the router callable as a function
			const handler: RequestHandler = (req, res, next) => router.handle(req, res, next)

			// Copy all properties and methods from Router to the handler function
			Object.setPrototypeOf(handler, _Router.prototype)
			Object.assign(handler, router)

			return handler as Types.Router & Types.RequestHandler
		}

		it('should return a function', () => {
			assert(typeof Router(), 'function')
		})

		it('should return a function using new', () => {
			assert(typeof new Router(), 'function')
		})

		it('should invoke callback', (_, done) => {
			const router = Router()
			router({}, {}, () => {
				done()
			})
		})

		it('should handle routing logic', ({ mock }) => {
			const router = Router()
			const req = { url: '/test' } as Types.IncomingRequest
			const res = {
				status: mock.fn(),
				send: mock.fn(),
			} as unknown as Types.Response
			const next = mock.fn()

			router(req, res, next)

			// Add assertions based on your expected routing behavior
			// For example:
			assert.equal(next.mock.callCount(), 1)
			// or if you implement actual routing:
			// expect(res.status).toHaveBeenCalledWith(200);
			// expect(res.send).toHaveBeenCalledWith('Test route');
		})

		it('should be callable as a function', () => {
			const router = Router()
			assert.equal(typeof router, 'function')
			assert(router instanceof Router)
		})

		it('should be instantiable using new', () => {
			const router = new Router()
			assert.equal(typeof router, 'function')
			assert(router instanceof Router)
		})

		it('should have access to Router methods and be callable', () => {
			const r1 = Router()
			assert.equal(typeof r1.get, 'function')
			assert.equal(typeof r1, 'function')

			const r2 = new Router()
			assert.equal(typeof r2.get, 'function')
			assert.equal(typeof r2, 'function')
		})
	})

	describe('with Class and Proxy', () => {
		class R implements RouterInstance {
			get: RouterMatcher<RouterInstance>
			handle: RequestHandler
		}

		const Router = new Proxy(R, {
			apply(target, thisArg, argArray) {
				// if Router is called as a function without new, return a new instance
				if (thisArg === undefined) {
					return new target()
				}
			},
		})
	})
})
