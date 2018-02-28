const babel = require('babel-core')
const babelPresetEnv = require('babel-preset-env').default
const farmhash = require('farmhash')
const path = require('path')
const Readable = require('stream').Readable
const url = require('url')
const userAgent = require('useragent')

const Cache = require(path.join(__dirname, '/../cache'))
const config = require(path.join(__dirname, '/../../../config'))
const StorageFactory = require(path.join(__dirname, '/../storage/factory'))

/**
 * Creates a new JSHandler instance.
 *
 * @param {String} format The extension of the file being handled
 * @param {Object} req    The request instance
 */
const JSHandler = function (format, req, {
  options = {}
} = {}) {
  this.legacyURLOverrides = this.getLegacyURLOverrides(req.url)
  this.options = options
  this.url = url.parse(
    this.legacyURLOverrides.url || req.url,
    true
  )

  this.cache = Cache()
  this.cacheKey = this.url.href

  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null

  this.userAgent = req.headers['user-agent']
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
  if (this.isTransformEnabled()) {
    this.cacheKey += this.getBabelPluginsHash()
  }

  return this.cache.getStream(this.cacheKey).then(stream => {
    if (stream) return stream

    this.storageHandler = this.storageFactory.create(
      'asset',
      this.url.pathname.slice(1),
      false
    )

    return this.storageHandler.get().then(stream => {
      return this.transform(stream)
    }).then(stream => {
      return this.cache.cacheFile(stream, this.cacheKey)
    })
  })
}

/**
 * Returns a Babel configuration object for the current request.
 *
 * @return {Object} Babel configuration object
 */
JSHandler.prototype.getBabelConfig = function () {
  const query = this.url.query

  let options = {
    babelrc: false,
    presets: []
  }

  if (this.isTransformEnabled()) {
    options.presets.push(['env', this.getBabelEnvOptions()])
  }

  if (this.legacyURLOverrides.compress || query.compress === '1' || this.options.compress) {
    options.presets.push('minify')
  }

  return options
}

/**
 * Returns a Babel targets object for the user agent of the current
 * request.
 *
 * @return {Object} Babel targets object
 */
JSHandler.prototype.getBabelEnvOptions = function () {
  const agent = userAgent.parse(this.userAgent).toAgent()
  const dotIndexes = Array.from(agent).reduce((indexes, character, index) => {
    if (character === '.') {
      return indexes.concat(index)
    }

    return indexes
  }, [])
  const sanitisedAgent = dotIndexes.length <= 1
    ? agent
    : agent.slice(0, dotIndexes[1])

  return {
    targets: {
      browsers: [sanitisedAgent]
    }
  }
}

/**
 * Creates a non-cryptographic hash from the list of Babel plugins
 * required to transform the code for the current user agent.
 *
 * @return {String} A hash of all the plugins
 */
JSHandler.prototype.getBabelPluginsHash = function () {
  const functions = babelPresetEnv(this.getBabelEnvOptions()).plugins.map(plugin => plugin[0])
  const hashSource = functions.reduce((result, functionSource) => {
    if (typeof functionSource === 'function') {
      return result + functionSource.toString()
    } else if (typeof functionSource.default === 'function') {
      return result + functionSource.default.toString()
    }

    return result
  }, '')
  const hash = farmhash.fingerprint64(hashSource)

  return hash
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

/**
 * Looks for parameters in the URL using legacy syntax
 * (e.g. /js/0/file.js)
 *
 * @param  {String} url The URL
 * @return {Object}     A list of parameters and their value
 */
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

/**
 * Returns true if transforms are enabled for this request.
 *
 * @return {Boolean}
 */
JSHandler.prototype.isTransformEnabled = function () {
  // Currently behind a feature flag.
  if (!config.get('experimental.jsTranspiling')) return false

  return (this.url.query.transform || (this.options.transform === true))
}

JSHandler.prototype.setBaseUrl = function (baseUrl) {
  this.url = url.parse(baseUrl, true)
}

/**
 * Transforms the code from the stream provided using Babel
 *
 * @param  {Stream} stream The input stream
 * @return {Promise<Stream>}
 */
JSHandler.prototype.transform = function (stream) {
  let inputCode = ''

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      inputCode += chunk
    })
    stream.on('end', () => {
      const outputStream = new Readable()

      try {
        const outputCode = babel.transform(inputCode, this.getBabelConfig()).code

        outputStream.push(outputCode)
      } catch (err) {
        outputStream.push(inputCode)
      }

      outputStream.push(null)

      resolve(outputStream)
    })
  })
}

module.exports = function (format, request, handlerData) {
  return new JSHandler(format, request, handlerData)
}

module.exports.JSHandler = JSHandler
