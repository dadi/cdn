const colourNamer = require('color-namer')
const Vibrant = require('node-vibrant')

/**
 * Handles colour-related tasks for CDN images
 */
const ColourHandler = function () {

}

/**
 * Get colour information from an image stream
 * @returns {object}
 */
ColourHandler.prototype.getColours = function (buffer, callback) {
  let v = new Vibrant(buffer, { colorCount: 12, quality: 1 })

  v.getSwatches((err, swatches) => {
    if (err) {
      console.log(err)
    }

    // remove empty swatches and sort by population descending
    swatches = Object.values(swatches)
    swatches.sort((a, b) => {
      if (a.population === b.population) return 0
      return a.population > b.population ? -1 : 1
    })

    let dominantColour = swatches[0]
    let palette = swatches.slice(1)

    return callback(null, {
      flattened: this.getFlattenedColours(dominantColour, palette),
      full: this.getFullColours(dominantColour, palette)
    })
  })
}

/**
 *
 * @param {Object} dominantColour - a colour swatch containing RGB, HSL, HEX
 * @param {Array} palette - an array of colour swatches
 */
ColourHandler.prototype.getFullColours = function (dominantColour, palette) {
  let primaryColourHex = dominantColour.getHex()
  let primaryColourHSL = this.getHsl(dominantColour.getHsl())
  let humanColour = new HumanColours(primaryColourHSL)

  let paletteColours = {}

  palette.forEach((colour, index) => {
    let hex = colour.getHex()
    let hsl = this.getHsl(colour.getHsl())
    let humanColourPalette = new HumanColours(hsl)

    paletteColours[index] = {
      rgb: colour.getRgb(),
      hsl: hsl,
      hex: hex,
      human: {
        lightness: humanColourPalette.lightnessName(),
        saturation: humanColourPalette.saturationName(),
        hue: humanColourPalette.hueName()
      }
    }
  })

  return {
    primaryColour: {
      rgb: dominantColour.getRgb(),
      hsl: primaryColourHSL,
      hex: primaryColourHex,
      human: {
        lightness: humanColour.lightnessName(),
        saturation: humanColour.saturationName(),
        hue: humanColour.hueName()
      },
      colourNames: this.getColourNames(dominantColour.getRgb())
    },
    palette: paletteColours
  }
}

/**
 *
 * @param {Object} dominantColour - a colour swatch containing RGB, HSL, HEX
 * @param {Array} palette - an array of colour swatches
 */
ColourHandler.prototype.getFlattenedColours = function (dominantColour, palette) {
  let primaryColourHex = dominantColour.getHex()
  let primaryColourHSL = this.getHsl(dominantColour.getHsl())
  let humanColour = new HumanColours(primaryColourHSL)

  let colourNames = colourNamer(dominantColour.getRgb())
  let colours = [colourNames.basic[0], colourNames.roygbiv[0], colourNames.html[0], colourNames.pantone[0]].sort((a, b) => {
    if (a.distance === b.distance) return 0
    return a.distance < b.distance ? -1 : 1
  })

  let names = colours.map(({ name }) => name)
  let primaryColourArrays = {
    names: names.map(name => { return name.toLowerCase() }),
    hex: colours.map(({ hex }) => hex)
  }

  primaryColourArrays.names.push(humanColour.hueName())
  // dedupe
  primaryColourArrays.names = [...(new Set(primaryColourArrays.names))]

  let colourPalette = palette.map(colour => {
    let pc = colour.getHex()
    let hsl = this.getHsl(colour.getHsl())
    let humanColour = new HumanColours(hsl)
    let names = colourNamer(pc)

    return {
      primary: pc,
      basic: names.basic[0],
      roygbiv: names.roygbiv[0],
      html: names.html[0],
      pantone: names.pantone[0],
      human: humanColour.hueName()
    }
  })

  let colourArrays = colourPalette.map(colour => {
    let colours = [colour.basic, colour.roygbiv, colour.html, colour.pantone].sort((a, b) => {
      if (a.distance === b.distance) return 0
      return a.distance < b.distance ? -1 : 1
    })
    return {
      names: [colours[0].name.toLowerCase(), colour.human.toLowerCase()],
      hex: [colours[0].hex]
    }
  })

  let nameArray = colourArrays.map(({ names }) => names)
  // flatten
  nameArray.reduce((acc, val) => acc.concat(val), [])
  // dedupe
  nameArray = [...(new Set(nameArray))]

  let hexArray = colourArrays.map(({ hex }) => hex)
  // flatten
  hexArray.reduce((acc, val) => acc.concat(val), [])
  // dedupe
  hexArray = [...(new Set(hexArray))]

  return {
    primary: {
      rgb: dominantColour.getRgb(),
      hex: primaryColourHex,
      nameArray: primaryColourArrays.names,
      hexArray: primaryColourArrays.hex
    },
    palette: {
      nameArray: nameArray,
      hexArray: hexArray
    }
  }
}

