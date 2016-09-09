var path = require('path')
var Promise = require('bluebird')
var request = require('request')
var stream = require('stream')
var urljoin = require('url-join')

var Missing = require(path.join(__dirname, '/missing'))

var HTTPStorage = function (settings, url) {
  if (!settings.remote.path) throw new Error('Remote address not specified')

  this.url = url
  this.baseUrl = settings.remote.path
}

HTTPStorage.prototype.getFullUrl = function () {
  return urljoin(this.baseUrl, this.url.replace('/http/', ''))
}

HTTPStorage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    request
      .get(this.getFullUrl())
      .on('response', (response) => {
        if (response.statusCode === 200) {
          var bufferStream = new stream.PassThrough()
          response.pipe(bufferStream)
          return resolve(bufferStream)
        } else {
          var err = {
            statusCode: response.statusCode,
            message: response.statusMessage + ': ' + this.getFullUrl()
          }

          if (err.statusCode === 404) {
            return new Missing().get().then((stream) => {
              this.notFound = true
              this.lastModified = new Date()
              return resolve(stream)
            }).catch((e) => {
              return reject(e)
            })
          }

          return reject(err)
        }
      })
      .on('error', (err) => {
        return reject(err)
      })
  })
}

module.exports = function (settings, url) {
  return new HTTPStorage(settings, url)
}

module.exports.HTTPStorage = HTTPStorage
