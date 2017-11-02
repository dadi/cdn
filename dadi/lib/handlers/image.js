var _ = require('underscore')
var fs = require('fs')
var concat = require('concat-stream')
var ExifImage = require('exif').ExifImage
var fit = require('aspect-fit')
var imagesize = require('imagesize')
var lengthStream = require('length-stream')
var mkdirp = require('mkdirp')
var PassThrough = require('stream').PassThrough
var path = require('path')
var querystring = require('querystring')
var Readable = require('stream').Readable
var smartcrop = require('smartcrop-sharp')
var sha1 = require('sha1')
var sharp = require('sharp')
var url = require('url')
var Vibrant = require('node-vibrant')

var ColourHandler = require(path.join(__dirname, '/colour'))
var StorageFactory = require(path.join(__dirname, '/../storage/factory'))
var HTTPStorage = require(path.join(__dirname, '/../storage/http'))
var Cache = require(path.join(__dirname, '/../cache'))
var config = require(path.join(__dirname, '/../../../config'))

var exifDirectory = path.resolve(path.join(__dirname, '/../../../workspace/_exif'))
mkdirp(exifDirectory, (err, made) => {
  if (err) {
    console.log(err)
  }
})

var GRAVITY_TYPES = {
  NW: 'northwest',
  N: 'north',
  NE: 'northeast',
  W: 'west',
  C: 'center',
  E: 'east',
  SW: 'southwest',
  S: 'south',
  SE: 'southeast',
  NONE: 'none'
}

/**
 * Performs checks on the supplied URL and fetches the image
 * @param {String} format - the type of image requested
 * @param {Object} req - the original HTTP request
 */
var ImageHandler = function (format, req) {
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null
  this.cache = Cache()

  var parsedUrl = url.parse(this.req.url, true)
  var pathname = parsedUrl.pathname.slice(1)

  this.url = req.url
  this.cacheKey = this.req.url
  this.fileName = path.basename(parsedUrl.pathname)
  this.fileExt = path.extname(this.fileName).substring(1)

  if (this.fileExt === '') {
    this.fileExt = format
  }

  if (path.extname(this.url) === '') {
    this.url = this.fileName + '.' + this.fileExt
  }

  this.exifData = {}

  if (!pathname.indexOf('http://') || !pathname.indexOf('https://')) {
    this.externalUrl = HTTPStorage.processURL(parsedUrl.path.slice(1), this.optionSettings())
  }
}

ImageHandler.prototype.put = function (stream, folderPath) {
  return new Promise((resolve, reject) => {
    this.storageHandler = this.storageFactory.create('image', this.url)

    var colourInfoStream = new PassThrough()
    var writeStream = new PassThrough()

    stream.pipe(colourInfoStream)
    stream.pipe(writeStream)

    var concatStream = concat(getColourInfo)
    colourInfoStream.pipe(concatStream)

    var self = this

    function getColourInfo (buffer) {
      var colourHandler = new ColourHandler()

      self.storageHandler.put(writeStream, folderPath).then((result) => {
        if (config.get('upload.extractColours')) {
          colourHandler.getColours(buffer, (err, colours) => {
            if (err) {
              console.log(err)
            }

            if (!_.isEmpty(colours)) result.colours = colours

            return resolve(result)
          })
        } else {
          return resolve(result)
        }
      })
    }
  })
}

