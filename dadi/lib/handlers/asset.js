var compressor = require('node-minify')
var fs = require('fs')
var path = require('path')
var url = require('url')

var StorageFactory = require(path.join(__dirname, '/../storage/factory'))
var Cache = require(path.join(__dirname, '/../cache'))

/**
 * Performs checks on the supplied URL and fetches the asset
 * @param {String} format - the type of asset requested
 * @param {Object} req - the original HTTP request
 */
var AssetHandler = function (format, req) {
  this.supportedExtensions = ['ttf', 'otf', 'woff', 'svg', 'eot']
  this.format = format
  this.compress = '0'
  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null
  this.cache = Cache()

  this.req = req

  var parsedUrl = url.parse(this.req.url, true)

  // '/js/1/test.js' -> [ 'js', '1', 'test.js' ]
  // '/fonts/test.ttf' -> [ fonts', 'test.ttf' ]
  this.urlParts = parsedUrl.pathname.split('/').filter(Boolean)

  // Is this a request with the legacy format (e.g. /js/0/test.js)
  // or the new one (e.g. /js/test.js?compress=0)?
  const isLegacyFormat = this.urlParts[1].length === 1

  if (this.format === 'css' || this.format === 'js') {
    this.url = this.urlParts.slice(isLegacyFormat ? 2 : 1).join('/')
    this.fileExt = this.format
    this.fileName = this.urlParts[this.urlParts.length - 1]
    this.compress = isLegacyFormat
      ? this.urlParts[1]
      : parsedUrl.query.compress || this.compress
  } else {
    this.url = this.urlParts.splice(1).join('/')
    this.fileName = path.basename(this.url)
    this.fileExt = path.extname(this.fileName).replace('.', '')
  }

  this.fullUrl = this.url
  this.cacheKey = this.req.url
}

AssetHandler.prototype.get = function () {
  var self = this
  self.isCached = false

  var message

  if (self.compress !== '0' && self.compress !== '1') {
    message = 'The path format is invalid. Use http://www.example.com/{format-(js, css)}/{compress-(0, 1)}/{filepath}'
  }

  if (self.format === 'fonts' && self.supportedExtensions.indexOf(self.fileExt.toLowerCase()) < 0) {
    message = 'Font file type should be TTF, OTF, WOFF, SVG or EOT'
  }

  if (message) {
    var err = {
      statusCode: 400,
      message: message
    }

    return Promise.reject(err)
  }

  // get from cache
  return this.cache.getStream(self.cacheKey).then(stream => {
    if (stream) return stream

    this.storageHandler = this.storageFactory.create(
      'asset',
      this.fullUrl,
      this.hasQuery
    )

    return this.storageHandler.get()
  }).then(stream => {
    return this.compressFile(stream)
  }).then(stream => {
    return this.cache.cacheFile(stream, this.cacheKey)
  })
}

AssetHandler.prototype.compressFile = function (stream) {
  var self = this

  return new Promise(function (resolve, reject) {
    // no compression required, send stream back
    if (self.format === 'fonts' || self.compress === '0') return resolve(stream)

    if (!fs.existsSync(path.resolve('./tmp'))) fs.mkdirSync(path.resolve('./tmp'))

    var compression = self.format === 'js' ? 'uglifyjs' : 'sqwish'

    var fileIn = path.join(path.resolve('./tmp'), self.fileName)
    var newFileName = self.fileName.split('.')[0] + '.min.' + self.fileExt
    var fileOut = path.join(path.resolve('./tmp'), newFileName)

    stream.pipe(fs.createWriteStream(fileIn)).on('finish', function () {
      compressor.minify({
        compressor: compression,
        input: fileIn,
        output: fileOut,
        callback: function (err, min) {
          if (err) {
            return reject(err)
          } else {
            fs.unlinkSync(fileIn)
            stream = fs.createReadStream(fileOut)

            stream.on('open', function () {
              return resolve(stream)
            })

            stream.on('close', function () {
              fs.unlinkSync(fileOut)
            })
          }
        }
      })
    })
  })
}

AssetHandler.prototype.contentType = function () {
  if (this.format === 'css') {
    return 'text/css'
  }

  if (this.fileExt === 'eot') {
    return 'application/vnd.ms-fontobject'
  } else if (this.fileExt === 'otf') {
    return 'application/font-sfnt'
  } else if (this.fileExt === 'svg') {
    return 'image/svg+xml'
  } else if (this.fileExt === 'ttf') {
    return 'application/font-sfnt'
  } else if (this.fileExt === 'woff') {
    return 'application/font-woff'
  }
}

AssetHandler.prototype.getFilename = function () {
  return this.fileName
}

AssetHandler.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

module.exports = function (format, req) {
  return new AssetHandler(format, req)
}

module.exports.AssetHandler = AssetHandler
