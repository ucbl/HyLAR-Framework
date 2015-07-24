(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (process){
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    "use strict";

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object" && typeof module === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else if (typeof self !== "undefined") {
        self.Q = definition();

    } else {
        throw new Error("This environment was not anticipated by Q. Please file a bug.");
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;
    // queue for late tasks, used by unhandled rejection tracking
    var laterQueue = [];

    function flush() {
        /* jshint loopfunc: true */
        var task, domain;

        while (head.next) {
            head = head.next;
            task = head.task;
            head.task = void 0;
            domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }
            runSingle(task, domain);

        }
        while (laterQueue.length) {
            task = laterQueue.pop();
            runSingle(task);
        }
        flushing = false;
    }
    // runs a single function in the async queue
    function runSingle(task, domain) {
        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function () {
                    throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process === "object" &&
        process.toString() === "[object process]" && process.nextTick) {
        // Ensure Q is in a real Node environment, with a `process.nextTick`.
        // To see through fake Node environments:
        // * Mocha test runner - exposes a `process` global without a `nextTick`
        // * Browserify - exposes a `process.nexTick` function that uses
        //   `setTimeout`. In this case `setImmediate` is preferred because
        //    it is faster. Browserify's `process.toString()` yields
        //   "[object Object]", while in a real Node environment
        //   `process.nextTick()` yields "[object process]".
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }
    // runs a task after all other tasks have been run
    // this is useful for unhandled rejection tracking that needs to happen
    // after all `then`d tasks have been run.
    nextTick.runAfter = function (task) {
        laterQueue.push(task);
        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };
    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof Promise) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

// enable long stacks if Q_DEBUG is set
if (typeof process === "object" && process && process.env && process.env.Q_DEBUG) {
    Q.longStackSupport = true;
}

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            Q.nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            Q.nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            Q.nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
Q.race = race;
function race(answerPs) {
    return promise(function (resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function (answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    Q.nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

Q.tap = function (promise, callback) {
    return Q(promise).tap(callback);
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
Promise.prototype.tap = function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var reportedUnhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }
    if (typeof process === "object" && typeof process.emit === "function") {
        Q.nextTick.runAfter(function () {
            if (array_indexOf(unhandledRejections, promise) !== -1) {
                process.emit("unhandledRejection", reason, promise);
                reportedUnhandledRejections.push(promise);
            }
        });
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        if (typeof process === "object" && typeof process.emit === "function") {
            Q.nextTick.runAfter(function () {
                var atReport = array_indexOf(reportedUnhandledRejections, promise);
                if (atReport !== -1) {
                    process.emit("rejectionHandled", unhandledReasons[at], promise);
                    reportedUnhandledRejections.splice(atReport, 1);
                }
            });
        }
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    Q.nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    Q.nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var pendingCount = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++pendingCount;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--pendingCount === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (pendingCount === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Returns the first resolved promise of an array. Prior rejected promises are
 * ignored.  Rejects only if all promises are rejected.
 * @param {Array*} an array containing values or promises for values
 * @returns a promise fulfilled with the value of the first resolved promise,
 * or a rejected promise if all promises are rejected.
 */
Q.any = any;

function any(promises) {
    if (promises.length === 0) {
        return Q.resolve();
    }

    var deferred = Q.defer();
    var pendingCount = 0;
    array_reduce(promises, function (prev, current, index) {
        var promise = promises[index];

        pendingCount++;

        when(promise, onFulfilled, onRejected, onProgress);
        function onFulfilled(result) {
            deferred.resolve(result);
        }
        function onRejected() {
            pendingCount--;
            if (pendingCount === 0) {
                deferred.reject(new Error(
                    "Can't get fulfillment value from any promise, all " +
                    "promises were rejected."
                ));
            }
        }
        function onProgress(progress) {
            deferred.notify({
                index: index,
                value: progress
            });
        }
    }, undefined);

    return deferred.promise;
}

Promise.prototype.any = function () {
    return any(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        Q.nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, error) {
    return Q(object).timeout(ms, error);
};

Promise.prototype.timeout = function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            Q.nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            Q.nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

}).call(this,require('_process'))
},{"_process":2}],4:[function(require,module,exports){
function DOMParser(options){
	this.options = options ||{locator:{}};
	
}
DOMParser.prototype.parseFromString = function(source,mimeType){	
	var options = this.options;
	var sax =  new XMLReader();
	var domBuilder = options.domBuilder || new DOMHandler();//contentHandler and LexicalHandler
	var errorHandler = options.errorHandler;
	var locator = options.locator;
	var defaultNSMap = options.xmlns||{};
	var entityMap = {'lt':'<','gt':'>','amp':'&','quot':'"','apos':"'"}
	if(locator){
		domBuilder.setDocumentLocator(locator)
	}
	
	sax.errorHandler = buildErrorHandler(errorHandler,domBuilder,locator);
	sax.domBuilder = options.domBuilder || domBuilder;
	if(/\/x?html?$/.test(mimeType)){
		entityMap.nbsp = '\xa0';
		entityMap.copy = '\xa9';
		defaultNSMap['']= 'http://www.w3.org/1999/xhtml';
	}
	if(source){
		sax.parse(source,defaultNSMap,entityMap);
	}else{
		sax.errorHandler.error("invalid document source");
	}
	return domBuilder.document;
}
function buildErrorHandler(errorImpl,domBuilder,locator){
	if(!errorImpl){
		if(domBuilder instanceof DOMHandler){
			return domBuilder;
		}
		errorImpl = domBuilder ;
	}
	var errorHandler = {}
	var isCallback = errorImpl instanceof Function;
	locator = locator||{}
	function build(key){
		var fn = errorImpl[key];
		if(!fn){
			if(isCallback){
				fn = errorImpl.length == 2?function(msg){errorImpl(key,msg)}:errorImpl;
			}else{
				var i=arguments.length;
				while(--i){
					if(fn = errorImpl[arguments[i]]){
						break;
					}
				}
			}
		}
		errorHandler[key] = fn && function(msg){
			fn(msg+_locator(locator));
		}||function(){};
	}
	build('warning','warn');
	build('error','warn','warning');
	build('fatalError','warn','warning','error');
	return errorHandler;
}
/**
 * +ContentHandler+ErrorHandler
 * +LexicalHandler+EntityResolver2
 * -DeclHandler-DTDHandler 
 * 
 * DefaultHandler:EntityResolver, DTDHandler, ContentHandler, ErrorHandler
 * DefaultHandler2:DefaultHandler,LexicalHandler, DeclHandler, EntityResolver2
 * @link http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
 */
function DOMHandler() {
    this.cdata = false;
}
function position(locator,node){
	node.lineNumber = locator.lineNumber;
	node.columnNumber = locator.columnNumber;
}
/**
 * @see org.xml.sax.ContentHandler#startDocument
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
 */ 
DOMHandler.prototype = {
	startDocument : function() {
    	this.document = new DOMImplementation().createDocument(null, null, null);
    	if (this.locator) {
        	this.document.documentURI = this.locator.systemId;
    	}
	},
	startElement:function(namespaceURI, localName, qName, attrs) {
		var doc = this.document;
	    var el = doc.createElementNS(namespaceURI, qName||localName);
	    var len = attrs.length;
	    appendElement(this, el);
	    this.currentElement = el;
	    
		this.locator && position(this.locator,el)
	    for (var i = 0 ; i < len; i++) {
	        var namespaceURI = attrs.getURI(i);
	        var value = attrs.getValue(i);
	        var qName = attrs.getQName(i);
			var attr = doc.createAttributeNS(namespaceURI, qName);
			if( attr.getOffset){
				position(attr.getOffset(1),attr)
			}
			attr.value = attr.nodeValue = value;
			el.setAttributeNode(attr)
	    }
	},
	endElement:function(namespaceURI, localName, qName) {
		var current = this.currentElement
	    var tagName = current.tagName;
	    this.currentElement = current.parentNode;
	},
	startPrefixMapping:function(prefix, uri) {
	},
	endPrefixMapping:function(prefix) {
	},
	processingInstruction:function(target, data) {
	    var ins = this.document.createProcessingInstruction(target, data);
	    this.locator && position(this.locator,ins)
	    appendElement(this, ins);
	},
	ignorableWhitespace:function(ch, start, length) {
	},
	characters:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
		//console.log(chars)
		if(this.currentElement && chars){
			if (this.cdata) {
				var charNode = this.document.createCDATASection(chars);
				this.currentElement.appendChild(charNode);
			} else {
				var charNode = this.document.createTextNode(chars);
				this.currentElement.appendChild(charNode);
			}
			this.locator && position(this.locator,charNode)
		}
	},
	skippedEntity:function(name) {
	},
	endDocument:function() {
		this.document.normalize();
	},
	setDocumentLocator:function (locator) {
	    if(this.locator = locator){// && !('lineNumber' in locator)){
	    	locator.lineNumber = 0;
	    }
	},
	//LexicalHandler
	comment:function(chars, start, length) {
		chars = _toString.apply(this,arguments)
	    var comm = this.document.createComment(chars);
	    this.locator && position(this.locator,comm)
	    appendElement(this, comm);
	},
	
	startCDATA:function() {
	    //used in characters() methods
	    this.cdata = true;
	},
	endCDATA:function() {
	    this.cdata = false;
	},
	
	startDTD:function(name, publicId, systemId) {
		var impl = this.document.implementation;
	    if (impl && impl.createDocumentType) {
	        var dt = impl.createDocumentType(name, publicId, systemId);
	        this.locator && position(this.locator,dt)
	        appendElement(this, dt);
	    }
	},
	/**
	 * @see org.xml.sax.ErrorHandler
	 * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
	 */
	warning:function(error) {
		console.warn(error,_locator(this.locator));
	},
	error:function(error) {
		console.error(error,_locator(this.locator));
	},
	fatalError:function(error) {
		console.error(error,_locator(this.locator));
	    throw error;
	}
}
function _locator(l){
	if(l){
		return '\n@'+(l.systemId ||'')+'#[line:'+l.lineNumber+',col:'+l.columnNumber+']'
	}
}
function _toString(chars,start,length){
	if(typeof chars == 'string'){
		return chars.substr(start,length)
	}else{//java sax connect width xmldom on rhino(what about: "? && !(chars instanceof String)")
		if(chars.length >= start+length || start){
			return new java.lang.String(chars,start,length)+'';
		}
		return chars;
	}
}

/*
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html
 * used method of org.xml.sax.ext.LexicalHandler:
 *  #comment(chars, start, length)
 *  #startCDATA()
 *  #endCDATA()
 *  #startDTD(name, publicId, systemId)
 *
 *
 * IGNORED method of org.xml.sax.ext.LexicalHandler:
 *  #endDTD()
 *  #startEntity(name)
 *  #endEntity(name)
 *
 *
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html
 * IGNORED method of org.xml.sax.ext.DeclHandler
 * 	#attributeDecl(eName, aName, type, mode, value)
 *  #elementDecl(name, model)
 *  #externalEntityDecl(name, publicId, systemId)
 *  #internalEntityDecl(name, value)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
 * IGNORED method of org.xml.sax.EntityResolver2
 *  #resolveEntity(String name,String publicId,String baseURI,String systemId)
 *  #resolveEntity(publicId, systemId)
 *  #getExternalSubset(name, baseURI)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
 * IGNORED method of org.xml.sax.DTDHandler
 *  #notationDecl(name, publicId, systemId) {};
 *  #unparsedEntityDecl(name, publicId, systemId, notationName) {};
 */
"endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(/\w+/g,function(key){
	DOMHandler.prototype[key] = function(){return null}
})

/* Private static helpers treated below as private instance methods, so don't need to add these to the public API; we might use a Relator to also get rid of non-standard public properties */
function appendElement (hander,node) {
    if (!hander.currentElement) {
        hander.document.appendChild(node);
    } else {
        hander.currentElement.appendChild(node);
    }
}//appendChild and setAttributeNS are preformance key

if(typeof require == 'function'){
	var XMLReader = require('./sax').XMLReader;
	var DOMImplementation = exports.DOMImplementation = require('./dom').DOMImplementation;
	exports.XMLSerializer = require('./dom').XMLSerializer ;
	exports.DOMParser = DOMParser;
}

},{"./dom":5,"./sax":6}],5:[function(require,module,exports){
/*
 * DOM Level 2
 * Object DOMException
 * @see http://www.w3.org/TR/REC-DOM-Level-1/ecma-script-language-binding.html
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/ecma-script-binding.html
 */

function copy(src,dest){
	for(var p in src){
		dest[p] = src[p];
	}
}
/**
^\w+\.prototype\.([_\w]+)\s*=\s*((?:.*\{\s*?[\r\n][\s\S]*?^})|\S.*?(?=[;\r\n]));?
^\w+\.prototype\.([_\w]+)\s*=\s*(\S.*?(?=[;\r\n]));?
 */
function _extends(Class,Super){
	var pt = Class.prototype;
	if(Object.create){
		var ppt = Object.create(Super.prototype)
		pt.__proto__ = ppt;
	}
	if(!(pt instanceof Super)){
		function t(){};
		t.prototype = Super.prototype;
		t = new t();
		copy(pt,t);
		Class.prototype = pt = t;
	}
	if(pt.constructor != Class){
		if(typeof Class != 'function'){
			console.error("unknow Class:"+Class)
		}
		pt.constructor = Class
	}
}
var htmlns = 'http://www.w3.org/1999/xhtml' ;
// Node Types
var NodeType = {}
var ELEMENT_NODE                = NodeType.ELEMENT_NODE                = 1;
var ATTRIBUTE_NODE              = NodeType.ATTRIBUTE_NODE              = 2;
var TEXT_NODE                   = NodeType.TEXT_NODE                   = 3;
var CDATA_SECTION_NODE          = NodeType.CDATA_SECTION_NODE          = 4;
var ENTITY_REFERENCE_NODE       = NodeType.ENTITY_REFERENCE_NODE       = 5;
var ENTITY_NODE                 = NodeType.ENTITY_NODE                 = 6;
var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
var COMMENT_NODE                = NodeType.COMMENT_NODE                = 8;
var DOCUMENT_NODE               = NodeType.DOCUMENT_NODE               = 9;
var DOCUMENT_TYPE_NODE          = NodeType.DOCUMENT_TYPE_NODE          = 10;
var DOCUMENT_FRAGMENT_NODE      = NodeType.DOCUMENT_FRAGMENT_NODE      = 11;
var NOTATION_NODE               = NodeType.NOTATION_NODE               = 12;

// ExceptionCode
var ExceptionCode = {}
var ExceptionMessage = {};
var INDEX_SIZE_ERR              = ExceptionCode.INDEX_SIZE_ERR              = ((ExceptionMessage[1]="Index size error"),1);
var DOMSTRING_SIZE_ERR          = ExceptionCode.DOMSTRING_SIZE_ERR          = ((ExceptionMessage[2]="DOMString size error"),2);
var HIERARCHY_REQUEST_ERR       = ExceptionCode.HIERARCHY_REQUEST_ERR       = ((ExceptionMessage[3]="Hierarchy request error"),3);
var WRONG_DOCUMENT_ERR          = ExceptionCode.WRONG_DOCUMENT_ERR          = ((ExceptionMessage[4]="Wrong document"),4);
var INVALID_CHARACTER_ERR       = ExceptionCode.INVALID_CHARACTER_ERR       = ((ExceptionMessage[5]="Invalid character"),5);
var NO_DATA_ALLOWED_ERR         = ExceptionCode.NO_DATA_ALLOWED_ERR         = ((ExceptionMessage[6]="No data allowed"),6);
var NO_MODIFICATION_ALLOWED_ERR = ExceptionCode.NO_MODIFICATION_ALLOWED_ERR = ((ExceptionMessage[7]="No modification allowed"),7);
var NOT_FOUND_ERR               = ExceptionCode.NOT_FOUND_ERR               = ((ExceptionMessage[8]="Not found"),8);
var NOT_SUPPORTED_ERR           = ExceptionCode.NOT_SUPPORTED_ERR           = ((ExceptionMessage[9]="Not supported"),9);
var INUSE_ATTRIBUTE_ERR         = ExceptionCode.INUSE_ATTRIBUTE_ERR         = ((ExceptionMessage[10]="Attribute in use"),10);
//level2
var INVALID_STATE_ERR        	= ExceptionCode.INVALID_STATE_ERR        	= ((ExceptionMessage[11]="Invalid state"),11);
var SYNTAX_ERR               	= ExceptionCode.SYNTAX_ERR               	= ((ExceptionMessage[12]="Syntax error"),12);
var INVALID_MODIFICATION_ERR 	= ExceptionCode.INVALID_MODIFICATION_ERR 	= ((ExceptionMessage[13]="Invalid modification"),13);
var NAMESPACE_ERR            	= ExceptionCode.NAMESPACE_ERR           	= ((ExceptionMessage[14]="Invalid namespace"),14);
var INVALID_ACCESS_ERR       	= ExceptionCode.INVALID_ACCESS_ERR      	= ((ExceptionMessage[15]="Invalid access"),15);


function DOMException(code, message) {
	if(message instanceof Error){
		var error = message;
	}else{
		error = this;
		Error.call(this, ExceptionMessage[code]);
		this.message = ExceptionMessage[code];
		if(Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
	}
	error.code = code;
	if(message) this.message = this.message + ": " + message;
	return error;
};
DOMException.prototype = Error.prototype;
copy(ExceptionCode,DOMException)
/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-536297177
 * The NodeList interface provides the abstraction of an ordered collection of nodes, without defining or constraining how this collection is implemented. NodeList objects in the DOM are live.
 * The items in the NodeList are accessible via an integral index, starting from 0.
 */
function NodeList() {
};
NodeList.prototype = {
	/**
	 * The number of nodes in the list. The range of valid child node indices is 0 to length-1 inclusive.
	 * @standard level1
	 */
	length:0, 
	/**
	 * Returns the indexth item in the collection. If index is greater than or equal to the number of nodes in the list, this returns null.
	 * @standard level1
	 * @param index  unsigned long 
	 *   Index into the collection.
	 * @return Node
	 * 	The node at the indexth position in the NodeList, or null if that is not a valid index. 
	 */
	item: function(index) {
		return this[index] || null;
	}
};
function LiveNodeList(node,refresh){
	this._node = node;
	this._refresh = refresh
	_updateLiveList(this);
}
function _updateLiveList(list){
	var inc = list._node._inc || list._node.ownerDocument._inc;
	if(list._inc != inc){
		var ls = list._refresh(list._node);
		//console.log(ls.length)
		__set__(list,'length',ls.length);
		copy(ls,list);
		list._inc = inc;
	}
}
LiveNodeList.prototype.item = function(i){
	_updateLiveList(this);
	return this[i];
}

_extends(LiveNodeList,NodeList);
/**
 * 
 * Objects implementing the NamedNodeMap interface are used to represent collections of nodes that can be accessed by name. Note that NamedNodeMap does not inherit from NodeList; NamedNodeMaps are not maintained in any particular order. Objects contained in an object implementing NamedNodeMap may also be accessed by an ordinal index, but this is simply to allow convenient enumeration of the contents of a NamedNodeMap, and does not imply that the DOM specifies an order to these Nodes.
 * NamedNodeMap objects in the DOM are live.
 * used for attributes or DocumentType entities 
 */
function NamedNodeMap() {
};

function _findNodeIndex(list,node){
	var i = list.length;
	while(i--){
		if(list[i] === node){return i}
	}
}

function _addNamedNode(el,list,newAttr,oldAttr){
	if(oldAttr){
		list[_findNodeIndex(list,oldAttr)] = newAttr;
	}else{
		list[list.length++] = newAttr;
	}
	if(el){
		newAttr.ownerElement = el;
		var doc = el.ownerDocument;
		if(doc){
			oldAttr && _onRemoveAttribute(doc,el,oldAttr);
			_onAddAttribute(doc,el,newAttr);
		}
	}
}
function _removeNamedNode(el,list,attr){
	var i = _findNodeIndex(list,attr);
	if(i>=0){
		var lastIndex = list.length-1
		while(i<lastIndex){
			list[i] = list[++i]
		}
		list.length = lastIndex;
		if(el){
			var doc = el.ownerDocument;
			if(doc){
				_onRemoveAttribute(doc,el,attr);
				attr.ownerElement = null;
			}
		}
	}else{
		throw DOMException(NOT_FOUND_ERR,new Error())
	}
}
NamedNodeMap.prototype = {
	length:0,
	item:NodeList.prototype.item,
	getNamedItem: function(key) {
//		if(key.indexOf(':')>0 || key == 'xmlns'){
//			return null;
//		}
		var i = this.length;
		while(i--){
			var attr = this[i];
			if(attr.nodeName == key){
				return attr;
			}
		}
	},
	setNamedItem: function(attr) {
		var el = attr.ownerElement;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		var oldAttr = this.getNamedItem(attr.nodeName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},
	/* returns Node */
	setNamedItemNS: function(attr) {// raises: WRONG_DOCUMENT_ERR,NO_MODIFICATION_ALLOWED_ERR,INUSE_ATTRIBUTE_ERR
		var el = attr.ownerElement, oldAttr;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		oldAttr = this.getNamedItemNS(attr.namespaceURI,attr.localName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},

	/* returns Node */
	removeNamedItem: function(key) {
		var attr = this.getNamedItem(key);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
		
		
	},// raises: NOT_FOUND_ERR,NO_MODIFICATION_ALLOWED_ERR
	
	//for level2
	removeNamedItemNS:function(namespaceURI,localName){
		var attr = this.getNamedItemNS(namespaceURI,localName);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
	},
	getNamedItemNS: function(namespaceURI, localName) {
		var i = this.length;
		while(i--){
			var node = this[i];
			if(node.localName == localName && node.namespaceURI == namespaceURI){
				return node;
			}
		}
		return null;
	}
};
/**
 * @see http://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-102161490
 */
function DOMImplementation(/* Object */ features) {
	this._features = {};
	if (features) {
		for (var feature in features) {
			 this._features = features[feature];
		}
	}
};

DOMImplementation.prototype = {
	hasFeature: function(/* string */ feature, /* string */ version) {
		var versions = this._features[feature.toLowerCase()];
		if (versions && (!version || version in versions)) {
			return true;
		} else {
			return false;
		}
	},
	// Introduced in DOM Level 2:
	createDocument:function(namespaceURI,  qualifiedName, doctype){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR,WRONG_DOCUMENT_ERR
		var doc = new Document();
		doc.doctype = doctype;
		if(doctype){
			doc.appendChild(doctype);
		}
		doc.implementation = this;
		doc.childNodes = new NodeList();
		if(qualifiedName){
			var root = doc.createElementNS(namespaceURI,qualifiedName);
			doc.appendChild(root);
		}
		return doc;
	},
	// Introduced in DOM Level 2:
	createDocumentType:function(qualifiedName, publicId, systemId){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR
		var node = new DocumentType();
		node.name = qualifiedName;
		node.nodeName = qualifiedName;
		node.publicId = publicId;
		node.systemId = systemId;
		// Introduced in DOM Level 2:
		//readonly attribute DOMString        internalSubset;
		
		//TODO:..
		//  readonly attribute NamedNodeMap     entities;
		//  readonly attribute NamedNodeMap     notations;
		return node;
	}
};


/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-1950641247
 */

function Node() {
};

Node.prototype = {
	firstChild : null,
	lastChild : null,
	previousSibling : null,
	nextSibling : null,
	attributes : null,
	parentNode : null,
	childNodes : null,
	ownerDocument : null,
	nodeValue : null,
	namespaceURI : null,
	prefix : null,
	localName : null,
	// Modified in DOM Level 2:
	insertBefore:function(newChild, refChild){//raises 
		return _insertBefore(this,newChild,refChild);
	},
	replaceChild:function(newChild, oldChild){//raises 
		this.insertBefore(newChild,oldChild);
		if(oldChild){
			this.removeChild(oldChild);
		}
	},
	removeChild:function(oldChild){
		return _removeChild(this,oldChild);
	},
	appendChild:function(newChild){
		return this.insertBefore(newChild,null);
	},
	hasChildNodes:function(){
		return this.firstChild != null;
	},
	cloneNode:function(deep){
		return cloneNode(this.ownerDocument||this,this,deep);
	},
	// Modified in DOM Level 2:
	normalize:function(){
		var child = this.firstChild;
		while(child){
			var next = child.nextSibling;
			if(next && next.nodeType == TEXT_NODE && child.nodeType == TEXT_NODE){
				this.removeChild(next);
				child.appendData(next.data);
			}else{
				child.normalize();
				child = next;
			}
		}
	},
  	// Introduced in DOM Level 2:
	isSupported:function(feature, version){
		return this.ownerDocument.implementation.hasFeature(feature,version);
	},
    // Introduced in DOM Level 2:
    hasAttributes:function(){
    	return this.attributes.length>0;
    },
    lookupPrefix:function(namespaceURI){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			for(var n in map){
    				if(map[n] == namespaceURI){
    					return n;
    				}
    			}
    		}
    		el = el.nodeType == 2?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    lookupNamespaceURI:function(prefix){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			if(prefix in map){
    				return map[prefix] ;
    			}
    		}
    		el = el.nodeType == 2?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    isDefaultNamespace:function(namespaceURI){
    	var prefix = this.lookupPrefix(namespaceURI);
    	return prefix == null;
    }
};


function _xmlEncoder(c){
	return c == '<' && '&lt;' ||
         c == '>' && '&gt;' ||
         c == '&' && '&amp;' ||
         c == '"' && '&quot;' ||
         '&#'+c.charCodeAt()+';'
}


copy(NodeType,Node);
copy(NodeType,Node.prototype);

/**
 * @param callback return true for continue,false for break
 * @return boolean true: break visit;
 */
function _visitNode(node,callback){
	if(callback(node)){
		return true;
	}
	if(node = node.firstChild){
		do{
			if(_visitNode(node,callback)){return true}
        }while(node=node.nextSibling)
    }
}



function Document(){
}
function _onAddAttribute(doc,el,newAttr){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		el._nsMap[newAttr.prefix?newAttr.localName:''] = newAttr.value
	}
}
function _onRemoveAttribute(doc,el,newAttr,remove){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		delete el._nsMap[newAttr.prefix?newAttr.localName:'']
	}
}
function _onUpdateChild(doc,el,newChild){
	if(doc && doc._inc){
		doc._inc++;
		//update childNodes
		var cs = el.childNodes;
		if(newChild){
			cs[cs.length++] = newChild;
		}else{
			//console.log(1)
			var child = el.firstChild;
			var i = 0;
			while(child){
				cs[i++] = child;
				child =child.nextSibling;
			}
			cs.length = i;
		}
	}
}

/**
 * attributes;
 * children;
 * 
 * writeable properties:
 * nodeValue,Attr:value,CharacterData:data
 * prefix
 */
function _removeChild(parentNode,child){
	var previous = child.previousSibling;
	var next = child.nextSibling;
	if(previous){
		previous.nextSibling = next;
	}else{
		parentNode.firstChild = next
	}
	if(next){
		next.previousSibling = previous;
	}else{
		parentNode.lastChild = previous;
	}
	_onUpdateChild(parentNode.ownerDocument,parentNode);
	return child;
}
/**
 * preformance key(refChild == null)
 */
function _insertBefore(parentNode,newChild,nextChild){
	var cp = newChild.parentNode;
	if(cp){
		cp.removeChild(newChild);//remove and update
	}
	if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
		var newFirst = newChild.firstChild;
		if (newFirst == null) {
			return newChild;
		}
		var newLast = newChild.lastChild;
	}else{
		newFirst = newLast = newChild;
	}
	var pre = nextChild ? nextChild.previousSibling : parentNode.lastChild;

	newFirst.previousSibling = pre;
	newLast.nextSibling = nextChild;
	
	
	if(pre){
		pre.nextSibling = newFirst;
	}else{
		parentNode.firstChild = newFirst;
	}
	if(nextChild == null){
		parentNode.lastChild = newLast;
	}else{
		nextChild.previousSibling = newLast;
	}
	do{
		newFirst.parentNode = parentNode;
	}while(newFirst !== newLast && (newFirst= newFirst.nextSibling))
	_onUpdateChild(parentNode.ownerDocument||parentNode,parentNode);
	//console.log(parentNode.lastChild.nextSibling == null)
	if (newChild.nodeType == DOCUMENT_FRAGMENT_NODE) {
		newChild.firstChild = newChild.lastChild = null;
	}
	return newChild;
}
function _appendSingleChild(parentNode,newChild){
	var cp = newChild.parentNode;
	if(cp){
		var pre = parentNode.lastChild;
		cp.removeChild(newChild);//remove and update
		var pre = parentNode.lastChild;
	}
	var pre = parentNode.lastChild;
	newChild.parentNode = parentNode;
	newChild.previousSibling = pre;
	newChild.nextSibling = null;
	if(pre){
		pre.nextSibling = newChild;
	}else{
		parentNode.firstChild = newChild;
	}
	parentNode.lastChild = newChild;
	_onUpdateChild(parentNode.ownerDocument,parentNode,newChild);
	return newChild;
	//console.log("__aa",parentNode.lastChild.nextSibling == null)
}
Document.prototype = {
	//implementation : null,
	nodeName :  '#document',
	nodeType :  DOCUMENT_NODE,
	doctype :  null,
	documentElement :  null,
	_inc : 1,
	
	insertBefore :  function(newChild, refChild){//raises 
		if(newChild.nodeType == DOCUMENT_FRAGMENT_NODE){
			var child = newChild.firstChild;
			while(child){
				var next = child.nextSibling;
				this.insertBefore(child,refChild);
				child = next;
			}
			return newChild;
		}
		if(this.documentElement == null && newChild.nodeType == 1){
			this.documentElement = newChild;
		}
		
		return _insertBefore(this,newChild,refChild),(newChild.ownerDocument = this),newChild;
	},
	removeChild :  function(oldChild){
		if(this.documentElement == oldChild){
			this.documentElement = null;
		}
		return _removeChild(this,oldChild);
	},
	// Introduced in DOM Level 2:
	importNode : function(importedNode,deep){
		return importNode(this,importedNode,deep);
	},
	// Introduced in DOM Level 2:
	getElementById :	function(id){
		var rtv = null;
		_visitNode(this.documentElement,function(node){
			if(node.nodeType == 1){
				if(node.getAttribute('id') == id){
					rtv = node;
					return true;
				}
			}
		})
		return rtv;
	},
	
	//document factory method:
	createElement :	function(tagName){
		var node = new Element();
		node.ownerDocument = this;
		node.nodeName = tagName;
		node.tagName = tagName;
		node.childNodes = new NodeList();
		var attrs	= node.attributes = new NamedNodeMap();
		attrs._ownerElement = node;
		return node;
	},
	createDocumentFragment :	function(){
		var node = new DocumentFragment();
		node.ownerDocument = this;
		node.childNodes = new NodeList();
		return node;
	},
	createTextNode :	function(data){
		var node = new Text();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createComment :	function(data){
		var node = new Comment();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createCDATASection :	function(data){
		var node = new CDATASection();
		node.ownerDocument = this;
		node.appendData(data)
		return node;
	},
	createProcessingInstruction :	function(target,data){
		var node = new ProcessingInstruction();
		node.ownerDocument = this;
		node.tagName = node.target = target;
		node.nodeValue= node.data = data;
		return node;
	},
	createAttribute :	function(name){
		var node = new Attr();
		node.ownerDocument	= this;
		node.name = name;
		node.nodeName	= name;
		node.localName = name;
		node.specified = true;
		return node;
	},
	createEntityReference :	function(name){
		var node = new EntityReference();
		node.ownerDocument	= this;
		node.nodeName	= name;
		return node;
	},
	// Introduced in DOM Level 2:
	createElementNS :	function(namespaceURI,qualifiedName){
		var node = new Element();
		var pl = qualifiedName.split(':');
		var attrs	= node.attributes = new NamedNodeMap();
		node.childNodes = new NodeList();
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.tagName = qualifiedName;
		node.namespaceURI = namespaceURI;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		attrs._ownerElement = node;
		return node;
	},
	// Introduced in DOM Level 2:
	createAttributeNS :	function(namespaceURI,qualifiedName){
		var node = new Attr();
		var pl = qualifiedName.split(':');
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.name = qualifiedName;
		node.namespaceURI = namespaceURI;
		node.specified = true;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else{
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		return node;
	}
};
_extends(Document,Node);


function Element() {
	this._nsMap = {};
};
Element.prototype = {
	nodeType : ELEMENT_NODE,
	hasAttribute : function(name){
		return this.getAttributeNode(name)!=null;
	},
	getAttribute : function(name){
		var attr = this.getAttributeNode(name);
		return attr && attr.value || '';
	},
	getAttributeNode : function(name){
		return this.attributes.getNamedItem(name);
	},
	setAttribute : function(name, value){
		var attr = this.ownerDocument.createAttribute(name);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr)
	},
	removeAttribute : function(name){
		var attr = this.getAttributeNode(name)
		attr && this.removeAttributeNode(attr);
	},
	
	//four real opeartion method
	appendChild:function(newChild){
		if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
			return this.insertBefore(newChild,null);
		}else{
			return _appendSingleChild(this,newChild);
		}
	},
	setAttributeNode : function(newAttr){
		return this.attributes.setNamedItem(newAttr);
	},
	setAttributeNodeNS : function(newAttr){
		return this.attributes.setNamedItemNS(newAttr);
	},
	removeAttributeNode : function(oldAttr){
		return this.attributes.removeNamedItem(oldAttr.nodeName);
	},
	//get real attribute name,and remove it by removeAttributeNode
	removeAttributeNS : function(namespaceURI, localName){
		var old = this.getAttributeNodeNS(namespaceURI, localName);
		old && this.removeAttributeNode(old);
	},
	
	hasAttributeNS : function(namespaceURI, localName){
		return this.getAttributeNodeNS(namespaceURI, localName)!=null;
	},
	getAttributeNS : function(namespaceURI, localName){
		var attr = this.getAttributeNodeNS(namespaceURI, localName);
		return attr && attr.value || '';
	},
	setAttributeNS : function(namespaceURI, qualifiedName, value){
		var attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
		attr.value = attr.nodeValue = value;
		this.setAttributeNode(attr)
	},
	getAttributeNodeNS : function(namespaceURI, localName){
		return this.attributes.getNamedItemNS(namespaceURI, localName);
	},
	
	getElementsByTagName : function(tagName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType == ELEMENT_NODE && (tagName === '*' || node.tagName == tagName)){
					ls.push(node);
				}
			});
			return ls;
		});
	},
	getElementsByTagNameNS : function(namespaceURI, localName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType === ELEMENT_NODE && node.namespaceURI === namespaceURI && (localName === '*' || node.localName == localName)){
					ls.push(node);
				}
			});
			return ls;
		});
	}
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;


