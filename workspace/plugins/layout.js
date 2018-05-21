const concat = require('concat-stream')
const imageLib = require('images')
const imagesize = require('image-size-stream')
const PassThrough = require('stream').PassThrough
const Readable = require('stream').Readable
const path = require('path')
const url = require('url')

const TILE_TYPES = {
  IMAGE: 'i:',
  COLOUR: 'c:',
  OUTPUT: 'o:'
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

    if (c.length == 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }

    c = '0x' + c.join('')
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255]
  }

  throw new Error('Bad Hex')
}

const ImageLayoutProcessor = function ({assetStore, cache, req, setHeader}) {
  const parsedUrl = url.parse(req.url, true)

  this.cache = cache
  this.assetStore = assetStore
  this.inputs = []
  this.processUrl(parsedUrl.pathname)
  this.fileExt = path.extname(this.outputFile.fileName).substring(1)
  this.req = req
  this.setHeader = setHeader
}

ImageLayoutProcessor.prototype.get = function () {
  const cacheKey = this.req.url

  return this.cache.get(cacheKey).then(cachedLayout => {
    if (cachedLayout) {
      return cachedLayout
    }

    this.format = this.fileExt

    // Set content type
    this.setHeader('content-type', this.getContentType())

    const assetsQueue = this.inputs.map(input => {
      if (input.fileName) {
        return this.cache.get(input.fileName).then(cachedStream => {
          if (cachedStream) return cachedStream

          return this.assetStore('image', input.fileName).get()
        })
      }
    })

    return Promise.all(assetsQueue).then(streams => {
      return new Promise((resolve, reject) => {
        let newImage = imageLib(this.outputFile.width, this.outputFile.height)
        let i = 0

        const addImage = (input, obj) => {
          let inputImage

          try {
            if (obj instanceof Buffer) {
              let scaleWidth = (600 / input.originalImageSize.naturalWidth)
              let scaleHeight = (600 / input.originalImageSize.naturalHeight)
              let scale = Math.max(scaleWidth, scaleHeight)

              let calculatedWidth = input.originalImageSize.naturalWidth * scale
              let calculatedHeight = input.originalImageSize.naturalHeight * scale
              let sc = Math.max(input.width / calculatedWidth, input.height / calculatedHeight)
              let resizedWidth = calculatedWidth * sc
              let resizedHeight = calculatedHeight * sc

              input.l = resizedWidth === input.width ? 0 : (resizedWidth - input.width) / 2
              input.t = resizedHeight === input.height ? 0 : (resizedHeight - input.height) / 2

              inputImage = imageLib(obj).resize(resizedWidth, resizedHeight)
            } else {
              inputImage = obj
            }

            let extractedImage = imageLib(inputImage, input.l, input.t, input.width, input.height)

            newImage.draw(extractedImage, input.x, input.y)
          } catch (err) {

          }

          if (++i === this.inputs.length) {
            let outBuffer = newImage.encode(this.format, { operation: 100 })

            let cacheStream = new PassThrough()
            let responseStream = new PassThrough()

            let bufferStream = new PassThrough()
            bufferStream.end(outBuffer)

            bufferStream.pipe(cacheStream)
            bufferStream.pipe(responseStream)

            // Cache the layout
            this.cache.set(cacheStream, cacheKey)

            return resolve(responseStream)
          }
        }

        this.inputs.forEach((input, index) => {
          if (input.fileName) {
            const imageSizeStream = new PassThrough()
            const imageStream = new PassThrough()
            const concatStream = concat(obj => addImage(input, obj))

            streams[index].pipe(imageSizeStream)
            streams[index].pipe(imageStream)

            this.getImageSize(imageSizeStream).then(imageInfo => {
              input.originalImageSize = imageInfo
              imageStream.pipe(concatStream)
            })
          } else if (input.colour) {
            const rgb = hexToRgbA('#' + input.colour)

            addImage(input, imageLib(input.width, input.height).fill(rgb[0], rgb[1], rgb[2], 1))
          }
        })
      })
    })
  })
}

ImageLayoutProcessor.prototype.getContentType = function () {
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

ImageLayoutProcessor.prototype.getImageSize = function (stream) {
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

ImageLayoutProcessor.prototype.getFilename = function () {
  return this.outputFile.fileName
}

ImageLayoutProcessor.prototype.getInput = function (type, inputStr) {
  const parts = inputStr.split(',')

  let input = {}

  switch (type) {
    case TILE_TYPES.IMAGE:
      input.fileName = parts[0]
      break
    case TILE_TYPES.COLOUR:
      input.colour = parts[0]
      break
  }

  parts.shift()

  parts.forEach(part => {
    const type = part.substring(0, 1)

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

ImageLayoutProcessor.prototype.getLastModified = function () {
  if (!this.storageHandler || !this.storageHandler.getLastModified) return null

  return this.storageHandler.getLastModified()
}

ImageLayoutProcessor.prototype.getOutputFile = function (inputStr) {
  const parts = inputStr.split(',')
  const output = {
    fileName: parts[0]
  }

  parts.shift()

  parts.forEach(part => {
    const type = part.substring(0, 1)

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

ImageLayoutProcessor.prototype.processUrl = function (requestPath) {
  const pathParts = decodeURIComponent(requestPath).replace('/layout/', '').split('|')

  pathParts.forEach(part => {
    var type = part.substring(0, 2)

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

module.exports = options => {
  const layoutProcessor = new ImageLayoutProcessor(options)

  return layoutProcessor.get()
}
