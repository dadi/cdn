const path = require('path')
const DomainManager = require(path.join(__dirname, '/../models/domain-manager'))
const help = require(path.join(__dirname, '/../help'))

/**
 * Accept POST requests for adding domains to the internal domain configuration.
 */
module.exports.post = (req, res) => {
  // Don't accept an empty POST
  if (!req.body || !Array.isArray(req.body) || req.body.length === 0) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  let domains = req.body

  domains.forEach(item => {
    if (!DomainManager.getDomain(item.domain)) {
      // Add the domain configuration.
      DomainManager.addDomain(item.domain, item.data)
    }
  })

  return help.sendBackJSON(201, {
    success: true,
    domains: DomainManager.getDomains().map(item => item.domain)
  }, res)
}

/**
 * Accept PUT requests for modifying domains in the internal domain configuration.
 */
module.exports.put = (req, res) => {
  // Don't accept an empty body
  if (!req.body || !req.body.data) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  let domain = req.params.domain
  let configSchema = req.body.data

  // Don't accept an empty param.
  if (!domain || Object.keys(configSchema).length === 0) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  // Domain not found.
  if (!DomainManager.getDomain(domain)) {
    return help.sendBackJSON(404, {
      success: false,
      errors: [`Domain '${domain}' does not exist`]
    }, res)
  }

  // Update the domain configuration.
  DomainManager.addDomain(domain, configSchema)

  return help.sendBackJSON(200, {
    success: true,
    domains: DomainManager.getDomains().map(item => item.domain)
  }, res)
}

/**
 * Accept DELETE requests for removing domains from the internal domain configuration.
 */
module.exports.delete = (req, res) => {
  let domain = req.params.domain

  // Don't accept an empty param.
  if (!domain) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  // Domain not found.
  if (!DomainManager.getDomain(domain)) {
    return help.sendBackJSON(404, {
      success: false,
      errors: [`Domain '${domain}' does not exist`]
    }, res)
  }

  // Remove the domain.
  DomainManager.removeDomain(domain)

  return help.sendBackJSON(200, {
    success: true,
    domains: DomainManager.getDomains().map(item => item.domain)
  }, res)
}