_extends(Element,Node);
function Attr() {
};
Attr.prototype.nodeType = ATTRIBUTE_NODE;
_extends(Attr,Node);


function CharacterData() {
};
CharacterData.prototype = {
	data : '',
	substringData : function(offset, count) {
		return this.data.substring(offset, offset+count);
	},
	appendData: function(text) {
		text = this.data+text;
		this.nodeValue = this.data = text;
		this.length = text.length;
	},
	insertData: function(offset,text) {
		this.replaceData(offset,0,text);
	
	},
	appendChild:function(newChild){
		//if(!(newChild instanceof CharacterData)){
			throw new Error(ExceptionMessage[3])
		//}
		return Node.prototype.appendChild.apply(this,arguments)
	},
	deleteData: function(offset, count) {
		this.replaceData(offset,count,"");
	},
	replaceData: function(offset, count, text) {
		var start = this.data.substring(0,offset);
		var end = this.data.substring(offset+count);
		text = start + text + end;
		this.nodeValue = this.data = text;
		this.length = text.length;
	}
}
_extends(CharacterData,Node);
function Text() {
};
Text.prototype = {
	nodeName : "#text",
	nodeType : TEXT_NODE,
	splitText : function(offset) {
		var text = this.data;
		var newText = text.substring(offset);
		text = text.substring(0, offset);
		this.data = this.nodeValue = text;
		this.length = text.length;
		var newNode = this.ownerDocument.createTextNode(newText);
		if(this.parentNode){
			this.parentNode.insertBefore(newNode, this.nextSibling);
		}
		return newNode;
	}
}
_extends(Text,CharacterData);
function Comment() {
};
Comment.prototype = {
	nodeName : "#comment",
	nodeType : COMMENT_NODE
}
_extends(Comment,CharacterData);

function CDATASection() {
};
CDATASection.prototype = {
	nodeName : "#cdata-section",
	nodeType : CDATA_SECTION_NODE
}
_extends(CDATASection,CharacterData);


function DocumentType() {
};
DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
_extends(DocumentType,Node);

function Notation() {
};
Notation.prototype.nodeType = NOTATION_NODE;
_extends(Notation,Node);

function Entity() {
};
Entity.prototype.nodeType = ENTITY_NODE;
_extends(Entity,Node);

function EntityReference() {
};
EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
_extends(EntityReference,Node);

function DocumentFragment() {
};
DocumentFragment.prototype.nodeName =	"#document-fragment";
DocumentFragment.prototype.nodeType =	DOCUMENT_FRAGMENT_NODE;
_extends(DocumentFragment,Node);


