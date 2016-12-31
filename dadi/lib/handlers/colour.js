var _ = require('underscore')
var colourNamer = require('color-namer')
var Vibrant = require('node-vibrant')

/**
 * Handles colour-related tasks for CDN images
 */
var ColourHandler = function () {

}

/**
 * Get colour information from an image stream
 * @returns {object}
 */
ColourHandler.prototype.getColours = function (buffer) {
  var v = new Vibrant(buffer, { colorCount: 12, quality: 1 })

  v.getSwatches((err, swatches) => {
    if (err) {
      console.log(err)
    }

    // remove empty swatches and sort by population descending
    swatches = _.compact(_.sortBy(swatches, 'population')).reverse()

    var dominantColour = swatches[0]
    var palette = swatches.slice(1)

    return {
      flattened: this.getFlattenedColours(dominantColour, palette),
      full: this.getFullColours(dominantColour, palette)
    }
  })
}

/**
 *
 * @param {Object} dominantColour - a colour swatch containing RGB, HSL, HEX
 * @param {Array} palette - an array of colour swatches
 */
ColourHandler.prototype.getFullColours = function (dominantColour, palette) {
  var primaryColourHex = dominantColour.getHex()
  var primaryColourHSL = dominantColour.getHsl()
  var humanColour = new HumanColours(primaryColourHSL)

  var paletteColours = {}

  _.each(palette, (colour, index) => {
    var hex = colour.getHex()
    var hsl = colour.getHsl()
    var humanColourPalette = new HumanColours(hsl)

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
  var primaryColourHex = dominantColour.getHex()
  var primaryColourHSL = dominantColour.getHsl()
  var humanColour = new HumanColours(primaryColourHSL)

  var colourNames = colourNamer(dominantColour.getRgb())
  var colours = _.sortBy([colourNames.basic[0], colourNames.roygbiv[0], colourNames.html[0], colourNames.pantone[0]], 'distance')
  var names = _.pluck(colours, 'name')
  var primaryColourArrays = {
    names: _.map(names, (name) => { return name.toLowerCase() }),
    hex: _.pluck(colours, 'hex')
  }

  primaryColourArrays.names.push(humanColour.hueName())
  primaryColourArrays.names = _.uniq(primaryColourArrays.names)

  var colourPalette = _.map(palette, (colour) => {
    var pc = colour.getHex()
    var hsl = colour.getHsl()
    var humanColour = new HumanColours(hsl)
    var names = colourNamer(pc)

    return {
      primary: pc,
      basic: names.basic[0],
      roygbiv: names.roygbiv[0],
      html: names.html[0],
      pantone: names.pantone[0],
      human: humanColour.hueName()
    }
  })

  var colourArrays = _.map(colourPalette, (colour) => {
    var colours = _.sortBy([colour.basic, colour.roygbiv, colour.html, colour.pantone], 'distance')
    return {
      names: [colours[0].name.toLowerCase(), colour.human.toLowerCase()],
      hex: [colours[0].hex]
    }
  })

  var nameArray = _.uniq(_.flatten(_.pluck(colourArrays, 'names')))
  var hexArray = _.uniq(_.flatten(_.pluck(colourArrays, 'hex')))

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
  var obj = colourNamer(colour)
  var data = {}

  _.each(Object.keys(obj), (group) => {
    data[group] = obj[group][0]
  })

  return data
}

var regex = /hsl\((.*)\)/ // Match hsl values
var h // Hue
var s // Saturation
var l // Lightness
var hue
var sat
var light

function HumanColours (hsl) {
  this.HSL = hsl
  this.values = this.HSL.replace(regex, '$1').split(',')
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
