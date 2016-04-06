var Promise = require('bluebird');
var Readable = require('stream').Readable;
var request = require('request');
var urljoin = require('url-join');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');

var HTTPStorage = function (url) {
  var self = this;

  this.url = url;
  this.baseUrl = config.get('images.remote.path');

  this.getFullUrl = function() {
    return urljoin(self.baseUrl, self.url.replace('/http', ''))
  }
}

HTTPStorage.prototype.get = function () {
  var self = this;
  console.log(self.getFullUrl())
  return new Promise(function(resolve, reject) {
    request
    .get(self.getFullUrl())
    .on('response', function(response) {
      if (response.statusCode === 200) {
        return resolve(response)
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
    // var size = parseInt(response.headers['content-length']);
    // if(size === 0) {
    //   return help.displayErrorPage(404, 'File size is 0 byte.', res);
    // }
  })
}

module.exports = function (url) {
  return new HTTPStorage(url);
}

module.exports.HTTPStorage = HTTPStorage
