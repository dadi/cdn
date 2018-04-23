const fs = require('fs-extra')
const path = require('path')

const DomainManager = function () {
  this.domains = []
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

  return this
}

module.exports = new DomainManager()
module.exports.DomainManager = DomainManager
