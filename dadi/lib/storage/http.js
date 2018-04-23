'use strict'

const config = require('./../../../config')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const sha1 = require('sha1')
const urljoin = require('url-join')
const wget = require('wget-improved')

const tmpDirectory = path.resolve(path.join(__dirname, '/../../../workspace/_tmp'))

mkdirp(tmpDirectory, (err, made) => {
  if (err) {
    console.log(err)
  }
})

const HTTPStorage = function ({assetType = 'assets', domain, url}) {
  let isExternalURL = url.indexOf('http:') === 0 ||
    url.indexOf('https:') === 0
  let remoteAddress = config.get(`${assetType}.remote.path`, domain)

  if (!isExternalURL) {
    if (!remoteAddress) {
      throw new Error('Remote address not specified')
    }

    this.baseUrl = remoteAddress
  }

  this.url = url
}

/**
 * Removes the temporary file downloaded from the remote server
 */
HTTPStorage.prototype.cleanUp = function () {
  if (this.tmpFile) {
    try {
      fs.unlinkSync(this.tmpFile)
    } catch (err) {
      console.log(err)
    }
  }
}

HTTPStorage.prototype.getFullUrl = function () {
  if (this.baseUrl) {
    return urljoin(this.baseUrl, this.url)
  } else {
    return this.url
  }
}

HTTPStorage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    this.tmpFile = path.join(
      tmpDirectory,
      sha1(this.url) + '-' + Date.now() + path.extname(this.url)
    )

    let options = {
      headers: {
        'User-Agent': 'DADI CDN'
      }
    }

    let download = wget.download(
      this.getFullUrl(),
      this.tmpFile,
      options
    )

    download.on('error', (error) => {
      let expression = /Server responded with unhandled status: (\d*)/
      let match = (typeof error === 'string') && error.match(expression)
      let err = {
        statusCode: (match && parseInt(match[1])) || 400
      }

      switch (err.statusCode) {
        case 404:
          err.message = `Not Found: ${this.getFullUrl()}`

          break

        case 403:
          err.message = `Forbidden: ${this.getFullUrl()}`

          break

        default:
          err.message = `Remote server responded with error code ${err.statusCode} for URL: ${this.getFullUrl()}`

          break
      }

      return reject(err)
    })

    download.on('end', (output) => {
      return resolve(fs.createReadStream(this.tmpFile))
    })
  })
}

module.exports = HTTPStorage
module.exports.HTTPStorage = HTTPStorage
