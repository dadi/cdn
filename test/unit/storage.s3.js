const AWS = require('aws-sdk-mock')
const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const Promise = require('bluebird')
const stream = require('stream')
const imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')
const factory = require(__dirname + '/../../dadi/lib/storage/factory')
const DiskStorage = require(__dirname + '/../../dadi/lib/storage/disk')
const HTTPStorage = require(__dirname + '/../../dadi/lib/storage/http')
const S3Storage = require(__dirname + '/../../dadi/lib/storage/s3')
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

  describe('S3', function(done) {
    it('should use bucket name from config when not specified in path', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      newTestConfig.images.s3.region = 'eu-east-1'
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url: '/test.jpg'
      }

      const settings = config.get('images')
      const s3Storage = new S3Storage({
        assetType: 'images',
        url: req.url
      })

      s3Storage.getBucket().should.eql(settings.s3.bucketName)
    })

    it('should use correct key when s3 adapter is specified in config', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const spy = sinon.spy(factory, 'create')

      const req = {
        url: '/test.jpg'
      }

      // set expected key value
      const expected = 'test.jpg'

      const testImage = path.join(
        path.resolve(config.get('images.directory.path')),
        '/test.jpg'
      )

      // stub the get method so it doesn't do anything
      const get = sinon
        .stub(S3Storage.S3Storage.prototype, 'get')
        .callsFake(function() {
          return new Promise(function(resolve, reject) {
            const readable = new fs.createReadStream(testImage)

            resolve(readable)
          })
        })

      // this is the test
      const im = new imageHandler('jpg', req)

      return im.get().then(function(stream) {
        factory.create.restore()
        S3Storage.S3Storage.prototype.get.restore()

        spy.called.should.eql(true)
        get.called.should.eql(true)

        const returnValue = spy.firstCall.returnValue

        returnValue.getKey().should.eql(expected)
      })
    })

    it('should use bucket name from path when specified', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url: '/s3/testBucket/test.jpg'
      }

      const settings = config.get('images')
      const s3Storage = new S3Storage({
        assetType: 'images',
        url: req.url
      })

      s3Storage.getBucket().should.eql('testBucket')
    })

    it('should use correct key when s3 adapter is specified in path', function() {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url: '/s3/testBucket/test.jpg'
      }

      const settings = config.get('images')
      const s3Storage = new S3Storage({
        assetType: 'images',
        url: req.url
      })

      s3Storage.getKey().should.eql('test.jpg')
    })

    it('should call AWS with the correct parameters', function(done) {
      const newTestConfig = JSON.parse(testConfigString)

      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = true
      newTestConfig.images.s3.bucketName = 'test'
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      config.loadFile(config.configPath())

      const req = {
        url: '/test.jpg'
      }

      // set expected key value
      const expected = 'test.jpg'

      // mock the s3 request
      AWS.mock('S3', 'getObject', function(data) {
        AWS.restore()
        // here's the test
        // "data" contains the parameters passed to getObject

        data.Key.should.eql(expected)
        data.Bucket.should.eql(newTestConfig.images.s3.bucketName)

        done()
      })

      const im = new imageHandler('jpg', req)

      im.get()
    })
  })
})
