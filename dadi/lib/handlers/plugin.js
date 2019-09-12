const Cache = require('./../cache')()
const help = require('./../help')
const StorageFactory = require('./../storage/factory')

const Plugin = function(req, plugin) {
  this.headers = {}
  this.plugin = plugin
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
}

Plugin.prototype.get = function() {
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
    ).then(stream => {
      return help.streamToBuffer(stream)
    })
  } catch (err) {
    const error = new Error(err)

    error.message = 'A plugin has thrown a fatal error.'
    error.statusCode = 500

    return Promise.reject(error)
  }
}

Plugin.prototype.getContentType = function() {
  return this.headers['content-type']
}

Plugin.prototype.getHeader = function(header) {
  return this.headers[header.toLowerCase()]
}

Plugin.prototype.setHeader = function(header, value) {
  this.headers[header.toLowerCase()] = value
}

module.exports = Plugin
