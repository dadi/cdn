const config = require('./../../config')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const objectPath = require('object-path')
const path = require('path')
const should = require('should')
const sinon = require('sinon')

describe('Config', done => {
  let rawConfig = require(
    './../../config/config.test.json'
  )
  let domainConfig = require(
    './../../domains/testdomain.com/config/config.test.json'
  )

  it('should create config object', () => {
    config.should.be.Function
  })

  describe('when not given a domain', () => {
    it('should return values from the main config', () => {
      config.get('server.port').should.eql(
        rawConfig.server.port
      )
    })  
  })

  describe('when given a domain', () => {
    it('should return values from the main config if the value is not specified in the domain config', () => {
      should.not.exist(domainConfig.paths && domainConfig.paths.plugins)

      config.get('paths.plugins', 'testdomain.com').should.eql(
        config.get('paths.plugins')
      )
    })

    it('should return values from the main config if the value specified in the domain config isn\'t overridable', () => {
      should.exist(domainConfig.server.host)
      Boolean(
        objectPath.get(config.schema, 'server.host.allowDomainOverride')
      ).should.eql(false)

      config.get('server.host', 'testdomain.com').should.eql(
        rawConfig.server.host
      )
    })

    it('should return values from the domain config if the value is overridable and is specified in the domain config', () => {
      should.exist(domainConfig.images.remote.path)
      Boolean(
        objectPath.get(config.schema, 'images.remote.path.allowDomainOverride')
      ).should.eql(true)

      config.get('images.remote.path', 'testdomain.com').should.eql(
        domainConfig.images.remote.path
      )
    })  
  })
})
