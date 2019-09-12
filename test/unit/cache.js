const should = require('should')
const fs = require('fs')
const path = require('path')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const redis = require('redis')
const fakeredis = require('fakeredis')

const Router = require('router')
const router = Router()

let config
let cache
const imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

let testConfigString

describe('Cache', function(done) {
  beforeEach(function(done) {
    delete require.cache[__dirname + '/../../dadi/lib/cache']
    cache = require(__dirname + '/../../dadi/lib/cache')

    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    done()
  })

  afterEach(function(done) {
    delete require.cache[__dirname + '/../../dadi/lib/cache']
    fs.writeFileSync(config.configPath(), testConfigString)
    done()
  })

  it('should export an instance', function(done) {
    cache.should.be.Function
    done()
  })

  it("should cache if the app's directory config settings allow", function(done) {
    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = true
    newTestConfig.caching.redis.enabled = false
    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache.reset()

    const req = {
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    const im = new imageHandler('jpg', req)

    im.cache.isEnabled().should.eql(true)

    done()
  })

  it("should not cache if the app's config settings don't allow", function(done) {
    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache.reset()

    const req = {
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    const imageHandler = proxyquire('../../dadi/lib/handlers/image', {
      Cache: cache
    })
    const im = new imageHandler('jpg', req)

    im.cache.isEnabled().should.eql(false)

    done()
  })

  it('should receive null from cache.getStream() if the caching is disabled', function(done) {
    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.directory.path = './cache'

    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache.reset()

    const req = {
      __cdnLegacyURLSyntax: true,
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    const im = new imageHandler('jpg', req)

    const getStream = sinon.spy(im.cache, 'getStream')

    im.get()
      .then(function(stream) {
        getStream.restore()

        const args = getStream.firstCall.args

        args[0].includes(req.url).should.eql(true)

        const returnValue = getStream.firstCall.returnValue

        returnValue.then(err => {
          should.not.exist(err)

          done()
        })
      })
      .catch(console.log)
  })
})
