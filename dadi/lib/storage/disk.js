var fs = require('fs')
var nodeUrl = require('url')
var path = require('path')
var Promise = require('bluebird')

var Missing = require(path.join(__dirname, '/missing'))

var DiskStorage = function (settings, url) {
  this.url = nodeUrl.parse(url, true).pathname
  this.path = path.resolve(settings.directory.path)
}

DiskStorage.prototype.getFullUrl = function () {
  return decodeURIComponent(path.join(this.path, this.url.replace('disk', '')))
}

DiskStorage.prototype.getLastModified = function () {
  return this.lastModified
}

DiskStorage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    // attempt to open
    var stream = fs.createReadStream(this.getFullUrl())

    stream.on('open', () => {
      // check file size
      var stats = fs.statSync(this.getFullUrl())
      var fileSize = parseInt(stats.size)

      this.lastModified = stats.mtime

      if (fileSize === 0) {
        var err = {
          statusCode: 404,
          message: 'File size is 0 bytes'
        }

        return reject(err)
      }

      return resolve(stream)
    })

    stream.on('error', () => {
      var err = {
        statusCode: 404,
        message: 'File not found: ' + this.getFullUrl()
      }

      return new Missing().get().then((stream) => {
        this.notFound = true
        this.lastModified = new Date()
        return resolve(stream)
      }).catch((e) => {
        console.log(e)
        return reject(err)
      })
    })
  })
}

module.exports = function (settings, url) {
  return new DiskStorage(settings, url)
}

module.exports.DiskStorage = DiskStorage
