var logger = require('@dadi/logger')
var PassThrough = require('stream').PassThrough
var path = require('path')
var sha1 = require('sha1')

var config = require(path.join(__dirname, '/../../../config'))

var DadiCache = require('@dadi/cache')
var cache = new DadiCache(config.get('caching'))

/**
 * Creates a new Cache instance for the server
 * @constructor
 */
var Cache = function () {
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled')

  if (config.get('env') !== 'test') logger.info({module: 'cache'}, 'Cache logging started')
}

var instance
module.exports = function () {
  if (!instance) {
    instance = new Cache()
  }
  return instance
}

// reset method for unit tests
module.exports.reset = function () {
  instance = null
}

/**
 * Adds a stream to the cache
 * @param  {Stream} stream The stream to be cached
 * @param  {String} key    The cache key
 * @return {Promise}
 */
Cache.prototype.cacheFile = function (stream, key) {
  if (!this.enabled) return Promise.resolve(stream)

  const encryptedKey = sha1(key)
  const cacheStream = PassThrough()
  const responseStream = PassThrough()

  stream.pipe(cacheStream)
  stream.pipe(responseStream)

  return cache.set(encryptedKey, cacheStream).then(() => responseStream)
}

/**
 *
 */
Cache.prototype.get = function (key) {
  if (!this.enabled) return Promise.resolve(null)

  return cache.get(key)
}

/**
 *
 */
Cache.prototype.set = function (key, value) {
  if (!this.enabled) return Promise.resolve(null)

  return cache.set(key, value)
}

/**
 * Gets a stream for the given cache key, if it exists.
 *
 * Will return a Promise that is resolved with the Stream
 * if the cache key exists, or resolved with null otherwise.
 *
 * @param  {String} key The cache key
 * @return {Promise}
 */
Cache.prototype.getStream = function (key) {
  if (!this.enabled) return Promise.resolve(null)

  const encryptedKey = sha1(key)

  return cache.get(encryptedKey).catch(err => { // eslint-disable-line handle-callback-err
    return null
  })
}

/**
 *
 */
module.exports.delete = function (pattern, callback) {
  cache.flush(pattern).then(() => {
    return callback(null)
  }).catch((err) => {
    console.log(err)
    return callback(null)
  })
}
