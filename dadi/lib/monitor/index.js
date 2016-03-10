var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');

var Monitor = function (path) {
    if (!path) throw new Error('Must provide path to instantiate Monitor');

    this.path = path;

    var self = this;
    this.watcher = fs.watch(this.path, function (eventName, filename) {
        self.emit('change', filename);
    });
};

// inherits from EventEmitter
util.inherits(Monitor, EventEmitter);

Monitor.prototype.close = function () {
    this.watcher.close.apply(this.watcher, arguments);
};

// exports
module.exports = function (path) {
    return new Monitor(path);
};

module.exports.Monitor = Monitor;
