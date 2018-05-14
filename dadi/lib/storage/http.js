'use strict'

const config = require('./../../../config')
const http = require('http')
const https = require('https')
const mkdirp = require('mkdirp')
const PassThrough = require('stream').PassThrough
const path = require('path')
const url = require('url')
const urljoin = require('url-join')

const Missing = require(path.join(__dirname, '/missing'))

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

  this.domain = domain
  this.url = url
}

HTTPStorage.prototype.getFullUrl = function () {
  if (this.baseUrl) {
    return urljoin(this.baseUrl, this.url)
  } else {
    return this.url
  }
}

HTTPStorage.prototype.get = function () {
  let outputStream = PassThrough()

  return new Promise((resolve, reject) => {
    let parsedUrl = url.parse(this.getFullUrl())
    let requestFn = parsedUrl.protocol === 'https:'
      ? https
      : http

    requestFn.get({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      port: parsedUrl.port,
      headers: {
        'User-Agent': 'DADI CDN'
      }
    }, res => {
      if (res.statusCode === 200) {
        res.pipe(outputStream)

        return resolve(outputStream)
      }

      let httpError

      switch (res.statusCode) {
        case 404:
          httpError = new Error(`Not Found: ${this.getFullUrl()}`)

          break

        case 403:
          httpError = new Error(`Forbidden: ${this.getFullUrl()}`)

          break

        default:
          httpError = new Error(`Remote server responded with error code ${res.statusCode} for URL: ${this.getFullUrl()}`)

          break
      }

      httpError.statusCode = res.statusCode

      if (res.statusCode === 404) {
        new Missing().get({
          domain: this.domain
        }).then(stream => {
          this.notFound = true
          this.lastModified = new Date()

          resolve(stream)
        }).catch(() => {
          reject(httpError)
        })
      } else {
        reject(httpError)
      }
    })
  })
}

module.exports = HTTPStorage
module.exports.HTTPStorage = HTTPStorage