/**
 * Gets the named colours for a specified colour. Draws from lists of colours such as Basic, HTML and Pantone
 */
ColourHandler.prototype.getColourNames = function (colour) {
  let obj = colourNamer(colour)
  let data = {}

  Object.keys(obj).forEach(group => {
    data[group] = obj[group][0]
  })

  return data
}

/**
 * Translate an array of fractions to HSL numbers
 */
ColourHandler.prototype.getHsl = function (hslArray) {
  if (!hslArray || !hslArray.length || hslArray.length !== 3) {
    return [100, 25, 25]
  }

  return [ Math.ceil(hslArray[0] * 360), Math.ceil(hslArray[1] * 100).toString() + '%', Math.ceil(hslArray[2] * 100).toString() + '%' ]
}

let h // Hue
let s // Saturation
let l // Lightness
let hue
let sat
let light

function HumanColours (hsl) {
  this.HSL = hsl
  this.values = this.HSL
}

HumanColours.prototype = {
  getHSL: function () {
    return this.HSL
  },

  getHue: function () {
    return this.values[0]
  },

  getSaturation: function () {
    return this.values[1].replace('%', '')
  },

  getLightness: function () {
    return this.values[2].replace('%', '')
  },

  hueName: function () {
    h = this.getHue()

    if (h < 15) { hue = 'red' }
    if (h === 15) { hue = 'reddish' }
    if (h > 15) { hue = 'orange' }
    if (h > 45) { hue = 'yellow' }
    if (h > 70) { hue = 'lime' }
    if (h > 79) { hue = 'green' }
    if (h > 163) { hue = 'cyan' }
    if (h > 193) { hue = 'blue' }
    if (h > 240) { hue = 'indigo' }
    if (h > 260) { hue = 'violet' }
    if (h > 270) { hue = 'purple' }
    if (h > 291) { hue = 'magenta' }
    if (h > 327) { hue = 'rose' }
    if (h > 344) { hue = 'red' }

    return hue
  },

  saturationName: function () {
    s = this.getSaturation()

    if (s < 4) { sat = 'grey' }
    if (s > 3) { sat = 'almost grey' }
    if (s > 10) { sat = 'very unsaturated' }
    if (s > 30) { sat = 'unsaturated' }
    if (s > 46) { sat = 'rather unsaturated' }
    if (s > 60) { sat = 'saturated' }
    if (s > 80) { sat = 'rather saturated' }
    if (s > 90) { sat = 'very saturated' }

    return sat
  },

  lightnessName: function () {
    l = this.getLightness()

    if (l < 10) { light = 'almost black' }
    if (l > 9) { light = 'very dark' }
    if (l > 22) { light = 'dark' }
    if (l > 30) { light = 'normal?' }
    if (l > 60) { light = 'light' }
    if (l > 80) { light = 'very light' }
    if (l > 94) { light = 'almost white' }

    return light
  }
}

module.exports = function () {
  return new ColourHandler()
}

module.exports.ColourHandler = ColourHandler
