const fs = require('fs')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const Missing = function () {}

Missing.prototype.get = function ({domain} = {}) {
  let imagePath = config.get('notFound.images.enabled', domain)
    ? config.get('notFound.images.path', domain)
    : null

  return new Promise((resolve, reject) => {
    if (!imagePath) {
      return reject({ statusCode: 404 })
    }

    let stream = fs.createReadStream(imagePath)
    let errorNotFound = {
      statusCode: 404,
      message: `File not found: ${imagePath}`
    }

    stream.on('open', () => {
      // Check file size.
      fs.stat(imagePath, (error, stats) => {
        if (error) {
          return reject(errorNotFound)
        }

        let fileSize = parseInt(stats.size)

        if (fileSize === 0) {
          return reject({
            statusCode: 404,
            message: 'File size is 0 bytes'
          })
        }

        return resolve(stream)
      })
    })

    stream.on('error', () => {
      return reject(errorNotFound)
    })
  })
}

module.exports = function () {
  return new Missing()
}

module.exports.Missing = Missing
