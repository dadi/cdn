var Promise = require('bluebird');
var Readable = require('stream').Readable;
var request = require('request');
var stream = require('stream');
var urljoin = require('url-join');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');

var HTTPStorage = function (settings, url) {
  var self = this;

  if (!settings.remote.path) throw new Error('Remote address not specified')

  this.url = url;
  this.baseUrl = settings.remote.path;

  this.getFullUrl = function() {
    return urljoin(self.baseUrl, self.url.replace('/http/', ''))
  }
}

HTTPStorage.prototype.get = function () {
  var self = this;

  return new Promise(function(resolve, reject) {
    request
    .get(self.getFullUrl())
    .on('response', function(response) {
      if (response.statusCode === 200) {
        var bufferStream = new stream.PassThrough()
        response.pipe(bufferStream)
        return resolve(bufferStream)
      }
      else {
        var err = {
          statusCode: response.statusCode,
          message: response.statusMessage + ': ' + self.getFullUrl()
        }

        return reject(err)
      }
    })
    .on('error', function(err) {
      return reject(err)
    })
  })
}

module.exports = function (settings, url) {
  return new HTTPStorage(settings, url);
}

module.exports.HTTPStorage = HTTPStorage
