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
 *
 */
Cache.prototype.cacheFile = function (stream, key, cb) {
  if (!this.enabled) return cb(stream)

  var cacheStream = PassThrough()
  var responseStream = PassThrough()
  stream.pipe(cacheStream)
  stream.pipe(responseStream)

  var encryptedKey = sha1(key)

  cache.set(encryptedKey, cacheStream).then(() => {
    return cb(responseStream)
  })
}

/**
 *
 */
Cache.prototype.get = function (key) {
  return new Promise((resolve, reject) => {
    if (!this.enabled) return resolve(null)

    cache.get(key).then((value) => {
      return resolve(value)
    }).catch((err) => {
      return reject(err)
    })
  })
}

/**
 *
 */
Cache.prototype.set = function (key, value) {
  return new Promise((resolve, reject) => {
    if (!this.enabled) return resolve(null)

    cache.set(key, value).then(() => {
      return resolve()
    }).catch((err) => {
      return reject(err)
    })
  })
}

/**
 *
 */
Cache.prototype.getStream = function (key, cb) {
  if (!this.enabled) return cb(null)

  var encryptedKey = sha1(key)

  cache.get(encryptedKey).then((stream) => {
    return cb(stream)
  }).catch((err) => {
    return cb(null)
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