ImageHandler.prototype.get = function () {
  this.cached = false

  var parsedUrl = url.parse(this.req.url, true)

  // Previously set options (e.g. from a recipe) take precedence.
  // If none are set, we look for them in the URL.
  if (!this.options) {
    // get the image options provided as querystring or path
    if (parsedUrl.search) {
      // get image options from the querystring
      var querystrings = parsedUrl.search.split('?')

      if (querystrings.length > 1) {
        this.options = querystring.decode(querystrings[querystrings.length - 1])
      } else {
        this.options = parsedUrl.query
      }
    } else {
      // get the segments of the url that relate to image manipulation options
      var urlSegments = _.filter(parsedUrl.pathname.split('/'), function (segment, index) {
        if (index > 0 && segment === '') return '0'
        if (index < 13 || (index >= 13 && /^[0-1]$/.test(segment))) {
          return segment
        }
      })

      this.options = getImageOptions(urlSegments)
    }
  }

  // clean the options array up
  this.options = this.sanitiseOptions(this.options)

  if (typeof this.options.format === 'undefined') this.options.format = this.fileExt

  if (this.options.format === 'json') {
    if (this.fileExt === this.fileName) {
      this.format = 'PNG'
    } else {
      this.format = this.fileExt
    }
  } else {
    this.format = this.options.format
  }

  return new Promise((resolve, reject) => {
    var message

    // TODO: is there an error to raise here?
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
        if (this.options.format !== 'json') {
          this.cached = true
          return resolve(stream)
        }
      }

      // not in cache, get image from source
      if (this.externalUrl) {
        if (!config.get('images.remote.enabled') || !config.get('images.remote.allowFullURL')) {
          const err = {
            statusCode: 403,
            message: 'Loading images from a full remote URL is not supported by this instance of DADI CDN'
          }

          return reject(err)
        }

        this.storageHandler = new HTTPStorage(null, this.externalUrl)
      } else {
        this.storageHandler = this.storageFactory.create('image', this.url)
      }

      this.storageHandler.get().then((stream) => {
        var cacheStream = new PassThrough()
        var convertStream = new PassThrough()
        var imageSizeStream = new PassThrough()
        var responseStream = new PassThrough()
        var exifStream = new PassThrough()

        // duplicate the stream so we can use it for the imagesize() request and the
        // response. this saves requesting the same data a second time.
        stream.pipe(imageSizeStream)
        stream.pipe(convertStream)

        // pipe the stream to a temporary file to avoid back pressure buildup
        // while we wait for the exif data to be processed
        var tmpExifFile

        if (this.options.format === 'json') {
          tmpExifFile = path.join(exifDirectory, sha1(this.url))
          stream.pipe(exifStream).pipe(fs.createWriteStream(tmpExifFile))
        }

        // get the image size and format
        imagesize(imageSizeStream, (err, imageInfo) => {
          if (err) {
            if (err === 'invalid') {
              var message = 'Image data is invalid'

              var imageErr = {
                statusCode: 400,
                message: message
              }

              return reject(imageErr)
            }

            console.log(err)
          }

          // extract exif data if available
          if (imageInfo && /jpe?g/.exec(imageInfo.format) && this.options.format === 'json') {
            this.extractExifData(tmpExifFile).then((exifData) => {
              this.exifData = exifData
            }).catch(function (err) {
              // no exif data
              if (err) console.log(err)
            })
          }

          flushExifFiles()

          // connvert image using specified options
          this.convert(convertStream, imageInfo).then((result) => {
            var convertedStream = result.stream
            var dataFromConvert = result.data || {}

            convertedStream.pipe(cacheStream)
            convertedStream.pipe(responseStream)

            // cache the file if enabled
            this.cache.cacheFile(cacheStream, this.cacheKey, () => {
              // return image info only, as json
              if (this.options.format === 'json') {
                this.getImageInfo(responseStream, imageInfo, (data) => {
                  // Adding data from `convert()` to response
                  data = _.extendOwn(data, dataFromConvert)

                  var returnStream = new Readable()
                  returnStream.push(JSON.stringify(data))
                  returnStream.push(null)

                  return resolve(returnStream)
                })
              } else {
                // return image
                return resolve(responseStream)
              }
            })
          }).catch(function (err) {
            return reject(err)
          })
        })
      }).catch(function (err) {
        return reject(err)
      })
    })
  })
}

/**
 * Convert image according to options specified
 * @param {stream} stream - read stream from S3, local disk or url
 */
