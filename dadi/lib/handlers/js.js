const babel = require('babel-core')
const path = require('path')
const Readable = require('stream').Readable
const url = require('url')

const StorageFactory = require(path.join(__dirname, '/../storage/factory'))
const Cache = require(path.join(__dirname, '/../cache'))

/**
 * Creates a new JSHandler instance.
 *
 * @param {String} format The extension of the file being handled
 * @param {Object} req    The request instance
 */
const JSHandler = function (format, req) {
  this.legacyURLOverrides = this.getLegacyURLOverrides(req.url)
  this.url = url.parse(
    this.legacyURLOverrides.url || req.url,
    true
  )

  this.cache = Cache()
  this.cacheKey = this.url.href

  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null
}

/**
 * Returns the content type for the files handled.
 *
 * @return {String} The content type
 */
JSHandler.prototype.contentType = function () {
  return 'application/javascript'
}

/**
 * Retrieves a file for a given URL path.
 *
 * @return {Promise} A stream with the file
 */
JSHandler.prototype.get = function () {
  return this.cache.getStream(this.cacheKey).then(stream => {
    if (stream) return stream

    this.storageHandler = this.storageFactory.create(
      'asset',
      this.url.pathname.slice(1),
      false
    )

    return this.storageHandler.get().then(stream => {
      return this.processFile(stream)
    }).then(stream => {
      return this.cache.cacheFile(stream, this.cacheKey)
    })
  })
}

JSHandler.prototype.getBabelOptions = function () {
  const query = this.url.query

  let options = {
    babelrc: false,
    presets: []
  }

  if (this.legacyURLOverrides.compress || query.compress === '1') {
    options.presets.push('minify')
  }

  return options
}

/**
 * Returns the filename for the given request.
 *
 * @return {String} The filename
 */
JSHandler.prototype.getFilename = function () {
  return this.url.pathname.split('/').slice(-1)[0]
}

/**
 * Returns the last modified date for the asset.
 *
 * @return {Number} The last modified timestamp
 */
JSHandler.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

JSHandler.prototype.getLegacyURLOverrides = function (url) {
  let overrides = {}

  const legacyURLMatch = url.match(/\/js(\/(\d))?/)

  if (legacyURLMatch) {
    if (legacyURLMatch[2]) {
      overrides.compress = legacyURLMatch[2] === '1'
    }

    overrides.url = url.slice(legacyURLMatch[0].length)
  }

  return overrides
}

JSHandler.prototype.processFile = function (stream) {
  let inputCode = ''

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      inputCode += chunk
    })
    stream.on('end', () => {
      const outputCode = babel.transform(inputCode, this.getBabelOptions()).code
      const outputStream = new Readable()

      outputStream.push(outputCode)
      outputStream.push(null)

      resolve(outputStream)
    })
  })
}

module.exports = function (format, req) {
  return new JSHandler(format, req)
}

module.exports.JSHandler = JSHandler
