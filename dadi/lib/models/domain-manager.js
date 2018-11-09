const fs = require('fs-extra')
const path = require('path')

const DomainManager = function () {
  this.domains = []
}

/**
 * Adds a domain and its configuration to the internal domain configs.
 *
 * @param {String} domain
 * @param {Object} domainConfig
 */
DomainManager.prototype.addDomain = function (domain, domainConfig) {
  let config = require('./../../../config')

  if (!this.getDomain(domain)) {
    config.loadDomainConfig(domain, domainConfig)

    this.domains.push({
      domain
    })
  } else {
    config.loadDomainConfig(domain, domainConfig)
  }
}

/**
 * Removes a domain from the internal domain configs.
 *
 * @param {String} domain
 */
DomainManager.prototype.removeDomain = function (domain) {
  let config = require('./../../../config')

  if (this.getDomain(domain)) {
    delete config.domainConfigs[domain]

    this.domains = this.domains.filter(item => item.domain !== domain)
  }
}

/**
 * Returns a domain by name.
 *
 * @param  {String} domain
 * @return {Object}
 */
DomainManager.prototype.getDomain = function (domain) {
  if (typeof domain !== 'string') return null

  return this.domains.find(item => {
    return item.domain === domain
  })
}

/**
 * Returns all the domains.
 *
 * @return {Array}
 */
DomainManager.prototype.getDomains = function () {
  return this.domains
}

/**
 * Creates an internal array with all the configured domains,
 * with a `domain` and `path` properties, containing the domain
 * name and full path of its directory, respectively.
 *
 * @param  {String} domainsDirectory - full path of the base domains directory
 * @return {DomainManager}
 */
DomainManager.prototype.scanDomains = function (domainsDirectory) {
  let domainsPath = path.resolve(domainsDirectory)

  try {
    this.domains = fs.readdirSync(domainsPath).reduce((domains, domain) => {
      let domainPath = path.join(domainsPath, domain)

      if (fs.statSync(domainPath).isDirectory()) {
        domains.push({
          domain,
          path: domainPath
        })
      }

      return domains
    }, [])
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Domains directory (${domainsPath}) does not exist`)
    }

    throw err
  }

  return this
}

module.exports = new DomainManager()
module.exports.DomainManager = DomainManager
