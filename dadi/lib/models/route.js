var fs = require('fs')
var logger = require('@dadi/logger')
var path = require('path')
var request = require('request-promise')

var cache = require(path.join(__dirname, '/../cache'))()
var config = require(path.join(__dirname, '/../../../config'))

var Route = function (config) {
  this.config = config
}

Route.prototype._arrayIntersect = function (object, array) {
  if (!(object instanceof Array)) {
    object = [object]
  }

  return array.some((element) => {
    return object.some((objectPart) => {
      return objectPart.toLowerCase() === element.toLowerCase()
    })
  })
}

Route.prototype._getCacheKey = function () {
  return this.ip + this.config.route
}

Route.prototype._getPathInObject = function (path, object, breadcrumbs) {
  breadcrumbs = breadcrumbs || path.split('.')

  var head = breadcrumbs[0]

  if (breadcrumbs.length === 1) {
    return object[head]
  } else if (object[head]) {
    return this._getPathInObject(path, object[breadcrumbs[0]], breadcrumbs.slice(1))
  }
}

Route.prototype._matchBranch = function (branch) {
  if (!branch.condition) return Promise.resolve(branch)

  var match = true
  var queue = []

  Object.keys(branch.condition).every((type) => {
    var condition = branch.condition[type]

    switch (type) {
      case 'device':
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        match = match && this._arrayIntersect(this.getDevice(), condition)

        break

      case 'language':
        var minQuality = (branch.condition.languagesMinQuality && parseInt(branch.condition.languagesMinQuality))

        if ((minQuality === undefined) && isNaN(minQuality)) {
          minQuality = 1
        }

        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        var languageMatch = this.getLanguages(minQuality).some((language) => {
          return this._arrayIntersect(language, condition)
        })

        match = match && languageMatch

        break

      case 'country':
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        queue.push(this.getLocation().then((location) => {
          match = match && this._arrayIntersect(location, condition)
        }))

        break

      case 'network':
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        queue.push(this.getNetwork().then((network) => {
          match = match && network && this._arrayIntersect(network, condition)
        }))

        break
    }

    return match
  })

  return Promise.all(queue).then(() => {
    return match
  })
}

Route.prototype._requestAndGetPath = function (uri, path) {
  return request({
    json: true,
    uri: uri
  }).then((response) => {
    return response && this._getPathInObject(path, response)
  })
}

Route.prototype.evaluateBranches = function (branches, index) {
  index = index || 0

  if (!branches[index]) {
    return Promise.resolve(false)
  }

  return this._matchBranch(branches[index]).then((branchMatch) => {
    if (branchMatch) {
      return branches[index]
    }

    return this.evaluateBranches(branches, (index + 1))
  })
}

Route.prototype.getNetwork = function () {
  var path = config.get('network.path')
  var uri = config.get('network.url')

  // Replace placeholders in uri
  uri = uri.replace('{ip}', this.ip)
  uri = uri.replace('{key}', config.get('network.key'))
  uri = uri.replace('{secret}', config.get('network.secret'))

  return this._requestAndGetPath(uri, path).then((network) => {
    return network.split('/')
  }).catch((err) => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

Route.prototype.getDevice = function () {
  var ua = require('ua-parser-js')(this.userAgent)

  return ua.device.type || 'desktop'
}

Route.prototype.getLanguages = function (minQuality) {
  var languages = require('accept-language-parser').parse(this.language)
  var result = []

  languages.forEach((language) => {
    if ((result.indexOf(language.code) === -1) && (language.quality >= minQuality)) {
      result.push(language.code)
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

Route.prototype.getRecipe = function () {
  return cache.get(this._getCacheKey()).then((cachedRecipe) => {
    if (cachedRecipe) return Promise.resolve(cachedRecipe)

    return this.processRoute().then((recipe) => {
      if (recipe) {
        return cache.set(this._getCacheKey(), recipe).then(() => {
          return recipe
        }).catch((err) => {
          console.log(err)
          return recipe
        })
      }

      return recipe
    })
  })
}

Route.prototype.getRemoteLocation = function () {
  var countryPath = config.get('geolocation.remote.countryPath')
  var uri = config.get('geolocation.remote.url')

  // Replace placeholders
  uri = uri.replace('{ip}', this.ip)
  uri = uri.replace('{key}', config.get('geolocation.remote.key'))
  uri = uri.replace('{secret}', config.get('geolocation.remote.secret'))

  return this._requestAndGetPath(uri, countryPath).catch((err) => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

Route.prototype.processRoute = function () {
  return this.evaluateBranches(this.config.branches).then((match) => {
    if (match) return match.recipe
  }).catch((err) => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

Route.prototype.save = function () {
  var filePath = path.join(path.resolve(config.get('paths.routes')), this.config.route + '.json')

  try {
    fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2))

    return true
  } catch (err) {
    logger.error({module: 'routes'}, err)

    return false
  }
}

Route.prototype.setIP = function (ip) {
  this.ip = ip
}

Route.prototype.setLanguage = function (language) {
  this.language = language
}

Route.prototype.setUserAgent = function (userAgent) {
  this.userAgent = userAgent
}

Route.prototype.validate = function () {
  var errors = []

  // Check for required fields
  if (!this.config.route) {
    errors.push('Route name is missing')
  }

  // Check for name pattern
  if (/^[A-Za-z-_]{5,}$/.test(this.config.route) === false) {
    errors.push('Route name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores')
  }

  if (this.config.branches && (this.config.branches instanceof Array)) {
    // Check for `recipe` in branches
    this.config.branches.forEach((branch, index) => {
      if (!branch.recipe) {
        errors.push('Branch ' + index + ' does not have a recipe')
      }
    })
  } else {
    errors.push('Route branches missing or invalid')
  }

  return errors.length ? errors : null
}

module.exports = Route
