/*
http://localhost:8001/layout/i:test.jpg,h_200,w_200,y_0,x_400|c:01ee88,h_200,w_200,y_0,x_200|c:f3eacd,h_200,w_200,y_0,x_0|o:jim.jpg,h_200,w_600
*/

var concat = require('concat-stream')
// var logger = require('@dadi/logger')
var imageLib = require('images')
var imagesize = require('imagesize')
var PassThrough = require('stream').PassThrough
var path = require('path')
var Promise = require('bluebird')
var url = require('url')
var _ = require('underscore')

var StorageFactory = require(path.join(__dirname, '/../../dadi/lib/storage/factory'))
var Cache = require(path.join(__dirname, '/../../dadi/lib/cache'))
var config = require(path.join(__dirname, '/../../config'))

var TILE_TYPES = {
  IMAGE: 'i:',
  COLOUR: 'c:',
  OUTPUT: 'o:'
}

/**
 * Performs checks on the supplied URL and fetches the image
 * @param {String} format - the type of image requested
 * @param {Object} req - the original HTTP request
 */
var ImageLayoutProcessor = function (format, req) {
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null
  this.cache = Cache()

  var parsedUrl = url.parse(this.req.url, true)
  this.url = req.url
  this.cacheKey = this.req.url
  this.inputs = []
  this.processUrl(parsedUrl.pathname)
  this.fileExt = path.extname(this.outputFile.fileName).substring(1)
}

ImageLayoutProcessor.prototype.processUrl = function (requestPath) {
  var pathParts = decodeURIComponent(requestPath).replace('/layout/', '').split('|')

  _.each(pathParts, (part) => {
    var type = part.substring(0,2)

    switch (type) {
      case TILE_TYPES.IMAGE:
      case TILE_TYPES.COLOUR:
        this.inputs.push(this.getInput(type, part.replace(type, '')))
        break
      case TILE_TYPES.OUTPUT:
        this.outputFile = this.getOutputFile(part.replace(type, ''))
        break
    }
  })
}

ImageLayoutProcessor.prototype.getInput = function (type, inputStr) {
  var parts = inputStr.split(',')

  var input = {}

  switch (type) {
    case TILE_TYPES.IMAGE:
      input.fileName = parts[0]
      break
    case TILE_TYPES.COLOUR:
      input.colour = parts[0]
      break
  }

  parts.shift()

  _.each(parts, (part) => {
    var type = part.substring(0,1)

    switch (type) {
      case 'w':
        input.width = getValue(part)
        break
      case 'h':
        input.height = getValue(part)
        break
      case 'x':
        input.x = getValue(part)
        break
      case 'y':
        input.y = getValue(part)
        break
      case 'l':
        input.l = getValue(part)
        break
      case 't':
        input.t = getValue(part)
        break
    }
  })

  return input
}

ImageLayoutProcessor.prototype.getOutputFile = function (inputStr) {
  var parts = inputStr.split(',')

  var output = {
    fileName: parts[0]
  }

  parts.shift()

  _.each(parts, (part) => {
    var type = part.substring(0,1)

    switch (type) {
      case 'w':
        output.width = getValue(part)
        break
      case 'h':
        output.height = getValue(part)
        break
    }
  })

  return output
}

ImageLayoutProcessor.prototype.get = function () {
  var self = this
  self.cached = false

  var parsedUrl = url.parse(this.req.url, true)

  if (typeof this.format === 'undefined') this.format = this.fileExt

  return new Promise((resolve, reject) => {
    var message

    if (message) {
      var err = {
        statusCode: 400,
        message: message
      }

      return reject(err)
    }

    // get from cache
    this.cache.getStream(this.cacheKey, (stream) => {
      // if found in cache, return it
      if (stream) {
        this.cached = true
        return resolve(stream)
      }

      /* Create a new transparent image */
      var newImage = imageLib(this.outputFile.width, this.outputFile.height)

      var i = 0
      var self = this

      _.each(this.inputs, (input) => {
        if (input.fileName) {
          var storageHandler = this.storageFactory.create('image', input.fileName)

          storageHandler.get().then((stream) => {
            var imageSizeStream = new PassThrough()
            var imageStream = new PassThrough()

            var concatStream = concat(addImage)

            stream.pipe(imageSizeStream)
            stream.pipe(imageStream)

            imagesize(imageSizeStream, (err, imageInfo) => {
              input.originalImageSize = imageInfo
              imageStream.pipe(concatStream)
            })
          })
        } else if (input.colour) {
          var rgb = hexToRgbA('#' + input.colour)
          addImage(imageLib(input.width, input.height).fill(rgb[0], rgb[1], rgb[2], 1))
        }

        function addImage (obj) {
          var inputImage

          try {
            if (obj instanceof Buffer) {
              var scaleWidth = (600 / input.originalImageSize.width)
              var scaleHeight = (600 / input.originalImageSize.height)
              var scale = Math.max(scaleWidth, scaleHeight)

              var calculatedWidth = input.originalImageSize.width * scale
              var calculatedHeight = input.originalImageSize.height * scale
              var sc = Math.max(input.width/calculatedWidth, input.height/calculatedHeight)
              var resizedWidth = calculatedWidth * sc
              var resizedHeight = calculatedHeight * sc

              input.l = resizedWidth === input.width ? 0 : (resizedWidth - input.width)/2
              input.t = resizedHeight === input.height ? 0 : (resizedHeight - input.height)/2

              inputImage = imageLib(obj).resize(resizedWidth, resizedHeight)
            } else {
              inputImage = obj
            }

            var extractedImage = imageLib(inputImage, input.l, input.t, input.width, input.height)

            newImage.draw(extractedImage, input.x, input.y)
          } catch (err) {

          }

          if (++i === self.inputs.length) {
            var outBuffer = newImage.encode(self.format, { operation: 100 })

            var cacheStream = new PassThrough()
            var responseStream = new PassThrough()

            var bufferStream = new PassThrough()
            bufferStream.end(outBuffer)

            bufferStream.pipe(cacheStream)
            bufferStream.pipe(responseStream)

            // cache the file if enabled
            self.cache.cacheFile(cacheStream, self.cacheKey, function () {
              // return image
              return resolve(responseStream)
            })
          }
        }
      })
    })
  })
}

function getValue (input) {
  return parseInt(input.substring(2))
}

/**
 *
 */
function RGBtoHex (red, green, blue) {
  return '#' + ('00000' + (red << 16 | green << 8 | blue).toString(16)).slice(-6)
}

// hexToRgbA('#fbafff')
function hexToRgbA (hex) {
  var c

  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('')

    if (c.length== 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }

    c = '0x'+c.join('')
    return [(c>>16)&255, (c>>8)&255, c&255]
  }

  throw new Error('Bad Hex')
}

ImageLayoutProcessor.prototype.contentType = function () {
  switch (this.format.toLowerCase()) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

ImageLayoutProcessor.prototype.getFilename = function () {
  return this.outputFile.fileName
}

ImageLayoutProcessor.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

module.exports = function (format, req) {
  return new ImageLayoutProcessor(format, req)
}

module.exports.ImageLayoutProcessor = ImageLayoutProcessor

