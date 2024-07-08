import _debug from "debug";
import { flatten } from "array-flatten";
import methods from "methods";

import { Layer } from "./layer";
import type * as Types from "./types";

const debug = _debug("router:route");
/**
 * Module variables.
 * @private
 */

const slice = Array.prototype.slice;

/* istanbul ignore next */
const defer = typeof setImmediate === "function"
  ? setImmediate
  : function (fn): void {
    process.nextTick(fn.bind.apply(fn, arguments));
  };

/**
 * Expose `Route`.
 */
export class Route {
  private path: string;
  private stack: Layer[] = [];

  // route handlers for various http methods
  private methods: Record<string, any> = Object.create(null);
  /**
   * Initialize `Route` with the given `path`,
   *
   * @param {String} path
   * @api private
   */
  constructor(path: string) {
    debug("new %o", path);
    this.path = path;
  }

  private _handles_method(method: string): boolean {
    if (this.methods._all) {
      return true;
    }

    // normalize name
    let name = typeof method === "string" ? method.toLowerCase() : method;

    if (name === "head" && !this.methods["head"]) {
      name = "get";
    }

    return Boolean(this.methods[name]);
  }

  private _methods(): string[] {
    let methods = Object.keys(this.methods);

    // append automatic head
    if (this.methods.get && !this.methods.head) {
      methods.push("head");
    }

    for (let i = 0; i < methods.length; i++) {
      // make upper case
      methods[i] = methods[i].toUpperCase();
    }

    return methods;
  }

  /**
   * dispatch req, res into this route
   *
   * @private
   */
  dispatch(req: Request, res: Response, done: Function) {
    let idx = 0;
    let stack = this.stack;
    let sync = 0;

    if (stack.length === 0) {
      return done();
    }

    var method = typeof req.method === "string"
      ? req.method.toLowerCase()
      : req.method;

    if (method === "head" && !this.methods["head"]) {
      method = "get";
    }

    req.route = this;

    next();

    function next(err?: any): void {
      // signal to exit route
      if (err && err === "route") {
        return done();
      }

      // signal to exit router
      if (err && err === "router") {
        return done(err);
      }

      // no more matching layers
      if (idx >= stack.length) {
        return done(err);
      }

      // max sync stack
      if (++sync > 100) {
        return defer(next, err);
      }

      var layer;
      var match;

      // find next matching layer
      while (match !== true && idx < stack.length) {
        layer = stack[idx++];
        match = !layer.method || layer.method === method;
      }

      // no match
      if (match !== true) {
        return done(err);
      }

      if (err) {
        layer.handle_error(err, req, res, next);
      } else {
        layer.handle_request(req, res, next);
      }

      sync = 0;
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
  public all(handler: Types.RouteHandler[] | Types.RequestHandler[] ): Route {
    let callbacks = flatten(slice.call(arguments));

    if (callbacks.length === 0) {
      throw new TypeError("argument handler is required");
    }

    for (var i = 0; i < callbacks.length; i++) {
      var fn = callbacks[i];

      if (typeof fn !== "function") {
        throw new TypeError("argument handler must be a function");
      }

      let layer = new Layer("/", {}, fn);
      layer.method = undefined;

      this.methods._all = true;
      this.stack.push(layer);
    }

    return this;
  }
}

/**
 * @private
 */

Route.prototype._handles_method = function _handles_method(method) {
  if (this.methods._all) {
    return true;
  }

  // normalize name
  var name = typeof method === "string" ? method.toLowerCase() : method;

  if (name === "head" && !this.methods["head"]) {
    name = "get";
  }

  return Boolean(this.methods[name]);
};

/**
 * @return {array} supported HTTP methods
 * @private
 */

Route.prototype._methods = function _methods() {
  var methods = Object.keys(this.methods);

  // append automatic head
  if (this.methods.get && !this.methods.head) {
    methods.push("head");
  }

  for (var i = 0; i < methods.length; i++) {
    // make upper case
    methods[i] = methods[i].toUpperCase();
  }

  return methods;
};

/**
 * dispatch req, res into this route
 *
 * @private
 */

Route.prototype.dispatch = function dispatch(req, res, done) {
  var idx = 0;
  var stack = this.stack;
  var sync = 0;

  if (stack.length === 0) {
    return done();
  }

  var method = typeof req.method === "string"
    ? req.method.toLowerCase()
    : req.method;

  if (method === "head" && !this.methods["head"]) {
    method = "get";
  }

  req.route = this;

  next();

  function next(err) {
    // signal to exit route
    if (err && err === "route") {
      return done();
    }

    // signal to exit router
    if (err && err === "router") {
      return done(err);
    }

    // no more matching layers
    if (idx >= stack.length) {
      return done(err);
    }

    // max sync stack
    if (++sync > 100) {
      return defer(next, err);
    }

    var layer;
    var match;

    // find next matching layer
    while (match !== true && idx < stack.length) {
      layer = stack[idx++];
      match = !layer.method || layer.method === method;
    }

    // no match
    if (match !== true) {
      return done(err);
    }

    if (err) {
      layer.handle_error(err, req, res, next);
    } else {
      layer.handle_request(req, res, next);
    }

    sync = 0;
  }
};

/**
 * Add a handler for all HTTP verbs to this route.
 *
 * Behaves just like middleware and can respond or call `next`
 * to continue processing.
 *
 * You can use multiple `.all` call to add multiple handlers.
 *
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
 *
 * @param {array|function} handler
 * @return {Route} for chaining
 * @api public
 */

Route.prototype.all = function all(handler) {
  var callbacks = flatten(slice.call(arguments));

  if (callbacks.length === 0) {
    throw new TypeError("argument handler is required");
  }

  for (var i = 0; i < callbacks.length; i++) {
    var fn = callbacks[i];

    if (typeof fn !== "function") {
      throw new TypeError("argument handler must be a function");
    }

    var layer = Layer("/", {}, fn);
    layer.method = undefined;

    this.methods._all = true;
    this.stack.push(layer);
  }

  return this;
};

methods.forEach(function (method: string) {
  Route.prototype[method] = function (handler) {
    var callbacks = flatten(slice.call(arguments));

    if (callbacks.length === 0) {
      throw new TypeError("argument handler is required");
    }

    for (var i = 0; i < callbacks.length; i++) {
      var fn = callbacks[i];

      if (typeof fn !== "function") {
        throw new TypeError("argument handler must be a function");
      }

      debug("%s %s", method, this.path);

      var layer = Layer("/", {}, fn);
      layer.method = method;

      this.methods[method] = true;
      this.stack.push(layer);
    }

    return this;
  };
});
