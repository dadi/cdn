'use strict'

const _ = require('underscore')
const fs = require('fs')
const concat = require('concat-stream')
const ExifImage = require('exif').ExifImage
const fit = require('aspect-fit')
const imagesize = require('image-size-stream')
const lengthStream = require('length-stream')
const mkdirp = require('mkdirp')
const PassThrough = require('stream').PassThrough
const path = require('path')
const Readable = require('stream').Readable
const smartcrop = require('smartcrop-sharp')
const sha1 = require('sha1')
const sharp = require('sharp')
const urlParser = require('url')
const Vibrant = require('node-vibrant')

const ColourHandler = require(path.join(__dirname, '/colour'))
const StorageFactory = require(path.join(__dirname, '/../storage/factory'))
const Cache = require(path.join(__dirname, '/../cache'))
const config = require(path.join(__dirname, '/../../../config'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

const exifDirectory = path.resolve(path.join(__dirname, '/../../../workspace/_exif'))

mkdirp(exifDirectory, (err, made) => {
  if (err) {
    console.log(err)
  }
})

const GRAVITY_TYPES = {
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

const IMAGE_PARAMETERS = [
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
  { name: 'resizeStyle', aliases: ['resize'] },
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

/**
 * Performs checks on the supplied URL and fetches the image
 * @param {String} format - the type of image requested
 * @param {Object} req - the original HTTP request
 */
const ImageHandler = function (format, req, {
  options = {},
  plugins = []
} = {}) {
  this.req = req
  this.storageFactory = Object.create(StorageFactory)
  this.storageHandler = null
  this.cache = Cache()
  this.requestUrl = req.url
  this.options = options

  this.setBaseUrl(req.url)

  const pathname = this.parsedUrl.cdn.pathname.slice(1)

  this.fileName = path.basename(this.parsedUrl.original.pathname)
  this.fileExt = path.extname(this.fileName).substring(1)

  if (this.fileExt === '') {
    this.fileExt = format
  }

  this.exifData = {}
  this.isExternalUrl = !pathname.indexOf('http://') || !pathname.indexOf('https://')

  this.plugins = Object.keys(workspace.get()).reduce((activePlugins, file) => {
    if ((workspace.get(file).type === 'plugins') && plugins.includes(file)) {
      try {
        return activePlugins.concat(require(workspace.get(file).path))
      } catch (err) {
        throw new Error(`Error loading plugin '${file}': ${err}`)
      }
    }

    return activePlugins
  }, [])
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
    case 'webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}

/**
 * Convert image according to options specified
 * @param {stream} stream - read stream from S3, local disk or url
 */
ImageHandler.prototype.convert = function (stream, imageInfo) {
  const options = this.options
  const calculatedDimensions = this.getDimensions(options, imageInfo)

  imageInfo.width = parseInt(calculatedDimensions.width)
  imageInfo.height = parseInt(calculatedDimensions.height)

  return new Promise((resolve, reject) => {
    // sanity check on crop requests
    if (options.cropX !== undefined && options.cropY !== undefined) {
      if (
        imageInfo.width + parseInt(options.cropX) >= imageInfo.naturalWidth ||
        imageInfo.height + parseInt(options.cropY) >= imageInfo.naturalHeight
      ) {
        const rectangle = (imageInfo.width + parseInt(options.cropX)).toString() + 'x' + (imageInfo.height + parseInt(options.cropY)).toString()
        const original = imageInfo.naturalWidth.toString() + 'x' + imageInfo.naturalHeight.toString()
        const message = 'The calculated crop rectangle is larger than (or one dimension is equal to) the original image size. Crop rectangle: ' + rectangle + ', Image size: ' + original

        return reject({
          statusCode: 400,
          message: message
        })
      }
    }

    const concatStream = concat(buffer => {
      return resolve(this.process(buffer, options, imageInfo))
    })

    stream.pipe(concatStream)
  })
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
    const concatStream = concat(buffer => {
      ExifImage({ image: buffer }, (err, data) => {
        return resolve(err ? {} : data)
      })
    })

    try {
      fs.createReadStream(file).pipe(concatStream)
    } catch (err) {
      console.log(err)
      console.log(err.stack)
    }
  })
}

ImageHandler.prototype.get = function () {
  let assetPath = this.parsedUrl.asset.path

  // (!) DEPRECATED
  //
  // Extend the options object with settings from the legacy URL syntax.
  if (this.req.__cdnLegacyURLSyntax) {
    const pathParts = this.parsedUrl.cdn.pathname.split('/')
    const urlSegments = pathParts.filter((segment, index) => {
      if (index > 0 && segment === '') {
        return true
      }

      if (index < 13 || (index >= 13 && /^[0-1]$/.test(segment))) {
        return Boolean(segment)
      }
    })

    assetPath = pathParts.slice(urlSegments.length + 1).join('/')

    this.options = Object.assign({}, this.options, getImageOptionsFromLegacyURL(urlSegments))
  } else {
    this.options = Object.assign({}, this.options, this.parsedUrl.cdn.query)
  }

  // Aborting the request if full remote URL is required and not enabled.
  if (
    this.isExternalUrl &&
    (
      !config.get('images.remote.enabled') ||
      !config.get('images.remote.allowFullURL')
    )
  ) {
    const err = {
      statusCode: 403,
      message: 'Loading images from a full remote URL is not supported by this instance of DADI CDN'
    }

    return Promise.reject(err)
  }

  // Clean the options array up.
  this.options = this.sanitiseOptions(this.options || {})

  this.options.format = this.options.format || this.fileExt

  if (this.options.format === 'json') {
    if (this.fileExt === this.fileName) {
      this.format = 'PNG'
    } else {
      this.format = this.fileExt
    }
  } else {
    this.format = this.options.format
  }

  // Run any plugins with a `pre` method
  this.plugins.forEach(plugin => {
    if (typeof plugin.pre === 'function') {
      plugin.pre({
        options: this.options,
        url: this.requestUrl
      })
    }
  })

  this.storageHandler = this.storageFactory.create('image', assetPath)

  const cacheKey = this.requestUrl
  const isJSONResponse = this.options.format === 'json'

  return this.cache.getStream(cacheKey).then(cachedStream => {
    if (cachedStream) {
      this.isCached = true

      return cachedStream
    }

    let stream = this.storageHandler.get()

    return Promise.resolve(stream).then(stream => {
      this.cacheStream = new PassThrough()
      this.convertStream = new PassThrough()
      this.exifStream = new PassThrough()
      this.imageSizeStream = new PassThrough()
      this.responseStream = new PassThrough()

      // duplicate the stream so we can use it for the imagesize() request and the
      // response. this saves requesting the same data a second time.
      stream.pipe(this.imageSizeStream)
      stream.pipe(this.convertStream)

      // pipe the stream to a temporary file to avoid back pressure buildup
      // while we wait for the exif data to be processed
      let tmpExifFile

      if (isJSONResponse) {
        tmpExifFile = path.join(exifDirectory, sha1(this.parsedUrl.original.path))
        stream.pipe(this.exifStream).pipe(fs.createWriteStream(tmpExifFile))
      }

      return this.getImageSize(this.imageSizeStream).then(imageInfo => {
        return {
          imageInfo,
          tmpExifFile
        }
      }).then(({imageInfo, tmpExifFile}) => {
        let queue

        // extract exif data if available
        if (imageInfo && /jpe?g/.exec(imageInfo.format) && isJSONResponse) {
          queue = this.extractExifData(tmpExifFile).then(exifData => {
            this.exifData = exifData
          })
        }

        return Promise.resolve(queue).then(() => imageInfo)
      }).then(imageInfo => {
        flushExifFiles()

        // connvert image using specified options
        return this.convert(this.convertStream, imageInfo).then(result => {
          return {
            imageInfo,
            result
          }
        })
      }).then(({imageInfo, result}) => {
        const convertedStream = result.stream

        convertedStream.pipe(this.cacheStream)
        convertedStream.pipe(this.responseStream)

        return new Promise((resolve, reject) => {
          // Return image info only, as JSON.
          if (isJSONResponse) {
            this.getImageInfo(this.responseStream, imageInfo, data => {
              // Adding data from `convert()` to response
              Object.assign(data, result.data)

              const returnStream = new Readable()
              returnStream.push(JSON.stringify(data))
              returnStream.push(null)

              return resolve(returnStream)
            })
          } else {
            // return image
            return resolve(this.responseStream)
          }
        })
      }).then(responseStream => {
        // Cache the file if it's not already cached and it's not a placeholder.
        if (!this.isCached && !this.storageHandler.notFound) {
          this.cache.cacheFile(
            this.options.format === 'json' ? responseStream : this.cacheStream,
            cacheKey
          )
        }

        return responseStream
      })
    })
  })
}

ImageHandler.prototype.getAvailablePlugins = function (files) {
  return Object.keys(files).reduce((plugins, file) => {
    if (files[file].type === 'plugins') {
      try {
        plugins.push(
          require(files[file].path)
        )
      } catch (err) {
        console.log(`Plugin '${file}' failed to load:`, err)
      }
    }

    return plugins
  }, [])
}

/**
 *
 */
ImageHandler.prototype.getCropOffsetsByGravity = function (gravity, originalDimensions, croppedDimensions, scale) {
  const originalWidth = parseInt(originalDimensions.naturalWidth)
  const originalHeight = parseInt(originalDimensions.naturalHeight)

  const croppedWidth = parseInt(croppedDimensions.width)
  const croppedHeight = parseInt(croppedDimensions.height)

  if (!scale) scale = croppedWidth / originalWidth

  const resizedWidth = originalWidth * scale
  const resizedHeight = originalHeight * scale

  // No vertical offset for northern gravity
  let verticalOffset = 0
  let horizontalOffset = 0

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

ImageHandler.prototype.getDimensions = function (options, imageInfo) {
  let dimensions = {
    width: imageInfo.naturalWidth,
    height: imageInfo.naturalHeight
  }
  let ratio = imageInfo.naturalHeight / imageInfo.naturalWidth

  const ratioOverride = Boolean(options.ratio) && options.ratio.match(/^(\d+)-(\d+)$/)

  // Is there an explicit ratio defined?
  if (ratioOverride) {
    ratio = parseFloat(ratioOverride[2]) / parseFloat(ratioOverride[1])

    // Scenario 1: Width override is defined, height override is not.
    if ((options.width !== undefined) && (options.height === undefined)) {
      dimensions.width = options.width
      dimensions.height = Math.ceil(options.width * ratio)
    } else if ((options.width === undefined) && (options.height !== undefined)) {
      // Scenario 2: Width override is not defined, height override is.
      dimensions.width = Math.ceil(options.height / ratio)
      dimensions.height = options.height
    } else if ((options.width === undefined) && (options.height === undefined)) {
      // Scenario 3: Width and height overrides are not defined.
      dimensions.height = Math.ceil(dimensions.width * ratio)
    } else {
      // Scenario 4: Width and height overrides are both defined.
      // Ratio parameter is ignored.
      dimensions.width = options.width
      dimensions.height = options.height

      ratio = dimensions.height / dimensions.width
    }
  } else {
    dimensions.width = options.width || dimensions.width
    dimensions.height = options.height || dimensions.height

    ratio = dimensions.height / dimensions.width
  }

  // Ensuring dimensions are within security bounds.
  dimensions.width = Math.min(dimensions.width, config.get('security.maxWidth'))
  dimensions.height = Math.min(dimensions.height, config.get('security.maxHeight'))

  return dimensions
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

ImageHandler.prototype.getImageSize = function (stream) {
  return new Promise((resolve, reject) => {
    const size = imagesize()

    size.on('size', data => {
      resolve({
        format: data.type,
        naturalWidth: data.width,
        naturalHeight: data.height
      })
    })

    size.on('error', reject)

    stream.pipe(size)
  })
}

ImageHandler.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

ImageHandler.prototype.parseUrl = function (url) {
  const parsedUrl = urlParser.parse(url, true)
  const searchNodes = parsedUrl.search.split('?')

  let cdnUrl = `${parsedUrl.pathname}?${searchNodes.slice(-1)}`
  let assetUrl = parsedUrl.pathname

  if (searchNodes.length > 2) {
    assetUrl += `?${searchNodes.slice(-2, -1)}`
  }

  return {
    asset: urlParser.parse(assetUrl, true),
    original: parsedUrl,
    cdn: urlParser.parse(cdnUrl, true)
  }
}

ImageHandler.prototype.process = function (imageBuffer, options, imageInfo) {
  // load the input image
  let sharpImage = sharp(imageBuffer)

  // Default values fot resize style
  if (!options.resizeStyle) {
    if (options.width && options.height) {
      options.resizeStyle = 'entropy'
    } else {
      options.resizeStyle = 'aspectfit'
    }
  }

  // Override values for resize style
  if (this.storageHandler.notFound) {
    options.resizeStyle = 'entropy'
  } else if (options.ratio) {
    options.resizeStyle = 'aspectfill'
  }

  const {width, height} = imageInfo
  const shouldExtractEntropy = ((options.resizeStyle === 'entropy') && width && height)
    ? this.extractEntropy(imageBuffer, width, height)
    : false

  return Promise.resolve(shouldExtractEntropy).then(entropy => {
    return new Promise((resolve, reject) => {
      const resizeOptions = {
        kernel: config.get('engines.sharp.kernel'),
        interpolator: config.get('engines.sharp.interpolator'),
        centreSampling: config.get('engines.sharp.centreSampling')
      }

      if (width && height && typeof options.cropX !== 'undefined' && typeof options.cropY !== 'undefined') {
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
            const size = fit(imageInfo.naturalWidth, imageInfo.naturalHeight, width, height)

            sharpImage = sharpImage.resize(parseInt(size.width), parseInt(size.height), resizeOptions)

            break
          /*
          Aspect Fill: Will size your image proportionally until the whole area is full of your image.
          Your image is clipped. It will size proportionally to make sure there is no blank space left in your area.
          */
          case 'aspectfill':
            const scaleWidth = (width / imageInfo.naturalWidth)
            const scaleHeight = (height / imageInfo.naturalHeight)
            const scale = Math.max(scaleWidth, scaleHeight)
            const crops = this.getCropOffsetsByGravity(
              options.gravity,
              imageInfo,
              {width, height},
              scale
            )

            if (scaleHeight >= scaleWidth) {
              sharpImage = sharpImage.resize(
                Math.round(scale * imageInfo.naturalWidth),
                height,
                resizeOptions
              )
            } else {
              sharpImage = sharpImage.resize(
                width,
                Math.round(scale * imageInfo.naturalHeight),
                resizeOptions
              )
            }

            // Only crop if the aspect ratio is not the same
            if (
              (width / height) !== (imageInfo.naturalWidth / imageInfo.naturalHeight)
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
                  const adjustedWidth = parseFloat(options.width) * parseFloat(options.devicePixelRatio)
                  const adjustedHeight = parseFloat(options.height) * parseFloat(options.devicePixelRatio)

                  sharpImage.resize(adjustedWidth || undefined, adjustedHeight || undefined, resizeOptions)
                } else {
                  sharpImage.resize(options.width, options.height, resizeOptions)
                }
              } else {
                if (options.devicePixelRatio && options.devicePixelRatio < 4) {
                  const adjustedWidth = parseFloat(cropDimensions.width) * parseFloat(options.devicePixelRatio)
                  const adjustedHeight = parseFloat(cropDimensions.height) * parseFloat(options.devicePixelRatio)

                  sharpImage.resize(adjustedWidth || undefined, adjustedHeight || undefined, resizeOptions)
                }
              }
            } else {
              // Width & height provided, crop from centre
              const excessWidth = Math.max(0, imageInfo.naturalWidth - width)
              const excessHeight = Math.max(0, imageInfo.naturalHeight - height)

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
      const format = (this.options.format === 'json'
        ? imageInfo.format
        : this.options.format).toLowerCase()

      let outputFn
      let outputOptions = {}

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

        case 'webp':
          outputFn = 'webp'
          outputOptions.quality = parseInt(options.quality)

          break
      }

      if (!outputFn) {
        return reject('Invalid output format')
      }

      try {
        let jsonData = {}
        let pluginQueue = Promise.resolve(null)

        sharpImage = sharpImage[outputFn](outputOptions)

        if (entropy) {
          jsonData.entropyCrop = entropy
        }

        // Run any plugins with a `post` method
        this.plugins.forEach(plugin => {
          if (typeof plugin.post === 'function') {
            pluginQueue = pluginQueue.then(pluginStream => {
              return plugin.post({
                assetStore: this.storageFactory.create,
                cache: {
                  get: this.cache.getStream,
                  set: this.cache.set
                },
                imageInfo,
                jsonData,
                options: this.options,
                processor: sharpImage,
                sharp,
                stream: pluginStream,
                url: this.requestUrl
              })
            })
          }
        })

        pluginQueue.then(pluginStream => {
          if (pluginStream) {
            return resolve({
              stream: pluginStream,
              data: jsonData
            })
          }

          sharpImage.toBuffer({}, (err, buffer, info) => {
            if (err) return reject(err)

            let bufferStream = new PassThrough()
            bufferStream.end(buffer)

            return resolve({
              stream: bufferStream,
              data: jsonData
            })
          })
        })
      } catch (err) {
        return reject(err)
      }
    })
  })
}

ImageHandler.prototype.put = function (stream, folderPath) {
  const parsedUrl = this.parsedUrl.cdn

  return new Promise((resolve, reject) => {
    this.storageHandler = this.storageFactory.create('image', parsedUrl.path)

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
    var settings = _.filter(IMAGE_PARAMETERS, setting => {
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
  var defaults = _.filter(IMAGE_PARAMETERS, setting => {
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

ImageHandler.prototype.setBaseUrl = function (baseUrl) {
  this.parsedUrl = this.parseUrl(baseUrl)
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

/**
 * Parses the request URL and returns an options object
 * @param {Array} optionsArray - the options specified in the request URL
 * @returns {object}
 */
function getImageOptionsFromLegacyURL (optionsArray) {
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
          fs.unlinkSync(filePath)
        }
      })
    })
  })
}

module.exports = ImageHandler
module.exports.ImageHandler = ImageHandler
module.exports.parameters = IMAGE_PARAMETERS
