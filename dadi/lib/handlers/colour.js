var _ = require('underscore')
var colourNamer = require('color-namer')
var ColorThief = require('color-thief')
var colorThief = new ColorThief()

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
  var dominantColour = colorThief.getColor(buffer)
  var palette = colorThief.getPalette(buffer)

  var primaryColourHex = this.RGBtoHex(dominantColour[0], dominantColour[1], dominantColour[2])
  var primaryColourHSL = this.RGBtoHSL(dominantColour[0], dominantColour[1], dominantColour[2])
  var humanColour = new HumanColours(primaryColourHSL)

  var paletteColours = {}

  _.each(palette, (colour, index) => {
    var hex = this.RGBtoHex(colour[0], colour[1], colour[2])
    var hsl = this.RGBtoHSL(colour[0], colour[1], colour[2])
    var humanColourPalette = new HumanColours(hsl)

    paletteColours[index] = {
      rgb: colour,
      hsl: hsl,
      hex: hex,
      human: {
        lightness: humanColourPalette.lightnessName(),
        saturation: humanColourPalette.saturationName(),
        hue: humanColourPalette.hueName()
      },
      colourNames: this.getColourNames(colour)
    }
  })

  var data = {
    primaryColour: {
      rgb: dominantColour,
      hsl: primaryColourHSL,
      hex: primaryColourHex,
      human: {
        lightness: humanColour.lightnessName(),
        saturation: humanColour.saturationName(),
        hue: humanColour.hueName()
      },
      colourNames: this.getColourNames(dominantColour)
    },
    palette: paletteColours
  }

  return data
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
}

/**
 * Converts an RGB colour value to HEX
 */
ColourHandler.prototype.RGBtoHex = function (r, g, b) {
  return '#' + ('00000' + (r << 16 | g << 8 | b).toString(16)).slice(-6)
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
ColourHandler.prototype.RGBtoHSL = function (r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var h
  var s
  var l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    var d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  var h1 = Math.round(h * 360)
  var s1 = Math.round(s * 100)
  var l1 = Math.round(l * 100)

  return 'hsl(' + h1 + ', ' + s1 + '%, ' + l1 + '%)'
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
