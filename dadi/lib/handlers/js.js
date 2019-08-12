const babel = require('babel-core')
const babelPresetEnv = require('babel-preset-env').default
const Cache = require('./../cache')
const config = require('./../../../config')
const farmhash = require('farmhash')
const help = require('./../help')
const Readable = require('stream').Readable
const url = require('url')
const userAgent = require('useragent')
const StorageFactory = require('./../storage/factory')

const DEFAULT_UA = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)'

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
  this.url = url.parse(
    this.legacyURLOverrides.url || req.url,
    true
  )

  const mergedOptions = Object.assign({}, this.url.query, this.legacyURLOverrides, options)

  // Normalising boolean values (e.g. true vs. 1 vs. '1').
  this.options = Object.keys(mergedOptions).reduce((result, key) => {
    let value

    switch (mergedOptions[key]) {
      case 0:
      case '0':
      case 'false':
        value = false

        break

      case 1:
      case '1':
      case 'true':
        value = true

        break

      default:
        value = mergedOptions[key]
    }

    result[key] = value

    return result
  }, {})

  this.isExternalUrl = this.url.pathname.indexOf('http://') > 0 || this.url.pathname.indexOf('https://') > 0

  this.cache = Cache()
  this.cacheKey = [req.__domain, this.url.href]

  this.req = req

  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null

  this.userAgent = req.headers['user-agent']
}

/**
 * Retrieves a file for a given URL path.
 *
 * @return {Promise} A stream with the file
 */
JSHandler.prototype.get = function () {
  if (this.isTransformEnabled()) {
    this.cacheKey.push(this.getBabelPluginsHash())
  }

  return this.cache.getStream(this.cacheKey, {
    ttl: config.get('caching.ttl', this.req.__domain)
  }).then(stream => {
    if (stream) {
      this.isCached = true

      return stream
    }

    this.storageHandler = this.storageFactory.create(
      'asset',
      this.url.pathname.slice(1),
      {domain: this.req.__domain}
    )

    // Aborting the request if full remote URL is required and not enabled.
    if (
      this.isExternalUrl &&
      (
        !config.get('assets.remote.enabled', this.req.__domain) ||
        !config.get('assets.remote.allowFullURL', this.req.__domain)
      )
    ) {
      let err = {
        statusCode: 403,
        message: 'Loading assets from a full remote URL is not supported by this instance of DADI CDN'
      }

      return Promise.reject(err)
    }

    return this.storageHandler.get().then(stream => {
      const {compress, transform} = this.options

      console.log({compress, transform})

      // (!) TO DO: normalise the format of the options somewhere upstream.
      if (
        compress === '1' ||
        compress === true ||
        transform === '1' ||
        transform === true
      ) {
        return this.transform(stream)
      }

      return stream
    }).then(stream => {
      return this.cache.cacheFile(stream, this.cacheKey, {
        ttl: config.get('caching.ttl', this.req.__domain)
      })
    })
  }).then(stream => {
    return help.streamToBuffer(stream)
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
    options.presets.push(['env', this.getBabelEnvOptions(this.userAgent)])
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
JSHandler.prototype.getBabelEnvOptions = function (userAgentString) {
  const agent = userAgent.parse(userAgentString).toAgent()

  // If the agent is "Other", it means we don't have a valid browser
  // target to give to the Babel preset. When this happens, we assume
  // we're dealing with an old browser and therefore transpile for the
  // default target, defined by the user agent string in `DEFAULT_UA`.
  if (agent.indexOf('Other ') === 0) {
    return this.getBabelEnvOptions(DEFAULT_UA)
  }

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
  const babelOptions = this.getBabelEnvOptions(this.userAgent)
  const functions = babelPresetEnv(null, babelOptions).plugins.map(plugin => plugin[0])
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
 * Returns the content type for the files handled.
 *
 * @return {String} The content type
 */
JSHandler.prototype.getContentType = function () {
  return 'application/javascript'
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
  if (!config.get('experimental.jsTranspiling', this.req.__domain)) {
    return false
  }

  return (this.url.query.transform || (this.options.transform === true))
}

/**
 * Sets the base URL (excluding any recipe or route nodes)
 */
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
