var fs = require('fs')
var nodeUrl = require('url')
var path = require('path')
var Promise = require('bluebird')
var _ = require('underscore')

var config = require(__dirname + '/../../../config')

var DiskStorage = function (settings, url) {
  var self = this

  this.url = nodeUrl.parse(url, true).pathname
  this.path = path.resolve(settings.directory.path)
}

DiskStorage.prototype.getFullUrl = function () {
  return decodeURI(path.join(this.path, this.url.replace('disk', '')))
}

DiskStorage.prototype.getLastModified = function () {
  return this.lastModified
}

DiskStorage.prototype.get = function () {
  var self = this

  return new Promise(function (resolve, reject) {
    // attempt to open
    var stream = fs.createReadStream(self.getFullUrl())

    stream.on('open', function () {
      // check file size
      var stats = fs.statSync(self.getFullUrl())
      var fileSize = parseInt(stats.size)

      self.lastModified = stats.mtime

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
        message: 'File not found: ' + self.getFullUrl()
      }

      return reject(err)
    })
  })
}

module.exports = function (settings, url) {
  return new DiskStorage(settings, url)
}

module.exports.DiskStorage = DiskStorage