function ProcessingInstruction() {
}
ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
_extends(ProcessingInstruction,Node);
function XMLSerializer(){}
XMLSerializer.prototype.serializeToString = function(node){
	var buf = [];
	serializeToString(node,buf);
	return buf.join('');
}
Node.prototype.toString =function(){
	return XMLSerializer.prototype.serializeToString(this);
}
function serializeToString(node,buf){
	switch(node.nodeType){
	case ELEMENT_NODE:
		var attrs = node.attributes;
		var len = attrs.length;
		var child = node.firstChild;
		var nodeName = node.tagName;
		var isHTML = htmlns === node.namespaceURI
		buf.push('<',nodeName);
		for(var i=0;i<len;i++){
			serializeToString(attrs.item(i),buf,isHTML);
		}
		if(child || isHTML && !/^(?:meta|link|img|br|hr|input)$/i.test(nodeName)){
			buf.push('>');
			//if is cdata child node
			if(isHTML && /^script$/i.test(nodeName)){
				if(child){
					buf.push(child.data);
				}
			}else{
				while(child){
					serializeToString(child,buf);
					child = child.nextSibling;
				}
			}
			buf.push('</',nodeName,'>');
		}else{
			buf.push('/>');
		}
		return;
	case DOCUMENT_NODE:
	case DOCUMENT_FRAGMENT_NODE:
		var child = node.firstChild;
		while(child){
			serializeToString(child,buf);
			child = child.nextSibling;
		}
		return;
	case ATTRIBUTE_NODE:
		return buf.push(' ',node.name,'="',node.value.replace(/[<&"]/g,_xmlEncoder),'"');
	case TEXT_NODE:
		return buf.push(node.data.replace(/[<&]/g,_xmlEncoder));
	case CDATA_SECTION_NODE:
		return buf.push( '<![CDATA[',node.data,']]>');
	case COMMENT_NODE:
		return buf.push( "<!--",node.data,"-->");
	case DOCUMENT_TYPE_NODE:
		var pubid = node.publicId;
		var sysid = node.systemId;
		buf.push('<!DOCTYPE ',node.name);
		if(pubid){
			buf.push(' PUBLIC "',pubid);
			if (sysid && sysid!='.') {
				buf.push( '" "',sysid);
			}
			buf.push('">');
		}else if(sysid && sysid!='.'){
			buf.push(' SYSTEM "',sysid,'">');
		}else{
			var sub = node.internalSubset;
			if(sub){
				buf.push(" [",sub,"]");
			}
			buf.push(">");
		}
		return;
	case PROCESSING_INSTRUCTION_NODE:
		return buf.push( "<?",node.target," ",node.data,"?>");
	case ENTITY_REFERENCE_NODE:
		return buf.push( '&',node.nodeName,';');
	//case ENTITY_NODE:
	//case NOTATION_NODE:
	default:
		buf.push('??',node.nodeName);
	}
}
function importNode(doc,node,deep){
	var node2;
	switch (node.nodeType) {
	case ELEMENT_NODE:
		node2 = node.cloneNode(false);
		node2.ownerDocument = doc;
		//var attrs = node2.attributes;
		//var len = attrs.length;
		//for(var i=0;i<len;i++){
			//node2.setAttributeNodeNS(importNode(doc,attrs.item(i),deep));
		//}
	case DOCUMENT_FRAGMENT_NODE:
		break;
	case ATTRIBUTE_NODE:
		deep = true;
		break;
	//case ENTITY_REFERENCE_NODE:
	//case PROCESSING_INSTRUCTION_NODE:
	////case TEXT_NODE:
	//case CDATA_SECTION_NODE:
	//case COMMENT_NODE:
	//	deep = false;
	//	break;
	//case DOCUMENT_NODE:
	//case DOCUMENT_TYPE_NODE:
	//cannot be imported.
	//case ENTITY_NODE:
	//case NOTATION_NODE：
	//can not hit in level3
	//default:throw e;
	}
	if(!node2){
		node2 = node.cloneNode(false);//false
	}
	node2.ownerDocument = doc;
	node2.parentNode = null;
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(importNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}
//
//var _relationMap = {firstChild:1,lastChild:1,previousSibling:1,nextSibling:1,
//					attributes:1,childNodes:1,parentNode:1,documentElement:1,doctype,};
function cloneNode(doc,node,deep){
	var node2 = new node.constructor();
	for(var n in node){
		var v = node[n];
		if(typeof v != 'object' ){
			if(v != node2[n]){
				node2[n] = v;
			}
		}
	}
	if(node.childNodes){
		node2.childNodes = new NodeList();
	}
	node2.ownerDocument = doc;
	switch (node2.nodeType) {
	case ELEMENT_NODE:
		var attrs	= node.attributes;
		var attrs2	= node2.attributes = new NamedNodeMap();
		var len = attrs.length
		attrs2._ownerElement = node2;
		for(var i=0;i<len;i++){
			node2.setAttributeNode(cloneNode(doc,attrs.item(i),true));
		}
		break;;
	case ATTRIBUTE_NODE:
		deep = true;
	}
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(cloneNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}

function __set__(object,key,value){
	object[key] = value
}
//do dynamic
try{
	if(Object.defineProperty){
		Object.defineProperty(LiveNodeList.prototype,'length',{
			get:function(){
				_updateLiveList(this);
				return this.$$length;
			}
		});
		Object.defineProperty(Node.prototype,'textContent',{
			get:function(){
				return getTextContent(this);
			},
			set:function(data){
				switch(this.nodeType){
				case 1:
				case 11:
					while(this.firstChild){
						this.removeChild(this.firstChild);
					}
					if(data || String(data)){
						this.appendChild(this.ownerDocument.createTextNode(data));
					}
					break;
				default:
					//TODO:
					this.data = data;
					this.value = value;
					this.nodeValue = data;
				}
			}
		})
		
		function getTextContent(node){
			switch(node.nodeType){
			case 1:
			case 11:
				var buf = [];
				node = node.firstChild;
				while(node){
					if(node.nodeType!==7 && node.nodeType !==8){
						buf.push(getTextContent(node));
					}
					node = node.nextSibling;
				}
				return buf.join('');
			default:
				return node.nodeValue;
			}
		}
		__set__ = function(object,key,value){
			//console.log(value)
			object['$$'+key] = value
		}
	}
}catch(e){//ie8
}

if(typeof require == 'function'){
	exports.DOMImplementation = DOMImplementation;
	exports.XMLSerializer = XMLSerializer;
}

},{}],6:[function(require,module,exports){
//[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
//[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
//[5]   	Name	   ::=   	NameStartChar (NameChar)*
var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]///\u10000-\uEFFFF
var nameChar = new RegExp("[\\-\\.0-9"+nameStartChar.source.slice(1,-1)+"\u00B7\u0300-\u036F\\ux203F-\u2040]");
var tagNamePattern = new RegExp('^'+nameStartChar.source+nameChar.source+'*(?:\:'+nameStartChar.source+nameChar.source+'*)?$');
//var tagNamePattern = /^[a-zA-Z_][\w\-\.]*(?:\:[a-zA-Z_][\w\-\.]*)?$/
//var handlers = 'resolveEntity,getExternalSubset,characters,endDocument,endElement,endPrefixMapping,ignorableWhitespace,processingInstruction,setDocumentLocator,skippedEntity,startDocument,startElement,startPrefixMapping,notationDecl,unparsedEntityDecl,error,fatalError,warning,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,comment,endCDATA,endDTD,endEntity,startCDATA,startDTD,startEntity'.split(',')

//S_TAG,	S_ATTR,	S_EQ,	S_V
//S_ATTR_S,	S_E,	S_S,	S_C
var S_TAG = 0;//tag name offerring
var S_ATTR = 1;//attr name offerring 
var S_ATTR_S=2;//attr name end and space offer
var S_EQ = 3;//=space?
var S_V = 4;//attr value(no quot value only)
var S_E = 5;//attr value end and no space(quot end)
var S_S = 6;//(attr value end || tag end ) && (space offer)
var S_C = 7;//closed el<el />

function XMLReader(){
	
}

XMLReader.prototype = {
	parse:function(source,defaultNSMap,entityMap){
		var domBuilder = this.domBuilder;
		domBuilder.startDocument();
		_copy(defaultNSMap ,defaultNSMap = {})
		parse(source,defaultNSMap,entityMap,
				domBuilder,this.errorHandler);
		domBuilder.endDocument();
	}
}
function parse(source,defaultNSMapCopy,entityMap,domBuilder,errorHandler){
  function fixedFromCharCode(code) {
		// String.prototype.fromCharCode does not supports
		// > 2 bytes unicode chars directly
		if (code > 0xffff) {
			code -= 0x10000;
			var surrogate1 = 0xd800 + (code >> 10)
				, surrogate2 = 0xdc00 + (code & 0x3ff);

			return String.fromCharCode(surrogate1, surrogate2);
		} else {
			return String.fromCharCode(code);
		}
	}
	function entityReplacer(a){
		var k = a.slice(1,-1);
		if(k in entityMap){
			return entityMap[k]; 
		}else if(k.charAt(0) === '#'){
			return fixedFromCharCode(parseInt(k.substr(1).replace('x','0x')))
		}else{
			errorHandler.error('entity not found:'+a);
			return a;
		}
	}
	function appendText(end){//has some bugs
		var xt = source.substring(start,end).replace(/&#?\w+;/g,entityReplacer);
		locator&&position(start);
		domBuilder.characters(xt,0,end-start);
		start = end
	}
	function position(start,m){
		while(start>=endPos && (m = linePattern.exec(source))){
			startPos = m.index;
			endPos = startPos + m[0].length;
			locator.lineNumber++;
			//console.log('line++:',locator,startPos,endPos)
		}
		locator.columnNumber = start-startPos+1;
	}
	var startPos = 0;
	var endPos = 0;
	var linePattern = /.+(?:\r\n?|\n)|.*$/g
	var locator = domBuilder.locator;
	
	var parseStack = [{currentNSMap:defaultNSMapCopy}]
	var closeMap = {};
	var start = 0;
	while(true){
		var i = source.indexOf('<',start);
		if(i<0){
			if(!source.substr(start).match(/^\s*$/)){
				var doc = domBuilder.document;
    			var text = doc.createTextNode(source.substr(start));
    			doc.appendChild(text);
    			domBuilder.currentElement = text;
			}
			return;
		}
		if(i>start){
			appendText(i);
		}
		switch(source.charAt(i+1)){
		case '/':
			var end = source.indexOf('>',i+3);
			var tagName = source.substring(i+2,end);
			var config = parseStack.pop();
			var localNSMap = config.localNSMap;
			
	        if(config.tagName != tagName){
	            errorHandler.fatalError("end tag name: "+tagName+' is not match the current start tagName:'+config.tagName );
	        }
			domBuilder.endElement(config.uri,config.localName,tagName);
			if(localNSMap){
				for(var prefix in localNSMap){
					domBuilder.endPrefixMapping(prefix) ;
				}
			}
			end++;
			break;
			// end elment
		case '?':// <?...?>
			locator&&position(i);
			end = parseInstruction(source,i,domBuilder);
			break;
		case '!':// <!doctype,<![CDATA,<!--
			locator&&position(i);
			end = parseDCC(source,i,domBuilder,errorHandler);
			break;
		default:
			try{
				locator&&position(i);
				
				var el = new ElementAttributes();
				
				//elStartEnd
				var end = parseElementStartPart(source,i,el,entityReplacer,errorHandler);
				var len = el.length;
				//position fixed
				if(len && locator){
					var backup = copyLocator(locator,{});
					for(var i = 0;i<len;i++){
						var a = el[i];
						position(a.offset);
						a.offset = copyLocator(locator,{});
					}
					copyLocator(backup,locator);
				}
				if(!el.closed && fixSelfClosed(source,end,el.tagName,closeMap)){
					el.closed = true;
					if(!entityMap.nbsp){
						errorHandler.warning('unclosed xml attribute');
					}
				}
				appendElement(el,domBuilder,parseStack);
				
				
				if(el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed){
					end = parseHtmlSpecialContent(source,end,el.tagName,entityReplacer,domBuilder)
				}else{
					end++;
				}
			}catch(e){
				errorHandler.error('element parse error: '+e);
				end = -1;
			}

		}
		if(end<0){
			//TODO: 这里有可能sax回退，有位置错误风险
			appendText(i+1);
		}else{
			start = end;
		}
	}
}
function copyLocator(f,t){
	t.lineNumber = f.lineNumber;
	t.columnNumber = f.columnNumber;
	return t;
	
}

/**
 * @see #appendElement(source,elStartEnd,el,selfClosed,entityReplacer,domBuilder,parseStack);
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function parseElementStartPart(source,start,el,entityReplacer,errorHandler){
	var attrName;
	var value;
	var p = ++start;
	var s = S_TAG;//status
	while(true){
		var c = source.charAt(p);
		switch(c){
		case '=':
			if(s === S_ATTR){//attrName
				attrName = source.slice(start,p);
				s = S_EQ;
			}else if(s === S_ATTR_S){
				s = S_EQ;
			}else{
				//fatalError: equal must after attrName or space after attrName
				throw new Error('attribute equal must after attrName');
			}
			break;
		case '\'':
		case '"':
			if(s === S_EQ){//equal
				start = p+1;
				p = source.indexOf(c,start)
				if(p>0){
					value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					el.add(attrName,value,start-1);
					s = S_E;
				}else{
					//fatalError: no end quot match
					throw new Error('attribute value no end \''+c+'\' match');
				}
			}else if(s == S_V){
				value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
				//console.log(attrName,value,start,p)
				el.add(attrName,value,start);
				//console.dir(el)
				errorHandler.warning('attribute "'+attrName+'" missed start quot('+c+')!!');
				start = p+1;
				s = S_E
			}else{
				//fatalError: no equal before
				throw new Error('attribute value must after "="');
			}
			break;
		case '/':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_E:
			case S_S:
			case S_C:
				s = S_C;
				el.closed = true;
			case S_V:
			case S_ATTR:
			case S_ATTR_S:
				break;
			//case S_EQ:
			default:
				throw new Error("attribute invalid close char('/')")
			}
			break;
		case ''://end document
			//throw new Error('unexpected end of input')
			errorHandler.error('unexpected end of input');
		case '>':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_E:
			case S_S:
			case S_C:
				break;//normal
			case S_V://Compatible state
			case S_ATTR:
				value = source.slice(start,p);
				if(value.slice(-1) === '/'){
					el.closed  = true;
					value = value.slice(0,-1)
				}
			case S_ATTR_S:
				if(s === S_ATTR_S){
					value = attrName;
				}
				if(s == S_V){
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value.replace(/&#?\w+;/g,entityReplacer),start)
				}else{
					errorHandler.warning('attribute "'+value+'" missed value!! "'+value+'" instead!!')
					el.add(value,value,start)
				}
				break;
			case S_EQ:
				throw new Error('attribute value missed!!');
			}
//			console.log(tagName,tagNamePattern,tagNamePattern.test(tagName))
			return p;
		/*xml space '\x20' | #x9 | #xD | #xA; */
		case '\u0080':
			c = ' ';
		default:
			if(c<= ' '){//space
				switch(s){
				case S_TAG:
					el.setTagName(source.slice(start,p));//tagName
					s = S_S;
					break;
				case S_ATTR:
					attrName = source.slice(start,p)
					s = S_ATTR_S;
					break;
				case S_V:
					var value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					el.add(attrName,value,start)
				case S_E:
					s = S_S;
					break;
				//case S_S:
				//case S_EQ:
				//case S_ATTR_S:
				//	void();break;
				//case S_C:
					//ignore warning
				}
			}else{//not space
//S_TAG,	S_ATTR,	S_EQ,	S_V
//S_ATTR_S,	S_E,	S_S,	S_C
				switch(s){
				//case S_TAG:void();break;
				//case S_ATTR:void();break;
				//case S_V:void();break;
				case S_ATTR_S:
					errorHandler.warning('attribute "'+attrName+'" missed value!! "'+attrName+'" instead!!')
					el.add(attrName,attrName,start);
					start = p;
					s = S_ATTR;
					break;
				case S_E:
					errorHandler.warning('attribute space is required"'+attrName+'"!!')
				case S_S:
					s = S_ATTR;
					start = p;
					break;
				case S_EQ:
					s = S_V;
					start = p;
					break;
				case S_C:
					throw new Error("elements closed character '/' and '>' must be connected to");
				}
			}
		}
		p++;
	}
}
/**
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function appendElement(el,domBuilder,parseStack){
	var tagName = el.tagName;
	var localNSMap = null;
	var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
	var i = el.length;
	while(i--){
		var a = el[i];
		var qName = a.qName;
		var value = a.value;
		var nsp = qName.indexOf(':');
		if(nsp>0){
			var prefix = a.prefix = qName.slice(0,nsp);
			var localName = qName.slice(nsp+1);
			var nsPrefix = prefix === 'xmlns' && localName
		}else{
			localName = qName;
			prefix = null
			nsPrefix = qName === 'xmlns' && ''
		}
		//can not set prefix,because prefix !== ''
		a.localName = localName ;
		//prefix == null for no ns prefix attribute 
		if(nsPrefix !== false){//hack!!
			if(localNSMap == null){
				localNSMap = {}
				//console.log(currentNSMap,0)
				_copy(currentNSMap,currentNSMap={})
				//console.log(currentNSMap,1)
			}
			currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
			a.uri = 'http://www.w3.org/2000/xmlns/'
			domBuilder.startPrefixMapping(nsPrefix, value) 
		}
	}
	var i = el.length;
	while(i--){
		a = el[i];
		var prefix = a.prefix;
		if(prefix){//no prefix attribute has no namespace
			if(prefix === 'xml'){
				a.uri = 'http://www.w3.org/XML/1998/namespace';
			}if(prefix !== 'xmlns'){
				a.uri = currentNSMap[prefix]
				
				//{console.log('###'+a.qName,domBuilder.locator.systemId+'',currentNSMap,a.uri)}
			}
		}
	}
	var nsp = tagName.indexOf(':');
	if(nsp>0){
		prefix = el.prefix = tagName.slice(0,nsp);
		localName = el.localName = tagName.slice(nsp+1);
	}else{
		prefix = null;//important!!
		localName = el.localName = tagName;
	}
	//no prefix element has default namespace
	var ns = el.uri = currentNSMap[prefix || ''];
	domBuilder.startElement(ns,localName,tagName,el);
	//endPrefixMapping and startPrefixMapping have not any help for dom builder
	//localNSMap = null
	if(el.closed){
		domBuilder.endElement(ns,localName,tagName);
		if(localNSMap){
			for(prefix in localNSMap){
				domBuilder.endPrefixMapping(prefix) 
			}
		}
	}else{
		el.currentNSMap = currentNSMap;
		el.localNSMap = localNSMap;
		parseStack.push(el);
	}
}
function parseHtmlSpecialContent(source,elStartEnd,tagName,entityReplacer,domBuilder){
	if(/^(?:script|textarea)$/i.test(tagName)){
		var elEndStart =  source.indexOf('</'+tagName+'>',elStartEnd);
		var text = source.substring(elStartEnd+1,elEndStart);
		if(/[&<]/.test(text)){
			if(/^script$/i.test(tagName)){
				//if(!/\]\]>/.test(text)){
					//lexHandler.startCDATA();
					domBuilder.characters(text,0,text.length);
					//lexHandler.endCDATA();
					return elEndStart;
				//}
			}//}else{//text area
				text = text.replace(/&#?\w+;/g,entityReplacer);
				domBuilder.characters(text,0,text.length);
				return elEndStart;
			//}
			
		}
	}
	return elStartEnd+1;
}
function fixSelfClosed(source,elStartEnd,tagName,closeMap){
	//if(tagName in closeMap){
	var pos = closeMap[tagName];
	if(pos == null){
		//console.log(tagName)
		pos = closeMap[tagName] = source.lastIndexOf('</'+tagName+'>')
	}
	return pos<elStartEnd;
	//} 
}
function _copy(source,target){
	for(var n in source){target[n] = source[n]}
}
function parseDCC(source,start,domBuilder,errorHandler){//sure start with '<!'
	var next= source.charAt(start+2)
	switch(next){
	case '-':
		if(source.charAt(start + 3) === '-'){
			var end = source.indexOf('-->',start+4);
			//append comment source.substring(4,end)//<!--
			if(end>start){
				domBuilder.comment(source,start+4,end-start-4);
				return end+3;
			}else{
				errorHandler.error("Unclosed comment");
				return -1;
			}
		}else{
			//error
			return -1;
		}
	default:
		if(source.substr(start+3,6) == 'CDATA['){
			var end = source.indexOf(']]>',start+9);
			domBuilder.startCDATA();
			domBuilder.characters(source,start+9,end-start-9);
			domBuilder.endCDATA() 
			return end+3;
		}
		//<!DOCTYPE
		//startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId) 
		var matchs = split(source,start);
		var len = matchs.length;
		if(len>1 && /!doctype/i.test(matchs[0][0])){
			var name = matchs[1][0];
			var pubid = len>3 && /^public$/i.test(matchs[2][0]) && matchs[3][0]
			var sysid = len>4 && matchs[4][0];
			var lastMatch = matchs[len-1]
			domBuilder.startDTD(name,pubid && pubid.replace(/^(['"])(.*?)\1$/,'$2'),
					sysid && sysid.replace(/^(['"])(.*?)\1$/,'$2'));
			domBuilder.endDTD();
			
			return lastMatch.index+lastMatch[0].length
		}
	}
	return -1;
}



function parseInstruction(source,start,domBuilder){
	var end = source.indexOf('?>',start);
	if(end){
		var match = source.substring(start,end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
		if(match){
			var len = match[0].length;
			domBuilder.processingInstruction(match[1], match[2]) ;
			return end+2;
		}else{//error
			return -1;
		}
	}
	return -1;
}

/**
 * @param source
 */
function ElementAttributes(source){
	
}
ElementAttributes.prototype = {
	setTagName:function(tagName){
		if(!tagNamePattern.test(tagName)){
			throw new Error('invalid tagName:'+tagName)
		}
		this.tagName = tagName
	},
	add:function(qName,value,offset){
		if(!tagNamePattern.test(qName)){
			throw new Error('invalid attribute:'+qName)
		}
		this[this.length++] = {qName:qName,value:value,offset:offset}
	},
	length:0,
	getLocalName:function(i){return this[i].localName},
	getOffset:function(i){return this[i].offset},
	getQName:function(i){return this[i].qName},
	getURI:function(i){return this[i].uri},
	getValue:function(i){return this[i].value}
//	,getIndex:function(uri, localName)){
//		if(localName){
//			
//		}else{
//			var qName = uri
//		}
//	},
//	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
//	getType:function(uri,localName){}
//	getType:function(i){},
}




function _set_proto_(thiz,parent){
	thiz.__proto__ = parent;
	return thiz;
}
if(!(_set_proto_({},_set_proto_.prototype) instanceof _set_proto_)){
	_set_proto_ = function(thiz,parent){
		function p(){};
		p.prototype = parent;
		p = new p();
		for(parent in thiz){
			p[parent] = thiz[parent];
		}
		return p;
	}
}

function split(source,start){
	var match;
	var buf = [];
	var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
	reg.lastIndex = start;
	reg.exec(source);//skip <
	while(match = reg.exec(source)){
		buf.push(match);
		if(match[1])return buf;
	}
}

if(typeof require == 'function'){
	exports.XMLReader = XMLReader;
}


},{}],7:[function(require,module,exports){
/**
 * Created by Spadon on 02/12/2014.
 */

var q = require('q'),
    fs = require('fs');

module.exports = {
    getJsExports: function() {
        var deferred = q.defer();

        fs.readFile('./server/ontology/jsw/JswTrimQueryABox.js', 'utf-8', function (err, aBoxFile) {
            fs.readFile('./server/ontology/jsw/TrimPathQuery.js', 'utf-8', function(err, trimQueryFile) {
                deferred.resolve(aBoxFile + '\n' + trimQueryFile);
            });
        });

        return deferred.promise;
    }
};
},{"fs":1,"q":3}],8:[function(require,module,exports){
/**
* Created by Spadon on 17/10/2014.
*/

StopWatch = require('./JswStopWatch');
Queue = require('./JswQueue');
PairStorage = require('./JswPairStorage');
TripleStorage = require('./JswTripleStorage');
TrimQueryABox = require('./JswTrimQueryABox');
JswOWL = require('./JswOWL');
JswRDF = require('./JswRDF');
JswOntology = require('./JswOntology'),


/**
 * BrandT is an OWL-EL reasoner. Currently, it has some limitations and does not allow
 * reasoning on full EL++, but it does cover EL+ and its minor extensions.
 */
  BrandT = function (ontology) {
    var clock, normalizedOntology;

    /** Stores information about how much time different steps of building a reasoner took. */
    this.timeInfo = {};
    /** Original ontology from which the reasoner was built. */
    this.originalOntology = ontology;
    this.resultOntology = new JswOntology.ontology();

    clock = new StopWatch.stopWatch();

    clock.start();
    normalizedOntology = this.normalizeOntology();
    this.timeInfo.normalization = clock.stop();

    clock.start();
    this.objectPropertySubsumers = this.buildObjectPropertySubsumerSets(normalizedOntology);
    this.timeInfo.objectPropertySubsumption = clock.stop();

    clock.start();
    this.classSubsumers = this.buildClassSubsumerSets(normalizedOntology);
    this.timeInfo.classification = clock.stop();

    clock.start();
    /** Rewritten A-Box of the ontology. */
    this.aBox = this.rewriteAbox(normalizedOntology);
    this.timeInfo.aBoxRewriting = clock.stop();

    // Remove entity IRIs introduced during normalization stage from the subsumer sets.
    this.removeIntroducedEntities(
        this.classSubsumers,
        this.originalOntology.getClasses(),
        [JswOWL.IRIs.THING, JswOWL.IRIs.NOTHING]
    );
    this.removeIntroducedEntities(
        this.objectPropertySubsumers,
        this.originalOntology.getObjectProperties(),
        [JswOWL.IRIs.TOP_OBJECT_PROPERTY, JswOWL.IRIs.BOTTOM_OBJECT_PROPERTY]
    );

    clock.start();
    this.timeInfo.classHierarchy = clock.stop();

    clock.start();
    this.timeInfo.objectPropertyHierarchy = clock.stop();
};

/** Prototype for all BrandT objects. */
BrandT.prototype = {
    /**
     * Builds an object property subsumption relation implied by the ontology.
     *
     * @param ontology Normalized ontology to be use for building the subsumption relation.
     * @return PairStorage storage hashing the object property subsumption relation implied by the
     * ontology.
     */
    buildObjectPropertySubsumerSets: function (ontology) {
        var args, axiom, axioms, axiomIndex, objectProperties, objectProperty,
            objectPropertySubsumers, opropType, reqAxiomType, queue, subsumer, subsumers,
            topObjectProperty;

        topObjectProperty = JswOWL.IRIs.TOP_OBJECT_PROPERTY;
        objectPropertySubsumers = new PairStorage.pairStorage();
        objectPropertySubsumers.add(topObjectProperty, topObjectProperty);
        objectProperties = ontology.getObjectProperties();

        for (objectProperty in objectProperties) {
            if (objectProperties.hasOwnProperty(objectProperty)) {
                // Every object property is a subsumer for itself.
                objectPropertySubsumers.add(objectProperty, objectProperty);
                // Top object property is a subsumer for every other property.
                objectPropertySubsumers.add(objectProperty, topObjectProperty);
            }
        }

        axioms = ontology.axioms;
        opropType = JswOWL.ExpressionTypes.ET_OPROP;
        reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;

        // Add object property subsumptions explicitly mentioned in the ontology.
        for (axiomIndex = axioms.length; axiomIndex--;) {
            axiom = axioms[axiomIndex];
            args = axiom.args;

            if (axiom.type !== reqAxiomType || args[0].type !== opropType) {
                continue;
            }

            objectPropertySubsumers.add(args[0].IRI, args[1].IRI);
        }

        queue = new Queue.queue();

        for (objectProperty in objectProperties) {
            if (!objectProperties.hasOwnProperty(objectProperty)) {
                continue;
            }

            subsumers = objectPropertySubsumers.get(objectProperty);

            for (subsumer in subsumers) {
                if (subsumers.hasOwnProperty(subsumer)) {
                    queue.enqueue(subsumer);
                }
            }

            // Discover implicit subsumptions via intermediate object properties.
            while (!queue.isEmpty()) {
                subsumers = objectPropertySubsumers.get(queue.dequeue());

                for (subsumer in subsumers) {
                    if (subsumers.hasOwnProperty(subsumer)) {
                    // If the objectProperty has subsumer added in its subsumer set, then that
                    // subsumer either was processed already or has been added to the queue - no
                    // need to process it for the second time.
                        if (!objectPropertySubsumers.exists(objectProperty, subsumer)) {
                            objectPropertySubsumers.add(objectProperty, subsumer);
                            queue.enqueue(subsumer);
                        }
                    }
                }
            }
        }

        return objectPropertySubsumers;
    },

    /**
     * Builds a class subsumption relation implied by the ontology.
     *
     * @param ontology Ontology to use for building subsumer sets. The ontology has to be
     * normalized.
     * @return PairStorage storage containing the class subsumption relation implied by the ontology.
     */
    buildClassSubsumerSets: function (ontology) {
        var a,
            labelNodeIfAxioms1 = [],
            labelNodeIfAxioms2 = [],
            labelNodeAxioms = [],
            labelEdgeAxioms = [],
            labelNodeIfAxiom1Count,
            labelNodeIfAxiom2Count,
            labelNodeAxiomCount,
            labelEdgeAxiomCount,
            b,
            // Provides quick access to axioms like r o s <= q.
            chainSubsumers = this.buildChainSubsumerSets(),
            // Stores labels for each node.
            classSubsumers = new PairStorage.pairStorage(),
            // Stores labels for each edge.
            edgeLabels = new TripleStorage.tripleStorage(),
            instruction,
            leftChainSubsumers = chainSubsumers.left,
            node,
            nothing = JswOWL.IRIs.NOTHING,
            objectPropertySubsumers = this.objectPropertySubsumers,
            originalOntology = this.originalOntology,
            queue,
            queues = {},
            rightChainSubsumers = chainSubsumers.right,
            p,
            someInstructionFound;

        /**
         * Splits the axiom set of the ontology into several subsets used for different purposes.
         */
        function splitAxiomSet() {
            var axiom, axioms, axiomIndex, axiomType, classType, firstArgType,
                intersectType, reqAxiomType, secondArgType, someValuesType;

            reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            classType = JswOWL.ExpressionTypes.ET_CLASS;
            intersectType = JswOWL.ExpressionTypes.CE_INTERSECT;
            someValuesType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;
            axioms = ontology.axioms;

            for (axiomIndex = axioms.length; axiomIndex--;) {
                axiom = axioms[axiomIndex];
                axiomType = axiom.type;

                if (axiom.type !== reqAxiomType) {
                    continue;
                }

                secondArgType = axiom.args[1].type;

                if (secondArgType === classType) {
                    firstArgType = axiom.args[0].type;

                    if (firstArgType === classType) {
                        labelNodeIfAxioms1.push(axiom);
                    } else if (firstArgType === intersectType) {
                        labelNodeIfAxioms2.push(axiom);
                    } else if (firstArgType === someValuesType) {
                        labelNodeAxioms.push(axiom);
                    }
                } else if (secondArgType === someValuesType) {
                    if (axiom.args[0].type === classType) {
                        labelEdgeAxioms.push(axiom);
                    }
                }
            }

            labelNodeAxiomCount = labelNodeAxioms.length;
            labelNodeIfAxiom1Count = labelNodeIfAxioms1.length;
            labelNodeIfAxiom2Count = labelNodeIfAxioms2.length;
            labelEdgeAxiomCount = labelEdgeAxioms.length;
        }

        /**
         * Adds instructions
         *
         * 'Label B as C if it is labeled A1, A2, ..., Am already'
         *
         * to the queue of B for all axioms like
         *
         * A1 n A2 n ... n A n ... n Am <= C.
         *
         * @param a
         * @param b
         */
        function addLabelNodeIfInstructions(a, b) {
            var axioms, args, axiomIndex, canUse, classes, classCount, classIndex, classIri,
                reqLabels;

            axioms = labelNodeIfAxioms1;

            for (axiomIndex = labelNodeIfAxiom1Count; axiomIndex--;) {
                args = axioms[axiomIndex].args;

                if (args[0].IRI === a) {
                    queues[b].enqueue({
                        'type': 0,
                        'node': b,
                        'label': args[1].IRI,
                        'reqLabels': null
                    });
                }
            }

            axioms = labelNodeIfAxioms2;

            for (axiomIndex = labelNodeIfAxiom2Count; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                classes = args[0].args;
                classCount = classes.length;
                canUse = false;

                for (classIndex = classCount; classIndex--;) {
                    if (classes[classIndex].IRI === a) {
                        canUse = true;
                        break;
                    }
                }

                if (!canUse) {
                // Axiom does not contain A on the left side
                    continue;
                }

                reqLabels = {};

                for (classIndex = classCount; classIndex--;) {
                    classIri = classes[classIndex].IRI;

                    if (classIri !== a) {
                        reqLabels[classIri] = true;
                    }
                }

                queues[b].enqueue({
                    'type': 0,
                    'node': b,
                    'label': args[1].IRI,
                    'reqLabels': reqLabels
                });
            }
        }

        /**
         * Adds instructions
         *
         * 'Label B with C'
         *
         * to the queue of B for all axioms like
         *
         * E P.A <= C.
         *
         * @param p IRI of the object property to look for in axioms.
         * @param a IRI of the class to look for in the left part of axioms.
         * @param b IRI of the class to add instructions to.
         */
        function addLabelNodeInstructions(p, a, b) {
            var axioms, args, axiomIndex, firstArg;

            axioms = labelNodeAxioms;

            for (axiomIndex = labelNodeAxiomCount; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                firstArg = args[0];

                if (firstArg.opropExpr.IRI === p && firstArg.classExpr.IRI === a) {
                    queues[b].enqueue({
                        'type': 0,
                        'node': b,
                        'label': args[1].IRI
                    });
                }
            }
        }

        /**
         * Adds instructions
         *
         * 'Label the edge (B, C) as P'
         *
         * to the queue of B for all axioms like
         *
         * A <= E P.C
         *
         * @param a
         * @param b
         */
        function addLabelEdgeInstructions(a, b) {
            var axioms, args, axiomIndex, secondArg;

            axioms = labelEdgeAxioms;

            for (axiomIndex = labelEdgeAxiomCount; axiomIndex--;) {
                args = axioms[axiomIndex].args;
                secondArg = args[1];

                if (args[0].IRI !== a) {
                    continue;
                }

                queues[b].enqueue({
                    'type': 1,
                    'node1': b, // IRI of the source node of the edge.
                    'node2': secondArg.classExpr.IRI, // IRI of the destination node of the edge.
                    'label': secondArg.opropExpr.IRI // IRI of the label to add to the edge.
                });
            }
        }

        /**
         * Adds instructions to the queue of class B for axioms involving class A.
         *
         * @param a IRI of the class to look for in axioms.
         * @param b IRI of the class to add instructions for.
         */
        function addInstructions(a, b) {
            addLabelNodeIfInstructions(a, b);
            addLabelEdgeInstructions(a, b);
        }

        /**
         * Initialises a single node of the graph before the subsumption algorithm is run.
         *
         * @param classIri IRI of the class to initialize a node for.
         */
        function initialiseNode(classIri) {
// Every class is a subsumer for itself.
            classSubsumers.add(classIri, classIri);

// Initialise an instruction queue for the node.
            queues[classIri] = new Queue.queue();

// Add any initial instructions about the class to the queue.
            addInstructions(classIri, classIri);
        }

        /**
         * Initialises data structures before the subsumption algorithm is run.
         */
        function initialise() {
            var classes = ontology.getClasses(),
                classIri,
                thing = JswOWL.IRIs.THING;

// Put different axioms into different 'baskets'.
            splitAxiomSet();

// Create a node for Thing (superclass).
            initialiseNode(thing);

            for (classIri in classes) {
                if (classes.hasOwnProperty(classIri) && !classes[classIri]) {
// Create a node for each class in the Ontology.
                    initialiseNode(classIri);

// Mark Thing as a subsumer of the class.
                    classSubsumers.add(classIri, thing);

// All axioms about Thing should also be true for any class.
                    addInstructions(thing, classIri);
                }
            }
        }

        /**
         * Adds subsumers sets for classes which have not been found in the TBox of the ontology.
         */
        function addRemainingSubsumerSets() {
            var classes = ontology.getClasses(),
                classIri,
                nothing = JswOWL.IRIs.NOTHING,
                originalClasses = originalOntology.getClasses(),
                thing = JswOWL.IRIs.THING;

                // We add Nothing to the subsumer sets only if some of the original classes has Nothing
                // as a subsumer.
            for (classIri in classSubsumers.get(null)) {
                if (originalClasses.hasOwnProperty(classIri) &&
                    classSubsumers.exists(classIri, nothing)) {
                // In principle, everything is a subsumer of Nothing, but we ignore it.
                    classSubsumers.add(nothing, nothing);
                    classSubsumers.add(nothing, thing);
                    break;
                }
            }

            for (classIri in ontology.getClasses()) {
                if (classes.hasOwnProperty(classIri) && classes[classIri]) {
                    classSubsumers.add(classIri, classIri);
                    classSubsumers.add(classIri, thing);
                }
            }
        }

        /**
         * Processes an instruction to add a new edge.
         *
         * @param a
         * @param b
         * @param p
         */
        function processNewEdge(a, b, p) {
            var bSubsumers, c, classes, edges, lChainSubsumers, q, r, rChainSubsumers, s;

            classes = classSubsumers.get(null);
            edges = edgeLabels;
            bSubsumers = classSubsumers.get(b);
            lChainSubsumers = leftChainSubsumers;
            rChainSubsumers = rightChainSubsumers;

            // For all subsumers of object property P, including P itself.
            for (q in objectPropertySubsumers.get(p)) {
            // Add q as a label between A and B.
                edges.add(a, b, q);

                // Since we discovered that A <= E Q.B, we know that A <= E Q.C, where C is any
                // subsumer of B. We therefore need to look for new subsumers D of A by checking
                // all axioms like E Q.C <= D.
                for (c in bSubsumers) {
                    addLabelNodeInstructions(q, c, a);
                }

                // We want to take care of object property chains. We now know that Q: A -> B.
                // If there is another property R: C -> A for some class C and property S, such that
                // R o Q <= S, we want to label edge (C, B) with S.
                for (r in rChainSubsumers.get(q)) {
                    for (s in rChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(c, a, r) && !edges.exists(c, b, s)) {
                                processNewEdge(c, b, s);
                            }
                        }
                    }
                }

                // We want to take care of object property chains. We now know that Q: A -> B.
                // If there is another property R: B -> C for some class C and property S, such that
                // Q o R <= S, we want to label edge (A, C) with S.
                for (r in lChainSubsumers.get(q)) {
                    for (s in lChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(b, c, r) && !edges.exists(a, c, s)) processNewEdge(a, c, s);
                        }
                    }
                }
            }
        }

        /**
         * Processes the given Label Edge instruction.
         *
         * @param instruction Label Edge instruction to process.
         */
        function processLabelEdgeInstruction(instruction) {
            var p = instruction.label,
                a = instruction.node1,
                b = instruction.node2;

// If the label exists already, no need to process the instruction.
            if (!edgeLabels.exists(a, b, p)) {
                processNewEdge(a, b, p);
            }
        }

        /**
         * Processes the given Label Node instruction.
         *
         * @param instruction Label Node instruction to process.
         */
        function processLabelNodeInstruction(instruction) {
            var a, b, c, edges, p, subsumers;

            a = instruction.node;
            b = instruction.label;
            edges = edgeLabels;
            subsumers = classSubsumers;

            if (subsumers.exists(a, b) || !subsumers.existAll(a, instruction.reqLabels)) {
// The node is not labeled with all required labels yet or it has been labeled
// with the new label already - there is no point to process the operation anyway.
                return;
            }

// Otherwise, add a label to the node.
            subsumers.add(a, b);

// Since B is a new discovered subsumer of A, all axioms about B apply to A as well -
// we need to update node instruction queue accordingly.
            addInstructions(b, a);

// We have discovered a new information about A, so we need to update all other nodes
// linked to it.
            for (c in edges.get(null, null)) {
                for (p in edges.get(c, a)) {
// For all C <= E P.A, we now know that C <= E P.B. And therefore C should have
// the same subsumers as E P.B.
                    addLabelNodeInstructions(p, b, c);
                }
            }
        }

// Initialise queues and labels.
        initialise();

        do {
            someInstructionFound = false;

// Get a queue which is not empty.
            for (node in queues) {

                queue = queues[node];

                if (!queue.isEmpty()) {
// Process the oldest instruction in the queue.
                    instruction = queue.dequeue();

                    switch (instruction.type) {
                        case 0:
                            processLabelNodeInstruction(instruction);
                            break;
                        case 1:
                            processLabelEdgeInstruction(instruction);
                            break;
                        default:
                            throw 'Unrecognized type of instruction found in the queue!';
                    }

                    someInstructionFound = true;
                    break;
                }
            }
        } while (someInstructionFound);

        do {
            someInstructionFound = false;

            for (a in edgeLabels.get(null, null)) {
                if (classSubsumers.exists(a, nothing)) {
                    continue;
                }

                for (b in edgeLabels.get(a, null)) {
                    for (p in edgeLabels.get(a, b)) {
                        if (classSubsumers.exists(b, nothing)) {
                            classSubsumers.add(a, nothing);
                        }
                    }
                }
            }
        } while (someInstructionFound);

