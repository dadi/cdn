const config = require('./../../../config')
const fs = require('fs')
const nodeUrl = require('url')
const path = require('path')

const Missing = require(path.join(__dirname, '/missing'))

const DiskStorage = function ({assetType = 'assets', url}) {
  let assetPath = config.get(`${assetType}.directory.path`)

  this.url = nodeUrl.parse(url, true).pathname
  this.path = path.resolve(assetPath)
}

DiskStorage.prototype.getFullUrl = function () {
  return decodeURIComponent(path.join(this.path, this.url))
}

DiskStorage.prototype.getLastModified = function () {
  return this.lastModified
}

DiskStorage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    // attempt to open
    let stream = fs.createReadStream(this.getFullUrl())

    stream.on('open', () => {
      // check file size
      let stats = fs.statSync(this.getFullUrl())
      let fileSize = parseInt(stats.size)

      this.lastModified = stats.mtime

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
        message: 'File not found: ' + this.getFullUrl()
      }

      return new Missing().get().then(stream => {
        this.notFound = true
        this.lastModified = new Date()
        return resolve(stream)
      }).catch(e => {
        console.log(e)
        return reject(err)
      })
    })
  })
}

module.exports = DiskStorage
module.exports.DiskStorage = DiskStorage
