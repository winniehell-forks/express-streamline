module.exports = express = require('express');

// We support resetting Streamline's global context, but that requires (no pun
// intended) `require()`'ing Streamline, which may not be present at runtime,
// or at least not in our node_modules path. So be robust to that.
// TODO: Does this work in Streamline's "standalone" mode? Is that a use case?
var streamlineGlobal = null;
try {
    streamlineGlobal = require('streamline/lib/globals');
} catch (err) {}

var Layer = require('express/lib/router/layer');
Layer.prototype.handle_request = function handle(req, res, next) {
    var fn = this.handle;

    if (fn.length > 3) {
        // not a standard request handler
        return next();
    }

    try {
        function callback(next) {
            return function (err) {
                if (err) return next(err);

                if (err === null) {
                    next();
                }
            }
        }

        if(this.route) {
            fn(req, res, callback(next));
        }
        else {
            fn(req, res, next);
        }

    } catch (err) {
        next(err);
    }
};

// Patch app.handle() to reset Streamline's global context at the beginning of
// every request. This method is only present in Connect's prototype, *not*
// Express's, so we patch proto.init(), which is called on app creation.
// https://github.com/strongloop/express/blob/3.15.2/lib/express.js#L39
if (streamlineGlobal) {
    var proto = express.application;
    var origProtoInit = proto.init;

    proto.init = function () {
        var origAppHandle = this.handle;

        this.handle = function () {
            streamlineGlobal.context = {};
            return origAppHandle.apply(this, arguments);
        };

        return origProtoInit.apply(this, arguments)
    };
}