// Add a subsumer set for every class which did not participate in TBox.
        addRemainingSubsumerSets();

        return classSubsumers;
    },

    /**
     * Removes from subsumer sets references to entities which have been introduced during
     * normalization stage.
     *
     * @param subsumerSets Subsumer sets to remove the introduced entities from.
     * @param originalEntities Object containing IRIs of original entities as properties.
     * @param allowedEntities Array containing names of entites which should not be removed if they
     * are present in the subsumer sets.
     */
    removeIntroducedEntities: function (subsumerSets, originalEntities, allowedEntities) {
        var allowedCount = allowedEntities.length,
            entityIri,
            subsumerIri;

        /**
         * Checks if the given given entity IRI has been introduced during normalization stage.
         *
         * @param entityIri IRI of the entity to check.
         * @return boolean - true if the entity has been introduced, false otherwise.
         */
        function isIntroducedEntity(entityIri) {
            var index;

            if (originalEntities.hasOwnProperty(entityIri)) {
                return true;
            }

            for (index = allowedCount; index--;) {
                if (allowedEntities[index] === entityIri) {
                    return true;
                }
            }
        }

// Remove introduced entities from subsumer sets.
        for (entityIri in subsumerSets.get()) {
            if (!isIntroducedEntity(entityIri)) {
                subsumerSets.remove(entityIri);
                continue;
            }

            for (subsumerIri in subsumerSets.get(entityIri)) {
                if (!isIntroducedEntity(subsumerIri)) {
                    subsumerSets.remove(entityIri, subsumerIri);
                }
            }
        }
    },

    /**
     * Creates an object which hashes axioms like r o s <= q, so that all axioms related to either
     * q or s can be obtained efficiently. Normalized ontology containing the axioms to hash.
     * @return Object hashing all object property chain subsumptions.
     */
    buildChainSubsumerSets: function () {
        var args, axiom, axioms, axiomIndex, chainSubsumer, leftSubsumers, leftOprop,
            opropChainType, reqAxiomType, rightOprop, rightSubsumers;

        leftSubsumers = new TripleStorage.tripleStorage();

      axioms = this.originalOntology.axioms;
      rightSubsumers = new TripleStorage.tripleStorage();

        reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
        opropChainType = JswOWL.ExpressionTypes.OPE_CHAIN;

        for (axiomIndex = axioms.length; axiomIndex--;) {
            axiom = axioms[axiomIndex];

            if (axiom.type !== reqAxiomType || axiom.args[0].type !== opropChainType) {
                continue;
            }

            args = axiom.args[0].args;
            leftOprop = args[0].IRI;
            rightOprop = args[1].IRI;
            chainSubsumer = axiom.args[1].IRI;

            leftSubsumers.add(leftOprop, rightOprop, chainSubsumer);
            rightSubsumers.add(rightOprop, leftOprop, chainSubsumer);
        }

        return {
            'left': leftSubsumers,
            'right': rightSubsumers
        };
    },

    /**
     * Rewrites an ABox of the ontology into the relational database to use it for conjunctive query
     * answering.
     *
     * @param ontology Normalized ontology containing the ABox to rewrite.
     * @return TrimQueryABox object containing the rewritten ABox.
     */
    rewriteAbox: function (ontology) {
        var axioms = ontology.axioms,
            axiomCount = axioms.length,
            classSubsumers = this.classSubsumers,
            aBox = new TrimQueryABox.trimQueryABox(),
            objectPropertySubsumers = this.objectPropertySubsumers,
            originalOntology = this.originalOntology;

        /**
         * Puts class assertions implied by the ontology into the database.
         *
         * @return Array containing all class assertions implied by the ontology.
         */
        function rewriteClassAssertions() {
            var axiom, axiomIndex, classFactType, classIri, individualClasses, individualIri,
                subsumerIri;

            individualClasses = new PairStorage.pairStorage();
            classFactType = JswOWL.ExpressionTypes.FACT_CLASS;

            for (axiomIndex = axiomCount; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                if (axiom.type !== classFactType) {
                    continue;
                }

                individualIri = axiom.individual.IRI;
                classIri = axiom.classExpr.IRI;

                for (subsumerIri in classSubsumers.get(classIri)) {
                    if (originalOntology.containsClass(subsumerIri, JswOWL.IRIs)) {
                        individualClasses.add(individualIri, subsumerIri);
                    }
                }
            }

            // Put class assertions into the database.
            for (individualIri in individualClasses.get(null)) {
                for (classIri in individualClasses.get(individualIri)) {
                    aBox.addClassAssertion(individualIri, classIri);
                }
            }
        }

        /**
         * Puts role assertions implied by the ontology into the database.
         *
         * @return Array containing all object property assertions implied by the ontology.
         */
        function rewriteObjectPropertyAssertions() {
            var args, axiom, axiomIndex, centerInd, chainSubsumer, changesHappened, individual,
                individuals, opropSubsumer, leftInd, leftOprop, oprop, opropFactType,
                reflexiveOpropType, reqAxiomType, reqExprType, rightInd, rightOprop, storage;

            storage = new TripleStorage.tripleStorage();
            reflexiveOpropType = JswOWL.ExpressionTypes.AXIOM_OPROP_REFL;
            opropFactType = JswOWL.ExpressionTypes.FACT_OPROP;
            individuals = originalOntology.getIndividuals();

            for (axiomIndex = axiomCount; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                // Reflexive object properties.
                if (axiom.type === reflexiveOpropType) {
                    for (opropSubsumer in objectPropertySubsumers.get(axiom.objectProperty.IRI)) {
                        for (individual in individuals) {
                            storage.add(opropSubsumer, individual, individual);
                        }
                    }
                } else if (axiom.type === opropFactType) {
                    leftInd = axiom.leftIndividual.IRI;
                    rightInd = axiom.rightIndividual.IRI;

                    for (opropSubsumer in objectPropertySubsumers.get(axiom.objectProperty.IRI)) {
                        storage.add(opropSubsumer, leftInd, rightInd);
                    }
                }
            }

            reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
            reqExprType = JswOWL.ExpressionTypes.OPE_CHAIN;

            do {
                changesHappened = false;

                for (axiomIndex = axiomCount; axiomIndex--;) {
                    axiom = ontology.axioms[axiomIndex];

                    if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType) {
                        continue;
                    }

                    args = axiom.args[0].args;
                    leftOprop = args[0].IRI;
                    rightOprop = args[1].IRI;
                    chainSubsumer = axiom.args[1].IRI;

                    for (leftInd in storage.get(leftOprop, null)) {
                        for (centerInd in storage.get(leftOprop, leftInd)) {
                            for (rightInd in storage.get(rightOprop, centerInd)) {
                                for (opropSubsumer in objectPropertySubsumers.get(chainSubsumer)) {
                                    if (!storage.exists(opropSubsumer, leftInd, rightInd)) {
                                        storage.add(opropSubsumer, leftInd, rightInd);
                                        changesHappened = true;
                                    }
                                }
                            }
                        }
                    }
                }
            } while (changesHappened);

            // Put object property assertions into the database.
            for (oprop in storage.get(null, null)) {
                if (!originalOntology.containsObjectProperty(oprop, JswOWL.IRIs)) {
                    continue;
                }

                for (leftInd in storage.get(oprop, null)) {
                    for (rightInd in storage.get(oprop, leftInd)) {
                        aBox.addObjectPropertyAssertion(oprop, leftInd, rightInd);
                    }
                }
            }
        }

      /**
       * Puts class subsumers implied by the ontology into the database.
       * @author Mehdi Terdjimi
       * @return Array containing all class subsumers implied by the ontology.
       */
      function rewriteClassSubsumers() {
        var classIri, classSubsumerIri, subsumerClasses, axiomIndex, axiom, axiomCount, axiomClassSubType;

        subsumerClasses = new PairStorage.pairStorage();
        axiomClassSubType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
        axiomCount = axioms.length;

        for (axiomIndex = axiomCount; axiomIndex--;) {
          axiom = axioms[axiomIndex];

          if (axiom.type !== axiomClassSubType) {
            continue;
          }

          classIri = axiom.args[0].IRI;

          for (classSubsumerIri in classSubsumers.get(classIri)) {
            if (originalOntology.containsClass(classSubsumerIri, JswOWL.IRIs)) {
              subsumerClasses.add(classIri, classSubsumerIri);
            }
          }
        }

        // Put class subsumers into the database.
        for (classSubsumerIri in subsumerClasses.get(null)) {
          aBox.addClassSubsumer(classIri, classSubsumerIri);
        }
      }

        rewriteClassAssertions();
        rewriteObjectPropertyAssertions();
        rewriteClassSubsumers();

        return aBox;
    },

    /**
     * Answers the given user query.
     *
     * @param query An object representing a query to be answered.
     */
    answerQuery: function (query) {
        if (!query) {

            throw 'The query is not specified!';
        }

        //AJOUT Lionel
        //To separate SPARQL queries dedicated to ABoxes from class definitions
        if (query.triples.length !== 1) {
            throw 'Only one triple is currently allowed in sparql requests...';
        }

        //If the query is about class subsumption
        if (query.triples[0].predicate.value == JswRDF.IRIs.SUBCLASS) {
            var subject, object, subsumee, subsumer, result;

            result = [];
            subject = query.triples[0].subject.value;
            object = query.triples[0].object.value;

            //Find the variables in the subject and object
            for (var i = 0; i < query.variables.length; i++) {
                var variable = query.variables[i];
                if (variable.value == subject) {
                    subject = "*";
                }
                if (variable.value == object) {
                    object = "*";
                }
            }

            //Find the correct pairs in the classSubsumers Pairstorage...
            if (subject != "*") {
            //Looking for subsumers of the query subject
                for (subsumer in this.classSubsumers.storage[subject]) {
                    result.push({"subject": query.triples[0].subject.value, "object": subsumer});
                }
            } else {
            //Looking for subsumees
                for (subsumee in this.classSubsumers.storage) {
                    for (subsumer in this.classSubsumers.storage[subsumee]) {
                        if (object == "*" || object == subsumer) {
                            result.push({"subject": subsumee, "object": subsumer});
                        }
                    }
                }
            }
            return result;
        }

        return this.aBox.answerQuery(query);
    },

    /**
     * Normalizes the given ontology.
     *
     * @return jsw Ontology ontology which is a normalized version of the given one.
     */
    normalizeOntology: function (ontology, resultOntology) {
        var axiom, axiomIndex, queue, nothingClass, resultAxioms,
            rules, ruleCount, ruleIndex, instanceClasses,
            ontology = this.originalOntology,
            resultOntology = this.resultOntology;

        /**
         * Copies all entities from the source ontology to the result ontology.
         */
        function copyEntities() {
            var entities, entitiesOfType, entityIri, entityType;

            entities = ontology.entities;

            for (entityType in entities) {
                if (entities.hasOwnProperty(entityType)) {
                    entitiesOfType = entities[entityType];

                    for (entityIri in entitiesOfType) {
                        if (entitiesOfType.hasOwnProperty(entityIri)) {
                            resultOntology.entities[entityType][entityIri] =
                                entitiesOfType[entityIri];
                        }
                    }
                }
            }
        }

        /**
         * Creates a new entity of the given type with a unique IRI and registers it in the result
         * ontology.
         *
         * @param type Type of the entity to create.
         * @return Object representing the entity created.
         */
        function createEntity(type) {
            var newIri = resultOntology.createUniqueIRI(type);

            resultOntology.registerEntity(type, newIri, false);

            return {
                'type': type,
                'IRI': newIri
            };
        }

        /**
         * Returns nominal class object representing the given individual. If the class object
         * has not been created for the given individual, creates it.
         *
         * @param individual Object representing individual to return the nominal class for.
         * @return Nominal class object for the given individual.
         */
        function getIndividualClass(individual) {
            var individualIri, newClass;

            individualIri = individual.IRI;
            newClass = instanceClasses[individualIri];

            if (!newClass) {
                newClass = createEntity(JswOWL.ExpressionTypes.ET_CLASS);
                instanceClasses[individualIri] = newClass;
            }

            return newClass;
        }

        /**
         * For the given DisjointClasses axiom involving class expressions A1 .. An, puts an
         * equivalent set of axioms Ai n Aj <= {}, for all i <> j to the queue.
         *
         * @param statement DisjointClasses statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceDisjointClassesAxiom(statement, queue) {
            var args, argIndex1, argIndex2, firstArg, intersectType, nothing,
                resultAxiomType;

            resultAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            intersectType = JswOWL.ExpressionTypes.CE_INTERSECT;
            nothing = nothingClass;
            args = statement.args;

            for (argIndex1 = args.length; argIndex1--;) {
                firstArg = args[argIndex1];

                for (argIndex2 = argIndex1; argIndex2--;) {
                    queue.enqueue({
                        'type': resultAxiomType,
                        'args': [
                            {
                                'type': intersectType,
                                'args': [firstArg, args[argIndex2]]
                            },
                            nothing
                        ]
                    });
                }
            }
        }

        /**
         * For the given EquivalentClasses or EquivalentObjectProperties axiom involving expressions
         * A1 .. An, puts an equivalent set of all axioms Ai <= Aj to the given queue.
         *
         * @param axiom EquivalentClasses or EquivalentObjectProperties axiom.
         * @param resultAxiomType Type of the result axioms.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceEquivalenceAxiom(axiom, resultAxiomType, queue) {
            var args, argCount, argIndex1, argIndex2, firstArg;

            args = axiom.args;
            argCount = args.length;

            for (argIndex1 = argCount; argIndex1--;) {
                firstArg = args[argIndex1];

                for (argIndex2 = argCount; argIndex2--;) {
                    if (argIndex1 !== argIndex2) {
                        queue.enqueue({
                            type: resultAxiomType,
                            args: [firstArg, args[argIndex2]]
                        });
                    }
                }
            }
        }

        /**
         * For the given TransitiveObjectProperty for object property r, adds an equivalent axiom
         * r o r <= r to the given queue.
         *
         * @param axiom TransitiveObjectProperty axiom.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceTransitiveObjectPropertyAxiom(axiom, queue) {
            var oprop = axiom.objectProperty;

            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_OPROP_SUB,
                'args': [
                    {
                        'type': JswOWL.ExpressionTypes.OPE_CHAIN,
                        'args': [oprop, oprop]
                    },
                    oprop
                ]
            });
        }

        /**
         * For the given ClassAssertion statement in the form a <= A, where a is
         * individual and A is a class expression, puts the new statements a <= B and B <= A,
         * where B is a new atomic class, to the queue.
         *
         * @param statement ClassAssertion statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceClassAssertion(statement, queue) {
            var individual, newClass;

            individual = statement.individual;
            newClass = getIndividualClass(individual);

            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_CLASS_SUB,
                'args': [newClass, statement.classExpr]
            });
            queue.enqueue({
                'type': JswOWL.ExpressionTypes.FACT_CLASS,
                'individual': individual,
                'classExpr': newClass
            });
        }

        /**
         * For the given ObjectPropertyAssertion statement in the form r(a, b), where a and b are
         * individuals and r is an object property, adds axioms A <= E r.B to the given queue, where
         * A and B represent nominals {a} and {b}.
         *
         * @param statement ObjectPropertyAssertion statement.
         * @param queue Queue to which the equivalent statements should be put.
         */
        function replaceObjectPropertyAssertion(statement, queue) {
            queue.enqueue(statement);
            queue.enqueue({
                'type': JswOWL.ExpressionTypes.AXIOM_CLASS_SUB,
                'args': [getIndividualClass(statement.leftIndividual), {
                    'type': JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM,
                    'opropExpr': statement.objectProperty,
                    'classExpr': getIndividualClass(statement.rightIndividual)
                }]
            });
        }

        /**
         * Returns a queue with axioms which need to be normalized.
         */
        function createAxiomQueue() {
            var axiom, axioms, axiomIndex, classAssertion, disjointClasses, equivalentClasses,
                equivalentObjectProperties, objectPropertyAssertion, queue, subClassOf,
                subObjPropertyOf, transitiveObjectProperty;

            disjointClasses = JswOWL.ExpressionTypes.AXIOM_CLASS_DISJOINT;
            equivalentClasses = JswOWL.ExpressionTypes.AXIOM_CLASS_EQ;
            equivalentObjectProperties = JswOWL.ExpressionTypes.AXIOM_OPROP_EQ;
            subObjPropertyOf = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;
            subClassOf = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
            transitiveObjectProperty = JswOWL.ExpressionTypes.AXIOM_OPROP_TRAN;
            classAssertion = JswOWL.ExpressionTypes.FACT_CLASS;
            objectPropertyAssertion = JswOWL.ExpressionTypes.FACT_OPROP;
            queue = new Queue.queue();
            axioms = ontology.axioms;

            for (axiomIndex = axioms.length; axiomIndex--;) {
                axiom = axioms[axiomIndex];

                switch (axiom.type) {
                    case disjointClasses:
                        replaceDisjointClassesAxiom(axiom, queue);
                        break;
                    case equivalentClasses:
                        replaceEquivalenceAxiom(axiom, subClassOf, queue);
                        break;
                    case equivalentObjectProperties:
                        replaceEquivalenceAxiom(axiom, subObjPropertyOf, queue);
                        break;
                    case transitiveObjectProperty:
                        replaceTransitiveObjectPropertyAxiom(axiom, queue);
                        break;
                    case classAssertion:
                        replaceClassAssertion(axiom, queue);
                        break;
                    case objectPropertyAssertion:
                        replaceObjectPropertyAssertion(axiom, queue);
                        break;
                    default:
                        queue.enqueue(axiom);
                }
            }

            return queue;
        }

        instanceClasses = {};
        nothingClass = {
            'type': JswOWL.ExpressionTypes.ET_CLASS,
            'IRI': JswOWL.IRIs.NOTHING
        };

        rules = [
            /**
             * Checks if the given axiom is in the form P1 o P2 o ... o Pn <= P, where Pi and P are
             * object property expressions. If this is the case, transforms it into the set of
             * equivalent axioms
             *
             * P1 o P2 <= U1
             * U1 o P3 <= U2
             * ...
             * Un-2 o Pn <= P,
             *
             * where Ui are the new object properties introduced.
             *
             * @param axiom Axiom to apply the rule to.
             * @return (Object) {type: (exports.ExpressionTypes.AXIOM_OPROP_SUB|*), args: *[]}[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var lastOpropIndex, newOprop, normalized, opropChainType, opropIndex, opropType,
                    prevOprop, reqAxiomType, srcChain;

                opropChainType = JswOWL.ExpressionTypes.OPE_CHAIN;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_OPROP_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== opropChainType ||
                    axiom.args[0].args.length <= 2) {
                    return null;
                }

                opropType = JswOWL.ExpressionTypes.ET_OPROP;
                prevOprop = createEntity(opropType);
                srcChain = axiom.args[0].args;

                normalized = [
                    {
                        type: reqAxiomType,
                        args: [
                            {
                                type: opropChainType,
                                args: [srcChain[0], srcChain[1]]
                            },
                            prevOprop
                        ]
                    }
                ];

                lastOpropIndex = srcChain.length - 1;

                for (opropIndex = 2; opropIndex < lastOpropIndex; opropIndex += 1) {
                    newOprop = createEntity(opropType);
                    normalized.push({
                        type: reqAxiomType,
                        args: [
                            {
                                type: opropChainType,
                                args: [prevOprop, srcChain[opropIndex]]
                            },
                            newOprop
                        ]
                    });

                    prevOprop = newOprop;
                }

                normalized.push({
                    type: reqAxiomType,
                    args: [
                        {
                            type: opropChainType,
                            args: [prevOprop, srcChain[lastOpropIndex]]
                        },
                        axiom.args[1]
                    ]
                });

                return normalized;
            },

            /**
             * Checks if the given axiom is in the form A <= A1 n A2 n ... An., where A and Ai are
             * class expressions. If this is the case, transforms it into the set of equivalent
             * axioms
             *
             * A <= A1
             * A <= A2
             * ...
             * A <= An
             * .
             *
             * @param axiom Axiom to apply the rule to.
             * @return Array of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var exprs, exprIndex, firstArg, normalized, reqAxiomType;

                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[1].type !== JswOWL.ExpressionTypes.CE_INTERSECT) {
                    return null;
                }

                exprs = axiom.args[1].args;

                normalized = [];
                firstArg = axiom.args[0];

                for (exprIndex = exprs.length; exprIndex--;) {
                    normalized.push({
                        type: reqAxiomType,
                        args: [firstArg, exprs[exprIndex]]
                    });
                }

                return normalized;
            },

            /**
             * Checks if the given axiom is in the form C <= D, where C and D are complex class
             * expressions. If this is the case, transforms the axiom into two equivalent axioms
             *
             * C <= A
             * A <= D
             *
             * where A is a new atomic class introduced.
             *
             * @param axiom Axiom to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var classType, newClassExpr, reqAxiomType;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[0].type === classType ||
                    axiom.args[1].type === classType) {
                    return null;
                }

                newClassExpr = createEntity(classType);

                return [
                    {
                        type: reqAxiomType,
                        args: [axiom.args[0], newClassExpr]
                    },
                    {
                        type: reqAxiomType,
                        args: [newClassExpr, axiom.args[1]]
                    }
                ];
            },

            /**
             * Checks if the given axiom is in the form C1 n C2 n ... Cn <= C, where some Ci are
             * complex class expressions. If this is the case converts the axiom into the set of
             * equivalent axioms
             *
             * Ci <= Ai
             * ..
             * C1 n ... n Ai n ... Cn <= C
             *
             * where Ai are new atomic classes introduced to substitute complex class expressions
             * Ci in the original axiom.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return Array of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var args, argIndex, classExpr, classType, newClassExpr, newIntersectArgs,
                    normalized, reqAxiomType, reqExprType, ruleApplied;

                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_INTERSECT;
                classType = JswOWL.ExpressionTypes.ET_CLASS;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType) {
                    return null;
                }

// All expressions in the intersection.
                args = axiom.args[0].args;

                normalized = [];
                newIntersectArgs = [];
                ruleApplied = false;

                for (argIndex = args.length; argIndex--;) {
                    classExpr = args[argIndex];

                    if (classExpr.type !== classType) {
                        ruleApplied = true;
                        newClassExpr = createEntity(classType);

                        normalized.push({
                            type: reqAxiomType,
                            args: [classExpr, newClassExpr]
                        });

                        newIntersectArgs.push(newClassExpr);
                    } else {
                        newIntersectArgs.push(classExpr);
                    }
                }

                if (ruleApplied) {
                    normalized.push({
                        type: reqAxiomType,
                        args: [
                            {
                                type: reqExprType,
                                args: newIntersectArgs
                            },
                            axiom.args[1]
                        ]
                    });

                    return normalized;
                } else {
                    return null;
                }
            },

            /**
             * Checks if the given axiom is in the form E P.A <= B, where A is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms
             * A <= A1 and E P.A1 <= B, where A1 is a new atomic class.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var firstArg, classType, newClassExpr, newObjSomeValuesExpr, reqAxiomType,
                    reqExprType;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType ||
                    axiom.args[0].classExpr.type === classType) {
                    return null;
                }

                firstArg = axiom.args[0];

                newClassExpr = createEntity(classType);

                newObjSomeValuesExpr = {
                    'type': reqExprType,
                    'opropExpr': firstArg.opropExpr,
                    'classExpr': newClassExpr
                };

                return [
                    {
                        'type': reqAxiomType,
                        'args': [firstArg.classExpr, newClassExpr]
                    },
                    {
                        'type': reqAxiomType,
                        'args': [newObjSomeValuesExpr, axiom.args[1]]
                    }
                ];
            },

            /**
             * Checks if the given axiom is in the form A <= E P.B, where B is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms
             * B1 <= B and A <= E P.B1, where B1 is a new atomic class.
             *
             * @param axiom Axiom to try to apply the rule to.
             * @return *[] of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
                function (axiom) {
                var classType, newClassExpr, reqAxiomType, reqExprType, secondArg;

                classType = JswOWL.ExpressionTypes.ET_CLASS;
                reqAxiomType = JswOWL.ExpressionTypes.AXIOM_CLASS_SUB;
                reqExprType = JswOWL.ExpressionTypes.CE_OBJ_VALUES_FROM;

                if (axiom.type !== reqAxiomType || axiom.args[1].type !== reqExprType ||
                    axiom.args[1].classExpr.type === classType) {
                    return null;
                }

                secondArg = axiom.args[1];

                newClassExpr = createEntity(classType);

                return [
                    {
                        'type': reqAxiomType,
                        'args': [newClassExpr, secondArg.classExpr]
                    },
                    {
                        'type': reqAxiomType,
                        'args': [axiom.args[0], {
                            'type': reqExprType,
                            'opropExpr': secondArg.opropExpr,
                            'classExpr': newClassExpr
                        }]
                    }
                ];
            },

            /**
             * Checks if the given statement is an axiom of the form Nothing <= A. If this is the
             * case, removes the axiom from the knowledge base (the axiom states an obvious thing).
             *
             * @param statement Statement to try to apply the rule to.
             * @return Array of statements which are the result of applying the rule to the given
             * statement or null if the rule could not be applied.
             */
                function (statement) {
                var firstArg;

                if (statement.type !== JswOWL.ExpressionTypes.AXIOM_CLASS_SUB) {
                    return null;
                }

                firstArg = statement.args[0];

                if (firstArg.type === JswOWL.ExpressionTypes.ET_CLASS && firstArg.IRI === JswOWL.IRIs.NOTHING) {
                    return [];
                }

                return null;
            }
        ];

// MAIN ALGORITHM

// Copy all entities from the source to the destination ontology first.
        copyEntities();

        queue = createAxiomQueue();
        ruleCount = rules.length;

        while (!queue.isEmpty()) {
            axiom = queue.dequeue();

            // Trying to find a rule to apply to the axiom.
            for (ruleIndex = ruleCount; ruleIndex--;) {
                resultAxioms = rules[ruleIndex](axiom);

                if (resultAxioms !== null) {
                // If applying the rule succeeded.
                    for (axiomIndex = resultAxioms.length; axiomIndex--;) {
                        queue.enqueue(resultAxioms[axiomIndex]);
                    }

                    break;
                }
            }

            if (ruleIndex < 0) {
            // If nothing can be done to the axiom, it is returned unchanged by all rule
            // functions and the axiom is in one of the normal forms already.
                this.resultOntology.axioms.push(axiom);
            }
        }

        return this.resultOntology;
    }
};