ImageHandler.prototype.convert = function (stream, imageInfo) {
  var self = this
  var options = self.options

  var dimensions = getDimensions(options, imageInfo)
  var width = parseInt(dimensions.width)
  var height = parseInt(dimensions.height)

  return new Promise((resolve, reject) => {
    // sanity check on crop requests
    if (typeof options.cropX !== 'undefined' && typeof options.cropY !== 'undefined') {
      var originalWidth = parseFloat(imageInfo.width)
      var originalHeight = parseFloat(imageInfo.height)

      if ((width + parseInt(options.cropX) >= originalWidth) || (height + parseInt(options.cropY)) >= originalHeight) {
        var rectangle = (width + parseInt(options.cropX)).toString() + 'x' + (height + parseInt(options.cropY)).toString()
        var original = originalWidth.toString() + 'x' + originalHeight.toString()
        var message = 'The calculated crop rectangle is larger than (or one dimension is equal to) the original image size. Crop rectangle: ' + rectangle + ', Image size: ' + original

        var err = {
          statusCode: 400,
          message: message
        }

        return reject(err)
      }
    }

    var concatStream = concat(processImage)
    stream.pipe(concatStream)

    function processImage (imageBuffer) {
      // load the input image
      var sharpImage = sharp(imageBuffer)

      var shouldExtractEntropy = ((options.resizeStyle === 'entropy') && width && height)
        ? self.extractEntropy(imageBuffer, width, height)
        : false

      Promise.resolve(shouldExtractEntropy).then(entropy => {
        var resizeOptions = {
          kernel: config.get('engines.sharp.kernel'),
          interpolator: config.get('engines.sharp.interpolator'),
          centreSampling: config.get('engines.sharp.centreSampling')
        }

        if (width && height && typeof options.cropX !== 'undefined' && typeof options.cropY !== 'undefined') {
          // console.log('CROP %s %s %s %s', parseInt(options.cropX), parseInt(options.cropY), width + parseInt(options.cropX), height + parseInt(options.cropY))

          sharpImage.extract({
            left: parseInt(options.cropX),
            top: parseInt(options.cropY),
            width: width + parseInt(options.cropX),
            height: height + parseInt(options.cropY)
          })
        } else if (width && height) {
          switch (options.resizeStyle) {
            /*
            Aspect Fit: Will size your image until the whole image fits within your area.
            You are left with the extra space on top and bottom.
            */
            case 'aspectfit':
              var size = fit(imageInfo.width, imageInfo.height, width, height)

              sharpImage = sharpImage.resize(parseInt(size.width), parseInt(size.height), resizeOptions)

              break
            /*
            Aspect Fill: Will size your image proportionally until the whole area is full of your image.
            Your image is clipped. It will size proportionally to make sure there is no blank space left in your area.
            */
            case 'aspectfill':
              var scaleWidth = (width / parseInt(imageInfo.width))
              var scaleHeight = (height / parseInt(imageInfo.height))
              var scale = Math.max(scaleWidth, scaleHeight)
              var crops = self.getCropOffsetsByGravity(options.gravity, imageInfo, dimensions, scale)

              if (scaleHeight >= scaleWidth) {
                sharpImage = sharpImage.resize(
                  Math.round(scale * imageInfo.width),
                  height,
                  resizeOptions
                )
              } else {
                sharpImage = sharpImage.resize(
                  width,
                  Math.round(scale * imageInfo.height),
                  resizeOptions
                )
              }

              // Only crop if the aspect ratio is not the same
              if (
                (width / height) !== (imageInfo.width / imageInfo.height) &&
                !self.storageHandler.notFound
              ) {
                sharpImage.extract({
                  left: crops.x1,
                  top: crops.y1,
                  width: crops.x2 - crops.x1,
                  height: crops.y2 - crops.y1
                })
              }

              break

            /*
            Fill: Will size your image to the exact dimensions provided. Aspect ratio
            will _not_ be preserved.
            */
            case 'fill':
              sharpImage = sharpImage
                .resize(width, height, resizeOptions)
                .ignoreAspectRatio()

              break

            /*
            Crop: Will crop the image using the coordinates provided. If dimensions are
            provided, the resulting image will also be resized accordingly.
            */
            case 'crop':
              if (options.crop) {
                let coords = options.crop.split(',').map(coord => parseInt(coord))
                if (coords.length === 2) {
                  coords.push(height - coords[0])
                  coords.push(width - coords[1])
                }

                const cropDimensions = {
                  left: coords[1],
                  top: coords[0],
                  width: coords[3] - coords[1],
                  height: coords[2] - coords[0]
                }
                sharpImage.extract(cropDimensions)

                // resize if options.width or options.height are explicitly set
                if (options.width || options.height) {
                  if (options.width && options.height) {
                    sharpImage = sharpImage.ignoreAspectRatio()
                  }

                  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
                    let adjustedWidth = parseFloat(options.width) * parseFloat(options.devicePixelRatio)
                    let adjustedHeight = parseFloat(options.height) * parseFloat(options.devicePixelRatio)
                    sharpImage.resize(adjustedWidth || undefined, adjustedHeight || undefined, resizeOptions)
                  } else {
                    sharpImage.resize(options.width, options.height, resizeOptions)
                  }
                } else {
                  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
                    let adjustedWidth = parseFloat(cropDimensions.width) * parseFloat(options.devicePixelRatio)
                    let adjustedHeight = parseFloat(cropDimensions.height) * parseFloat(options.devicePixelRatio)
                    sharpImage.resize(adjustedWidth || undefined, adjustedHeight || undefined, resizeOptions)
                  }
                }
              } else {
                // Width & height provided, crop from centre
                const excessWidth = Math.max(0, imageInfo.width - width)
                const excessHeight = Math.max(0, imageInfo.height - height)

                sharpImage.extract({
                  left: Math.round(excessWidth / 2),
                  top: Math.round(excessHeight / 2),
                  width: width,
                  height: height
                })
              }

              break

            /*
            Entropy: Will crop the image using the dimensions provided. The crop
            coordinates will be determined by analising the image entropy using
            smartcrop.
            */
            case 'entropy':
              if (entropy) {
                sharpImage.extract({
                  left: entropy.x1,
                  top: entropy.y1,
                  width: entropy.x2 - entropy.x1,
                  height: entropy.y2 - entropy.y1
                })

                sharpImage.resize(width, height)
              }

              break
          }
        } else if (width && !height) {
          sharpImage = sharpImage.resize(width, null, resizeOptions)
        }

        // @param {Number} sigma - a value between 0.3 and 1000 representing the sigma of the Gaussian mask
        if (options.blur) sharpImage.blur(parseInt(options.blur))

        // @param {String} flip - flip the image on the x axis ('x'), y axis ('y') or both ('xy')
        switch (options.flip) {
          case 'x':
            sharpImage.flop()

            break

          case 'y':
            sharpImage.flip()

            break

          case 'xy':
            sharpImage.flip().flop()

            break
        }

        // @param {Number} angle - angle of rotation, must be a multiple of 90
        if (options.rotate) sharpImage.rotate(parseInt(options.rotate))
        if (options.saturate < 1) sharpImage.greyscale()
        if (options.sharpen) sharpImage.sharpen(options.sharpen)

        // Image format and parameters
        var format = (self.options.format === 'json'
          ? imageInfo.format
          : self.options.format).toLowerCase()

        var outputFn
        var outputOptions = {}

        switch (format) {
          case 'jpg':
          case 'jpeg':
            outputFn = 'jpeg'
            outputOptions.quality = parseInt(options.quality)

            break

          case 'png':
            outputFn = 'png'
            if (options.quality >= 70) outputOptions.compressionLevel = 3

            break
        }

        if (!outputFn) {
          return reject('Invalid output format')
        }

        try {
          sharpImage = sharpImage[outputFn](outputOptions)

          sharpImage.toBuffer({}, (err, buffer, info) => {
            if (err) return reject(err)

            var bufferStream = new PassThrough()
            bufferStream.end(buffer)

            var additionalData = {}

            if (entropy) {
              additionalData.entropyCrop = entropy
            }

            return resolve({stream: bufferStream, data: additionalData})
          })
        } catch (err) {
          return reject(err)
        }
      })
    }
  })
}

