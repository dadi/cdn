var AWS = require('aws-sdk-mock')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var Promise = require('bluebird')
var stream = require('stream')
var imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')
var factory = require(__dirname + '/../../dadi/lib/storage/factory')
var HTTPStorage = require(__dirname + '/../../dadi/lib/storage/http')
var cache = require(__dirname + '/../../dadi/lib/cache')

var config
var stub
var testConfigString

describe('Storage', function (done) {
  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())
    testConfigString = testConfigString.toString()

    done()
  })

  afterEach(function (done) {
    setTimeout(function () {
      fs.writeFileSync(config.configPath(), testConfigString)
      done()
    }, 1000)
  })

  describe('HTTP', function (done) {
    it('should use specified URL when passing external URL in request', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      var httpStorage = new HTTPStorage(null, req.url.substring(1))

      httpStorage.getFullUrl().should.eql('https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png')
    })

    it('should block a request for the specified external URL if allowFullURL is false', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.allowFullURL = false
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      var im = new imageHandler('png', req)
      return im.get().catch(function (err) {
        err.statusCode.should.eql(403)

        return Promise.resolve(true)
      })
    })

    it('should make a request for the specified external URL if allowFullURL is true', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.allowFullURL = true
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/https://www.google.co.uk/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
      }

      // fake the http request so it doesn't do anything
      var scope = nock('https://www.google.co.uk').get('/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png').reply(200)

      var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert', function (aStream, imageInfo) {
        return new Promise(function (resolve, reject) {
          var readable = new stream.Readable()
          readable.push('')
          readable.push(null)
          resolve({stream:readable})
        })
      })

      // this is the test
      var im = new imageHandler('png', req)
      return im.get().then(function (stream) {
        imageHandler.ImageHandler.prototype.convert.restore()
        convert.called.should.eql(true)

        // was our faked http request called?
        scope.isDone().should.eql(true)
      })
    })
  })
})