module.exports = {
    reasoner: function(data) {
        return new BrandT(data);
    }
}

},{"./JswOWL":9,"./JswOntology":10,"./JswPairStorage":11,"./JswQueue":13,"./JswRDF":14,"./JswStopWatch":17,"./JswTrimQueryABox":19,"./JswTripleStorage":20}],9:[function(require,module,exports){
/**
 * Created by Spadon on 14/10/2014.
 */

/** Defines types of expressions the objects in OWL namespace can work with.*/
ExpressionTypes = {
  /** SubClassOf axiom. */
  AXIOM_CLASS_SUB: 0,
  /** EquivalentClasses axiom. */
  AXIOM_CLASS_EQ: 1,
  /** DisjointClasses axiom */
  AXIOM_CLASS_DISJOINT: 2,
  /** SubObjectPropertyOf axiom. */
  AXIOM_OPROP_SUB: 3,
  /** EquivalentObjectProperties axiom. */
  AXIOM_OPROP_EQ: 4,
  /** ReflexiveObjectProperty axiom */
  AXIOM_OPROP_REFL: 5,
  /** TransitiveObjectProperty axiom */
  AXIOM_OPROP_TRAN: 6,
  /** ObjectIntersectionOf class expression. */
  CE_INTERSECT: 7,
  /** ObjectSomeValuesFrom class expression. */
  CE_OBJ_VALUES_FROM: 8,
  /** Class entity. */
  ET_CLASS: 9,
  /** ObjectProperty entity. */
  ET_OPROP: 10,
  /** (Named)Individual entity. */
  ET_INDIVIDUAL: 11,
  /** ClassAssertion fact. */
  FACT_CLASS: 12,
  /** ObjectPropertyAssertion fact. */
  FACT_OPROP: 13,
  /** SameIndividual fact */
  FACT_SAME_INDIVIDUAL: 14,
  /** DifferentIndividuals fact */
  FACT_DIFFERENT_INDIVIDUALS: 15,
  /** ObjectPropertyChain object property expression. */
  OPE_CHAIN: 16
};

IRIs = {
  /** Top concept. */
  THING: 'http://www.w3.org/2002/07/owl#Thing',
  /** Bottom concept. */
  NOTHING: 'http://www.w3.org/2002/07/owl#Nothing',
  /** Top object property. */
  TOP_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#topObjectProperty',
  /** Bottom object property. */
  BOTTOM_OBJECT_PROPERTY: 'http://www.w3.org/2002/07/owl#bottomObjectProperty'
};

module.exports = {
    ExpressionTypes: ExpressionTypes,
    IRIs: IRIs
};

},{}],10:[function(require,module,exports){
/**
 * Created by Spadon on 14/10/2014.
 */

JswOWL = require('./JswOWL');
/** Ontology represents a set of statements about some domain of interest. */
Ontology = function() {
    var exprTypes = JswOWL.ExpressionTypes,
        classType = exprTypes.ET_CLASS,
        individualType = exprTypes.ET_INDIVIDUAL,
        opropType = exprTypes.ET_OPROP;

    /** Sets of entity IRIs of different types found in the ontology. */
    this.entities = {};
    this.entities[opropType] = {};
    this.entities[classType] = {};
    this.entities[individualType] = {};

    /** Contains all axioms in the ontology. */
    this.axioms = [];

    /**
     * Contains all prefixes used in abbreviated entity IRIs in the ontology.
     * By default, contains standard prefixes defined by OWL 2 Structural Specification document.
     */
    this.prefixes = {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        owl: 'http://www.w3.org/2002/07/owl#'
    };

    // Contains the numbers to be used in IRIs of next auto-generated entities.
    this.nextEntityNos = {};
    this.nextEntityNos[opropType] = 1;
    this.nextEntityNos[classType] = 1;
    this.nextEntityNos[individualType] = 1;

    // Contains number of entities of each type in the ontology.
    this.entityCount = {};
    this.entityCount[opropType] = 0;
    this.entityCount[classType] = 0;
    this.entityCount[individualType] = 0;
};

Ontology.prototype = {
    /** Types of expressions which the ontology can contain. */
    exprTypes: JswOWL.ExpressionTypes,

    /**
     * Adds the given prefix to the ontology, so that the abbreviated IRIs of entities with this
     * prefix can be expanded.
     *
     * @param prefixName Name of the prefix.
     * @param iri IRI to use in abbreviated IRI expansion involving the prefix name.
     */
    addPrefix: function (prefixName, iri) {
        if (!this.prefixes[prefixName]) {
            this.prefixes[prefixName] = iri;
        }
    },

    /**
     * Allows generating a new unique IRI for the entity of the given type.
     *
     * @param type Type of the entity to generate a new unique IRI for.
     * @return string unique IRI.
     */
    createUniqueIRI: function (type) {
        var entities,
            entityPrefix = this.getEntityAutoPrefix(type),
            nextEntityNo = this.entityCount[type] + 1,
            iri;

        entities = this.entities[type];
        iri = '';

        do {
            iri = entityPrefix + nextEntityNo;
            nextEntityNo += 1;
        } while (entities.hasOwnProperty(iri));

        return iri;
    },

    /**
     * Registers the given entity in the ontology.
     *
     * @param type Type of the entity to register.
     * @param iri IRI of the entity.
     * @param isDeclared (optional) Indicates whether the entity has just been declared in the ontology and
     * not used in axioms yet. False by default.
     */
    registerEntity: function (type, iri, isDeclared) {
        var iris = JswOWL.IRIs;

        // We don't want to register default entity IRIs.
        if (type === this.exprTypes.ET_CLASS &&
            (iri === iris.THING || iri === iris.NOTHING)) {
            return;
        }

        if (type === this.exprTypes.ET_OPROP &&
            (iri === iris.TOP_OBJECT_PROPERTY || iri === iris.BOTTOM_OBJECT_PROPERTY)) {
            return;
        }

        if (!this.entities[type].hasOwnProperty(iri)) {
            this.entityCount[type] += 1;
            this.entities[type][iri] = (isDeclared);
        } else if (!isDeclared) {
            this.entities[type][iri] = false;
        }
    },

    /**
     * Checks if the ontology contains any references to the class with the given IRI.
     *
     * @param iri IRI of the class to check.
     * @return boolean - true if the ontology has reverences to the class, false otherwise.
     * @param owlIris
     */
    containsClass: function (iri, owlIris) {
        return !!(iri === owlIris.THING || iri === owlIris.NOTHING ||
            this.entities[this.exprTypes.ET_CLASS].hasOwnProperty(iri));
    },

    /**

     * Checks if the ontology contains any references to the object property with the given IRI.
     *
     * @param iri IRI of the object property to check.
     * @return boolean if the ontology has reverences to the object property, false otherwise.
     * @param owlIris
     */
    containsObjectProperty: function (iri, owlIris) {
        return !!(iri === owlIris.TOP_OBJECT_PROPERTY ||
            iri === owlIris.BOTTOM_OBJECT_PROPERTY ||
            this.entities[this.exprTypes.ET_OPROP].hasOwnProperty(iri));
    },

    /**
     * Returns an 'associative array' of all classes in the ontology.
     *
     * @return (Array) 'Associative array' of all classes in the ontology.
     */
    getClasses: function () {
        return this.entities[this.exprTypes.ET_CLASS];
    },

    /**
     * Returns a prefix to be used in the automatically generated nams for entities of the given
     * type.
     *
     * @param type Integer specifying the type of entity to get the name prefix for.
     * @return string prefix to be used in the automatically generated nams for entities of the given
     * type.
     */
    getEntityAutoPrefix: function (type) {
        var exprTypes = this.exprTypes;

        switch (type) {
            case exprTypes.ET_CLASS:
                return 'C_';
            case exprTypes.ET_OPROP:
                return 'OP_';
            case exprTypes.ET_INDIVIDUAL:
                return 'I_';
            default:
                throw 'Unknown entity type "' + type + '"!';
        }
    },

    /**
     * Returns an 'associative array' of all object properties in the ontology.
     *
     * @return (Array) 'Associative array' of all object properties in the ontology.
     */
    getObjectProperties: function () {
        return this.entities[this.exprTypes.ET_OPROP];
    },

    /**
     * Returns an 'associative array' of all individuals in the ontology.
     *
     * @return (Array) 'Associative array' of all individuals in the ontology.
     */
    getIndividuals: function () {
        return this.entities[this.exprTypes.ET_INDIVIDUAL];
    },

    /**
     * Resolves the given prefixName and otherPart to a full IRI. Checks if the prefix with the
     * given name is defined in the ontology.
     *
     * @param prefixName Name of the prefix.
     * @param otherPart Other (non-prefix) part of the abbreviated IRI.
     * @return Full IRI resolved.
     */
    resolveAbbreviatedIRI: function (prefixName, otherPart) {
        if (!this.prefixes[prefixName]) {
            throw 'Unknown IRI prefix "' + prefixName + '!"';
        }

        return this.prefixes[prefixName] + otherPart;
    }
};

module.exports = {
    ontology: function() {
        return new Ontology();
    }
};

},{"./JswOWL":9}],11:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */

/** Pair storage can be used to hash 2-tuples by the values in them in some order. */
PairStorage = function () {
    /** Data structure holding all pairs. */
    this.storage = {};
};

/** Prototype for all jsw.util.PairStorage objects. */
PairStorage.prototype = {
    /**
     * Adds a new tuple to the storage.
     *
     * @param first Value of the first element of the tuple.
     * @param second Value for the second element of the tuple.
     */
    add: function (first, second) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }

        storage[first][second] = true;
    },

    /**
     * Removes part of the relation specified by the arguments.
     *
     * @param first First value in the pairs to remove.
     * @param second (optional) Second value in the pairs to remove.
     */
    remove: function (first, second) {
        var firstPairs = this.storage[first];

        if (!firstPairs) {
            return;
        }

        if (second) {
            delete firstPairs[second];
        } else {
            delete this.storage[first];
        }
    },

    /**
     * Checks if the tuple with the given values exists within the storage.
     *
     * @param first First value in the pair.
     * @param second Second value in the pair.
     * @return boolean if the tuple with the given value exists, false otherwise.
     */
    exists: function (first, second) {
        var firstPairs = this.storage[first];

        if (!firstPairs) {
            return false;
        }

        return firstPairs[second] || false;
    },

    /**
     * Checks if tuples with the given first value and all of the given second values exist within
     * the storage.
     *
     * @param first First value in the tuple.
     * @param second Array containing the values for second element in the tuple.
     * @return boolean true if the storage contains all the tuples, false otherwise.
     */
    existAll: function (first, second) {
        var secondPairs, secondValue;

        if (!second) {
            return true;
        }

        secondPairs = this.storage[first];

        if (!secondPairs) {
            return false;
        }

        for (secondValue in second) {
            if (!secondPairs[secondValue]) {
// Some entity from subsumers array is not a subsumer.
                return false;
            }
        }

        return true;
    },

    /**
     * Returns an object which can be used to access all pairs in the storage with (optionally)
     * the fixed value of the first element in all pairs.
     *
     * @param first (optional) The value of the first element of all pairs to be returned.
     * @return Object which can be used to access all pairs in the storage.
     */
    get: function (first) {
        if (!first) {
            return this.storage;
        }

        return this.storage[first] || {};
    }
};

module.exports = {
    pairStorage: PairStorage
};

},{}],12:[function(require,module,exports){
/**
 * Created by Spadon on 14/10/2014.
 */

JswOWL = require('./JswOWL');
JswOntology = require('./JswOntology');
JswUtils = require('./JswUtils');
TextFile = require('./JswTextFile');

JswParser = {

    /**
     * Parses the given OWL/XML string into the Ontology object.
     * @param owlXml String containing OWL/XML to be parsed.
     * @param onError Function to be called in case if the parsing error occurs.
     * @return Ontology object representing the ontology parsed.
     */
    parse: function (owlXml, onError) {
        var exprTypes = JswOWL.ExpressionTypes, // Cash reference to the constants.
            node,                               // Will hold the current node being parsed.
            ontology = JswOntology.ontology(),             // The ontology to be returned.
            statements = ontology.axioms;       // Will contain all statements.

        /**
         * Parses XML element representing some entity into the object. Throws an exception if the
         * name of the given element is not equal to typeName.
         * @param type Type of the entity represented by the XML element.
         * @param typeName Name of the OWL/XML element which corresponds to the given entity type.
         * @param element XML element representing some entity.
         * @param isDeclared (optional) Indicates whether the entity has been just declared in the ontology.
         * False by default.
         * @return Object representing the entity parsed.
         */
        function parseEntity(type, typeName, element, isDeclared) {
            var abbrIri, colonPos, entity, iri;

            if (element.nodeName !== typeName) {
                throw typeName + ' element expected, but not found!';
            }

            abbrIri = element.getAttribute('abbreviatedIRI');
            iri = element.getAttribute('IRI');

            // If both attributes or neither are defined on the entity, it is an error.

            if ((!iri && !abbrIri) || (iri && abbrIri)) {
                throw 'Exactly one of IRI or abbreviatedIRI attribute must be present in ' +
                    element.nodeName + ' element!';
            }

            if (!abbrIri) {
                entity = {
                    'type': type,
                    'IRI': iri
                };
            } else {
                colonPos = abbrIri.indexOf(':');

                if (colonPos < 0) {
                    throw 'Abbreviated IRI "' + abbrIri + '" does not contain a prefix name!';
                }

                if (colonPos === abbrIri.length - 1) {
                    throw 'Abbreviated IRI "' + abbrIri + '" does not contain anything after ' +
                        'the prefix!';
                }

                iri = ontology.resolveAbbreviatedIRI(
                    abbrIri.substring(0, colonPos),
                    abbrIri.substring(colonPos + 1)
                );

                // Store information about abbreviated entity IRI, so that it can be used when
                // writing the ontology back in OWL/XML.
                entity = {
                    'type': type,
                    'IRI': iri,
                    'abbrIRI': abbrIri
                };
            }

            ontology.registerEntity(type, iri, isDeclared);
            return entity;
        }

        /**
         * Parses XML element representing class intersection expression.
         * @param element XML element representing class intersection expression.
         * @return Object representing the class intersection expression.
         */
        function parseObjIntersectExpr(element) {
            var classExprs = [],
                node = element.firstChild;

            while (node) {
                if (node.nodeType === 1) {
                    classExprs.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }

            return {
                'type': exprTypes.CE_INTERSECT,
                'args': classExprs
            };
        }

        /**
         * Parses XML element representing ObjectSomeValuesFrom expression.
         * @param element XML element representing the ObjectSomeValuesFrom expression.
         * @return Object representing the expression parsed.
         */
        function parseSomeValuesFromExpr(element) {
            var oprop, classExpr, node;

            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!oprop) {
                    oprop = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                } else if (!classExpr) {
                    classExpr = parseClassExpr(node);
                } else {
                    throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
                }

                node = node.nextSibling;
            }

            if (!oprop || !classExpr) {
                throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
            }

            return {
                'type': exprTypes.CE_OBJ_VALUES_FROM,
                'opropExpr': oprop,
                'classExpr': classExpr

            };
        }

        /**
         * Parses the given XML node into the class expression.
         * @param element XML node containing class expression to parse.
         * @return Object representing the class expression parsed.
         */
        function parseClassExpr(element) {
            switch (element.nodeName) {
                case 'ObjectIntersectionOf':
                    return parseObjIntersectExpr(element);
                case 'ObjectSomeValuesFrom':
                    return parseSomeValuesFromExpr(element);
                default:
                    return parseEntity(exprTypes.ET_CLASS, 'Class', element, false);
            }
        }

        /**
         * Parses an XML element representing the object property chain into the object.
         * @param element Element representing an object property chain.
         * @return Object representing the object property chain parsed.
         */
        function parseOpropChain(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;

            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node, false));
                }

                node = node.nextSibling;
            }

            if (args.length < 2) {
                throw 'The object property chain should contain at least 2 object properties!';
            }

            return {
                'type': exprTypes.OPE_CHAIN,
                'args': args
            };
        }

        /**
         * Parses XML element representing SubObjectPropertyOf axiom into the object.
         * @param element OWL/XML element representing SubObjectPropertyOf axiom.
         */
        function parseSubOpropAxiom(element) {
            var firstArg, secondArg, node, opropType;

            opropType = exprTypes.ET_OPROP;
            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!firstArg) {
                    if (node.nodeName === 'ObjectPropertyChain') {
                        firstArg = parseOpropChain(node);
                    } else {
                        firstArg = parseEntity(opropType, 'ObjectProperty', node, false);
                    }
                } else if (!secondArg) {
                    secondArg = parseEntity(opropType, 'ObjectProperty', node, false);
                } else {
                    throw 'The format of SubObjectPropertyOf axiom is incorrect!';
                }

                node = node.nextSibling;
            }

            if (!firstArg || !secondArg) {
                throw 'The format of SubObjectPropertyOf axiom is incorrect!';
            }

            statements.push({
                'type': exprTypes.AXIOM_OPROP_SUB,
                'args': [firstArg, secondArg]
            });
        }

        /**
         * Parse XML element representing a class axiom into the object.
         * @param type Type of the class axiom to parse.
         * @param element XML element representing the class axiom to parse.
         * @param minExprCount Minimum number of times the class expressions should occur in the
         * axiom.
         * @param maxExprCount Maximum number of times the class expressions should occur in the
         * axiom.
         */
        function parseClassAxiom(type, element, minExprCount, maxExprCount) {
            var args = [],
                node = element.firstChild;


            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }

            if (!isNaN(minExprCount) && args.length < minExprCount) {
                throw 'Class axiom contains less than ' + minExprCount + ' class expressions!';
            }

            if (!isNaN(maxExprCount) && args.length > maxExprCount) {
                throw 'Class axiom contains more than ' + maxExprCount + ' class expressions!';
            }

            statements.push({
                'type': type,
                'args': args
            });
        }

        /**
         * Parses EquivalentObjectProperties XML element into the corresponding object.
         * @param element OWL/XML element representing the EquivalentObjectProperties axiom.
         */
        function parseEqOpropAxiom(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;

            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node, false));
                }

                node = node.nextSibling;
            }

            if (args.length < 2) {
                throw 'EquivalentObjectProperties axiom contains less than 2 child elements!';
            }

            statements.push({
                'type': exprTypes.AXIOM_OPROP_EQ,
                'args': args
            });
        }

        /**
         * Parses the given XML element into the object property axiom of the given type.
         * @param type Type of an object property axiom represented by the element.
         * @param element XML element to parse into the axiom object.
         */
        function parseOpropAxiom(type, element) {
            var node = element.firstChild,
                oprop;

            while (node) {
                if (node.nodeType === 1) {
                    if (!oprop) {
                        oprop = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                    } else {
                        throw 'Unexpected element ' + node.nodeName + ' found inside the object ' +
                            'property axiom element!';
                    }
                }

                node = node.nextSibling;
            }

            if (!oprop) {
                throw 'Object property axiom does not contain an argument!';
            }

            statements.push({
                'type': type,
                'objectProperty': oprop
            });
        }

        /**
         * Parses Declaration OWL/XML element into the corresponding entity object within the
         * ontology.
         * @param element OWL/XML Declaration element to parse.
         */
        function parseDeclaration(element) {
            var found = false,
                node = element.firstChild,
                nodeName;

            // This will not detect (and report) declarations of other entity types. On purpose.
            while (node) {
                if (node.nodeType === 1) {
                    nodeName = node.nodeName;

                    if (found) {
                        throw 'Unexpected element "' + nodeName + '" found in Declaration element!';
                    }

                    switch (nodeName) {
                        case 'Class':
                            parseEntity(exprTypes.ET_CLASS, 'Class', node, true);
                            found = true;
                            break;
                        case 'ObjectProperty':
                            parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, true);
                            found = true;
                            break;
                        case 'NamedIndividual':
                            parseEntity(exprTypes.ET_INDIVIDUAL, 'NamedIndividual', node, true);
                            found = true;
                            break;
                    }
                }

                node = node.nextSibling;
            }
        }

        /**
         * Parses ClassAssertion XML element into the corresponding object.
         * @param element OWL/XML ClassAssertion element.
         */
        function parseClassAssertion(element) {
            var classExpr, individual, node;

            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!classExpr) {
                    classExpr = parseClassExpr(node);
                } else if (!individual) {
                    individual = parseEntity(exprTypes.ET_INDIVIDUAL, 'NamedIndividual', node, false);
                } else {
                    throw 'Incorrect format of the ClassAssertion element!';
                }

                node = node.nextSibling;
            }

            if (!classExpr || !individual) {
                throw 'Incorrect format of the ClassAssertion element!';
            }

            statements.push({
                'type': exprTypes.FACT_CLASS,
                'individual': individual,
                'classExpr': classExpr
            });
        }

        /**
         * Parses ObjectPropertyAssertion OWL/XML element into the corresponding object.
         *
         * @param element OWL/XML ObjectPropertyAssertion element to parse.
         */
        function parseObjectPropertyAssertion(element) {
            var individualType, leftIndividual, node, objectProperty, rightIndividual;

            individualType = exprTypes.ET_INDIVIDUAL;
            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!objectProperty) {
                    objectProperty = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node, false);
                } else if (!leftIndividual) {
                    leftIndividual = parseEntity(individualType, 'NamedIndividual', node, false);
                } else if (!rightIndividual) {
                    rightIndividual = parseEntity(individualType, 'NamedIndividual', node, false);
                } else {
                    throw 'Incorrect format of the ObjectPropertyAssertion element!';
                }

                node = node.nextSibling;
            }

            if (!objectProperty || !leftIndividual || !rightIndividual) {
                throw 'Incorrect format of the ObjectPropertyAssertion element!';
            }

            statements.push({
                'type': exprTypes.FACT_OPROP,
                'leftIndividual': leftIndividual,
                'objectProperty': objectProperty,
                'rightIndividual': rightIndividual
            });
        }

        /**
         * Parses OWL/XML element representing an assertion about individuals into the corresponding
         * object.
         * @param element OWL/XML element to parse.
         * @param type
         */
        function parseIndividualAssertion(element, type) {
            var individuals, individualType, node;

            individualType = exprTypes.ET_INDIVIDUAL;
            node = element.firstChild;
            individuals = [];

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                individuals.push(parseEntity(individualType, 'NamedIndividual', node, false));
                node = node.nextSibling;
            }

            if (individuals.length < 2) {
                throw 'Incorrect format of the ' + element.nodeName + ' element!';
            }

            statements.push({
                'type': type,
                'individuals': individuals
            });
        }

        /**
         * Parses the given OWL/XML Prefix element and adds the information about this prefix to the
         * ontology.
         * @param element OWL/XML Prefix element.
         */
        function parsePrefixDefinition(element) {
            var prefixName = element.getAttribute('name'),
                prefixIri = element.getAttribute('IRI');

            if (prefixName === null || !prefixIri) {
                throw 'Incorrect format of Prefix element!';
            }

            ontology.addPrefix(prefixName, prefixIri);
        }

        node = JswUtils.parseString(owlXml).documentElement.firstChild;

        // OWL/XML Prefix statements (if any) should be at the start of the document. We need them
        // to expand abbreviated entity IRIs.
        while (node) {
            if (node.nodeType === 1) {
                if (node.nodeName === 'Prefix') {
                    parsePrefixDefinition(node);
                } else {
                    break;
                }
            }

            node = node.nextSibling;
        }

        // Axioms / facts (if any) follow next.
        while (node) {
            if (node.nodeType !== 1) {
                node = node.nextSibling;
                continue;
            }

            try {
                switch (node.nodeName) {
                    case 'Declaration':
                        parseDeclaration(node);
                        break;
                    case 'SubClassOf':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_SUB, node, 2, 2);
                        break;
                    case 'EquivalentClasses':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_EQ, node, 2);
                        break;
                    case 'DisjointClasses':
                        parseClassAxiom(exprTypes.AXIOM_CLASS_DISJOINT, node, 2);
                        break;
                    case 'SubObjectPropertyOf':
                        parseSubOpropAxiom(node);
                        break;
                    case 'EquivalentObjectProperties':
                        parseEqOpropAxiom(node);
                        break;
                    case 'ReflexiveObjectProperty':
                        parseOpropAxiom(exprTypes.AXIOM_OPROP_REFL, node);
                        break;
                    case 'TransitiveObjectProperty':
                        parseOpropAxiom(exprTypes.AXIOM_OPROP_TRAN, node);
                        break;
                    case 'ClassAssertion':
                        parseClassAssertion(node);
                        break;
                    case 'ObjectPropertyAssertion':
                        parseObjectPropertyAssertion(node);
                        break;
                    case 'SameIndividual':
                        parseIndividualAssertion(node, exprTypes.FACT_SAME_INDIVIDUAL);
                        break;
                    case 'DifferentIndividuals':
                        parseIndividualAssertion(node, exprTypes.FACT_DIFFERENT_INDIVIDUALS);
                        break;
                    case 'Prefix':
                        throw 'Prefix elements should be at the start of the document!';
                }
            } catch (ex) {
                if (!onError || !onError(ex)) {
                    throw ex;
                }
            }

            node = node.nextSibling;
        }

        return ontology;
    },

    /**
     * Parses the OWL/XML ontology located at the given url.
     * @param url URL of the OWL/XML ontology to be parsed.
     * @param onError Function to be called in case if the parsing error occurs.
     * @return Ontology object representing the ontology parsed.
     */
    parseUrl: function (url, onError) {
        var newUrl = JswUtils.trim(url),
            owlXml;

        if (!JswUtils.isUrl(newUrl)) {
            throw '"' + url + '" is not a valid URL!';
        }

        owlXml = new TextFile(url).getText();
        return this.parse(owlXml, onError);
    }

};

module.exports = JswParser;

},{"./JswOWL":9,"./JswOntology":10,"./JswTextFile":18,"./JswUtils":21}],13:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */

/** Represents a queue implementing FIFO mechanism. */
Queue = function () {
    this.queue = [];
    this.emptyElements = 0;
};

/** Prototype for all jsw.util.Queue objects. */
Queue.prototype = {
    /**
     * Checks if the queue has no objects.
     *
     * @return (boolean) True if there are no objects in the queue, fale otherwise.
     */
    isEmpty: function () {
        return this.queue.length === 0;
    },

    /**
     * Adds an object to the queue.
     *
     * @param obj Object to add to the queue.
     */
    enqueue: function (obj) {
        this.queue.push(obj);
    },

    /**
     * Removes the oldest object from the queue and returns it.
     *
     * @return The oldest object in the queue.
     */
    dequeue: function () {
        var element,
            emptyElements = this.emptyElements,
            queue = this.queue,
            queueLength = queue.length;

        if (queueLength === 0) {
            return null;
        }

        element = queue[emptyElements];
        emptyElements += 1;

        // If the queue has more than a half empty elements, shrink it.
        if (emptyElements << 1 >= queueLength - 1) {
            this.queue = queue.slice(emptyElements);
            this.emptyElements = 0;
        } else {
            this.emptyElements = emptyElements;
        }

        return element;
    }
};

module.exports = {
    queue: Queue
};


},{}],14:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */

JswRDF = {

    ExpressionTypes: {
        VAR: 0,
        LITERAL: 1,
        IRI_REF: 2
    },

    IRIs: {
        /** IRI by which the type concept is referred to in RDF. */
        TYPE: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',

        //AJOUT Lionel
        /** IRI of the OWL class subsumption property */
        SUBCLASS: 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
    }
};

module.exports = JswRDF;

},{}],15:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */
RDFQuery = function() {
    /** Represents a query to the RDF data. */
    var rdfQuery = function () {
        /** IRI to serve as a base of all IRI references in the query. */
        this.baseIri = null;
        /** Indicates that all non-unique matches should be eliminated from the results. */
        this.distinctResults = false;
        /** Number of results the query should return. */
        this.limit = 0;
        /** The number of a record to start returning results from. */
        this.offset = 0;
        /** Array of values to sort the query results by. */
        this.orderBy = [];
        /** An array containing all prefix definitions for the query. */
        this.prefixes = [];
        /** Indicates if some of the non-unique matches can be eliminated from the results. */
        this.reducedResults = false;
        /** An array of RDF triples which need to be matched. */
        this.triples = [];

        /**
         * Array containing the names of variables to return as a result of a query run. If the array is
         * empty, all variables in the query need to be returned.
         */
        this.variables = [];
    };

    /** Prototype for all jsw.rdf.Query objects. */
    rdfQuery.prototype = {
        /** Defines constants by which different expressions can be distinguished in the query. */
        ExpressionTypes: {
            VAR: 0,
            LITERAL: 1,
            IRI_REF: 2
        },

        /**
         * Adds the given prefix to the query. Throws an error if the prefix with the given name but
         * different IRI has been defined already.
         *
         * @param prefixName Name of the prefix to add.
         * @param iri IRI associated with the prefix.
         */
        addPrefix: function (prefixName, iri) {
            var existingIri = this.getPrefixIri(prefixName);

            if (existingIri === null) {
                this.prefixes.push({
                    'prefixName': prefixName,
                    'iri': iri
                });
            } else if (iri !== existingIri) {
                throw 'The prefix "' + prefixName + '" has been defined already in the query!';
            }
        },

        /**
         * Adds an RDF triple which needs to be matched to the query.
         */
        addTriple: function (subject, predicate, object) {
            this.triples.push({
                'subject': subject,
                'predicate': predicate,
                'object': object
            });
        },

        /**
         * Returns IRI for the prefix with the given name in the query.
         *
         * @param prefixName Name of the prefix.
         * @return IRI associated with the given prefix name in the query or null if no prefix with the
         * given name is defined.
         */
        getPrefixIri: function (prefixName) {
            var prefix,
                prefixes = this.prefixes,
                prefixIndex;

            for (prefixIndex = prefixes.length; prefixIndex--;) {
                prefix = prefixes[prefixIndex];

                if (prefix.prefixName === prefixName) {
                    return prefix.iri.value;
                }
            }

            return null;
        }
    };

    return rdfQuery;
};

