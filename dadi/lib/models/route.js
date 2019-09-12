const domainManager = require('./domain-manager')
const fs = require('fs-extra')
const languageParser = require('accept-language-parser')
const logger = require('@dadi/logger')
const Maxmind = require('maxmind')
const path = require('path')
const request = require('request-promise')
const userAgentParser = require('ua-parser-js')

const cache = require(path.join(__dirname, '/../cache'))()
const config = require(path.join(__dirname, '/../../../config'))

const Route = function(config) {
  this.config = config
}

Route.prototype._arrayIntersect = function(object, array) {
  if (!object) return false

  if (!(object instanceof Array)) {
    object = [object]
  }

  return array.some(element => {
    return object.some(objectPart => {
      return (
        objectPart.toString().toLowerCase() === element.toString().toLowerCase()
      )
    })
  })
}

Route.prototype._getCacheKey = function() {
  return [this.domain, this.ip + this.config.route]
}

Route.prototype._getPathInObject = function(path, object, breadcrumbs) {
  breadcrumbs = breadcrumbs || path.split('.')

  const head = breadcrumbs[0]

  if (breadcrumbs.length === 1) {
    return object[head]
  } else if (object[head]) {
    return this._getPathInObject(
      path,
      object[breadcrumbs[0]],
      breadcrumbs.slice(1)
    )
  }
}

Route.prototype._matchBranch = function(branch) {
  if (!branch.condition) return Promise.resolve(true)

  let match = true
  const queue = []

  Object.keys(branch.condition).every(type => {
    let condition = branch.condition[type]

    switch (type) {
      case 'device': {
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        match = match && this._arrayIntersect(this.getDevice(), condition)

        break
      }

      case 'language': {
        let minQuality =
          branch.condition.languageMinQuality &&
          parseFloat(branch.condition.languageMinQuality)

        if (minQuality === undefined || isNaN(minQuality)) {
          minQuality = 1
        }

        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        const languageMatch = this.getLanguages(minQuality).some(language => {
          return this._arrayIntersect(language, condition)
        })

        match = match && languageMatch

        break
      }

      case 'country': {
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        queue.push(
          this.getLocation().then(location => {
            match = match && this._arrayIntersect(location, condition)
          })
        )

        break
      }

      case 'network': {
        // Ensure the condition is in array format
        if (!(condition instanceof Array)) {
          condition = [condition]
        }

        queue.push(
          this.getNetwork().then(network => {
            match = match && network && this._arrayIntersect(network, condition)
          })
        )

        break
      }
    }

    return match
  })

  return Promise.all(queue).then(() => {
    return match
  })
}

Route.prototype._requestAndGetPath = function(uri, path) {
  return request({
    json: true,
    uri
  }).then(response => {
    return response && this._getPathInObject(path, response)
  })
}

Route.prototype.evaluateBranches = function(branches, index) {
  index = index || 0

  if (!branches[index]) {
    return Promise.resolve(false)
  }

  return this._matchBranch(branches[index]).then(branchMatch => {
    if (branchMatch) {
      return branches[index]
    }

    return this.evaluateBranches(branches, index + 1)
  })
}

Route.prototype.getDevice = function() {
  const ua = userAgentParser(this.userAgent)

  return ua.device.type || 'desktop'
}

Route.prototype.getLanguages = function(minQuality) {
  const languages = languageParser.parse(this.language)

  const result = []

  languages.forEach(language => {
    if (
      result.indexOf(language.code) === -1 &&
      language.quality >= minQuality
    ) {
      result.push(language.code)
    }
  })

  return result
}

Route.prototype.getLocation = function() {
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

Route.prototype.getMaxmindLocation = function() {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(
      __dirname,
      config.get('geolocation.maxmind.countryDbPath')
    )

    Maxmind.open(
      dbPath,
      {
        cache: {
          max: 1000, // max items in cache
          maxAge: 1000 * 60 * 60 // life time in milliseconds
        }
      },
      (err, db) => {
        if (err) return reject(err)

        const country = db.get(this.ip)

        return resolve(country && country.country && country.country.iso_code)
      }
    )
  })
}

Route.prototype.getNetwork = function() {
  const path = config.get('network.path')
  let uri = config.get('network.url')

  // Replace placeholders in uri
  uri = uri.replace('{ip}', this.ip)
  uri = uri.replace('{key}', config.get('network.key'))
  uri = uri.replace('{secret}', config.get('network.secret'))

  return this._requestAndGetPath(uri, path)
    .then(network => {
      return network.split('/')
    })
    .catch(err => {
      logger.error({module: 'routes'}, err)

      return Promise.resolve(null)
    })
}

Route.prototype.getRecipe = function() {
  return cache.getStream(this._getCacheKey()).then(cachedRecipe => {
    if (cachedRecipe) return cachedRecipe

    return this.processRoute().then(recipe => {
      if (recipe) {
        return cache
          .set(this._getCacheKey(), recipe)
          .then(() => {
            return recipe
          })
          .catch(err => {
            logger.error({module: 'routes'}, err)

            return recipe
          })
      }

      return recipe
    })
  })
}

Route.prototype.getRemoteLocation = function() {
  const countryPath = config.get('geolocation.remote.countryPath')
  let uri = config.get('geolocation.remote.url')

  // Replace placeholders
  uri = uri.replace('{ip}', this.ip)
  uri = uri.replace('{key}', config.get('geolocation.remote.key'))
  uri = uri.replace('{secret}', config.get('geolocation.remote.secret'))

  return this._requestAndGetPath(uri, countryPath).catch(err => {
    logger.error({module: 'routes'}, err)

    return Promise.resolve(null)
  })
}

Route.prototype.processRoute = function() {
  return this.evaluateBranches(this.config.branches)
    .then(match => {
      if (match) return match.recipe
    })
    .catch(err => {
      logger.error({module: 'routes'}, err)

      return Promise.resolve(null)
    })
}

Route.prototype.save = function(domainName) {
  const domain = domainManager.getDomain(domainName)
  const routePath = path.resolve(
    path.join(
      domain ? domain.path : '',
      config.get('paths.routes', domainName),
      `${this.config.route}.json`
    )
  )

  return fs.writeJson(routePath, this.config, {
    spaces: 2
  })
}

Route.prototype.setDomain = function(domain) {
  this.domain = domain
}

Route.prototype.setIP = function(ip) {
  this.ip = ip
}

Route.prototype.setLanguage = function(language) {
  this.language = language
}

Route.prototype.setUserAgent = function(userAgent) {
  this.userAgent = userAgent
}

Route.prototype.validate = function() {
  const errors = []

  // Check for required fields
  if (!this.config.route) {
    errors.push('Route name is missing')
  }

  // Check for name pattern
  if (/^[A-Za-z-_]{5,}$/.test(this.config.route) === false) {
    errors.push(
      'Route name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores'
    )
  }

  if (this.config.branches && this.config.branches instanceof Array) {
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
