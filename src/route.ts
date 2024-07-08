import _debug from 'debug'
import { methods } from './methods'
import { flatten } from 'array-flatten'

import { Layer } from './layer'
import { RequestHandlerParams, RouteHandler } from './types'
import type * as Types from './types'

const debug = _debug('router:route')
/**
 * Module variables.
 * @private
 */

const slice = Array.prototype.slice

/**
 * Expose `Route`.
 */
export class Route {
	private path: Types.PathParams
	private stack: Layer[] = []

	// route handlers for various http methods
	private methods: Record<Types.HttpMethods, unknown> = Object.create(null)
	/**
	 * Initialize `Route` with the given `path`,
	 *
	 * @param {String} path
	 * @api private
	 */
	constructor(path: Types.PathParams) {
		debug('new %o', path)
		this.path = path
	}

	/**
	 * @private
	 */
	public _handles_method(method: undefined | string): boolean {
		if (this.methods._all) {
			return true
		}

		// normalize name
		let name = typeof method === 'string' ? method.toLowerCase() : method

		if (name === 'head' && !this.methods['head']) {
			name = 'get'
		}

		return Boolean(this.methods[name])
	}

	/**
	 * @return {array} supported HTTP methods
	 * @private
	 */
	public _methods(): Uppercase<Types.HttpMethods>[] {
		let methods = Object.keys(this.methods) as Types.HttpMethods[]

		// append automatic head
		if (this.methods.get && !this.methods.head) {
			methods.push('head')
		}

		return methods.map((method) => method.toUpperCase() as Uppercase<typeof method>)
	}

	/**
	 * dispatch req, res into this route
	 *
	 * @private
	 */
	dispatch(req: Request, res: Response, done: Function): void {
		let idx = 0
		let stack = this.stack
		let sync = 0

		if (stack.length === 0) {
			return done()
		}

		var method = typeof req.method === 'string' ? req.method.toLowerCase() : req.method

		if (method === 'head' && !this.methods['head']) {
			method = 'get'
		}

		req.route = this

		next()

		function next(err?: any): void {
			// signal to exit route
			if (err && err === 'route') {
				return done()
			}

			// signal to exit router
			if (err && err === 'router') {
				return done(err)
			}

			// no more matching layers
			if (idx >= stack.length) {
				return done(err)
			}

			// max sync stack
			if (++sync > 100) {
				return setImmediate(next, err)
			}

			var layer
			var match

			// find next matching layer
			while (match !== true && idx < stack.length) {
				layer = stack[idx++]
				match = !layer.method || layer.method === method
			}

			// no match
			if (match !== true) {
				return done(err)
			}

			if (err) {
				layer.handle_error(err, req, res, next)
			} else {
				layer.handle_request(req, res, next)
			}

			sync = 0
		}
	}

	/**
	 * Add a handler for all HTTP verbs to this route.
	 *
	 * @param {array|function} handler
	 * @return {Route} for chaining
	 *
	 * Behaves just like middleware and can respond or call `next`
	 * to continue processing.
	 *
	 * @example
	 * You can use multiple `.all` call to add multiple handlers.
	 * ```ts
	 *   function check_something(req, res, next){
	 *     next()
	 *   }
	 *
	 *   function validate_user(req, res, next){
	 *     next()
	 *   }
	 *
	 *   route
	 *   .all(validate_user)
	 *   .all(check_something)
	 *   .get(function(req, res, next){
	 *     res.send('hello world')
	 *   })
	 * ```
	 */
	public all(...handlers: Types.RouteHandler[]): Route
	public all(...handlers: Types.RequestHandlerParams[]): Route
	public all(...handlers: Types.RouteHandler[] | Types.RequestHandlerParams[]): Route {
		let callbacks = handlers.slice().flat()

		if (callbacks.length === 0) {
			throw new TypeError('argument handler is required')
		}

		for (let i = 0; i < callbacks.length; i++) {
			let fn = callbacks[i]

			if (typeof fn !== 'function') {
				throw new TypeError('argument handler must be a function')
			}

			let layer = new Layer('/', {}, fn)
			layer.method = undefined

			this.methods._all = true
			this.stack.push(layer)
		}

		return this
	}
}

methods.forEach(function (method) {
	Route.prototype[method] = function (handler) {
		var callbacks = flatten(slice.call(arguments))

		if (callbacks.length === 0) {
			throw new TypeError('argument handler is required')
		}

		for (var i = 0; i < callbacks.length; i++) {
			var fn = callbacks[i]

			if (typeof fn !== 'function') {
				throw new TypeError('argument handler must be a function')
			}

			debug('%s %s', method, this.path)

			var layer = Layer('/', {}, fn)
			layer.method = method

			this.methods[method] = true
			this.stack.push(layer)
		}

		return this
	}
})