module.exports = {
    rdfQuery: function() {
        return new RDFQuery();
    }
};

},{}],16:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */
JswXSD = require('./JswXSD');
JswRDFQuery = require('./JswRDFQuery');
xsd = new JswXSD.xsd();
rdfQuery = new JswRDFQuery.rdfQuery();

SPARQL = {
// ============================= SPARQL namespace =============================
/**
 * An object which can be used to work with SPARQL queries.
 *
 * The features currently not supported by the parser:
 * - Proper relative IRI resolution;
 * - Blank Nodes;
 * - Comments;
 * - Nested Graph Patterns;
 * - FILTER expressions;
 * - ORDER BY: expressions other than variables;
 * - RDF Collections;
 * - OPTIONAL patterns;
 * - UNION of patterns;
 * - FROM clause (and, hence, GRAPH clause and named graphs).
 */
    /** Defines data types of literals which can be parsed */
    DataTypes: xsd.DataTypes,
    /** Defines types of expressions which can be parsed */
    ExpressionTypes: rdfQuery.prototype.ExpressionTypes,

    /** Regular expression for SPARQL absolute IRI references. */
    absoluteIriRegExp: null,
//AJOUT Lionel
    /** Regular expression for SPARQL local IRI references. */
    localIriRegExp: null,
    /** Regular expression for SPARQL boolean literals. */
    boolRegExp: null,
    /** Regular expression for SPARQL decimal literals. */
    decimalRegExp: null,
    /** Regular expression for SPARQL double literals. */
    doubleRegExp: null,
    /** Regular expression for SPARQL integer literals. */
    intRegExp: null,
    /** Regular expression for SPARQL IRI references. */
    iriRegExp: null,
    /** Regular expression representing one of the values in the ORDER BY clause. */
    orderByValueRegExp: null,
    /** Regular expression for SPARQL prefixed names. */
    prefixedNameRegExp: null,
    /** Regular expression for SPARQL prefix name. */
    prefixRegExp: null,
    /** Regular expression for RDF literals. */
    rdfLiteralRegExp: null,
    /** Regular expression for SPARQL variables. */
    varRegExp: null,

    /**
     * Expands the given prefixed name into the IRI reference.
     *
     * @param prefix Prefix part of the name.
     * @param localName Local part of the name.
     * @return IRI reference represented by the given prefix name.
     * @param query
     */
    expandPrefixedName: function (prefix, localName, query) {

        var iri;

        if (!prefix && !localName) {
            throw 'Can not expand the given prefixed name, since both prefix and local name are ' +
                'empty!';
        }

        prefix = prefix || '';
        localName = localName || '';

        iri = query.getPrefixIri(prefix);

        if (iri === null) {
            throw 'Prefix "' + prefix + '" has not been defined in the query!';
        }

        return iri + localName;
    },

    /** Initializes regular expressions used by parser. */
    init: function () {
        var pnCharsBase = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D" +
                "\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF" +
                "\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u10000-\\uEFFFF",
            pnCharsU = pnCharsBase + "_",
            pnChars = pnCharsU + "0-9\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040",
            pnNameNs = "([" + pnCharsBase + "][" + pnChars + ".]*[" + pnChars + "])?:",
            pnLocal = "([" + pnCharsU + "0-9](?:[" + pnChars + ".]*[" + pnChars + "])?)?",
            varRegExp = "[?$][" + pnCharsU + "0-9][" + pnCharsU + "0-9\\u00B7\\u0300-\\u036F" +
                "\\u203F-\\u2040]*",
        //CHANGEMENT Lionel
        //Bug in \\[tbnrf\\\"'] -> not interpreted in JS as [\t\b\n...]
        //Added an echar variable (as in the spec) and used it in the string variable
            echar = "[\\t\\b\\n\\r\\f\\\\\\" + '"' + "\\']",
            string = "'((?:[^\\x27\\x5C\\xA\\xD]|" + echar + ")*)'|" +
                '"((?:[^\\x22\\x5C\\xA\\xD]|' + echar + ')*)"|' +
                '"""((?:(?:"|"")?(?:[^"\\]|' + echar + '))*)"""|' +
                "'''((?:(?:'|'')?(?:[^'\\]|" + echar + "))*)'''",
        //Ancien code
        //string = "'((?:[^\\x27\\x5C\\xA\\xD]|\\[tbnrf\\\"'])*)'|" +
        //'"((?:[^\\x22\\x5C\\xA\\xD]|\\[tbnrf\\"\'])*)"|' +
        //'"""((?:(?:"|"")?(?:[^"\\]|\\[tbnrf\\"\']))*)"""|' +
        //"'''((?:(?:'|'')?(?:[^'\\]|\\[tbnrf\\\"']))*)'''",
            iriRef = '<[^<>"{}|^`\\][\\x00-\\x20]*>',
            prefixedName = pnNameNs + pnLocal,
            exponent = '[eE][+-]?[0-9]+';

        this.absoluteIriRegExp = /^<\w*:\/\//; // TODO: This is not precise.
        //AJOUT Lionel
        this.localIriRegExp = /^<#.*>$/; // TODO: This is not precise.
        this.boolRegExp = /^true$|^false$/i;
        this.intRegExp = /^(?:\+|-)?[0-9]+$/;
        this.decimalRegExp = /^(?:\+|-)?(?:[0-9]+\.[0-9]*|\.[0-9]+)$/;
        this.doubleRegExp = new RegExp('^(?:\\+|-)?(?:[0-9]+\\.[0-9]*' + exponent + '|\\.[0-9]+' +
            exponent + '|[0-9]+' + exponent + ')$');
        this.iriRegExp = new RegExp('^' + iriRef + '$');
        this.orderByValueRegExp = new RegExp('^(ASC|DESC)\\((' + varRegExp + ')\\)$|^' + varRegExp +
            '$', "i");
        this.prefixRegExp = new RegExp("^" + pnNameNs + "$");
        this.prefixedNameRegExp = new RegExp("^" + prefixedName + "$");
        this.rdfLiteralRegExp = new RegExp('^(?:' + string + ')(?:@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*)|' +
            '\\^\\^(' + iriRef + ')|\\^\\^' + prefixedName + ')?$');
        this.varRegExp = new RegExp('^' + varRegExp + '$');
    },

    /**
     * Parses the given SPARQL string into the query.
     *
     * @param queryTxt SPARQL string to parse into the query.
     * @return rdfQuery object representing the query parsed.
     */
    parse: function (queryTxt) {
        var iri, object, predicate, prefix, query, subject, token, tokens, tokenCount,
            tokenIndex, valueToRead, variable, vars;

        if (!queryTxt) {
            throw 'The query text is not specified!';
        }

        query = new rdfQuery();
        tokens = queryTxt.split(/\s+/);
        tokenCount = tokens.length;
        tokenIndex = 0;

        if (tokens[tokenIndex].toUpperCase() === 'BASE') {
            tokenIndex += 1;

            query.baseIri = this.parseAbsoluteIri(tokens[tokenIndex]);

            if (query.baseIri === null) {
                throw 'BASE statement does not contain a valid IRI reference!';
            }

            tokenIndex += 1;
        }

// Read all PREFIX statements...
        while (tokenIndex < tokenCount) {
            token = tokens[tokenIndex];

            if (token.toUpperCase() !== 'PREFIX') {
                break;
            }

            tokenIndex += 1;

            if (tokenIndex === tokenCount) {
                throw 'Prefix name expected, but end of the query text found!';
            }

            prefix = this.parsePrefixName(tokens[tokenIndex]);

            if (prefix === null) {
                throw 'Token "' + token + '" does not represent a valid IRI prefix!';
            }

            tokenIndex += 1;

            if (tokenIndex === tokenCount) {
                throw 'Prefix IRI expected, but end of the query text found!';
            }

            iri = this.parseIriRef(tokens[tokenIndex], query);

            if (iri === null) {
                throw 'Incorrect format of the IRI encountered!';
            }

            query.addPrefix(prefix, iri);

            tokenIndex += 1;
        }

// Parse SELECT clause.
        if (tokenIndex === tokenCount) {
            return query;
        } else if (token.toUpperCase() !== 'SELECT') {
            throw 'SELECT statement expected, but "' + token + '" was found!';
        }

        tokenIndex += 1;

        if (tokenIndex === tokenCount) {
            throw 'DISTINCT/REDUCED or variable declaration expected after "SELECT", but the end ' +
                'of query text was found!';
        }

        token = tokens[tokenIndex].toUpperCase();

        if (token === 'DISTINCT') {
            query.distinctResults = true;
            tokenIndex += 1;
        } else if (token === 'REDUCED') {
            query.reducedResults = true;
            tokenIndex += 1;
        }

        if (tokenIndex === tokenCount) {
            throw 'Variable declarations are expected after DISTINCT/REDUCED, but the end of ' +
                'the query text was found!';
        }

        token = tokens[tokenIndex];

        if (token === '*') {
            tokenIndex += 1;

            token = tokens[tokenIndex];
        } else {
            vars = [];

// Parse SELECT variables.
            while (tokenIndex < tokenCount) {
                token = tokens[tokenIndex];

                if (token.toUpperCase() === 'WHERE' || token === '{') {
                    break;
                }

                variable = this.parseVar(token);

                if (variable) {
                    vars.push(variable);
                } else {
                    throw 'The token "' + token + '" does not represent the valid variable!';
                }

                tokenIndex += 1;
            }

            if (vars.length === 0) {
                throw 'No variable definitions found in the SELECT clause!';
            }

            query.variables = vars;
        }

        if (tokenIndex === tokenCount) {
            return query;
        } else if (token.toUpperCase() === 'WHERE') {
            if (tokens[tokenIndex + 1] === '{') {
                tokenIndex += 2; // Skip to the next token after '{'.
            } else {
                throw 'WHERE clause should be surrounded with "{}"!';
            }
        } else if (token === '{') {
            tokenIndex += 1;
        } else {
            throw 'WHERE clause was expected, but "' + token + '" was found!';
        }

// Parsing WHERE clause.
        valueToRead = 0;

        while (tokenIndex < tokenCount) {
// TODO: Add parsing filters.
            token = tokens[tokenIndex];

            if (token === '}') {
                if (valueToRead === 0) {
                    break;
                } else {
                    throw 'RDF triple is not complete but the end of WHERE clause was found!';
                }
            }

            if (valueToRead === 0) {
                subject = this.parseVarOrTerm(token, query);

                if (subject === null) {
                    throw 'Subject variable or term was expected but "' + token + '" was found!';
                }

                tokenIndex += 1;
                valueToRead += 1;

                if (tokenIndex === tokenCount) {
                    throw 'Predicate of the RDF triple expected, reached the end of text instead!';
                }
            } else if (valueToRead === 1) {
                predicate = this.parseVerb(token, query);

                if (predicate === null) {
                    throw 'Predicate verb was expected but "' + token + '" was found!';
                }

                tokenIndex += 1;
                valueToRead += 1;

                if (tokenIndex === tokenCount) {
                    throw 'Object of the RDF triple expected, reached the end of text instead!';
                }
            } else if (valueToRead === 2) {
                object = this.parseVarOrTerm(token, query);

                if (object === null) {
                    throw 'Object variable or term was expected but "' + token + '" was found!';
                }

                query.addTriple(subject, predicate, object);

                valueToRead = 0;
                tokenIndex += 1;

                switch (tokens[tokenIndex]) {
                    case '.':
                        valueToRead = 0;
                        tokenIndex += 1;
                        break;
                    case ';':
                        valueToRead = 1;
                        tokenIndex += 1;
                        break;
                    case ',':
                        valueToRead = 2;
                        tokenIndex += 1;
                        break;
                }
            }
        }

        if (tokenIndex === tokenCount) {
            throw '"}" expected but the end of query text found!';
        }

        tokenIndex += 1;

        if (tokenIndex === tokenCount) {
            return query;
        }

        if (tokens[tokenIndex].toUpperCase() === 'ORDER') {
            tokenIndex += 1;

            token = tokens[tokenIndex];


            if (token.toUpperCase() !== 'BY') {
                throw '"BY" expected after "ORDER", but "' + token + '" was found!';
            }

            tokenIndex += 1;

            while (tokenIndex < tokenCount) {
                token = tokens[tokenIndex];

                if (token.toUpperCase() === 'LIMIT' || token.toUpperCase() === 'OFFSET') {
                    break;
                }

                variable = this.parseOrderByValue(token);

                if (variable === null) {
                    throw 'Unknown token "' + token + '" was found in the ORDER BY clause!';
                }

                query.orderBy.push(variable);
                tokenIndex += 1;
            }
        }

        while (tokenIndex < tokenCount) {
            token = tokens[tokenIndex].toUpperCase();

// Parse LIMIT clause.
            if (token === 'LIMIT') {
                tokenIndex += 1;

                if (tokenIndex === tokenCount) {
                    throw 'Integer expected after "LIMIT", but the end of query text found!';
                }

                token = tokens[tokenIndex];
                query.limit = parseInt(token, 10);

                if (isNaN(query.limit)) {
                    throw 'Integer expected after "LIMIT", but "' + token + '" found!';
                }

                tokenIndex += 1;
            } else if (token === 'OFFSET') {
// Parse OFFSET clause.
                tokenIndex += 1;

                if (tokenIndex === tokenCount) {
                    throw 'Integer expected after "OFFSET", but the end of query text found!';
                }

                token = tokens[tokenIndex];
                query.offset = parseInt(token, 10);

                if (isNaN(query.offset)) {
                    throw 'Integer expected after "OFFSET", but "' + token + '" found!';
                }

                tokenIndex += 1;
            } else {
                throw 'Unexpected token "' + token + '" found!';
            }
        }

        return query;
    },

    /**
     * Parses the given string into the absolute IRI.
     *
     * @param token String containing the IRI.
     * @return Absolute IRI parsed from the string or null if the given string does not represent
     * an absolute IRI.
     */
    parseAbsoluteIri: function (token) {
        if (!this.iriRegExp) {
            this.init();
        }

        if (this.iriRegExp.test(token) && this.absoluteIriRegExp.test(token)) {
            return token.substring(1, token.length - 1);
        } else {
            return null;
        }
    },

    /**
     * Parses the given string into the object representing an IRI.
     *
     * @param token String containing the IRI.
     * @param baseIri IRI to use for resolving relative IRIs.
     * @return Object representing the IRI parsed or null if the given string does not represent an
     * IRI.
     */
    parseIriRef: function (token, baseIri) {
        var iriRef;

        if (!this.iriRegExp) {
            this.init();
        }

        if (!this.iriRegExp.test(token)) {
            return null;
        }

//CHANGEMENT Lionel : bug qui faisait qu'une IRI avec namespace était considérée comme une absolute IRI


        if (this.absoluteIriRegExp.test(token)) {
            iriRef = token.substring(1, token.length - 1);
        } else if (!!baseIri && this.localIriRegExp.test(token)) {
// TODO: This is very basic resolution!
            iriRef = baseIri + token.substring(1, token.length - 1);
        } else if (this.localIriRegExp.test(token)) { // Shouldn't do that without baseIri...
            iriRef = token.substring(1, token.length - 1);
        } else {
            return null;
        }

//ANCIEN CODE :
        /*
         if (!baseIri || this.absoluteIriRegExp.test(token)) {
         iriRef = token.substring(1, token.length - 1);
         } else {
         // TODO: This is very basic resolution!
         iriRef = baseIri + token.substring(1, token.length - 1);
         }
         */

        return {
            'type': this.ExpressionTypes.IRI_REF,
            'value': iriRef
        };
    },

    /**
     * Parses the given string into a literal.
     *
     * @param token String containing the literal.
     * @return (Object) {type: (exports.ExpressionTypes.LITERAL|*|rdfQuery.ExpressionTypes.LITERAL), value: *, lang: (*|null), dataType: null} parsed from the string or null if the token does not represent a valid
     * literal.
     * @param query
     */
    parseLiteral: function (token, query) {
        var dataTypeIri, localName, matches, matchIndex, prefix, value;

        if (!this.rdfLiteralRegExp) {
            this.init();
        }

        matches = token.match(this.rdfLiteralRegExp);

        if (matches) {
            for (matchIndex = 1; matchIndex <= 4; matchIndex += 1) {
                value = matches[matchIndex];

                if (value) {
                    break;
                }
            }

            dataTypeIri = matches[6] || null;

            if (!dataTypeIri) {
                prefix = matches[7] || '';
                localName = matches[8] || '';

                if (prefix !== '' || localName !== '') {
                    dataTypeIri = this.expandPrefixedName(prefix, localName, query);
                } else {
                    dataTypeIri = this.DataTypes.STRING;
                }
            }

            return {
                'type': this.ExpressionTypes.LITERAL,
                'value': value,
                'lang': matches[5] || null,
                'dataType': dataTypeIri
            };
        }

        if (this.intRegExp.test(token)) {
            return {
                'type': this.ExpressionTypes.LITERAL,
                'value': token,
                'dataType': this.DataTypes.INTEGER
            };
        }

        if (this.decimalRegExp.test(token)) {
            return {
                'type': this.ExpressionTypes.LITERAL,
                'value': token,
                'dataType': this.DataTypes.DECIMAL
            };
        }

        if (this.doubleRegExp.test(token)) {
            return {
                'type': this.ExpressionTypes.LITERAL,
                'value': token,
                'dataType': this.DataTypes.DOUBLE
            };
        }

        if (this.boolRegExp.test(token)) {
            return {
                'type': this.ExpressionTypes.LITERAL,
                'value': token,
                'dataType': this.DataTypes.BOOLEAN
            };
        }

        return null;
    },

    /**
     * Parses the given string into the object representing some value found in the order by clause.
     *
     * @param token String to parse.
     * @return Object representing the order by value parsed or null if token does not reperesent
     * a valid order by value.
     */
    parseOrderByValue: function (token) {
// TODO: support not only variables in ORDER BY.
        var match, prefix;

        if (!this.orderByValueRegExp) {
            this.init();
        }

        match = token.match(this.orderByValueRegExp);

        if (match) {
            prefix = match[1];

            if (!prefix) {
                return {
                    'type': this.ExpressionTypes.VAR,
                    'value': match[0].substring(1), // remove the ? or $ in the variable
                    'order': 'ASC'
                };
            }

            return {
                'type': this.ExpressionTypes.VAR,
                'value': match[2].substring(1), // remove the ? or $ in the variable
                'order': match[1].toUpperCase()
            };
        }

        return null;
    },

    /**
     * Parses the given string into the IRI, assuming that it is a prefixed name.
     *
     * @param token String containing prefixed name.
     * @param query Query object with defined prefixes, which can be used for name expansion.
     * @return Object representing the prefixed name parsed or null if the token is not a prefixed
     * name.
     */
    parsePrefixedName: function (token, query) {
        var match, cleaned;

//CHANGEMENTS Lionel
//Conservait les caractères < et > dans le découpage du prefixed name...
        if (this.iriRegExp.test(token)) {
            cleaned = token.substring(1, token.length - 1);
        } else {
            cleaned = token;
        }

        if (!this.prefixedNameRegExp) {
            this.init();
        }

        match = cleaned.match(this.prefixedNameRegExp);

        if (!match) {
            return null;
        }

        return {
            'type': this.ExpressionTypes.IRI_REF,
            'value': this.expandPrefixedName(match[1], match[2], query)
        };
    },

    /**
     * Parses the given string into the string representing the prefix name.
     *
     * @param token String containing the prefix name.
     * @return Prefix name parsed or null if the given string does not contain a prefix name.
     */
    parsePrefixName: function (token) {
        if (!this.prefixRegExp) {
            this.init();
        }

        return (this.prefixRegExp.test(token)) ? token.substring(0, token.length - 1) : null;
    },

    /**
     * Returns a SPARQL variable or term represented by the given string.
     *
     * @param token String to parse into the variable or term.
     * @param query Reference to the query for which the variable or term is parsed.
     * @return Object representing the variable or a term parsed.
     */
    parseVarOrTerm: function (token, query) {
// See if it is a variable.
        var value = this.parseVar(token);

        if (value) {
            return value;
        }

// See if it is an IRI reference.
        value = this.parseIriRef(token, query.baseIri);

        if (value) {
            return value;
        }

// See if it is a prefixed name.
        value = this.parsePrefixedName(token, query);

        if (value) {
            return value;
        }

// See if it is a literal.
        value = this.parseLiteral(token, query);

        if (value) {
            return value;
        }

        return null;
    },

    /**
     * Parses a token into the variable.

     *
     * @param token Contains the text representing SPARQL variable.
     * @return Object representing the SPARQL variable, or null if the given token does not
     * represent a valid SPARQL variable.
     */
    parseVar: function (token) {
        if (this.varRegExp === null) {
            this.init();
        }

        if (!this.varRegExp.test(token)) {
            return null;
        }

        return {
            'type': this.ExpressionTypes.VAR,
            'value': token.substring(1) // Skip the initial '?' or '$'
        };
    },

    /**
     * Parses a token into the SPARQL verb.
     *
     * @param token String containing a SPARQL verb.
     * @param query Reference to the query for which the variable or term is parsed.
     * @return Object representing the SPARQL verb, or null if the given token does not represent a
     * valid SPARQL verb.
     */
    parseVerb: function (token, query) {
// See if it is a variable.
        var value = this.parseVar(token);

        if (value) {
            return value;
        }

// See if it is an IRI reference.
        value = this.parseIriRef(token, query.baseIri);

        if (value) {
            return value;
        }

// See if it is a prefixed name.
        value = this.parsePrefixedName(token, query);

        if (value) {
            return value;
        }

        if (token === 'a') {
            return {
                'type': this.ExpressionTypes.IRI_REF,
                'value': CONFIG.rdf.IRIs.TYPE
            };
        }

        return null;
    }
};

module.exports = {
    sparql: SPARQL
};

},{"./JswRDFQuery":15,"./JswXSD":22}],17:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */

/** Stopwatch allows measuring time between different events. */
var Stopwatch = function () {

    var startTime, // Time (in milliseconds) when the stopwatch was started last time.
        elapsedMs = null; // Contains the number of milliseconds in the last measured period of time.

    /**
     * Returns textual representation of the last measured period of time.
     *
     * @return string representation of the last measured period of time.
     */
    this.getElapsedTimeAsText = function () {
        var milliseconds = elapsedMs % 1000,
            hours = Math.floor(elapsedMs / 3600000),
            minutes = Math.floor(elapsedMs % 3600000 / 60000),
            seconds = Math.floor(elapsedMs % 60000 / 1000);

        if (milliseconds < 10) {
            milliseconds = '00' + milliseconds.toString();
        } else if (milliseconds < 100) {
            milliseconds = '0' + milliseconds.toString();
        }

        return hours + ' : ' + minutes + ' : ' + seconds + '.' + milliseconds;
    };

    /**
     * Starts measuring the time.
     */
    this.start = function () {
        startTime = new Date().getTime();
        elapsedMs = null;
    };

    /**
     * Stops measuring the time.
     *
     * @return string representation of the measured period of time.
     */
    this.stop = function () {
        elapsedMs = new Date().getTime() - startTime;
        return this.getElapsedTimeAsText();
    };
};

