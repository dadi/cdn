const fs = require('fs')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const Missing = function() {}

Missing.prototype.get = function({domain, isDirectory = false}) {
  const imagePath = config.get('notFound.images.enabled', domain)
    ? config.get('notFound.images.path', domain)
    : null

  return new Promise((resolve, reject) => {
    if (!imagePath || isDirectory) {
      return reject({statusCode: 404})
    }

    const errorNotFound = {
      statusCode: 404,
      message: `File not found: ${imagePath}`
    }

    const stream = fs.createReadStream(imagePath)

    stream.on('open', () => {
      // Check file size.
      fs.stat(imagePath, (error, stats) => {
        if (error) {
          return reject(errorNotFound)
        }

        const fileSize = parseInt(stats.size)

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

module.exports = function() {
  return new Missing()
}

module.exports.Missing = Missing