/**
 *
 */
ImageHandler.prototype.getCropOffsetsByGravity = function (gravity, originalDimensions, croppedDimensions, scale) {
  var originalWidth = parseInt(originalDimensions.width)
  var originalHeight = parseInt(originalDimensions.height)

  var croppedWidth = parseInt(croppedDimensions.width)
  var croppedHeight = parseInt(croppedDimensions.height)

  if (!scale) scale = croppedWidth / originalWidth
  var resizedWidth = originalWidth * scale
  var resizedHeight = originalHeight * scale

  // No vertical offset for northern gravity
  var verticalOffset = 0
  var horizontalOffset = 0

  switch (gravity.toLowerCase()) {
    case GRAVITY_TYPES.NW:
    case GRAVITY_TYPES.N:
    case GRAVITY_TYPES.NE:
      verticalOffset = 0
      break
    case GRAVITY_TYPES.C:
    case GRAVITY_TYPES.E:
    case GRAVITY_TYPES.W:
      verticalOffset = getMaxOfArray([(resizedHeight - croppedHeight) / 2.0, 0])
      break
    case GRAVITY_TYPES.SW:
    case GRAVITY_TYPES.S:
    case GRAVITY_TYPES.SE:
      verticalOffset = resizedHeight - croppedHeight
      break
    default:
      verticalOffset = 0
  }

  switch (gravity.toLowerCase()) {
    case GRAVITY_TYPES.NW:
    case GRAVITY_TYPES.W:
    case GRAVITY_TYPES.SW:
      horizontalOffset = 0
      break
    case GRAVITY_TYPES.C:
    case GRAVITY_TYPES.N:
    case GRAVITY_TYPES.S:
      horizontalOffset = getMaxOfArray([(resizedWidth - croppedWidth) / 2.0, 0])
      break
    case GRAVITY_TYPES.NE:
    case GRAVITY_TYPES.E:
    case GRAVITY_TYPES.SE:
      horizontalOffset = resizedWidth - croppedWidth
      break
    default:
      horizontalOffset = 0
  }

  function getMaxOfArray (numArray) {
    return Math.max.apply(null, numArray)
  }

  return {
    x1: Math.floor(horizontalOffset),
    x2: Math.floor(horizontalOffset + croppedWidth),
    y1: Math.floor(verticalOffset),
    y2: Math.floor(verticalOffset + croppedHeight)
  }
}