module.exports = {
    stopWatch: function() {
        return new Stopwatch();
    }
};


},{}],18:[function(require,module,exports){
/**
 * Created by Spadon on 14/10/2014.
 */

JswUtils = require('./JswUtils');

/**
 * TextFile objects allow loading the text content of the file specified by the url.
 *
 * @param url URL of the text file.
 */
TextFile = function (url) {
    var newUrl = JswUtils.trim(url);

    if (!JswUtils.trim(newUrl)) {
        throw '"' + url + '" is not a valid url for a text file!';
    }

    /** URL of the file. */
    this.url = newUrl;
};

/** Prototype for all TextFile objects. */
// todo: re-adapt for nodejs application (no window object)
TextFile.prototype = {
    /**
     * Returns the content of the file as text.
     *
     * @returns Content of the file as text.
     */
    getText: function () {
        var newUrl = JswUtils.trim(this.url),
            xhr;

        if (!JswUtils.trim(newUrl)) {
            throw '"' + this.url + '" is not a valid url for a text file!';
        }

        if (window.XMLHttpRequest &&
            (window.location.protocol !== "file:" || !window.ActiveXObject)) {
            xhr = new XMLHttpRequest();
        } else {
            xhr = new window.ActiveXObject("Microsoft.XMLHTTP");
        }

        try {
            xhr.open('GET', this.url, false);
            xhr.send(null);
            return xhr.responseText;
        } catch (ex) {
            throw ex;
        }
    }
};

module.exports = TextFile;

},{"./JswUtils":21}],19:[function(require,module,exports){
/**
* Created by Spadon on 17/10/2014.
*/
TrimPath = require('./TrimPathQuery'),
rdf = require('./JswRDF');

/** Allows to work with SQL representation of queries against RDF data. */
TrimQueryABox = function () {
  /** The object storing ABox data. */
  this.database = {
    ClassAssertion: [],
    ObjectPropertyAssertion: [],
    ClassSubsumer: [],
    ObjectPropertySubsumer: []
  };

  /** The object which can be used to send queries against ABoxes. */
  this.queryLang = this.createQueryLang();
};

/** Prototype for all jsw.TrimQueryABox objects. */
TrimQueryABox.prototype = {
  /**
   * Answers the given RDF query.
   *
   * @param query RDF query to answer.
   * @return Data set containing the results matching the query.
   */
  answerQuery: function (query) {
    var sql = this.createSql(query);

    try {
      return this.queryLang.parseSQL(sql).filter(this.database);
    } catch (ex) {
      /* Recreate the query language object, since the previous object can not be used now.*/
      return this.createQueryLang().parseSQL(sql).filter(this.database);
      throw ex;
    }
  },

  /**
   * Adds a class assertion to the database.
   *
   * @param individualIri IRI of the individual in the assertion.
   * @param classIri IRI of the class in the assertion.
   */
  addClassAssertion: function (individualIri, classIri) {
    this.database.ClassAssertion.push({
      individual: individualIri,
      className: classIri
    });
  },

  /**
   * Adds an object property assertion to the database.
   *
   * @param objectPropertyIri IRI of the object property in the assertion.
   * @param leftIndIri IRI of the left individual in the assertion.
   * @param rightIndIri IRI of the right individual in the assertion.
   */
  addObjectPropertyAssertion: function (objectPropertyIri, leftIndIri, rightIndIri) {
    this.database.ObjectPropertyAssertion.push({
      objectProperty: objectPropertyIri,
      leftIndividual: leftIndIri,
      rightIndividual: rightIndIri
    });
  },

  /**
   * @author Mehdi Terdjimi
   * Adds a class subsumer to the database.
   * (classIri subClassOf classSubsumerIri)
   */
  addClassSubsumer: function (classIri, classSubsumerIri) {
    this.database.ClassSubsumer.push({
      class: classIri,
      classSubsumer: classSubsumerIri
    });
  },

  /**
   * @author Mehdi Terdjimi
   * Adds a object property subsumer to the database.
   * (objectPropertyIri subPropertyOf objectPropertySubsumerIri)
   */
  addObjectPropertySubsumer: function (objectPropertyIri, objectPropertySubsumerIri) {
    this.database.ObjectPropertySubsumer.push({
      objectProperty: objectPropertyIri,
      objectPropertySubsumer: objectPropertySubsumerIri
    });
  },

  /**
   * Creates an object which can be used for sending queries against the database.
   *
   * @return Object which can be used for sending queries against the database.
   */
  createQueryLang: function () {
    return TrimPath.makeQueryLang({
      ClassAssertion : { individual : { type: 'String' },
        className : { type: 'String' },
        rightclassName: { type: 'String' },
        leftclassName: { type: 'String' }},
      ObjectPropertyAssertion : { objectProperty : { type: 'String' },
        leftIndividual : { type: 'String' },
        rightIndividual : { type: 'String' }},
      ClassSubsumer : { class : { type: 'String' },
        class : { type: 'String' },
        classSubsumer : { type: 'String' }},
      ObjectPropertySubsumer: { class : { type: 'String' },
        leftIndividual : { type: 'String' },
        rightIndividual : { type: 'String' }}
    });
  },

  /**
   * Returns an SQL representation of the given RDF query.
   *
   * @param query jsw.rdf.Query to return the SQL representation for.
   * @return string representation of the given RDF query.
   */
  createSql: function (query) {
    var from, limit, objectField, orderBy, predicate, predicateType, predicateValue, rdfTypeIri, subClassOfIri,
      select, subjectField, table, triple, triples, tripleCount, tripleIndex, variable, vars, varCount, varField, varFields, varIndex, where;

    from = '';
    where = '';
    rdfTypeIri = rdf.IRIs.TYPE;
    subClassOfIri = rdf.IRIs.SUBCLASS;

    varFields = {};

    /** Appends a condition to the where clause based on the given expression.
     *

     * @param expr Expression to use for constructing a condition.
     * @param table Name of the table corresponding to the expression.
     * @param field Name of the field corresponding to the expression.
     */
    function writeExprCondition(expr, table, field) {
      var type = expr.type,
        value = expr.value,
        varField;

      if (type === rdf.ExpressionTypes.IRI_REF) {
        where += table + '.' + field + "=='" + value + "' AND ";
      } else if (type === rdf.ExpressionTypes.VAR) {
        varField = varFields[value];

        if (varField) {
          where += table + '.' + field + '==' + varField + ' AND ';
        } else {
          varFields[value] = table + '.' + field;
        }
      } else if (type === rdf.ExpressionTypes.LITERAL) {
        throw 'Literal expressions in RDF queries are not supported by the library yet!';
      } else {
        throw 'Unknown type of expression found in the RDF query: ' + type + '!';
      }
    }

    triples = query.triples;
    tripleCount = triples.length;

    for (tripleIndex = 0; tripleIndex < tripleCount; tripleIndex += 1) {
      triple = triples[tripleIndex];

      predicate = triple.predicate;
      predicateType = predicate.type;
      predicateValue = predicate.value;
      subjectField = 'leftIndividual';
      objectField = 'rightIndividual';
      table = 't' + tripleIndex;


      if (predicateType === rdf.ExpressionTypes.IRI_REF) {
        if (predicateValue === rdfTypeIri) {
          from += 'ClassAssertion AS ' + table + ', ';
          subjectField = 'individual';
          objectField = 'className';

          //AJOUT Lionel (pour le traitement des requêtes de subsomption de classes

        } else if (predicateValue === subClassOfIri) {
           from += 'ClassSubsumer AS ' + table + ', ';
           subjectField = 'class';
           objectField = 'classSubsumer';

        } else {
          from += 'ObjectPropertyAssertion AS ' + table + ', ';
          where += table + ".objectProperty=='" + predicateValue + "' AND ";
        }
      } else if (predicateType === rdf.ExpressionTypes.VAR) {
        from += 'ObjectPropertyAssertion AS ' + table + ', ';
        varField = varFields[predicateValue];

        if (varField) {
          where += table + '.objectProperty==' + varField + ' AND ';
        } else {
          varFields[predicateValue] = table + '.objectProperty';
        }
      } else {
        throw 'Unknown type of a predicate expression: ' + predicateType + '!';
      }

      writeExprCondition(triple.subject, table, subjectField);
      writeExprCondition(triple.object, table, objectField);
    }

    if (tripleCount > 0) {
      from = ' FROM ' + from.substring(0, from.length - 2);
    }

    if (where.length > 0) {
      where = ' WHERE ' + where.substring(0, where.length - 5);
    }

    select = '';
    vars = query.variables;
    varCount = vars.length;

    if (varCount > 0) {
      for (varIndex = 0; varIndex < varCount; varIndex += 1) {
        variable = vars[varIndex].value;
        varField = varFields[variable];

        if (varField) {
          select += varField + ' AS ' + variable + ', ';
        } else {
          select += "'' AS " + variable + ', ';
        }
      }
    } else {
      for (variable in varFields) {
        if (varFields.hasOwnProperty(variable)) {
          select += varFields[variable] + ' AS ' + variable + ', ';
        }
      }
    }

    if (select.length > 0) {
      select = select.substring(0, select.length - 2);
    } else {
      throw 'The given RDF query is in the wrong format!';
    }

    if (query.distinctResults) {
      select = 'SELECT DISTINCT ' + select;
    } else {
      select = 'SELECT ' + select;
    }

    orderBy = '';
    vars = query.orderBy;
    varCount = vars.length;

    for (varIndex = 0; varIndex < varCount; varIndex += 1) {
      variable = vars[varIndex];

      if (variable.type !== rdf.ExpressionTypes.VAR) {
        throw 'Unknown type of expression found in ORDER BY: ' + variable.type + '!';
      }

      orderBy += variable.value + ' ' + variable.order + ', ';
    }

    if (varCount > 0) {
      orderBy = ' ORDER BY ' + orderBy.substring(0, orderBy.length - 2);
    }

    limit = '';

    if (query.limit !== 0) {

      limit = ' LIMIT ';
      if (query.offset !== 0) {
        limit += query.offset + ', ';
      }
      limit += query.limit;
    } else if (query.offset !== 0) {
      limit = ' LIMIT ' + query.offset + ', ALL';
    }

    return select + from + where + orderBy + limit;
  }
};


module.exports = {
  trimQueryABox: TrimQueryABox
};

},{"./JswRDF":14,"./TrimPathQuery":23}],20:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */

/**
 * Triple storage can be used to hash 3-tuples by the values in them in some order.
 *
 * @return Object which can be used to hash 3-tuples by the values in them in some order.
 */
TripleStorage = function () {
    /**
     * Data structure holding all 3-tuples.
     */
    this.storage = {};
};

TripleStorage.prototype = {
    /**
     * Returns all Triples for a fixed value of the 1-st element in Triples and (optionally) the
     * 2-nd one.
     *
     * @param first Value of the first element of the returned Triples.
     * @param second (optional) Value of the second element of the returned Triples.
     * @return Object containing the Triples requested.
     */
    get: function (first, second) {
        var firstTuples;

        if (!first) {
            return this.storage;
        }

        firstTuples = this.storage[first];

        if (!firstTuples) {
            return {};
        }

        if (!second) {
            return firstTuples;
        }

        return firstTuples[second] || {};
    },

    /**
     * Adds the given Triple to the storage.
     *
     * @param first Value of the first element in the Triple.
     * @param second Value of the second element in the Triple.
     * @param third Value of the third element in the Triple.
     */
    add: function (first, second, third) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }

        if (!storage[first][second]) {
            storage[first][second] = {};
        }

        storage[first][second][third] = true;
    },

    /**
     * Checks if the given Triple exists in the storage.
     *
     * @param first Value of the first element in the Triple.
     * @param second Value of the second element in the Triple.
     * @param third Value of the third element in the Triple.
     * @return (boolean) True if the value exists, false otherwise.
     */
    exists: function (first, second, third) {
        var storage = this.storage,
            firstStorage = storage[first],
            secondStorage;

        if (!firstStorage) {
            return false;
        }

        secondStorage = firstStorage[second];

        if (!secondStorage) {
            return false;
        }

        return secondStorage[third];


    }
};

