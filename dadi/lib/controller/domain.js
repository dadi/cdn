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
      // Prepare the domain configuration.
      let configContent = {
        images: {
          directory: {
            enabled: false
          },
          remote: {
            enabled: true,
            path: item.data.remote.path
          }
        },
        assets: {
          directory: {
            enabled: false
          },
          remote: {
            enabled: true,
            path: item.data.remote.path
          }
        }
      }

      // Add the domain configuration.
      DomainManager.addDomain(item.domain, configContent)
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
  let domain = req.params.domain
  let payload = req.body

  // Don't accept an empty param.
  if (!domain || Object.keys(payload).length === 0) {
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
  let configContent = {
    images: {
      directory: {
        enabled: false
      },
      remote: {
        enabled: true,
        path: payload.remote.path
      }
    },
    assets: {
      directory: {
        enabled: false
      },
      remote: {
        enabled: true,
        path: payload.remote.path
      }
    }
  }

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
