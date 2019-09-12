const PassThrough = require('stream').PassThrough
const urlParser = require('url')

/*

References:

- https://github.com/nagelflorian/react-duotone/blob/master/src/hex-to-rgb.js
- https://github.com/nagelflorian/react-duotone/blob/master/src/create-duotone-gradient.js
- https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-plugin-sharp/src/duotone.js
- https://en.wikipedia.org/wiki/Relative_luminance

*/

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : null
}

function createDuotoneGradient(primaryColorRGB, secondaryColorRGB) {
  const duotoneGradient = []

  for (let i = 0; i < 256; i++) {
    const ratio = i / 255

    duotoneGradient.push([
      Math.round(
        primaryColorRGB[0] * ratio + secondaryColorRGB[0] * (1 - ratio)
      ),
      Math.round(
        primaryColorRGB[1] * ratio + secondaryColorRGB[1] * (1 - ratio)
      ),
      Math.round(
        primaryColorRGB[2] * ratio + secondaryColorRGB[2] * (1 - ratio)
      )
    ])
  }

  return duotoneGradient
}

module.exports.post = ({jsonData, options, processor, sharp, stream, url}) => {
  const parsedUrl = urlParser.parse(url, true)
  const colourHighlight = parsedUrl.query.highlight || '#f00e2e'
  const colourShadow = parsedUrl.query.shadow || '#192550'
  const duotoneGradient = createDuotoneGradient(
    hexToRgb(colourHighlight),
    hexToRgb(colourShadow)
  )

  return processor
    .raw()
    .toBuffer({resolveWithObject: true})
    .then(({data, info}) => {
      for (let i = 0; i < data.length; i = i + info.channels) {
        const r = data[i + 0]
        const g = data[i + 1]
        const b = data[i + 2]

        const avg = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)

        data[i + 0] = duotoneGradient[avg][0]
        data[i + 1] = duotoneGradient[avg][1]
        data[i + 2] = duotoneGradient[avg][2]
      }

      return sharp(data, {
        raw: info
      })
        .toFormat(options.format)
        .toBuffer()
    })
    .then(buffer => {
      const bufferStream = new PassThrough()

      bufferStream.end(buffer)

      return bufferStream
    })
}