module.exports = {
    tripleStorage: TripleStorage
};

},{}],21:[function(require,module,exports){
/**
 * Created by Spadon on 14/10/2014.
 */

DOMParser = require('xmldom').DOMParser;

JswUtils = {

    /**
     * Parses string into the XML DOM object in a browser-independent way.
     * @param xml String containing the XML text to parse.
     * @return XML DOM object representing the parsed XML.
     */
    parseString: function (xml) {
        var xmlDoc;

        xml = this.trim(xml);
        xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');

            if (xmlDoc.nodeName === 'parsererror') {
                throw xmlDoc.childNodes[0].nodeValue;
            } else if (xmlDoc.childNodes && xmlDoc.childNodes[0] &&
                xmlDoc.childNodes[0].childNodes &&
                xmlDoc.childNodes[0].childNodes[0] &&
                xmlDoc.childNodes[0].childNodes[0].nodeName === 'parsererror') {

                throw xmlDoc.childNodes[0].childNodes[0].childNodes[1].innerText;
            }

            return xmlDoc;
    },

    /**
     * Checks if the given string is a valid URL.
     * @param str String to check.
     * @return boolean : true if the given string is a URL, false otherwise.
     */
    isUrl: function (str) {
        var regexp = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
        return regexp.test(str);
    },

    /**
     * Removes space characters at the start and end of the given string.
     *
     * @param str String to trim.
     * @return New string with space characters removed from the start and the end.
     */
    trim: function (str) {
        return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }
};

module.exports = JswUtils;

},{"xmldom":4}],22:[function(require,module,exports){
/**
 * Created by Spadon on 17/10/2014.
 */
XSD = function() {
// ============================== XSD namespace ===============================

    var xsd = {};

    /** Contains the URIs of (some) datatypes of XML Schema. */
    xsd.DataTypes = {
        /** IRI of boolean data type. */
        BOOLEAN: 'http://www.w3.org/2001/XMLSchema#boolean',
        /** IRI of decimal data type. */
        DECIMAL: 'http://www.w3.org/2001/XMLSchema#decimal',
        /** IRI of a double data type. */
        DOUBLE: 'http://www.w3.org/2001/XMLSchema#double',
        /** IRI of a integer data type. */
        INTEGER: 'http://www.w3.org/2001/XMLSchema#integer',
        /** IRI of a string data type. */
        STRING: 'http://www.w3.org/2001/XMLSchema#string'
    };

    return xsd;
};

module.exports = {
    xsd: function() {
        return new XSD();
    }
};

},{}],23:[function(require,module,exports){
/**
 * TrimPath Query. Release 1.1.14.
 * Copyright (C) 2004 - 2007 TrimPath.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 */
if (typeof(TrimPath) == 'undefined')
  TrimPath = {};
  QueryLang = function(){};

(function() { // Using a closure to keep global namespace clean.
    var theEval   = eval;
    var theString = String;
    var theArray  = Array;

    QueryLang.prototype.parseSQL = function(sqlQueryIn, paramsArr) { // From sql to tql.
        var sqlQuery = sqlQueryIn.replace(/\n/g, ' ').replace(/\r/g, '');

        if (paramsArr != null) { // Convert " ?" to args from optional paramsArr.
          if (paramsArr instanceof theArray == false)
            paramsArr = [ paramsArr ];

          var sqlParts = sqlQuery.split(' ?');
          for (var i = 0; i < sqlParts.length - 1; i++)
            sqlParts[i] = sqlParts[i] + ' ' + cleanString(paramsArr[i], true);
          sqlQuery = sqlParts.join('');
        }

        sqlQuery = sqlQuery.replace(/ AS ([_a-zA-z0-9]+)/g, ".AS('$1')");

        var err = function(errMsg) {
          throw ("[ERROR: " + errMsg + " in query: " + sqlQueryIn + "]");
        };

        var query_type = sqlQuery.split(/\s+/)[0];
        if (query_type == 'DELETE')
          query_type = 'DESTROY';

        if (!arrayInclude(['SELECT', 'DESTROY', 'UPDATE', 'INSERT'], query_type))
          err("not a valid query type");

        var strip_whitespace = function(str) {
          return str.replace(/\s+/g, '');
        }

        if (query_type == 'SELECT' || query_type == 'DESTROY') {

          var fromSplit = sqlQuery.substring(7).split(" FROM ");
          if (fromSplit.length != 2)
            err("missing a FROM clause");

          //SELECT Invoice.*, Customer.* FROM Invoice, Customer
          //SELECT * FROM Invoice, Customer
          //DELETE things, relationships FROM relationships LEFT OUTER JOIN things ON things.relationship_id = relationships.id WHERE relationships.id = 2
          //SELECT * FROM relationships LEFT OUTER JOIN users ON relationships.created_by = users.id AND relationships.updated_by = users.id LEFT OUTER JOIN things ON things.relatedrelationship_id = relationships.id  ORDER BY relationships.updated_at DESC LIMIT 0, 20
          var columnsClause = fromSplit[0].replace(/\.\*/g, ".ALL");
          var remaining     = fromSplit[1];
          var fromClause    = findClause(remaining, /\sWHERE\s|\sGROUP BY\s|\sHAVING\s|\sORDER BY\s|\sLIMIT/);
          var fromTableClause = findClause(fromClause, /\sLEFT OUTER JOIN\s/);
          var fromTables = strip_whitespace(fromTableClause).split(',');
          remaining = remaining.substring(fromClause.length);

          var fromClauseSplit = fromClause.split(" LEFT OUTER JOIN ");
          var fromClauseParts = [fromClauseSplit[0]];
          var leftJoinComponents;
          for (var i = 1; i < fromClauseSplit.length; i++) {
            leftJoinComponents = /(\w+)\sON\s(.+)/.exec(fromClauseSplit[i]);
            fromTables.push(leftJoinComponents[1]);
            fromClauseParts.push( '('+leftJoinComponents[1]+')'+'.ON(WHERE_SQL("'+leftJoinComponents[2]+'"))' );
          }
          fromClause = fromClauseParts.join(", LEFT_OUTER_JOIN");

          if(strip_whitespace(columnsClause) == '*') {
            var new_columns = [];
            for(var i=0; i<fromTables.length; i++) {
              new_columns.push(fromTables[i]+'.ALL')
            }
            columnsClause = columnsClause.replace(/\*/, new_columns.join(', '))
          }
          var whereClause   = findClause(remaining, /\sGROUP BY\s|\sHAVING\s|\sORDER BY\s|\sLIMIT/);
          remaining = remaining.substring(whereClause.length);
          var groupByClause = findClause(remaining, /\sHAVING\s|\sORDER BY\s|\sLIMIT /);
          remaining = remaining.substring(groupByClause.length);
          var havingClause  = findClause(remaining, /\sORDER BY\s|\sLIMIT /);
          remaining = remaining.substring(havingClause.length);
          var orderByClause = findClause(remaining, /\sLIMIT /).replace(/\sASC/g, ".ASC").replace(/\sDESC/g, ".DESC");
          remaining = remaining.substring(orderByClause.length);
          var limitClause   = remaining;

          var tql = [ 'SELECT(FROM(', fromClause, '), ', columnsClause];
          if (whereClause.length > 0)
            tql.push(', WHERE_SQL("' + whereClause.substring(7) + '")');
          if (groupByClause.length > 0)
            tql.push(', GROUP_BY(' + groupByClause.substring(10) + ')');
          if (havingClause.length > 0)
            tql.push(', HAVING_SQL("' + havingClause.substring(8) + '")');
          if (orderByClause.length > 0)
            tql.push(', ORDER_BY(' + orderByClause.substring(10) + ')');
          if (limitClause.length > 0)
            tql.push(', LIMIT(' + limitClause.substring(7) + ')');
          tql.push(')');
        }
        else if (query_type == "INSERT") {
          // accepts sql of the format: INSERT INTO things (field1, field2) VALUES ('value1', 'value2')
          var intoSplit = sqlQuery.substring(6).split(" INTO ");
          if (intoSplit.length != 2)
            err("missing an INTO clause");
          var insertion_regex = /^\s*(\w+)\s*\((.+)\)\s+VALUES\s+\((.+)\)/
          var parsed_sql = intoSplit[1].match(insertion_regex);
          var table_name = parsed_sql[1];
          var fields = strip_whitespace(parsed_sql[2]).split(',');
          var values = parsed_sql[3].split(',');
          if (fields.length != values.length)
            err("values and fields must have same number of elements");

          tql = ['INSERT(', table_name, ',', simpleJson(fields, values), ')'];
        }
        else if (query_type == "UPDATE") {
          // UPDATE things SET relatedrelationship_id=2, name="poop" WHERE things.relatedrelationship_id=1
          //var tql = ['UPDATE(FROM(things ), {"relatedrelationship_id": "2"}, WHERE_SQL("things.relatedrelationship_id = 1"))'];
          var setSplit = sqlQuery.substring(7).split(" SET ");
          if (setSplit.length != 2)
            err("missing a SET clause");
          var fromClause = setSplit[0];
          var remaining  = setSplit[1];
          var assignmentClause   = findClause(remaining, /\sWHERE\s/);
          remaining = remaining.substring(assignmentClause.length);
          var whereClause = remaining;
          var assignmentArray = assignmentClause.split(',');
          var fields = [];
          var values = [];
          for (var i=0; i<assignmentArray.length; i++) {
            var components = assignmentArray[i].split('=');
            fields.push(strip(components[0]));
            values.push(strip(components[1]));
          }
          var update_regex = /^UPDATE\s+(\w+)\s+SET\s+(\w+\s*=\s*\w+)/
          var update_regex = /^UPDATE\s+(\w+)\s+SET\s+(\w+\s*=\s*\w+)/
          var parsed_sql = sqlQuery.match(update_regex);

          var tql = ['UPDATE(FROM(', fromClause, '), ', simpleJson(fields, values)];
          tql.push(', WHERE_SQL("' + whereClause.substring(7) + '")');
          tql.push(')');
        }
        if(query_type == 'DESTROY') {
          tql.unshift('DESTROY(');
          tql.push(')');
        }
        with (this) {
          return eval(tql.join(''));
        }
    };

    TrimPath.TEST = TrimPath.TEST || {}; // For exposing to testing only.

    var arrayUniq = function(arr) {
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            if (arrayInclude(result, arr[i]) == false)
                result.push(arr[i]);
        }
        return result;
    };

    var arrayInclude = function(arr, val) {
        for (var j = 0; j < arr.length; j++) {
            if (arr[j] == val)
                return true;
        }
        return false;
    }

    var arrayCompact = function(arr) {
        var result = [];
        for (var i = 0; i < arr.length; i++)
            if (arr[i] != null)
                result.push(arr[i])
        return result;
    }

    var simpleJson = function(fields, values) { // The fields and values are arrays of strings.
        var json = [ '{' ];
        for (var i=0; i<fields.length; i++) {
            if (i > 0)
                json.push(',');
            json.push(fields[i]);
            json.push(':');
            if (values[i]) {
                json.push('"');
                json.push(values[i].replace(/(["\\])/g, '\\$1').replace(/\r/g, '').replace(/\n/g, '\\n'));
                json.push('"');
            } else
                json.push(null);
        }
        json.push('}');
        return json.join('');
    }

    var hashKeys = function(object) {
        var keys = [];
        for (var property in object)
            keys.push(property);
        return keys;
    }

    var hashValues = function(object) {
        var values = [];
        for (var property in object)
            values.push(object[property]);
        return values;
    }

    var strip = function(str) {
        return str.replace(/^\s+/, '').replace(/\s+$/, '');
    }

    TrimPath.makeQueryLang_etc = {};
    TrimPath.makeQueryLang_etc.Error = function(message, stmt) { // The stmt can be null, a String, or an Object.
        this.message = message;
        this.stmt    = stmt;
    }
    TrimPath.makeQueryLang_etc.Error.prototype.toString = function() {
        return ("TrimPath query Error in " + (this.stmt != null ? this.stmt : "[unknown]") + ": " + this.message);
    }

    var TODO  = function() { throw "currently unsupported"; };
    var USAGE = function() { throw "incorrect keyword usage"; };

    TrimPath.makeQueryLang = function(tableInfos, etc) {
        if (etc == null)
            etc = TrimPath.makeQueryLang_etc;

        var aliasArr = []; // Used after SELECT to clean up the queryLang for reuse.
        var aliasReg = function(aliasKey, scope, obj) {
            if (scope[aliasKey] != null)
                throw new etc.Error("alias redefinition: " + aliasKey);
            aliasArr.push({ aliasKey: aliasKey, scope: scope, orig: scope[aliasKey] });
            scope[aliasKey] = obj;
            return obj;
        };

        var queryLang = new QueryLang();

        var checkArgs = function(args, minLength, maxLength, name, typeCheck) {
            args = cleanArray(args);
            if (minLength == null)
                minLength = 1;
            if (args == null || args.length < minLength)
                throw new etc.Error("not enough arguments for " + name);
            if (maxLength != null && args.length > maxLength)
                throw new etc.Error("too many arguments for " + name);
            if (typeCheck != null)
                for (var k in args)
                    if (typeof(args[k]) != "function" && // Ignore functions because other libraries like to extend Object.prototype.
                        args[k] instanceof typeCheck == false)
                        throw new etc.Error("wrong type for " + args[k] + " to " + name);
            return args;
        }

        var sql_date_to_js_date = function(data) {
            if(typeof data == "string" && data.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
                var dateArr = data.match(/\d{4}-\d{1,2}-\d{1,2}/)[0].split('-');
                var date = new Date(parseInt(dateArr[0], 10), (parseInt(dateArr[1], 10)-1), parseInt(dateArr[2], 10));
                return date;
            }
            return data;
        }

        var data_insertion = function(table_info, field_name, data, column_ref) {
            if(table_info[field_name]) {
                var data = eval(data);
                if(table_info[field_name].type && table_info[field_name].type == 'Number')
                    data = Number(data, 10);
                else if(table_info[field_name].type && table_info[field_name].type == 'Date')
                    data = sql_date_to_js_date(data);
                column_ref[field_name] = data;
            }
        }

        var NodeType = { // Constructor functions for SELECT statement tree nodes.
            select : function(args) {
                var columns = [];
                var nodes = { from : null, where : null, groupBy : null, having : null, orderBy : null,
                    limit : null };

                for (var i = 0; i < args.length; i++) { // Parse args into columns and nodes.
                    var arg = args[i];
                    var argIsNode = false;
                    for (var nodeTypeName in nodes) {
                        if (arg instanceof NodeType[nodeTypeName]) {
                            if (nodes[nodeTypeName] != null)
                                throw new etc.Error("too many " + nodeTypeName.toUpperCase() + " clauses");
                            nodes[nodeTypeName] = arg;
                            argIsNode = true;
                            break;
                        }
                    }
                    if (argIsNode == false) // Then the arg must be a column.
                        columns.push(arg);
                }
                columns = checkArgs(columns, 1, null, "COLUMNS");
                if (nodes.from == null)
                    throw new etc.Error("missing FROM clause");

                var joinDriver        = null;
                var joinFilter        = null;
                var whereFilter       = null;
                var columnConvertor   = null;
                var orderByComparator = null;
                var groupByCalcValues = null;
                var havingFilter      = null;

                var typeConverter = function(results) {
                    for(var i=0; i<results.length; i++) {
                        var result = results[i];
                        for(var attr in result) {
                            var value = result[attr];
                            if(value instanceof Date)
                                results[i][attr] = dateToString(value);
                        }
                    }
                }

                this.prepareFilter = function() {
                    if (joinDriver == null)
                        joinDriver = compileJoinDriver(nodes.from.tables);
                    if (joinFilter == null)
                        joinFilter = compileFilter(compileFilterForJoin, nodes.from.tables);
                    if (whereFilter == null)
                        whereFilter = compileFilter(compileFilterForWhere, nodes.from.tables, nodes.where != null ? nodes.where.exprs : null);
                    if (groupByCalcValues == null && nodes.groupBy != null)
                        groupByCalcValues = compileGroupByCalcValues(nodes.from.tables, nodes.groupBy.exprs);
                    if (havingFilter == null && nodes.having != null)
                        havingFilter = compileFilter(compileFilterForWhere, [], nodes.having.exprs, { aliasOnly : true });
                    if (columnConvertor == null)
                        columnConvertor = compileColumnConvertor(nodes.from.tables, columns);
                    if (orderByComparator == null && nodes.orderBy != null)
                        orderByComparator = compileOrderByComparator(nodes.orderBy.exprs);
                }

                /* params is a list of parameters including:
                 * with_table: if set to true, the results will include table_name+'.'+field_name
                 * return_reference: used by update and delete queries, if set to true, returns reference of data rather than copies,
                 *                   returns the result of the joinDriver
                 */
                this.filter = function(dataTables, bindings, params) {
                    this.prepareFilter();
                    if (bindings == null)
                        bindings = {};
                    if (params == null)
                        params = {};

                    var resultOfFromWhere = joinDriver(dataTables, joinFilter, whereFilter, bindings);

                    if (groupByCalcValues != null) {
                        for (var i = 0; i < resultOfFromWhere.length; i++)
                            resultOfFromWhere[i].groupByValues = groupByCalcValues.apply(null, resultOfFromWhere[i]);
                        resultOfFromWhere.sort(groupByComparator);
                    }

                    if (params.return_reference)
                        return resultOfFromWhere;

                    var groupByAccum = {}; // Accumlation area for aggregate functions.
                    var groupByFuncs = {
                        SUM : function(key, val) {
                            groupByAccum[key] = zeroDefault(groupByAccum[key]) + zeroDefault(val);
                            return groupByAccum[key];
                        },
                        COUNT : function(key) {
                            groupByAccum[key] = zeroDefault(groupByAccum[key]) + 1;
                            return groupByAccum[key];
                        },
                        AVG : function(key, val) {
                            return groupByFuncs.SUM(key, val) / groupByFuncs.COUNT("_COUNT" + key);
                        }
                    };

                    var result = [], prevItem = null, currItem;
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        currItem    = resultOfFromWhere[i];
                        currItem[0] = groupByFuncs;
                        if (prevItem != null &&
                            groupByComparator(prevItem, currItem) != 0) {
                            if (havingFilter == null ||
                                havingFilter(prevItem.record) == true)
                                result.push(prevItem.record);
                            groupByAccum = {};
                        }
                        currItem.record = columnConvertor.apply(null, currItem.concat([params.with_table])); // Must visit every item to calculate aggregates.
                        prevItem = currItem;
                    }
                    if (prevItem != null &&
                        (havingFilter == null ||
                            havingFilter(prevItem.record) == true))
                        result.push(prevItem.record);

                    if (orderByComparator != null)
                        result.sort(orderByComparator);
                    if (nodes.limit != null) {
                        if (nodes.limit.total == 0)
                            return [];
                        var start = (nodes.limit.offset != null ? nodes.limit.offset : 0);
                        result = result.slice(start, start + (nodes.limit.total > 0 ? nodes.limit.total : result.length));
                    }

                    typeConverter(result)
                    return result;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "SELECT", map(columns, toSqlWithAlias).join(", "), nodes.from.toSql() ];
                    if (nodes.where != null)
                        sqlArr.push(nodes.where.toSql());
                    if (nodes.groupBy != null)
                        sqlArr.push(nodes.groupBy.toSql());
                    if (nodes.having != null)
                        sqlArr.push(nodes.having.toSql());
                    if (nodes.orderBy != null)
                        sqlArr.push(nodes.orderBy.toSql());
                    if (nodes.limit != null)
                        sqlArr.push(nodes.limit.toSql());
                    return sqlArr.join(" ");
                });

                for (var i = 0; i < aliasArr.length; i++) { // TODO: In nested select, parent's aliases are incorrectly reset.
                    var aliasItem = aliasArr[i];
                    aliasItem.scope[aliasItem.aliasKey] = aliasItem.orig;
                }
                aliasArr = [];
            },
            insert  : function(args) {
                var table_info = args[0];
                var object = args[1];
                this.filter  = function(dataTables, bindings) {
                    var table_name = table_info['.name'];
                    if(!dataTables[table_name])
                        dataTables[table_name] = [];
                    dataTables[table_name].push({});
                    for(var field_name in object) {
                        data_insertion(table_info, field_name, object[field_name], dataTables[table_name][dataTables[table_name].length-1]);
                    }
                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "INSERT INTO", table_info.toSql(), '('+hashKeys(object).join(', ')+')',
                        'VALUES', '('+hashValues(object).join(', ')+')' ];
                    return sqlArr.join(" ");
                });
            },
            update  : function(args) {
                var from_node   = args[0];
                var assignments = args[1];
                var where_node  = args[2];
                this.filter  = function(dataTables, bindings) {
                    var table_info = from_node.tables[0];
                    var resultOfFromWhere = queryLang.SELECT(from_node, where_node, 1).filter(dataTables, null, {return_reference: true});
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        var object = resultOfFromWhere[i][1];
                        for(var field in assignments) {
                            var fieldSplit = field.split('.');
                            var field_name = field;
                            if(fieldSplit.length == 2)
                                field_name = fieldSplit[1];
                            data_insertion(table_info, field_name, assignments[field], object);
                        }
                    }
                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "UPDATE", from_node.toSql() ];
                    var assignmentsArr = [];
                    for(var attr in assignments) {
                        assignmentsArr.push(attr+'='+assignments[attr])
                    }
                    sqlArr.push(assignmentsArr.join(', '));
                    if (where_node != null)
                        sqlArr.push(where_node.toSql());
                    return sqlArr.join(" ");
                });
            },
            destroy  : function(args) {
                var select_node = args[0];
                this.filter  = function(dataTables, bindings) {
                    var resultOfFromWhere = select_node.filter(dataTables, null, {return_reference: true});
                    // now go through each object, go through each attribute of it and delete it
                    for (var i = 0; i < resultOfFromWhere.length; i++) {
                        var record = resultOfFromWhere[i];
                        for(var j=1; j<record.length; j++) {
                            var object = record[j];
                            for(var attr in object) {
                                delete object[attr];
                            }
                        }
                    }
                    // then go through each table in the dataTables, each record, deleting any records that are empty objects
                    for(var table_name in dataTables) {
                        var table = dataTables[table_name]
                        for(var i = 0; i<table.length; i++) {
                            if(hashKeys(table[i]).length == 0)
                                delete table[i];
                        }
                    }
                    // then compact each table and save it back as itself
                    for(var table_name in dataTables) {
                        dataTables[table_name] = arrayCompact(dataTables[table_name]);
                    }

                    return true;
                }

                setSSFunc(this, function() {
                    var sqlArr = [ "DELETE", select_node.toSql() ];
                    return sqlArr.join(" ").replace(/SELECT\s/, '');
                });
            },
            from    : function(tables) { this.tables = checkArgs(tables, 1, null, "FROM",   NodeType.tableDef); },
            where   : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "WHERE",  NodeType.expression); },
            groupBy : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "GROUP_BY"); },
            having  : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "HAVING", NodeType.expression); },
            orderBy : function(exprs)  { this.exprs  = checkArgs(exprs,  1, null, "ORDER_BY"); },
            expression : function(args, name, opFix, sqlText, minArgs, maxArgs, jsText, alias) {
                var theExpr    = this;
                this.args      = checkArgs(args, minArgs, maxArgs, name);
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this.opFix     = opFix;
                this.sqlText   = sqlText != null ? sqlText : this[".name"];
                this.jsText    = jsText != null ? jsText : this.sqlText;
                this.AS = function(aliasArg) {
                    this[".alias"] = this.ASC[".alias"] = this.DESC[".alias"] = aliasArg;
                    return aliasReg(aliasArg, queryLang, this);
                }
                this.ASC  = setSSFunc({ ".name": name, ".alias": theExpr[".alias"], order: "ASC" },
                    function() { return theExpr[".alias"] + " ASC"; });
                this.DESC = setSSFunc({ ".name": name, ".alias": theExpr[".alias"], order: "DESC" },
                    function() { return theExpr[".alias"] + " DESC"; });
                this.COLLATE = TODO;
            },
            aggregate : function() {
                NodeType.expression.apply(this, arguments);
            },
            limit : function(offset, total) {
                if(total == null) { // if only one parameter, it is the total
                    this.total  = cleanString(offset);
                } else {
                    this.total  = cleanString(total);
                    this.offset = cleanString(offset);
                }
            },
            tableDef : function(name, columnInfos, alias) {
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this[".allColumns"] = [];
                for (var columnName in columnInfos) {
                    this[columnName] = new NodeType.columnDef(columnName, columnInfos[columnName], this);
                    this[".allColumns"].push(this[columnName]);
                }
                setSSFunc(this, function() { return name; });
                this.AS = function(alias) {
                    return aliasReg(alias, queryLang, new NodeType.tableDef(name, columnInfos, alias));
                }
                this.ALL    = new NodeType.columnDef("*", null, this);
                this.ALL.AS = null; // SELECT T.* AS X FROM T is not legal.
            },
            columnDef : function(name, columnInfo, tableDef, alias) { // The columnInfo & tableDef might be null.
                var theColumnDef = this;
                this[".name"]  = name;
                this[".alias"] = alias != null ? alias : name;
                this.tableDef = tableDef;
                setSSFunc(this, function(flags) {
                    if (flags != null && flags.aliasOnly == true)
                        return this[".alias"];
                    return tableDef != null ? ((tableDef[".alias"]) + "." + name) : name;
                });
                this.AS = function(aliasArg) {
                    return aliasReg(aliasArg, queryLang, new NodeType.columnDef(name, columnInfo, tableDef, aliasArg));
                }
                if(columnInfo && columnInfo.type)
                    this.type = columnInfo.type
                else
                    this.type = "String";
                this.ASC  = setSSFunc({ ".name": name, ".alias": theColumnDef[".alias"], tableDef: tableDef, order: "ASC" },
                    function() { return theColumnDef.toSql() + " ASC"; });
                this.DESC = setSSFunc({ ".name": name, ".alias": theColumnDef[".alias"], tableDef: tableDef, order: "DESC" },
                    function() { return theColumnDef.toSql() + " DESC"; });
                this.COLLATE = TODO;
            },
            join : function(joinType, tableDef) {
                var theJoin        = this;
                this.joinType      = joinType;
                this.fromSeparator = " " + joinType + " JOIN ";
                for (var k in tableDef)
                    this[k] = tableDef[k];
                this.ON    = function() { theJoin.ON_exprs    = checkArgs(arguments, 1, null, "ON"); return theJoin; };
                this.USING = function() { theJoin.USING_exprs = cleanArray(arguments, false);        return theJoin; };
                this.fromSuffix = function() {
                    if (theJoin.ON_exprs != null)
                        return (" ON " + map(theJoin.ON_exprs, toSql).join(" AND "));
                    if (theJoin.USING_exprs != null)
                        return (" USING (" + theJoin.USING_exprs.join(", ") + ")");
                    return "";
                }
            }
        }

        var setSSFunc = function(obj, func) { obj.toSql = obj.toJs = obj.toString = func; return obj; };

        setSSFunc(NodeType.from.prototype, function() {
            var sqlArr = [ "FROM " ];
            for (var i = 0; i < this.tables.length; i++) {
                if (i > 0) {
                    var sep = this.tables[i].fromSeparator;
                    if (sep == null)
                        sep = ", "
                    sqlArr.push(sep);
                }
                sqlArr.push(toSqlWithAlias(this.tables[i]));
                if (this.tables[i].fromSuffix != null)
                    sqlArr.push(this.tables[i].fromSuffix());
            }
            return sqlArr.join("");
        });

        setSSFunc(NodeType.where.prototype,   function() { return "WHERE "    + map(this.exprs,  toSql).join(" AND "); });
        setSSFunc(NodeType.orderBy.prototype, function() { return "ORDER BY " + map(this.exprs,  toSql).join(", "); });
        setSSFunc(NodeType.groupBy.prototype, function() { return "GROUP BY " + map(this.exprs,  toSql).join(", "); });
        setSSFunc(NodeType.having.prototype,  function() { return "HAVING "   + map(this.exprs,  toSql, { aliasOnly : true }).join(" AND "); });
        setSSFunc(NodeType.limit.prototype,   function() { return "LIMIT " + (this.total < 0 ? "ALL" : this.total) +
            (this.offset != null ? (" OFFSET " + this.offset) : ""); });

        var makeToFunc = function(toFunc, opText) {
            return function(flags) {
                if (flags != null && flags.aliasOnly == true && this[".alias"] != this[".name"])
                    return this[".alias"];
                if (this.opFix < 0) // prefix
                    return this[opText] + " (" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ")";
                if (this.opFix > 0) // suffix
                    return "(" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ") " + this[opText];
                return "(" + map(this.args, toFunc, flags).join(") " + this[opText] + " (") + ")"; // infix
            }
        }

        NodeType.expression.prototype.toSql = makeToFunc(toSql, "sqlText");
        NodeType.expression.prototype.toJs  = makeToFunc(toJs,  "jsText");

        NodeType.aggregate.prototype      = new NodeType.expression([], null, null, null, 0);
        NodeType.aggregate.prototype.toJs = function(flags) {
            if (flags != null && flags.aliasOnly == true && this[".alias"] != this[".name"])
                return this[".alias"];
            return this.jsText + " ('" + this[".alias"] + "', (" + map(this.args, toJs).join("), (") + "))";
        }

        NodeType.join.prototype = new NodeType.tableDef();

        NodeType.whereSql = function(sql) { this.exprs = [ new NodeType.rawSql(sql) ]; };
        NodeType.whereSql.prototype = new NodeType.where([new NodeType.expression([0], null, 0, null, 0, null, null, null)]);

        NodeType.havingSql = function(sql) { this.exprs = [ new NodeType.rawSql(sql) ]; };
        NodeType.havingSql.prototype = new NodeType.having([new NodeType.expression([0], null, 0, null, 0, null, null, null)]);

        NodeType.rawSql = function(sql) { this.sql = sql; }
        NodeType.rawSql.prototype.toSql = function(flags) { return this.sql; }
        NodeType.rawSql.prototype.toJs = function(flags) {
            var js = this.sql;
            js = js.replace(/ AND /g, " && ");
            js = js.replace(/ OR /g, " || ");
            js = js.replace(/ = /g, " == ");
            js = js.replace(/ IS NULL/g, " == null");
            js = js.replace(/ IS NOT NULL/g, " != null");
            js = js.replace(/ NOT /g, " ! ");

            var LIKE_regex = /(\S+)\sLIKE\s'(\S+)'/g;
            var matchArr;
            while(matchArr = LIKE_regex.exec(js) ) {
                matchArr[2] = matchArr[2].replace(/%/, '.*');
                js = js.replace(LIKE_regex, "$1.match(/"+matchArr[2]+"/)");
            }

            // replace date-like strings with date object constructor
            var DATE_regex = /'(\d{4})-(\d{1,2})-(\d{1,2})'/g;
            while(matchArr = DATE_regex.exec(js) ) {
                var dateArr = [parseInt(matchArr[1], 10).toString(), (parseInt(matchArr[2], 10)-1).toString(), parseInt(matchArr[3], 10).toString()];
                var replacement = '(new Date('+dateArr.join(', ')+').valueOf())';
                js = js.replace(matchArr[0], replacement);
            }

            // NOTE: The following messes up IS NULL queries. -- steve.yen
            // >>> // replace all table+'.'+column with valueOf()
            // >>> js = js.replace(/(\w+\.\w+)/g, "$1 && $1.valueOf()");

            return js;
        }

        var keywords = {
            INSERT  :   function() { return new NodeType.insert(arguments); },
            UPDATE  :   function() { return new NodeType.update(arguments); },
            DESTROY  :   function() { return new NodeType.destroy(arguments); },
            SELECT_ALL      : function() { return new NodeType.select(arguments); },
            SELECT_DISTINCT : TODO,
            ALL   : USAGE, // We use ALL in different syntax, like SELECT_ALL.
            FROM  : function() { return new NodeType.from(arguments); },
            WHERE : function() { return new NodeType.where(arguments); },
            AND   : function() { return new NodeType.expression(arguments, "AND",  0, null, 1, null, "&&"); },
            OR    : function() { return new NodeType.expression(arguments, "OR",   0, null, 1, null, "||"); },
            NOT   : function() { return new NodeType.expression(arguments, "NOT", -1, null, 1, 1, "!"); },
            EQ    : function() { return new NodeType.expression(arguments, "EQ",   0, "=",  2, 2, "=="); },
            NEQ   : function() { return new NodeType.expression(arguments, "NEQ",  0, "!=", 2, 2); },
            LT    : function() { return new NodeType.expression(arguments, "LT",   0, "<",  2, 2); },
            GT    : function() { return new NodeType.expression(arguments, "GT",   0, ">",  2, 2); },
            LTE   : function() { return new NodeType.expression(arguments, "LTE",  0, "<=", 2, 2); },
            GTE   : function() { return new NodeType.expression(arguments, "GTE",  0, ">=", 2, 2); },
            IS_NULL     : function() { return new NodeType.expression(arguments, "IS_NULL",     1, "IS NULL",     1, 1, "== null"); },
            IS_NOT_NULL : function() { return new NodeType.expression(arguments, "IS_NOT_NULL", 1, "IS NOT NULL", 1, 1, "!= null"); },
            ADD         : function() { return new NodeType.expression(arguments, "ADD",      0, "+", 2, null); },
            SUBTRACT    : function() { return new NodeType.expression(arguments, "SUBTRACT", 0, "-", 2, null); },
            NEGATE      : function() { return new NodeType.expression(arguments, "NEGATE",  -1, "-", 1, 1); },
            MULTIPLY    : function() { return new NodeType.expression(arguments, "MULTIPLY", 0, "*", 2, null); },
            DIVIDE      : function() { return new NodeType.expression(arguments, "DIVIDE",   0, "/", 2, null); },
            PAREN       : function() { return new NodeType.expression(arguments, "PAREN",    0, "",  1, 1); },
            LIKE         : function() { return new NodeType.expression(arguments, "LIKE",   0, "LIKE",  2, 2, "match"); },
            BETWEEN      : TODO,
            AVG            : function() { return new NodeType.aggregate(arguments, "AVG",   -1, null, 1, 1); },
            AVG_ALL        : TODO,
            AVG_DISTINCT   : TODO,
            SUM            : function() { return new NodeType.aggregate(arguments, "SUM",   -1, null, 1, 1); },
            SUM_ALL        : TODO,
            SUM_DISTINCT   : TODO,
            COUNT          : function() { return new NodeType.aggregate(arguments, "COUNT", -1, null, 1, 1); },
            COUNT_ALL      : TODO,
            COUNT_DISTINCT : TODO,
            AS     : USAGE, // We use expression.AS(), table.AS(), and column.AS() instead.
            IN     : TODO,
            UNION     : TODO,
            UNION_ALL : TODO,
            EXCEPT     : TODO,
            EXCEPT_ALL : TODO,
            INTERSECT     : TODO,
            INTERSECT_ALL : TODO,
            CROSS_JOIN       : function(tableDef) { return tableDef; },
            INNER_JOIN       : function(tableDef) { return new NodeType.join("INNER", tableDef); },
            LEFT_OUTER_JOIN  : function(tableDef) { return new NodeType.join("LEFT OUTER", tableDef); },
            RIGHT_OUTER_JOIN : TODO,
            FULL_OUTER_JOIN  : TODO,
            ON               : USAGE, // We use LEFT_OUTER_JOIN(x).ON() syntax instead.
            USING            : USAGE, // We use LEFT_OUTER_JOIN(x).USING() syntax instead.
            GROUP_BY   : function() { return new NodeType.groupBy(arguments); },
            HAVING     : function() { return new NodeType.having(arguments); },
            ORDER_BY   : function() { return new NodeType.orderBy(arguments); },
            LIMIT      : function(offset, total) { return new NodeType.limit(offset, total); },
            LIMIT_ALL  : function(offset) { return queryLang.LIMIT(-1, offset); },
            OFFSET     : USAGE, // We use the shortcut comma-based syntax of "LIMIT count, offset".
            ANY_SELECT : TODO,  // TODO: Consider using syntax of LT.ANY(Invoice.total, SELECT(...))
            ALL_SELECT : TODO,
            EXISTS     : TODO,
            WHERE_SQL  : function(sql) { return new NodeType.whereSql(sql); },
            HAVING_SQL : function(sql) { return new NodeType.havingSql(sql); }
        };

        keywords.SELECT = keywords.SELECT_ALL;

        for (var k in keywords)
            queryLang[k] = keywords[k];
        for (var tableName in tableInfos)
            queryLang[tableName] = new NodeType.tableDef(tableName, tableInfos[tableName]);
        return queryLang;
    }

    /////////////////////////////////////////////////////

    var compileJoinDriver = function(tables) { // The join driver naively visits the cross-product.
        var funcText = [ "var TrimPath_query_tmpJD = function(dataTables, joinFilter, whereFilter, bindings) {",
            "var result = [], filterArgs = [ bindings ];" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push("var T" + i + " = dataTables['" + tables[i][".name"] + "'] || [];");
        for (var i = 0; i < tables.length; i++) {
            funcText.push("for (var t"+i+" = 0; t"+i+" < T"+i+".length; t"+i+"++) {");
            funcText.push("var resultLength"+i+" = result.length;");
            funcText.push("filterArgs["+(i+1)+"] = T"+i+"[t"+i+"];");
        }
        funcText.push("if ((joinFilter == null || joinFilter.apply(null, filterArgs) == true) && ");
        funcText.push("    (whereFilter == null || whereFilter.apply(null, filterArgs) == true))");
        funcText.push(    "result.push(filterArgs.slice(0));");
        for (var i = tables.length - 1; i >= 0; i--) {
            funcText.push("}");
            if (i >= 1 && tables[i].joinType == "LEFT OUTER") {
                funcText.push("if (resultLength"+(i-1)+" == result.length) {");
                for (var j = i; j < tables.length; j++)
                    funcText.push("filterArgs[" + (j+1) + "] = ");
                funcText.push("{}; if (whereFilter == null || whereFilter.apply(null, filterArgs) == true) result.push(filterArgs.slice(0)); }");
            }
        }
        funcText.push("return result; }; TrimPath_query_tmpJD");
        return theEval(funcText.join(""));
    }

    var compileFilter = function(bodyFunc, tables, whereExpressions, flags) { // Used for WHERE and HAVING.
        var funcText = [ "var TrimPath_query_tmpWF = function(_BINDINGS" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push(", " + tables[i][".alias"]);
        funcText.push("){ with(_BINDINGS) {");
        bodyFunc(funcText, tables, whereExpressions, flags);
        funcText.push("return true; }}; TrimPath_query_tmpWF");
        return theEval(funcText.join(""));
    }

    var compileFilterForJoin = function(funcText, tables, whereExpressions, flags) {
        for (var i = 0; i < tables.length; i++) { // Emit JOIN ON/USING clauses.
            if (tables[i].joinType != null) {
                if (tables[i].ON_exprs != null || tables[i].USING_exprs != null) {
                    funcText.push("if (!(");
                    if (tables[i].ON_exprs != null && tables[i].ON_exprs[0].exprs != null) {
                        funcText.push(tables[i].ON_exprs[0].exprs[0].toJs())
                    } else if(tables[i].ON_exprs != null)
                        funcText.push(map(tables[i].ON_exprs, toJs).join(" && "));
                    if (tables[i].USING_exprs != null)
                        funcText.push(map(tables[i].USING_exprs, function(col) {
                            return "(" + tables[i - 1][".alias"] + "." + col + " == " + tables[i][".alias"] + "." + col + ")";
                        }).join(" && "));
                    funcText.push(")) return false;");
                }
            }
        }
    }

    var compileFilterForWhere = function(funcText, tables, whereExpressions, flags) {
        if (whereExpressions != null) {
            funcText.push("if (!(("); // Emit the main WHERE clause test.
            for (var i = 0; i < whereExpressions.length; i++) {
                if (i > 0)
                    funcText.push(") && (");
                funcText.push(toJs(whereExpressions[i], flags));
            }
            funcText.push("))) return false;");
        }
    }
    var compileColumnConvertor = function(tables, columnExpressions) {
        var funcText = [ "var TrimPath_query_tmpCC = function(_BINDINGS, " ];
        var table_aliases = [];
        for (var i = 0; i < tables.length; i++)
            table_aliases.push(tables[i][".alias"]);
        funcText.push(arrayUniq(table_aliases).join(', '));
        funcText.push(", with_table){ with(_BINDINGS) {");
        funcText.push("var _RESULT = {};");
        funcText.push("if(with_table) {");
        compileColumnConvertorHelper(funcText, columnExpressions, true);
        funcText.push("} else {");
        compileColumnConvertorHelper(funcText, columnExpressions, false);
        funcText.push("}");
        funcText.push("return _RESULT; }}; TrimPath_query_tmpCC");
        return theEval(funcText.join(""));
    }

    var test = function(stuff) {
        var i;
    }
    var compileColumnConvertorHelper = function(funcText, columnExpressions, with_table) {
        for (var i = 0; i < columnExpressions.length; i++) {
            var columnExpression = columnExpressions[i];
            if (columnExpression[".name"] == "*") {
                compileColumnConvertorHelper(funcText, columnExpression.tableDef[".allColumns"], with_table);
            } else {
                funcText.push("_RESULT['"); // TODO: Should we add _RESULT[i] as assignee?
                if(with_table == true) {
                    funcText.push(columnExpression.toString());
                } else {
                    funcText.push(columnExpression[".alias"]);
                }
                funcText.push("'] = (");
                funcText.push(toJs(columnExpression));
                funcText.push(");");
            }
        }
    }

    var dateToString = function(date) {
        if(typeof date == 'object')
            return [date.getFullYear(), '-', (date.getMonth()+1), '-', date.getDate()].join('');
        if(date == null)
            return null;
    }

    var compileOrderByComparator = function(orderByExpressions) {
        var funcText = [ "var TrimPath_query_tmpOC = function(A, B) { var a, b; " ];
        for (var i = 0; i < orderByExpressions.length; i++) {
            var orderByExpression = orderByExpressions[i];
            if(orderByExpression.tableDef) {
                funcText.push("a = A['" + orderByExpression[".alias"] + "'] || A['" +
                    orderByExpression.tableDef['.alias'] + '.' + orderByExpression[".alias"] + "'] || '';");
                funcText.push("b = B['" + orderByExpression[".alias"] + "'] || B['" +
                    orderByExpression.tableDef['.alias'] + '.' + orderByExpression[".alias"] + "'] || '';");
            } else {
                funcText.push("a = A['" + orderByExpression[".alias"] + "'] || '';");
                funcText.push("b = B['" + orderByExpression[".alias"] + "'] || '';");
            }
            var sign = (orderByExpression.order == "DESC" ? -1 : 1);
            funcText.push("if (a.valueOf() < b.valueOf()) return " + (sign * -1) + ";");
            funcText.push("if (a.valueOf() > b.valueOf()) return " + (sign * 1) + ";");
        }
        funcText.push("return 0; }; TrimPath_query_tmpOC");
        return theEval(funcText.join(""));
    }

    var compileGroupByCalcValues = function(tables, groupByExpressions) {
        var funcText = [ "var TrimPath_query_tmpGC = function(_BINDINGS" ];
        for (var i = 0; i < tables.length; i++)
            funcText.push(", " + tables[i][".alias"]);
        funcText.push("){ var _RESULT = [];");
        for (var i = 0; i < groupByExpressions.length; i++) {
            funcText.push("_RESULT.push(");
            funcText.push(toJs(groupByExpressions[i]));
            funcText.push(");");
        }
        funcText.push("return _RESULT; }; TrimPath_query_tmpGC");
        return theEval(funcText.join(""));
    }

    /////////////////////////////////////////////////////

    var groupByComparator = function(a, b) {
        return arrayCompare(a.groupByValues, b.groupByValues);
    }

    var arrayCompare = function(x, y) {
        if (x == null || y == null) return -1; // Required behavior on null for GROUP_BY to work.
        for (var i = 0; i < x.length && i < y.length; i++) {
            if (x[i] < y[i]) return -1;
            if (x[i] > y[i]) return 1;
        }
        return 0;
    }

    var toSqlWithAlias = function(obj, flags) {
        var res = toSql(obj, flags);
        if (obj[".alias"] != null &&
            obj[".alias"] != obj[".name"])
            return res + " AS " + obj[".alias"];
        return res;
    }
    var toSql = function(obj, flags) { return toX(obj, "toSql", flags); }
    var toJs  = function(obj, flags) { return toX(obj, "toJs",  flags); }
    var toX   = function(obj, funcName, flags) {
        if (typeof(obj) == "object" && obj[funcName] != null)
            return obj[funcName].call(obj, flags);
        return theString(obj);
    }

    var zeroDefault = function(x) { return (x != null ? x : 0); }

    var map = function(arr, func, arg2) { // Lisp-style map function on an Array.
        for (var result = [], i = 0; i < arr.length; i++)
            result.push(func(arr[i], arg2));
        return result;
    }

    var cleanArray = function(src, quotes) {
        for (var result = [], i = 0; i < src.length; i++)
            result.push(cleanString(src[i], quotes));
        return result;
    }

    var cleanString = TrimPath.TEST.cleanString = function(src, quotes) { // Example: "hello" becomes "'hello'"
        if (src instanceof theString || typeof(src) == "string") {
            src = theString(src).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            if (quotes != false) // Handles null as true.
                src = "'" + src + "'";
        }
        return src;
    }

    var findClause = function(str, regexp) {
        var clauseEnd = str.search(regexp);
        if (clauseEnd < 0)
            clauseEnd = str.length;
        return str.substring(0, clauseEnd);
    }

}) ();

module.exports = {
    makeQueryLang: TrimPath.makeQueryLang,
    QueryLang: QueryLang
};

},{}]},{},[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]);
