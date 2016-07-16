var config = require(__dirname + '/../../../config')
var logger = require('@dadi/logger')
var request = require('request-promise')

var Route = function (config, req) {
  this.config = config
  this.headers = req.headers
  this.ip = req.connection.remoteAddress
}

Route.prototype.getRecipe = function () {
  var match
  var queue = []

  return this.evaluateBranches(this.config.branches).then((match) => {
    if (match) return match.recipe
  }).catch((err) => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

Route.prototype.evaluateBranches = function (branches, index) {
  index = index || 0

  if (!branches[index]) {
    return Promise.resolve(false)
  }

  return this.matchBranch(branches[index]).then((branchMatch) => {
    if (branchMatch) {
      return branches[index]
    }

    return this.evaluateBranches(branches, (index + 1))
  })
}

Route.prototype.matchBranch = function (branch) {
  if (!branch.condition) return Promise.resolve(branch)

  var match = true
  var queue = []

  Object.keys(branch.condition).every((type) => {
    switch (type) {
      case 'device':
        // Ensure `device` is an array
        if (!(branch.condition[type] instanceof Array)) {
          branch.condition[type] = [branch.condition[type]]
        }

        match = match && (branch.condition[type].indexOf(this.getDevice()) !== -1)

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

      case 'country':
        // Ensure `language` is an array
        if (!(branch.condition[type] instanceof Array)) {
          branch.condition[type] = [branch.condition[type]]
        }

        queue.push(this.getLocation().then((location) => {
          match = match && (branch.condition[type].indexOf(location) !== -1)
        }))
    }

    return match
  })

  return Promise.all(queue).then(() => {
    return match
  })
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
  if (!config.get('geolocation.enabled')) {
    return Promise.reject('Geolocation is not enabled')
  }

  switch (config.get('geolocation.method')) {
    case 'maxmind':
      return this.getMaxmindLocation()

    case 'remote':
      return this.getRemoteLocation()

    default:
      return Promise.reject('Invalid geolocation method')
  }
}

Route.prototype.getMaxmindLocation = function () {
  var Maxmind = require('maxmind')
  var countryDb = Maxmind.open(config.get('geolocation.maxmind.countryDbPath'), {
    cache: {
      max: 1000, // max items in cache
      maxAge: 1000 * 60 * 60 // life time in milliseconds
    }
  })
  var country = countryDb.get(this.ip)

  return Promise.resolve(country && country.country && country.country.iso_code)
}

Route.prototype.getRemoteLocation = function () {
  var uri = config.get('geolocation.remote.url')

  // Replace placeholders
  url = url.replace('{ip}', this.ip)
  url = url.replace('{key}', config.get('geolocation.remote.key'))
  url = url.replace('{secret}', config.get('geolocation.remote.secret'))

  return request({
    uri: uri,
    json:true}
  ).then((response) => {
    return response && response.location && response.location.country && response.location.country.isoCode
  }).catch((err) => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

module.exports = Route