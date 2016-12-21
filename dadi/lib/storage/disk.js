var fs = require('fs')
var mkdirp = require('mkdirp')
var nodeUrl = require('url')
var path = require('path')

var Missing = require(path.join(__dirname, '/missing'))

var DiskStorage = function (settings, url) {
  this.settings = settings
  this.url = nodeUrl.parse(url, true).pathname
  this.path = path.resolve(this.settings.directory.path)
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

DiskStorage.prototype.put = function (stream, folderPath) {
  this.path = path.join(this.path, folderPath)

  return new Promise((resolve, reject) => {
    mkdirp(this.path, (err, made) => {
      if (err) {
        return reject(err)
      }

      var filePath = this.getFullUrl()

      fs.stat(filePath, (err, stats) => {
        if (err) {
          // file not found on disk, so ok to write it with no filename changes
        } else {
          // file exists, give it a new name
          var pathParts = path.parse(filePath)
          var newFileName = pathParts.name + '-' + Date.now().toString()
          filePath = path.join(this.path, newFileName + pathParts.ext)
        }

        var writeStream = fs.createWriteStream(filePath)
        stream.pipe(writeStream)

        var data = {
          message: 'File uploaded',
          path: filePath.replace(path.resolve(this.settings.directory.path), '')
        }

        return resolve(data)
      })
    })
  })
}

module.exports = function (settings, url) {
  return new DiskStorage(settings, url)
}

module.exports.DiskStorage = DiskStorage
