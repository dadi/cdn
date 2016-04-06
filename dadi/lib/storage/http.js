var Promise = require('bluebird');
var Readable = require('stream').Readable;
var request = require('request');
var nodeUrl = require('url');
var _ = require('underscore');

var config = require(__dirname + '/../config');

module.exports = function (url) {
  var self = this;

  this.url = url;
  this.baseUrl = config.get('images.remote.path');

  this.getFullUrl = function() {
    return nodeUrl.resolve(self.baseUrl, self.url.replace('/remote', ''))
  }

  this.get = function () {
    return new Promise(function(resolve, reject) {
      request({ url: self.getFullUrl() }, function (err, res, body) {
        if (err) {
          reject(err)
        }

        if (res.statusCode === 200) {
          var stream = new Readable();
          stream.push(body);
          stream.push(null);

          resolve(stream)
        }
        else {
          reject(res.statusCode)
        }
        //if (!err && res.statusCode === 200) {
          // var size = parseInt(response.headers['content-length']);
          // if(size === 0) {
          //   return help.displayErrorPage(404, 'File size is 0 byte.', res);
          // }
          //var tmpReadStream = request({url: url});

        //}
        //else {
          //help.displayErrorPage(404, 'Image path "' + url + '" isn\'t valid.', res);

        //}
      })
	  })
  }
}