/**
 * Extract coordinates for a crop based on the entropy of the image
 * @param {image} image - LWIP image instance
 * @param {number} width - Crop width
 * @param {number} heifgt - Crop height
 */
ImageHandler.prototype.extractEntropy = function (image, width, height) {
  return new Promise((resolve, reject) => {
    smartcrop.crop(image, {
      width: width,
      height: height
    }).then(result => {
      resolve({
        x1: result.topCrop.x,
        x2: result.topCrop.x + result.topCrop.width,
        y1: result.topCrop.y,
        y2: result.topCrop.y + result.topCrop.height
      })
    }).catch(err => {
      reject(err)
    })
  })
}

/**
 * Extract EXIF data from the specified image
 * @param {stream} stream - read stream from S3, local disk or url
 */
ImageHandler.prototype.extractExifData = function (file) {
  return new Promise(function (resolve, reject) {
    var concatStream = concat(gotImage)
    try {
      fs.createReadStream(file).pipe(concatStream)
    } catch (err) {
      console.log(err)
      console.log(err.stack)
    }

    function gotImage (buffer) {
      ExifImage({ image: buffer }, function (err, data) {
        if (err) {
          return reject(err)
        } else {
          return resolve(data)
        }
      })
    }
  })
}

/**
 * Get image information from stream
 * @param {stream} stream - read stream from S3, local disk or url
 * @returns {object}
 */

/*
{ "fileName":"322324f3696ec76c3479617aa2d700403e58b74c.jpg", "cacheReference":"24a33b40b0c2281cb045d6dff9139a5a0ec0baff",
  "fileSize":20766, "format":"JPEG", "width":"520", "height":"346", "depth":8,
  "density":{"width":72,"height":72}, "exif":{"orientation":0}, "primaryColor":"#b7b7b0",
  "quality":"70", "trim":0, "trimFuzz":0, "resizeStyle":"aspectfill", "gravity":"Center",
  "filter":"None", "blur":0, "strip":0, "rotate":0, "flip":0, "ratio":0, "devicePixelRatio":0
}
*/
ImageHandler.prototype.getImageInfo = function (stream, imageInfo, cb) {
  var self = this
  var options = self.options
  var buffers = []
  var fileSize = 0

  function lengthListener (length) {
    fileSize = length
  }

  var data = {
    fileName: self.fileName,
    cacheReference: sha1(self.fileName),
    quality: options.quality ? options.quality : 75,
    trim: options.trim ? options.trim : 0,
    trimFuzz: options.trimFuzz ? options.trimFuzz : 0,
    resizeStyle: options.resizeStyle ? options.resizeStyle : 'aspectfill',
    gravity: options.gravity ? options.gravity : 'Center',
    filter: options.filter ? options.filter : 'None',
    blur: options.blur ? options.blur : 0,
    strip: options.strip ? options.strip : 0,
    rotate: options.rotate ? options.rotate : 0,
    flip: options.flip ? options.flip : 0,
    ratio: options.ratio ? options.ratio : 0,
    devicePixelRatio: options.devicePixelRatio ? options.devicePixelRatio : 0
  }

  var ls = lengthStream(lengthListener)
  stream.pipe(ls)
    .on('error', function (err) { console.log(err) })
    .on('data', function (data) { buffers.push(data) })
    .on('end', function () {
      var buffer = Buffer.concat(buffers)

      var colourOpts = {
        colorCount: options.maxColours || 64,
        quality: options.colourQuality || 1
      }

      getColours(buffer, colourOpts).then((colours) => {
        data.format = imageInfo.format
        data.fileSize = fileSize
        data.primaryColor = colours.primaryColour
        data.palette = colours.palette

        if (self.exifData.image && self.exifData.image.XResolution && self.exifData.image.YResolution) {
          data.density = {
            width: self.exifData.image.XResolution,
            height: self.exifData.image.YResolution,
            unit: (self.exifData.image.ResolutionUnit ? (self.exifData.image.ResolutionUnit === 2 ? 'dpi' : '') : '')
          }
        }

        return cb(data)
      })
    })
}

