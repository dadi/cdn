var config = require(__dirname + '/../../../config')

var Route = function (config, req) {
  this.config = config
  this.headers = req.headers
  this.ip = req.connection.remoteAddress
  this.ip = '154.57.245.210'

  console.log('*** Location:', this.getLocation())
}

Route.prototype.getRecipe = function () {
  var match

  this.config.branches.some((branch) => {
    if (this.matchBranch(branch)) {
      match = branch.recipe

      return true
    }
  })

  return Promise.resolve(match)
}

Route.prototype.matchBranch = function (branch) {
  if (!branch.condition) return true

  var match = true

  Object.keys(branch.condition).every((type) => {
    switch (type) {
      case 'device':
        match = match && (branch.condition[type] === this.getDevice())

        break

      case 'language':
        var minQuality = (branch.condition.languagesMinQuality && parseInt(branch.condition.languagesMinQuality))

        if ((minQuality === undefined) && isNaN(minQuality)) {
          minQuality = 1
        }

        // Ensure `language` is an array
        if (!(branch.condition[type] instanceof Array)) {
          branch.condition[type] = [branch.condition[type]]
        }

        var languageMatch = this.getLanguages(minQuality).some((language) => {
          return branch.condition[type].indexOf(language) !== -1
        })

        match = match && languageMatch

        break
    }

    return match
  })

  return match
}

Route.prototype.getDevice = function () {
  var ua = require('ua-parser-js')(this.headers['user-agent'])
  
  return ua.device.type || 'desktop'
}

Route.prototype.getLanguages = function (minQuality) {
  var languages = require('accept-language').parse(this.headers['accept-language'])
  var result = []

  languages.forEach((language) => {
    if ((result.indexOf(language.language) === -1) && (language.quality >= minQuality)) {
      result.push(language.language)
    }
  })

  return result
}

Route.prototype.getLocation = function () {
  var Maxmind = require('maxmind')
  var countryDb = Maxmind.open(config.get('geolocation.maxmind.countryDbPath'), {
    cache: {
      max: 1000, // max items in cache
      maxAge: 1000 * 60 * 60 // life time in milliseconds
    }
  })
  var country = countryDb.get(this.ip)

  return country.country.iso_code
}

module.exports = Route