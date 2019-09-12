const AWS = require('aws-sdk-mock')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const request = require('request')
const should = require('should')
const sinon = require('sinon')
const Promise = require('bluebird')
const stream = require('stream')
const imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')
const factory = require(__dirname + '/../../dadi/lib/storage/factory')
const HTTPStorage = require(__dirname + '/../../dadi/lib/storage/http')
const cache = require(__dirname + '/../../dadi/lib/cache')

let config
let stub
let testConfigString

describe('Storage', function(done) {
  beforeEach(function(done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())
    testConfigString = testConfigString.toString()

    done()
  })

  afterEach(function(done) {
    setTimeout(function() {
      fs.writeFileSync(config.configPath(), testConfigString)
      done()
    }, 1000)
  })

  describe('HTTP', function(done) {
    it('should use specified URL when passing external URL in request', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url:
          '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      const httpStorage = new HTTPStorage({
        assetType: 'images',
        url: req.url.substring(1)
      })

      httpStorage
        .getFullUrl()
        .should.eql(
          'https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
        )
    })

    it('should use specified URL with URL parameters when passing external URL in request', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url:
          '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png?h=32'
      }

      const httpStorage = new HTTPStorage({
        assetType: 'images',
        url: req.url.substring(1)
      })

      httpStorage
        .getFullUrl()
        .should.eql(
          'https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png?h=32'
        )
    })

    it('should block a request for the specified external URL if allowFullURL is false', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.allowFullURL = false
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url:
          '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      const im = new imageHandler('png', req)

      return im.get().catch(function(err) {
        err.statusCode.should.eql(403)

        return Promise.resolve(true)
      })
    })

    it('should make a request for the specified external URL if allowFullURL is true', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.allowFullURL = true
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url:
          '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      // this is the test
      const im = new imageHandler('png', req)

      // fake the http request so it doesn't do anything
      const scope = nock('https://www.google.co.uk')
        .get('/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png')
        .reply(200, function(uri, requestBody) {
          const testImage =
            'http://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
          const s = new stream.PassThrough()

          request
            .get(testImage)
            .on('response', response => {
              // console.log(response.statusCode) // 200
              // console.log(response.headers['content-type']) // 'image/png'
            })
            .on('error', err => {})
            .pipe(s)

          return s
        })

      return im.get().then(function(stream) {
        // was our faked http request called?
        scope.isDone().should.eql(true)
      })
    })
  })
})