function getColours (buffer, options) {
  return new Promise((resolve, reject) => {
    var v = new Vibrant(buffer, options)

    v.getSwatches((err, swatches) => {
      if (err) {
        return reject(err)
      }

      // remove empty swatches and sort by population descending
      swatches = _.compact(_.sortBy(swatches, 'population')).reverse()

      var colourData = {
        primaryColour: swatches[0].getHex(),
        palette: {
          rgb: [],
          hex: []
        }
      }

      _.each(swatches, (swatch, key) => {
        if (key !== 0) {
          colourData.palette.rgb.push(swatch.getRgb())
          colourData.palette.hex.push(swatch.getHex())
        }
      })

      return resolve(colourData)
    })
  })
}

function getDimensions (options, imageInfo) {
  var dimensions = {
    width: options.width,
    height: options.height
  }

  if (options.ratio) {
    var ratio = options.ratio.split('-')
    if (!dimensions.width && parseFloat(dimensions.height) > 0) {
      dimensions.width = parseFloat(dimensions.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]))
      dimensions.height = parseFloat(dimensions.height)
    } else if (!dimensions.height && parseFloat(dimensions.width) > 0) {
      dimensions.height = parseFloat(dimensions.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]))
      dimensions.width = parseFloat(dimensions.width)
    } else if (!dimensions.height && !dimensions.height) {
      dimensions.width = parseFloat(imageInfo.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]))
      dimensions.height = parseFloat(imageInfo.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]))
    }
  } else {
    dimensions.width = dimensions.width || imageInfo.width
    dimensions.height = dimensions.height || imageInfo.height
  }

  if (config.get('security.maxWidth') && config.get('security.maxWidth') < dimensions.width) {
    const hwr = parseFloat(dimensions.height / dimensions.width)
    dimensions.width = config.get('security.maxWidth')
    dimensions.height = dimensions.width * hwr
  }

  if (config.get('security.maxHeight') && config.get('security.maxHeight') < dimensions.height) {
    const whr = parseFloat(dimensions.width / dimensions.height)
    dimensions.height = config.get('security.maxHeight')
    dimensions.width = dimensions.height * whr
  }

  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
    // http://devicepixelratio.com/
    dimensions.width = parseFloat(dimensions.width) * parseFloat(options.devicePixelRatio)
    dimensions.height = parseFloat(dimensions.height) * parseFloat(options.devicePixelRatio)
  }

  return dimensions
}

/**
 * Parses the request URL and returns an options object
 * @param {Array} optionsArray - the options specified in the request URL
 * @returns {object}
 */
function getImageOptions (optionsArray) {
  var legacyURLFormat = optionsArray.length < 17

  var gravity = optionsArray[optionsArray.length - 6].substring(0, 1).toUpperCase() + optionsArray[optionsArray.length - 6].substring(1)
  var filter = optionsArray[optionsArray.length - 5].substring(0, 1).toUpperCase() + optionsArray[optionsArray.length - 5].substring(1)

  var options = {
    format: optionsArray[0],
    quality: optionsArray[1],
    trim: optionsArray[2],
    trimFuzz: optionsArray[3],
    width: optionsArray[4],
    height: optionsArray[5],

    /* legacy client applications don't send the next 4 */
    cropX: legacyURLFormat ? '0' : optionsArray[6],
    cropY: legacyURLFormat ? '0' : optionsArray[7],
    ratio: legacyURLFormat ? '0' : optionsArray[8],
    devicePixelRatio: legacyURLFormat ? 1 : optionsArray[9],

    resizeStyle: optionsArray[optionsArray.length - 7],
    gravity: gravity,
    filter: filter,
    blur: optionsArray[optionsArray.length - 4],
    strip: optionsArray[optionsArray.length - 3],
    rotate: optionsArray[optionsArray.length - 2],
    flip: optionsArray[optionsArray.length - 1]
  }

  return options
}

