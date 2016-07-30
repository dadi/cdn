var fs = require('fs')
var nodeUrl = require('url')
var path = require('path')
var Promise = require('bluebird')
var _ = require('underscore')

var config = require(__dirname + '/../../../config')

var Missing = function () {
  this.url = config.get('images.missing.enabled') ? config.get('images.missing.path') : null
}

Missing.prototype.get = function () {
  var self = this

  return new Promise(function (resolve, reject) {

    console.log(self)

    if (!self.url) {
      return reject({statusCode: 404})
    }

    // attempt to open
    var stream = fs.createReadStream(self.url)

    stream.on('open', function () {
      // check file size
      var stats = fs.statSync(self.url)
      var fileSize = parseInt(stats.size)

      if (fileSize === 0) {
        var err = {
          statusCode: 404,
          message: 'File size is 0 bytes'
        }

        return reject(err)
      }

      return resolve(stream)
    })

    stream.on('error', function () {
      var err = {
        statusCode: 404,
        message: 'File not found: ' + self.url
      }

      return reject(err)
    })
  })
}

module.exports = function () {
  return new Missing()
}

module.exports.Missing = Missing
