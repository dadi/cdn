const path = require('path')
const DomainManager = require(path.join(__dirname, '/../models/domain-manager'))
const help = require(path.join(__dirname, '/../help'))

// Domain configuration template.
let configContent = {
  images: {
    remote: {
      path: null
    }
  },
  assets: {
    remote: {
      path: null
    }
  }
}

/**
 * Accept POST requests for adding domains to the internal domain configuration.
 */
module.exports.post = (req, res) => {
  // Don't accept an empty POST
  if (!req.body || (Object.keys(req.body).length === 0)) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  let payload = req.body
  let domains = Object.keys(payload)

  domains.forEach((domain, index) => {
    if (!DomainManager.getDomain(domain)) {
      // Prepare the domain configuration.
      configContent.images.remote.path = payload[domain].remote.path
      configContent.assets.remote.path = payload[domain].remote.path

      // Add the domain configuration.
      DomainManager.addDomain(domain, configContent)
    }

    if (index === domains.length - 1) {
      return help.sendBackJSON(201, {
        success: true,
        domains: DomainManager.getDomains().map(item => item.domain)
      }, res)
    }
  })
}

/**
 * Accept PUT requests for modifying domains in the internal domain configuration.
 */
module.exports.put = (req, res) => {
  let domain = req.params.domain
  let payload = req.body

  // Don't accept an empty param.
  if (!domain || !Object.keys(payload).length === 0) {
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

  // Prepare the domain configuration.
  configContent.images.remote.path = payload.remote.path
  configContent.assets.remote.path = payload.remote.path

  // Update the domain configuration.
  DomainManager.addDomain(domain, configContent)

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
