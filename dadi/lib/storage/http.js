'use strict'

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

const HTTPStorage = function (settings, url) {
  const isExternalURL = url.indexOf('http:') === 0 ||
    url.indexOf('https:') === 0

  if (!isExternalURL && settings && !settings.path) {
    throw new Error('Remote address not specified')
  }

  this.url = url

  if (settings && !isExternalURL) {
    this.baseUrl = settings.path
  }
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
    this.tmpFile = path.join(tmpDirectory, sha1(this.url) + '-' + Date.now() + path.extname(this.url))

    const options = {
      headers: {
        'User-Agent': 'DADI CDN'
      }
    }

    const download = wget.download(this.getFullUrl(), this.tmpFile, options)

    download.on('error', (error) => {
      let err = {}

      if (typeof error === 'string') {
        if (error.indexOf('404') > -1) {
          err.statusCode = '404'
          err.message = 'Not Found: ' + this.getFullUrl()
        } else if (error.indexOf('403') > -1) {
          err.statusCode = '403'
          err.message = 'Forbidden: ' + this.getFullUrl()
        }

        return reject(err)
      } else {
        return reject(error)
      }
    })

    download.on('end', (output) => {
      return resolve(fs.createReadStream(this.tmpFile))
    })
  })
}

module.exports = HTTPStorage
module.exports.HTTPStorage = HTTPStorage
