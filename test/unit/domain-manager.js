const config = require(__dirname + '/../../config')
const domainManager = require(__dirname + '/../../dadi/lib/models/domain-manager')
const fs = require('fs-extra')
const path = require('path')

describe('Domain manager', () => {
  describe('`scanDomains()` method', () => {
    it('should build an array of domains and paths', () => {
      let domainsDirectory = path.resolve(
        config.get('multiDomain.directory')
      )

      return Promise.all([
        fs.ensureDir(
          path.join(domainsDirectory, 'localhost')
        ),
        fs.ensureDir(
          path.join(domainsDirectory, 'testdomain.com')
        )
      ]).then(() => {
        let domains = new domainManager.DomainManager()

        domains.scanDomains(domainsDirectory)

        domains.domains.should.eql([
          {
            domain: 'localhost',
            path: path.join(domainsDirectory, 'localhost')
          },
          {
            domain: 'testdomain.com',
            path: path.join(domainsDirectory, 'testdomain.com')
          }
        ])
      })
    })

    it('should ignore any files and only include directories', () => {
      let domainsDirectory = path.resolve(
        config.get('multiDomain.directory')
      )

      let mockFile1 = path.join(domainsDirectory, 'not-a-domain')
      let mockFile2 = path.join(domainsDirectory, 'definitely-not-a-domain.js')

      return Promise.all([
        fs.ensureFile(mockFile1),
        fs.ensureFile(mockFile2)
      ]).then(() => {
        let domains = new domainManager.DomainManager()

        domains.scanDomains(domainsDirectory)

        should.not.exist(
          domains.domains.find(item => {
            return ['not-a-domain', 'definitely-not-a-domain.js'].includes(item.domain)
          })
        )

        return fs.remove(mockFile1)
      }).then(() => {
        return fs.remove(mockFile2)
      })
    })
  })

  describe('`addDomain()` method', () => {
    it('should add the specified domain to the internal map of domains', () => {
      let domains = new domainManager.DomainManager()

      domains.addDomain('test-domain', {})
      domains.getDomain('test-domain').should.eql({domain: 'test-domain'})
    })
  })

  describe('`removeDomain()` method', () => {
    it('should remove the specified domain from the internal map of domains', () => {
      let domains = new domainManager.DomainManager()

      domains.removeDomain('test-domain')
      let domain = domains.getDomain('test-domain');

      (typeof domain).should.eql('undefined')
    })
  })

  describe('`getDomains()` method', () => {
    it('should return the full array of domains and paths', () => {
      let domainsDirectory = path.resolve(
        config.get('multiDomain.directory')
      )

      return Promise.all([
        fs.ensureDir(
          path.join(domainsDirectory, 'localhost')
        ),
        fs.ensureDir(
          path.join(domainsDirectory, 'testdomain.com')
        )
      ]).then(() => {
        let domains = new domainManager.DomainManager()

        domains.scanDomains(domainsDirectory)
        domains.getDomains().should.eql(domains.domains)
      })
    })
  })

  describe('`getDomain()` method', () => {
    it('should return the name and path of a matching domain', () => {
      let domainsDirectory = path.resolve(
        config.get('multiDomain.directory')
      )

      return Promise.all([
        fs.ensureDir(
          path.join(domainsDirectory, 'localhost')
        ),
        fs.ensureDir(
          path.join(domainsDirectory, 'testdomain.com')
        )
      ]).then(() => {
        let domains = new domainManager.DomainManager()

        domains.scanDomains(domainsDirectory)
        domains.getDomain('localhost').should.eql(domains.domains[0])
        domains.getDomain('testdomain.com').should.eql(domains.domains[1])
      })
    })

    it('should return `undefined` when given a domain that is not configured', () => {
      let domainsDirectory = path.resolve(
        config.get('multiDomain.directory')
      )
      let domains = new domainManager.DomainManager()

      domains.scanDomains(domainsDirectory)
      should.not.exist(domains.getDomain('lolcathost'))
    })    
  })  
})
