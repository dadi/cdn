var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var Promise = require('bluebird')
var request = require('request')
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

describe('ImageHandler', function (done) {
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

  it('should use Disk Storage storage adapter when nothing else is configured', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    cache.reset()
    newTestConfig.images.directory.enabled = false
    newTestConfig.images.s3.enabled = false
    newTestConfig.images.remote.enabled = false
    newTestConfig.images.directory.path = './test/images'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    // console.log(newTestConfig)
    config.loadFile(config.configPath())

    var spy = sinon.spy(factory, 'create')

    var req = {
      __cdnLegacyURLSyntax: true,
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    var expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    var get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        var readable = new fs.createReadStream(expected)
        return resolve(readable)
      })
    })

    var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert').callsFake(function (aStream, imageInfo) {
      return new Promise(function (resolve, reject) {
        var readable = new stream.Readable()
        readable.push('')
        readable.push(null)
        resolve({stream: readable})
      })
    })

    // this is the test
    var im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      DiskStorage.DiskStorage.prototype.get.restore()
      imageHandler.ImageHandler.prototype.convert.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      var returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)

      done()
    })
  })

  it('should use Disk Storage storage adapter when configured', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    cache.reset()
    newTestConfig.images.directory.enabled = true
    newTestConfig.images.s3.enabled = false
    newTestConfig.images.remote.enabled = false
    newTestConfig.images.directory.path = './test/images'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var spy = sinon.spy(factory, 'create')

    var req = {
      __cdnLegacyURLSyntax: true,
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    var expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    var get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        var readable = new fs.createReadStream(expected)
        resolve(readable)
      })
    })

    var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert').callsFake(function (aStream, imageInfo) {
      return new Promise(function (resolve, reject) {
        var readable = new stream.Readable()
        readable.push('')
        readable.push(null)
        resolve({stream: readable})
      })
    })

    // this is the test
    var im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      DiskStorage.DiskStorage.prototype.get.restore()
      imageHandler.ImageHandler.prototype.convert.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      var returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)

      done()
    })
  })

  it.skip('should use HTTP Storage storage adapter when configured', () => {
    this.timeout(5000)
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    cache.reset()
    newTestConfig.images.directory.enabled = false
    newTestConfig.images.s3.enabled = false
    newTestConfig.images.remote.enabled = true
    newTestConfig.images.remote.path = 'https://nodejs.org'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    // console.log(newTestConfig)
    config.loadFile(config.configPath())

    var spy = sinon.spy(factory, 'create')

    var req = {
      __cdnLegacyURLSyntax: true,
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/static/images/logos/nodejs-new-white-pantone.png'
    }

    // set some expected values
    var expected = 'https://nodejs.org/static/images/logos/nodejs-new-white-pantone.png'

    // stub the get method so it doesn't do anything
    var get = sinon.stub(HTTPStorage.HTTPStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        var s = new stream.PassThrough()

        request
        .get(expected)
        .on('response', response => {})
        .on('error', err => {})
        .pipe(s)
        resolve(s)
      })
    })

    var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert').callsFake(function (aStream, imageInfo) {
      return new Promise(function (resolve, reject) {
        var readable = new stream.Readable()
        readable.push('')
        readable.push(null)
        resolve({stream: readable})
      })
    })

    // this is the test
    var im = new imageHandler('jpg', req)
    return im.get().then(function (stream) {
      factory.create.restore()
      HTTPStorage.HTTPStorage.prototype.get.restore()
      imageHandler.ImageHandler.prototype.convert.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      var returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)
    })
  })

  it('should use S3 Storage storage adapter when configured', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    cache.reset()
    newTestConfig.images.directory.enabled = false
    newTestConfig.images.s3.enabled = true
    newTestConfig.images.remote.enabled = false
    // newTestConfig.images.remote.path = 'https://nodejs.org'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var spy = sinon.spy(factory, 'create')

    var req = {
      __cdnLegacyURLSyntax: true,
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    var expected = ['test.jpg']

    var testImage = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    var get = sinon.stub(S3Storage.S3Storage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        var readable = new fs.createReadStream(testImage)
        resolve(readable)
      })
    })

    var convert = sinon.stub(imageHandler.ImageHandler.prototype, 'convert').callsFake(function (aStream, imageInfo) {
      return new Promise(function (resolve, reject) {
        var readable = new stream.Readable()
        readable.push('')
        readable.push(null)
        resolve({stream: readable})
      })
    })

    // this is the test
    var im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      S3Storage.S3Storage.prototype.get.restore()
      imageHandler.ImageHandler.prototype.convert.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      var returnValue = spy.firstCall.returnValue
      returnValue.urlParts.should.eql(expected)

      done()
    })
  })

  it('should return filename with jpg extension when a URL has no extension', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    cache.reset()
    newTestConfig.images.directory.enabled = false
    newTestConfig.images.s3.enabled = false
    newTestConfig.images.remote.enabled = true
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var req = {
      headers: {},
      url: '/test'
    }

    // set some expected values
    var expected = 'test.jpg'

    var im = new imageHandler('jpg', req)
    im.getFilename().should.eql(expected)

    done()
  })
})
