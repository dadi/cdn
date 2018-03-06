const path = require('path')

const Cache = require(path.join(__dirname, '/../cache'))()
const StorageFactory = require(path.join(__dirname, '/../storage/factory'))

const Plugin = function (req, plugin) {
  this.headers = {}
  this.plugin = plugin
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
}

Plugin.prototype.contentType = function () {
  return this.headers['content-type']
}

Plugin.prototype.get = function () {
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
}

Plugin.prototype.setHeader = function (header, value) {
  this.headers[header] = value
}

module.exports = Plugin