ImageHandler.prototype.optionSettings = function () {
  return [
    { name: 'format', aliases: ['fmt'] },
    { name: 'quality', aliases: ['q'], default: 75 },
    { name: 'sharpen', aliases: ['sh'], default: 0, allowZero: true, minimumValue: 1 },
    { name: 'saturate', aliases: ['sat'], default: 1, allowZero: true },
    { name: 'width', aliases: ['w'] },
    { name: 'height', aliases: ['h'] },
    { name: 'ratio', aliases: ['rx'] },
    { name: 'cropX', aliases: ['cx'] },
    { name: 'cropY', aliases: ['cy'] },
    { name: 'crop', aliases: ['coords'] },
    { name: 'resizeStyle', aliases: ['resize'], default: 'aspectfill' },
    { name: 'devicePixelRatio', aliases: ['dpr'] },
    { name: 'gravity', aliases: ['g'], default: 'None' },
    { name: 'filter', aliases: ['f'], default: 'lanczos', lowercase: true },
    { name: 'trim', aliases: ['t'] },
    { name: 'trimFuzz', aliases: ['tf'] },
    { name: 'blur', aliases: ['b'] },
    { name: 'strip', aliases: ['s'] },
    { name: 'rotate', aliases: ['r'] },
    { name: 'flip', aliases: ['fl'] }
  ]
}

ImageHandler.prototype.sanitiseOptions = function (options) {
  // check the options for aliases
  // e.g. "dpr" === "devicePixelRatio"

  var imageOptions = {}

  // handle querystring options that came from a remote image url
  // as if the original remote url had it's own querystring then we'll
  // get an option here that starts with a ?, from where the CDN params were added
  _.each(Object.keys(options), key => {
    if (key[0] === '?') {
      options[key.substring(1)] = options[key]
      delete options[key]
    }
  })

  _.each(Object.keys(options), key => {
    var settings = _.filter(this.optionSettings(), setting => {
      return setting.name === key || _.contains(setting.aliases, key)
    })

    if (settings && settings[0]) {
      var value = options[key]

      if (options[key] !== '0' || settings[0].allowZero || settings[0].default) {
        if (options[key] !== '0' || settings[0].allowZero) {
          if (settings[0].lowercase) value = value.toLowerCase()
          value = _.isFinite(value) ? parseFloat(value) : value
          if (settings[0].minimumValue && value < settings[0].minimumValue) {
            value = settings[0].minimumValue
          } else if (settings[0].maximumValue && value > settings[0].maximumValue) {
            value = settings[0].maximumValue
          }
          imageOptions[settings[0].name] = value
        } else {
          imageOptions[settings[0].name] = settings[0].default
        }
      }
    }

    delete options[key]
  })

  // ensure we have defaults for options not specified
  var defaults = _.filter(this.optionSettings(), setting => {
    return setting.default
  })

  _.each(defaults, setting => {
    if (typeof imageOptions[setting.name] === 'undefined') {
      imageOptions[setting.name] = setting.default
    }
  })

  // add any URL parameters that aren't part of the core set
  _.extend(imageOptions, options)

  return imageOptions
}

ImageHandler.prototype.contentType = function () {
  if (this.options.format === 'json') {
    return 'application/json'
  }

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

/**
 * Returns the filename including extension of the requested image
 * @returns {string} the filename of the image
 */
ImageHandler.prototype.getFilename = function () {
  if (path.extname(this.fileName) === '') {
    return this.fileName + '.' + this.fileExt
  } else {
    return this.fileName
  }
}

ImageHandler.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

function flushExifFiles () {
  fs.readdir(exifDirectory, (err, files) => {
    if (err) {
      console.log(err)
    }

    files.forEach((file) => {
      var filePath = path.join(exifDirectory, file)

      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.log(err)
        }

        var lastModified = stats && stats.mtime && stats.mtime.valueOf()

        if (lastModified && (Date.now() - lastModified) / 1000 > 36) {
          fs.unlink(filePath)
        }
      })
    })
  })
}

module.exports = function (format, req) {
  return new ImageHandler(format, req)
}

module.exports.ImageHandler = ImageHandler
