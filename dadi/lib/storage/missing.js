const fs = require('fs')
const path = require('path')

const config = require(path.join(__dirname, '/../../../config'))

const Missing = function () {
  this.url = config.get('notFound.images.enabled')
    ? config.get('notFound.images.path')
    : null
}

Missing.prototype.get = function () {
  return new Promise((resolve, reject) => {
    if (!this.url) {
      return reject({ statusCode: 404 })
    }

    // attempt to open
    let stream = fs.createReadStream(this.url)

    stream.on('open', () => {
      // check file size
      let stats = fs.statSync(this.url)
      let fileSize = parseInt(stats.size)

      if (fileSize === 0) {
        let err = {
          statusCode: 404,
          message: 'File size is 0 bytes'
        }

        return reject(err)
      }

      return resolve(stream)
    })

    stream.on('error', () => {
      let err = {
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
