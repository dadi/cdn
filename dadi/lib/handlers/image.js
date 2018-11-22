'use strict'

const fs = require('fs-extra')
const exifReader = require('exif-reader-paras20xx')
const fit = require('aspect-fit')
const { BitmapImage, GifFrame, GifUtil } = require('gifwrap')
const help = require('./../help')
const Jimp = require('jimp')
const mkdirp = require('mkdirp')
const path = require('path')
const sha1 = require('sha1')
const sharp = require('sharp')
const smartcrop = require('smartcrop-sharp')
const urlParser = require('url')
const Vibrant = require('node-vibrant')
const imagemin = require('imagemin')
const imageminJpegtran = require('imagemin-jpegtran')

const StorageFactory = require(path.join(__dirname, '/../storage/factory'))
const Cache = require(path.join(__dirname, '/../cache'))
const config = require(path.join(__dirname, '/../../../config'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

const tmpDirectory = path.resolve(path.join(__dirname, '/../../../workspace/_tmp'))

mkdirp(tmpDirectory, (err, made) => {
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
  { name: 'flip', aliases: ['fl'] },
  { name: 'progressive', aliases: ['pg'] }
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

/**
 * Checks that a crop rectangle is valid given the dimensions of the image.
 * Returns a Promise that rejects with an error or resolves with `undefined`.
 *
 * @return {Promise}
 */
ImageHandler.prototype.checkCropRectangle = function () {
  let options = this.options

  // sanity check on crop requests
  if (options.cropX !== undefined && options.cropY !== undefined) {
    if (
      this.calculatedDimensions.width + parseInt(options.cropX) >= this.imageData.width ||
      this.calculatedDimensions.height + parseInt(options.cropY) >= this.imageData.height
    ) {
      let rectangle = (this.calculatedDimensions.width + parseInt(options.cropX)).toString() + 'x' + (this.calculatedDimensions.height + parseInt(options.cropY)).toString()
      let original = this.imageData.width.toString() + 'x' + this.imageData.height.toString()
      let message = 'The calculated crop rectangle is larger than (or one dimension is equal to) the original image size. Crop rectangle: ' + rectangle + ', Image size: ' + original

      return Promise.reject({
        statusCode: 400,
        message: message
      })
    }
  }

  return Promise.resolve()
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

ImageHandler.prototype.get = function () {
  let assetPath = this.parsedUrl.asset.href

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

    this.options = Object.assign(
      {},
      this.options,
      getImageOptionsFromLegacyURL(urlSegments)
    )
  } else {
    this.options = Object.assign(
      {},
      this.options,
      this.parsedUrl.cdn.query
    )
  }

  // Aborting the request if full remote URL is required and not enabled.
  if (
    this.isExternalUrl &&
    (
      !config.get('images.remote.enabled', this.req.__domain) ||
      !config.get('images.remote.allowFullURL', this.req.__domain)
    )
  ) {
    let err = {
      statusCode: 403,
      message: 'Loading images from a full remote URL is not supported by this instance of DADI CDN'
    }

    return Promise.reject(err)
  }

  // Clean the options array up.
  this.options = this.sanitiseOptions(this.options || {})

  this.getFormat()

  // Run any plugins with a `pre` method
  this.plugins.forEach(plugin => {
    if (typeof plugin.pre === 'function') {
      plugin.pre({
        options: this.options,
        url: this.requestUrl
      })
    }
  })

  this.storageHandler = this.storageFactory.create(
    'image',
    assetPath,
    {domain: this.req.__domain}
  )

  // The cache key is formed by multiple parts which will be hashed
  // separately, so that they can be used as search parameters for
  // flushing, except for the first parameter, which contains the full
  // set of options passed to the image engine. It's part of the cache
  // key purely to make `/recipe1/a.jpg` and `/recipe1/b.jpg` map to
  // different keys if the recipes contain different parameters.
  const cacheKey = [
    sha1(JSON.stringify(this.options) + this.req.url),
    this.req.__domain,
    this.parsedUrl.cdn.pathname,
    this.parsedUrl.cdn.search.slice(1)
  ]
  const isJSONResponse = this.options.format === 'json'

  return this.cache.getStream(cacheKey, {
    ttl: config.get('caching.ttl', this.req.__domain)
  }).then(cacheStream => {
    if (cacheStream) {
      this.isCached = true

      return this.cache.getMetadata(cacheKey).then(metadata => {
        if (metadata && metadata.errorCode) {
          this.storageHandler.notFound = true
          this.contentType = metadata.contentType || 'application/json'
        }

        return help.streamToBuffer(cacheStream)
      })
    }

    let stream = this.storageHandler.get()

    return stream.then(stream => {
      return help.streamToBuffer(stream)
    }).then(imageBuffer => {
      let sharpImage = sharp(imageBuffer)

      return sharpImage.metadata().then(imageData => {
        this.imageData = imageData

        if (this.imageData.format === 'jpeg') {
          this.imageData.format = 'jpg'
        }

        if (Buffer.isBuffer(this.imageData.exif)) {
          this.exifData = exifReader(this.imageData.exif)
        }

        this.calculatedDimensions = this.getCalculatedDimensions({
          width: imageData.width,
          height: imageData.height
        })

        return this.process(sharpImage, imageBuffer)
      }).then(result => {
        return this.checkCropRectangle().then(() => {
          return result
        })
      }).then(result => {
        // Return image info only, as JSON.
        if (isJSONResponse) {
          return sharpImage.toBuffer().then(sharpImageBuffer => {
            return this.getImageInfo(imageBuffer, sharpImageBuffer).then(data => {
              return JSON.stringify(
                Object.assign({}, data, result.data)
              )
            })
          })
        }

        return result
      }).then(result => {
        // Cache the file if it's not already cached.
        if (!this.isCached) {
          let metadata

          if (this.storageHandler.notFound) {
            metadata = {
              contentType: this.getContentType(),
              errorCode: 404
            }
          }

          // The only situation where we don't want to write the result to
          // cache is when the response is a 404 and the config specifies
          // that 404s should not be cached.
          if (
            !this.storageHandler.notFound ||
            config.get('caching.cache404', this.req.__domain)
          ) {
            this.cache.set(
              cacheKey,
              result,
              {
                metadata,
                ttl: config.get('caching.ttl', this.req.__domain)
              }
            )
          }
        }

        return result
      })
    })
  }).catch(error => {
    // If the response is a 404 and we want to cache 404s, we
    // write the error to cache.
    if (
      (error.statusCode === 404) &&
      config.get('caching.cache404', this.req.__domain) &&
      !this.isCached
    ) {
      this.cache.set(
        cacheKey,
        JSON.stringify(error),
        {
          metadata: {
            errorCode: error.statusCode
          }
        }
      )
    }

    return Promise.reject(error)
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

ImageHandler.prototype.getContentType = function () {
  if (this.contentType) {
    return this.contentType
  }

  if (this.options.format === 'json') {
    return 'application/json'
  }

  let outputFormat = this.format

  // If the fallback image is to be delivered, the content type
  // will need to match its format, not the format of the original
  // file.
  if (
    this.storageHandler.notFound &&
    config.get('notFound.images.enabled', this.req.__domain)
  ) {
    outputFormat = path.extname(
      config.get('notFound.images.path')
    ).slice(1)
  }

  switch (outputFormat.toLowerCase()) {
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
 *
 */
ImageHandler.prototype.getCropOffsetsByGravity = function (gravity, croppedDimensions, scale) {
  const originalWidth = this.imageData.width
  const originalHeight = this.imageData.height

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

ImageHandler.prototype.getCalculatedDimensions = function ({width, height}) {
  let options = this.options
  let dimensions = {
    width,
    height
  }
  let ratio = height / width
  let ratioOverride = Boolean(options.ratio) && options.ratio.match(/^(\d+)-(\d+)$/)

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

  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
    dimensions.width = dimensions.width * options.devicePixelRatio
    dimensions.height = dimensions.height * options.devicePixelRatio
  }

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
 * Sets `this.options.format` and `this.format` with the output format
 * and the format of the processed image, respectively (these may not be
 * the same, for example when the format is JSON there is still an image
 * being processed, which can be a JPEG or a PNG).
 *
 * It also resolves comma-separated conditional formats (e.g. `webp,jpg`,
 * which will use WebP if the requesting client supports it, or JPEG
 * otherwise).
 */
ImageHandler.prototype.getFormat = function () {
  let formats = (this.options.format || this.fileExt).split(',')

  this.options.format = formats.find((format, index) => {
    // If this is the last format in the input string, that's
    // what we'll use.
    if (index === (formats.length - 1)) {
      return true
    }

    // If we're here, it means the requested format is WebP and
    // there is a fallback. We check the `accept` header to see
    // if the client supports WebP, choosing it if it does, or
    // choosing the fallback if it doesn't.
    if (format === 'webp') {
      let acceptHeader = (this.req.headers && this.req.headers.accept) || ''
      let supportsWebP = acceptHeader.split(',').includes('image/webp')

      return supportsWebP
    }

    return true
  })

  if (this.options.format === 'json') {
    if (this.fileExt === this.fileName) {
      this.format = 'PNG'
    } else {
      this.format = this.fileExt
    }
  } else {
    this.format = this.options.format
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
ImageHandler.prototype.getImageInfo = function (oldBuffer, newBuffer) {
  let options = this.options
  let data = {
    fileName: this.fileName,
    cacheReference: sha1(this.fileName),
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
  let colourOptions = {
    colorCount: options.maxColours || 64,
    quality: options.colourQuality || 1
  }

  if (this.entropy) {
    data.entropyCrop = this.entropy
  }

  return getColours(oldBuffer, colourOptions).then(colours => {
    data.format = this.imageData.format
    data.fileSizePre = oldBuffer.byteLength
    data.primaryColorPre = colours.primaryColour
    data.palettePre = colours.palette

    if (this.exifData.image && this.exifData.image.XResolution && this.exifData.image.YResolution) {
      data.density = {
        width: this.exifData.image.XResolution,
        height: this.exifData.image.YResolution,
        unit: (this.exifData.image.ResolutionUnit ? (this.exifData.image.ResolutionUnit === 2 ? 'dpi' : '') : '')
      }
    }

    return data
  }).then(data => {
    return getColours(newBuffer, colourOptions).then(colours => {
      data.fileSizePost = newBuffer.byteLength
      data.primaryColorPost = colours.primaryColour
      data.palettePost = colours.palette

      return data
    })
  })
}

ImageHandler.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

ImageHandler.prototype.parseUrl = function (url) {
  let parsedUrl = urlParser.parse(url, true)
  let searchNodes = (parsedUrl.search && parsedUrl.search.split('?')) || []
  let cdnUrl = `${parsedUrl.pathname}?${searchNodes.slice(-1)}`
  let assetUrl = parsedUrl.pathname

  if (parsedUrl.protocol && parsedUrl.host) {
    let baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

    if (parsedUrl.port) {
      baseUrl += `:${parsedUrl.port}`
    }

    assetUrl = baseUrl + assetUrl
  }

  if (searchNodes.length > 2) {
    assetUrl += `?${searchNodes.slice(-2, -1)}`
  }

  return {
    asset: urlParser.parse(assetUrl, true),
    original: parsedUrl,
    cdn: urlParser.parse(cdnUrl, true)
  }
}

ImageHandler.prototype.process = function (sharpImage, imageBuffer) {
  let options = this.options

  // Default values fot resize style
  if (!options.resizeStyle) {
    if (options.width && options.height) {
      options.resizeStyle = options.gravity
        ? 'aspectfill'
        : 'entropy'
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

  const {width, height} = this.calculatedDimensions
  const shouldExtractEntropy = ((options.resizeStyle === 'entropy') && width && height)
    ? this.extractEntropy(imageBuffer, width, height)
    : false

  return Promise.resolve(shouldExtractEntropy).then(entropy => {
    this.entropy = entropy

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
            const size = fit(this.imageData.width, this.imageData.height, width, height)

            sharpImage = sharpImage.resize(parseInt(size.width), parseInt(size.height), resizeOptions)

            break
          /*
          Aspect Fill: Will size your image proportionally until the whole area is full of your image.
          Your image is clipped. It will size proportionally to make sure there is no blank space left in your area.
          */
          case 'aspectfill':
            const scaleWidth = (width / this.imageData.width)
            const scaleHeight = (height / this.imageData.height)
            const scale = Math.max(scaleWidth, scaleHeight)
            const crops = this.getCropOffsetsByGravity(
              options.gravity,
              {width, height},
              scale
            )

            if (scaleHeight >= scaleWidth) {
              sharpImage = sharpImage.resize(
                Math.round(scale * this.imageData.width),
                height,
                resizeOptions
              )
            } else {
              sharpImage = sharpImage.resize(
                width,
                Math.round(scale * this.imageData.height),
                resizeOptions
              )
            }

            // Only crop if the aspect ratio is not the same
            if (
              (width / height) !== (this.imageData.width / this.imageData.height)
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
            resizeOptions.fit = 'fill'
            sharpImage = sharpImage
              .resize(width, height, resizeOptions)

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
                  resizeOptions.fit = 'fill'
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
              const excessWidth = Math.max(0, this.imageData.width - width)
              const excessHeight = Math.max(0, this.imageData.height - height)

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
        ? this.imageData.format
        : this.options.format).toLowerCase()

      let outputFn
      let outputOptions = {}

      switch (format) {
        case 'gif':
        case 'jpg':
        case 'jpeg':
          outputFn = 'jpeg'
          outputOptions.quality = parseInt(options.quality)

          break

        case 'png':
          outputFn = 'png'
          // Map options.quality inversely to a compression level between 1 and 9
          // Ignore compressionLevel=0 since this results in much larger file sizes
          let compressionLevel = parseInt((options.quality * -0.09) + 9)
          outputOptions.compressionLevel = Math.max(Math.min(compressionLevel, 9), 1)

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
                imageInfo: Object.assign({}, this.imageData, this.calculatedDimensions, {
                  naturalWidth: this.imageData.width,
                  naturalHeight: this.imageData.height
                }),
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
            return resolve(
              help.streamToBuffer(pluginStream)
            )
          }

          sharpImage.toBuffer({}, (err, buffer, info) => {
            if (err) return reject(err)

            let processBuffer = Promise.resolve(buffer)

            if (format === 'gif') {
              processBuffer = this.processGif(buffer)
            }

            if (options.progressive === 'true' && (format === 'jpeg' || format === 'jpg')) {
              processBuffer = this.progressiveJpeg(buffer)
            }

            processBuffer.then(buffer => {
              resolve(buffer)
            })
          })
        })
      } catch (err) {
        return reject(err)
      }
    })
  })
}

/**
 * Transcodes an input buffer to a GIF, ensures colours are appropriate
 * for GIF encoding via a "quantize" method.
 *
 * Saves the encoded GIF to a temporary file and removes to before returning
 * the buffer.
 *
 * @param {Buffer} buffer - a Buffer extracted from the main image
 * processor after applying image manipulations
 * @returns {Buffer} a GIF encoded buffer
 */
ImageHandler.prototype.processGif = function (buffer) {
  return Jimp.read(buffer).then(image => {
    let bitmap = new BitmapImage(image.bitmap)

    GifUtil.quantizeDekker(bitmap)

    let frame = new GifFrame(bitmap)

    let tmpGifFile = `${path.join(tmpDirectory, sha1(this.parsedUrl.original.path))}.gif`

    return GifUtil.write(tmpGifFile, [frame]).then(gif => {
      return fs.unlink(tmpGifFile).then(() => {
        return gif.buffer
      })
    })
  })
}

/**
 * Transcodes an input buffer to a progressive JPEG
 *
 * @param {Buffer} buffer - a Buffer extracted from the main image
 * processor after applying image manipulations
 * @returns {Buffer} a progressive JPEG encoded buffer
 */
ImageHandler.prototype.progressiveJpeg = function (buffer) {
  return imagemin.buffer(buffer, {
    plugins: [
      imageminJpegtran({progressive: true})
    ]
  })
}

ImageHandler.prototype.sanitiseOptions = function (options) {
  // check the options for aliases
  // e.g. "dpr" === "devicePixelRatio"

  let imageOptions = {}

  // handle querystring options that came from a remote image url
  // as if the original remote url had it's own querystring then we'll
  // get an option here that starts with a ?, from where the CDN params were added
  Object.keys(options).forEach(key => {
    if (key[0] === '?') {
      options[key.substring(1)] = options[key]
      delete options[key]
    }
  })

  Object.keys(options).forEach(key => {
    let settings = IMAGE_PARAMETERS.filter(setting => {
      return setting.name === key || setting.aliases.includes(key)
    })

    if (settings && settings[0]) {
      let value = options[key]

      if (options[key] !== '0' || settings[0].allowZero || settings[0].default) {
        if (options[key] !== '0' || settings[0].allowZero) {
          if (settings[0].lowercase) {
            value = value.toLowerCase()
          }

          value = isNaN(value) ? value : Number.parseFloat(value)

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
  let defaults = IMAGE_PARAMETERS.filter(setting => {
    return setting.default
  })

  defaults.forEach(setting => {
    if (typeof imageOptions[setting.name] === 'undefined') {
      imageOptions[setting.name] = setting.default
    }
  })

  // add any URL parameters that aren't part of the core set
  imageOptions = Object.assign({}, imageOptions, options)

  return imageOptions
}

ImageHandler.prototype.setBaseUrl = function (baseUrl) {
  this.parsedUrl = this.parseUrl(baseUrl)
}

function getColours (buffer, options) {
  return new Promise((resolve, reject) => {
    let v = new Vibrant(buffer, options)

    v.getSwatches((err, swatches) => {
      if (err) {
        return reject(err)
      }

      // remove empty swatches and sort by population descending
      swatches = Object.values(swatches)

      // swatches = swatches.filter(Boolean)
      swatches = Object.values(swatches).sort((a, b) => {
        if (a.population === b.population) return 0
        return a.population > b.population ? -1 : 1
      })

      let colourData = {
        primaryColour: swatches[0].getHex(),
        palette: {
          rgb: [],
          hex: []
        }
      }

      swatches.forEach((swatch, index) => {
        if (index !== 0) {
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
  let superLegacyFormatOffset = optionsArray.length === 13
    ? 0
    : 4

  let options = {
    format: optionsArray[0],
    quality: optionsArray[1],
    trim: optionsArray[2],
    trimFuzz: optionsArray[3],
    width: optionsArray[4],
    height: optionsArray[5],
    cropX: (superLegacyFormatOffset === 0) ? '0' : optionsArray[6],
    cropY: (superLegacyFormatOffset === 0) ? '0' : optionsArray[7],
    ratio: (superLegacyFormatOffset === 0) ? '0' : optionsArray[8],
    devicePixelRatio: (superLegacyFormatOffset === 0) ? '0' : optionsArray[9],
    resizeStyle: optionsArray[6 + superLegacyFormatOffset],
    gravity: optionsArray[7 + superLegacyFormatOffset],
    filter: optionsArray[8 + superLegacyFormatOffset],
    blur: optionsArray[9 + superLegacyFormatOffset],
    strip: optionsArray[10 + superLegacyFormatOffset],
    rotate: optionsArray[11 + superLegacyFormatOffset],
    flip: optionsArray[12 + superLegacyFormatOffset],
    progressive: optionsArray[13 + superLegacyFormatOffset]
  }

  return options
}

module.exports = ImageHandler
module.exports.ImageHandler = ImageHandler
module.exports.parameters = IMAGE_PARAMETERS
