import pathToRegexp from 'path-to-regexp'

import type { Route } from './route'

import type * as Types from './types'

import _debug from 'debug'

const debug = _debug('router:layer')

/**
 * Expose `Layer`.
 */

export class Layer {
	public method?: undefined | Types.HttpMethods
	public route?: undefined | Route
	private readonly handle: Types.RouteHandler | Types.ErrorRequestHandler
	public readonly name: string = '<anonymous>'
	public params: undefined | Record<string, string> = undefined
	public path: undefined | Types.PathParams = undefined
	private regexp: RegExp & {
		keys?: string[]
		fast_star?: boolean
		fast_slash?: boolean
	}
	public keys: string[] = []

	constructor(
		path: Types.PathParams,
		options: {
			/**
			 * Set this to `false` to only match the prefix of the URL.
			 * @default {true} - if omitted
			 */
			end?: boolean
			/**
			 * Set this to `true` to make the trailing slash matter.
			 * @default {false} - if omitted
			 */
			strict?: boolean
			/**
			 * Set this to `true` to make routes case sensitive
			 * @default {false} - if omitted
			 */
			sensitive?: boolean
		},
		fn: Types.RouteHandler | Types.ErrorRequestHandler,
	) {
		debug('new %o', path)
		const opts = { end: true, sensitive: false, strict: false, ...options }

		this.handle = fn
		this.name = fn.name
		// this.params = undefined
		// this.path = undefined
		this.regexp = pathToRegexp(path as string, this.keys, opts)

		// set fast path flags
		this.regexp.fast_star = path === '*'
		this.regexp.fast_slash = path === '/' && opts.end === false
	}

	/**
	 * Handle the error for the layer.
	 * @api private
	 */
	handle_error(
		error: Error,
		req: Types.IncomingRequest,
		res: Types.OutgoingMessage,
		next: Types.NextFunction,
	): void {
		const fn = this.handle

		if (fn.length !== 4) {
			// not a standard error handler
			next(error)
			return
		}

		try {
			;(fn as Types.ErrorRequestHandler)(error, req, res, next)
		} catch (err) {
			next(err)
		}
	}

	/**
	 * Handle the request for the layer.
	 * @api private
	 */
	handle_request(
		req: Types.RoutedRequest,
		res: Types.OutgoingMessage,
		next: Types.NextFunction,
	): void {
		const fn = this.handle

		if (fn.length > 3) {
			// not a standard request handler
			next()
			return
		}

		try {
			;(fn as Types.RouteHandler)(req, res, next)
		} catch (err: unknown) {
			next(err)
		}
	}

	/**
	 * Check if this route matches `path`, if so populate `.params`.
	 * TODO: warn about the side-effects
	 *
	 * @api private
	 */
	match(path: string): boolean {
		let match: null | RegExpExecArray = null

		if (path != null) {
			// fast path non-ending match for / (any path matches)
			if (this.regexp.fast_slash) {
				this.params = {}
				this.path = ''
				return true
			}

			// fast path for * (everything matched in a param)
			if (this.regexp.fast_star) {
				this.params = { '0': this.decode_param(path) }
				this.path = path
				return true
			}

			// match the path
			match = this.regexp.exec(path)
		}

		if (!match) {
			this.params = undefined
			this.path = undefined
			return false
		}

		// store values
		this.params = {}
		this.path = match[0]

		// iterate matches
		let keys = this.keys
		let params = this.params

		for (let i = 1; i < match.length; i++) {
			let key = keys[i - 1]
			let prop = key.name
			let val = this.decode_param(match[i])

			if (val !== undefined || !Object.prototype.hasOwnProperty.call(params, prop)) {
				params[prop] = val
			}
		}

		return true
	}

	/**
	 * Decode param value.
	 *
	 * @param {string} val
	 * @return {string}
	 * @private
	 */
	private decode_param(val: string): string {
		if (typeof val !== 'string' || val.length === 0) {
			return val
		}

		try {
			return decodeURIComponent(val)
		} catch (err) {
			if (err instanceof URIError) {
				err.message = `Failed to decode param '${val}'`
				// @ts-expect-error
				err.status = 400
			}

			throw err
		}
	}
}
