const path = require('path')

const Cache = require(path.join(__dirname, '/../cache'))()
const StorageFactory = require(path.join(__dirname, '/../storage/factory'))

const Plugin = function (req, plugin) {
  this.headers = {}
  this.plugin = plugin
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
}

Plugin.prototype.get = function () {
  try {
    return Promise.resolve(
      this.plugin({
        assetStore: this.storageFactory.create,
        cache: {
          get: Cache.getStream.bind(Cache),
          set: Cache.cacheFile.bind(Cache)
        },
        req: this.req,
        setHeader: this.setHeader.bind(this)
      })
    )
  } catch (err) {
    let error = new Error(err)

    error.message = 'A plugin has thrown a fatal error.'
    error.statusCode = 500

    return Promise.reject(error)
  }
}

Plugin.prototype.getContentType = function () {
  return this.headers['content-type']
}

Plugin.prototype.getHeader = function (header) {
  return this.headers[header.toLowerCase()]
}

Plugin.prototype.setHeader = function (header, value) {
  this.headers[header.toLowerCase()] = value
}

module.exports = Plugin
