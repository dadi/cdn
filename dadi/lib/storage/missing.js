var fs = require('fs')
var path = require('path')

var config = require(path.join(__dirname, '/../../../config'))

var Missing = function () {
  this.url = config.get('notFound.images.enabled') ? config.get('notFound.images.path') : null
}

Missing.prototype.get = function () {
  return new Promise((resolve, reject) => {
    if (!this.url) {
      return reject({ statusCode: 404 })
    }

    // attempt to open
    var stream = fs.createReadStream(this.url)

    stream.on('open', () => {
      // check file size
      var stats = fs.statSync(this.url)
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

    stream.on('error', () => {
      var err = {
        statusCode: 404,
        message: 'File not found: ' + this.url
      }

      return reject(err)
    })
  })
}

module.exports = function () {
  return new Missing()
}

module.exports.Missing = Missing
