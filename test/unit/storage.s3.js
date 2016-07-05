var AWS = require('aws-sdk-mock')
var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var Promise = require('bluebird')
var stream = require('stream')
var imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')
var factory = require(__dirname + '/../../dadi/lib/storage/factory')
var DiskStorage = require(__dirname + '/../../dadi/lib/storage/disk')
var HTTPStorage = require(__dirname + '/../../dadi/lib/storage/http')
var S3Storage = require(__dirname + '/../../dadi/lib/storage/s3')
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

  describe('S3', function (done) {
    it('should use bucket name from config when not specified in path', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      newTestConfig.images.s3.region = 'eu-east-1'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
      }

      var settings = config.get('images')
      var s3Storage = new S3Storage(settings, req.url)

      s3Storage.getBucket().should.eql(settings.s3.bucketName)
    })

    it('should use correct key when s3 adapter is specified in config', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var spy = sinon.spy(factory, 'create')

      var req = {
        url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
      }

      // set expected key value
      var expected = 'test.jpg'

      // stub the get method so it doesn't do anything
      var get = sinon.stub(S3Storage.S3Storage.prototype, 'get', function () { return new Promise(function (resolve, reject) {
          var readable = new stream.Readable()
          readable.push('')
          readable.push(null)
          resolve(readable)
        })
      })

      var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert', function (aStream, imageInfo) {
        return new Promise(function (resolve, reject) {
          var readable = new stream.Readable()
          readable.push('')
          readable.push(null)
          resolve(readable)
        })
      })

      // this is the test
      var im = new imageHandler('jpg', req)
      return im.get().then(function (stream) {
        factory.create.restore()
        S3Storage.S3Storage.prototype.get.restore()
        imageHandler.ImageHandler.prototype.convert.restore()

        spy.called.should.eql(true)
        get.called.should.eql(true)

        var returnValue = spy.firstCall.returnValue
        returnValue.getKey().should.eql(expected)
      })
    })

    it('should use bucket name from path when specified', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/s3/testBucket/test.jpg'
      }

      var settings = config.get('images')
      var s3Storage = new S3Storage(settings, req.url)

      s3Storage.getBucket().should.eql('testBucket')
    })

    it('should use correct key when s3 adapter is specified in path', function () {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/s3/testBucket/test.jpg'
      }

      var settings = config.get('images')
      var s3Storage = new S3Storage(settings, req.url)

      s3Storage.getKey().should.eql('test.jpg')
    })

    it('should call AWS with the correct parameters', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var req = {
        url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
      }

      // set expected key value
      var expected = 'test.jpg'

      // mock the s3 request
      AWS.mock('S3', 'getObject', function(data) {
        AWS.restore()
        // here's the test
        // "data" contains the parameters passed to getObject
        data.Key.should.eql(expected)
        done()
      })

      var im = new imageHandler('jpg', req)

      // create the s3 handler
      var storage = im.storageFactory.create('image', req.url)

      return storage.get().then(function (stream) {
      })
    })
  })
})
