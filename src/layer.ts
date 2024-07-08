import pathtoRegexp from 'path-to-regexp'
import { Route } from './route'

import type * as Types from './types'

import _debug from 'debug'

const debug = _debug('router:layer')

/**
 * Module variables.
 * @private
 */

const hasOwnProperty = Object.prototype.hasOwnProperty

/**
 * Expose `Layer`.
 */

export class Layer {
	public method?: undefined | Types.HttpMethods
	public route?: Route

	private handle: {
		(error: Error, req: Request, res: Response, next: Function): void
		(req: Request, res: Response, next: Function): void
	}
	private name: string = '<anonymous>'
	private params: undefined | {} = undefined
	private path: undefined | Types.PathParams = undefined
	private regexp: RegExp & {
		keys: string[]
		fast_star: boolean
		fast_slash: boolean
	}
	private keys: unknown[] = []

	constructor(
		path: Types.PathParams,
		options: {
			end?: undefined | boolean
			strict?: undefined | boolean
			sensitive?: undefined | boolean
		},
		fn: {
			(error: Error, req: Request, res: Response, next: Function): void
			(req: Request, res: Response, next: Function): void
		},
	) {
		debug('new %o', path)
		let opts = options || {}

		this.handle = fn
		this.name = fn.name
		// this.params = undefined
		// this.path = undefined
		this.regexp = pathtoRegexp(path, (this.keys = []), opts)

		// set fast path flags
		this.regexp.fast_star = path === '*'
		this.regexp.fast_slash = path === '/' && opts.end === false
	}

	/**
	 * Handle the error for the layer.
	 *
	 * @param {Error} error
	 * @param {Request} req
	 * @param {Response} res
	 * @param {function} next
	 * @api private
	 */
	handle_error(error: Error, req: Request, res: Response, next: Function): void {
		let fn = this.handle

		if (fn.length !== 4) {
			// not a standard error handler
			return next(error)
		}

		try {
			fn(error, req, res, next)
		} catch (err) {
			next(err)
		}
	}

	/**
	 * Handle the request for the layer.
	 *
	 * @param {Request} req
	 * @param {Response} res
	 * @param {function} next
	 * @api private
	 */
	handle_request(req: Request, res: Response, next: Function): void {
		let fn = this.handle

		if (fn.length > 3) {
			// not a standard request handler
			return next()
		}

		try {
			fn(req, res, next)
		} catch (err) {
			next(err)
		}
	}

	/**
	 * Check if this route matches `path`, if so
	 * populate `.params`.
	 *
	 * @param {String} path
	 * @return {Boolean}
	 * @api private
	 */
	match(path: string): boolean {
		let match: undefined | null | RegExpExecArray = undefined

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

			if (val !== undefined || !hasOwnProperty.call(params, prop)) {
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
				err.message = "Failed to decode param '" + val + "'"
				err.status = 400
			}

			throw err
		}
	}
}
