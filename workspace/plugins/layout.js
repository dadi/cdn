const concat = require('concat-stream')
const imagesize = require('image-size-stream')
const Jimp = require('jimp')
const PassThrough = require('stream').PassThrough
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

const ImageLayoutProcessor = function ({assetStore, cache, req, setHeader}) {
  let parsedUrl = url.parse(req.url, true)

  this.cache = cache
  this.assetStore = assetStore
  this.inputs = []
  this.processUrl(parsedUrl.pathname)
  this.fileExt = path.extname(this.outputFile.fileName).substring(1)
  this.req = req
  this.setHeader = setHeader
  this.newImage = null
}

ImageLayoutProcessor.prototype.get = function () {
  let cacheKey = this.req.url

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
        const addImage = (input, obj, cb) => {
          if (obj instanceof Buffer) {
            let resizedWidth
            let resizedHeight

            if (input.fileName) {
              let scaleWidth = (600 / input.originalImageSize.naturalWidth)
              let scaleHeight = (600 / input.originalImageSize.naturalHeight)
              let scale = Math.max(scaleWidth, scaleHeight)

              let calculatedWidth = input.originalImageSize.naturalWidth * scale
              let calculatedHeight = input.originalImageSize.naturalHeight * scale
              let sc = Math.max(input.width / calculatedWidth, input.height / calculatedHeight)
              resizedWidth = calculatedWidth * sc
              resizedHeight = calculatedHeight * sc

              input.l = resizedWidth === input.width ? 0 : (resizedWidth - input.width) / 2
              input.t = resizedHeight === input.height ? 0 : (resizedHeight - input.height) / 2
            } else {
              resizedWidth = input.width
              resizedHeight = input.height
            }

            // Read the overlay image, resive and composite it on the original
            Jimp.read(obj)
              .then(inputImage => {
                inputImage.resize(Math.floor(resizedWidth), Math.floor(resizedHeight))

                this.newImage.blit(
                  inputImage,
                  input.x,
                  input.y,
                  Math.floor(input.l),
                  Math.floor(input.t),
                  Math.floor(input.width),
                  Math.floor(input.height)
                )

                cb()
              }).catch(err => {
                cb(err)
              })
          }
        }

        let instance = this

        // Create a blank canvas using the output file dimensions.
        new Jimp(this.outputFile.width, this.outputFile.height, 0xff0000ff, (_err, image) => {
          this.newImage = image

          let i = 0

          this.inputs.forEach((input, index) => {
            if (input.fileName) {
              let imageSizeStream = new PassThrough()
              let imageStream = new PassThrough()

              let concatStream = concat(obj => {
                return addImage(input, obj, (err) => {
                  if (err) {
                    console.log(err)
                  }

                  if (++i === this.inputs.length) {
                    return returnImage(instance)
                  }
                })
              })

              streams[index].pipe(imageSizeStream)
              streams[index].pipe(imageStream)

              return this.getImageSize(imageSizeStream).then(imageInfo => {
                input.originalImageSize = imageInfo
                imageStream.pipe(concatStream)
              })
            } else if (input.colour) {
              // Create a colour tile.
              new Jimp(input.width, input.height, `#${input.colour}`, (_err, image) => {
                image.getBuffer(Jimp.MIME_PNG, (_err, buffer) => {
                  addImage(input, buffer, () => {
                    if (++i === this.inputs.length) {
                      return returnImage(instance)
                    }
                  })
                })
              })
            }
          })
        })

        function returnImage (instance) {
          return instance.newImage
            .getBuffer(instance.getContentType(), (err, outBuffer) => {
              let cacheStream = new PassThrough()
              let responseStream = new PassThrough()

              let bufferStream = new PassThrough()
              bufferStream.end(outBuffer)

              bufferStream.pipe(cacheStream)
              bufferStream.pipe(responseStream)

              // Cache the layout
              instance.cache.set(cacheStream, cacheKey)

              return resolve(responseStream)
            })
        }
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
