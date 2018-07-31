const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const request = require('request')
const stream = require('stream')
const imageHandler = require('./../../dadi/lib/handlers/image')
const factory = require('./../../dadi/lib/storage/factory')
const DiskStorage = require('./../../dadi/lib/storage/disk')
const HTTPStorage = require('./../../dadi/lib/storage/http')
const S3Storage = require('./../../dadi/lib/storage/s3')
const config = require('./../../config')

let configBackup = config.get()

describe('ImageHandler', function (done) {
  beforeEach(function (done) {

    done()
  })

  afterEach(function (done) {
    config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
    config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
    
    config.set('images.directory.enabled', configBackup.images.directory.enabled)
    config.set('images.s3.enabled', configBackup.images.s3.enabled)
    config.set('images.remote.enabled', configBackup.images.remote.enabled)
    config.set('images.directory.path', configBackup.images.directory.path)
    done()
  })

  it('should use Disk Storage adapter when nothing else is configured', function (done) {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    
    config.set('images.directory.enabled', false)
    config.set('images.s3.enabled', false)
    config.set('images.remote.enabled', false)
    config.set('images.directory.path', './test/images')

    let spy = sinon.spy(factory, 'create')

    let req = {
      __cdnLegacyURLSyntax: true,
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    let expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    let get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        let readable = new fs.createReadStream(expected)
        return resolve(readable)
      })
    })

    // this is the test
    let im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      DiskStorage.DiskStorage.prototype.get.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      let returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)

      done()
    })
  })

  it('should use Disk Storage adapter when configured', function (done) {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    
    config.set('images.directory.enabled', true)
    config.set('images.s3.enabled', false)
    config.set('images.remote.enabled', false)
    config.set('images.directory.path', './test/images')

    let spy = sinon.spy(factory, 'create')

    let req = {
      __cdnLegacyURLSyntax: true,
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    let expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    let get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        let readable = new fs.createReadStream(expected)
        resolve(readable)
      })
    })

    // this is the test
    let im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      DiskStorage.DiskStorage.prototype.get.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      let returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)

      done()
    })
  })

  it('should use HTTP Storage adapter when configured', () => {
    this.timeout(5000)

    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    
    config.set('images.directory.enabled', false)
    config.set('images.s3.enabled', false)
    config.set('images.remote.enabled', true)
    config.set('images.remote.path', 'https://nodejs.org')

    let spy = sinon.spy(factory, 'create')

    let req = {
      __cdnLegacyURLSyntax: false,
      headers: {},
      url: 'static/images/logos/nodejs-new-white-pantone.png'
    }

    // set some expected values
    let expected = 'https://nodejs.org/static/images/logos/nodejs-new-white-pantone.png'

    // stub the get method so it doesn't do anything
    let get = sinon.stub(HTTPStorage.HTTPStorage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        let s = new stream.PassThrough()

        request
          .get(expected)
          .on('response', response => {})
          .on('error', err => {})
          .pipe(s)
        resolve(s)
      })
    })

    // this is the test
    let im = new imageHandler('jpg', req)
    return im.get().then(function (stream) {
      factory.create.restore()
      HTTPStorage.HTTPStorage.prototype.get.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      let returnValue = spy.firstCall.returnValue
      returnValue.getFullUrl().should.eql(expected)
    })
  })

  it('should use S3 Storage adapter when configured', function (done) {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    
    config.set('images.directory.enabled', false)
    config.set('images.s3.enabled', true)
    config.set('images.remote.enabled', false)

    let spy = sinon.spy(factory, 'create')

    let req = {
      __cdnLegacyURLSyntax: true,
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    // set some expected values
    let expected = ['test.jpg']

    let testImage = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    let get = sinon.stub(S3Storage.S3Storage.prototype, 'get').callsFake(function () {
      return new Promise(function (resolve, reject) {
        let readable = new fs.createReadStream(testImage)
        resolve(readable)
      })
    })

    // this is the test
    let im = new imageHandler('jpg', req)
    im.get().then(function (stream) {
      factory.create.restore()
      S3Storage.S3Storage.prototype.get.restore()

      spy.called.should.eql(true)
      get.called.should.eql(true)

      let returnValue = spy.firstCall.returnValue
      returnValue.urlParts.should.eql(expected)

      done()
    })
  })

  it('should return filename with jpg extension when a URL has no extension', function (done) {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    
    config.set('images.directory.enabled', false)
    config.set('images.s3.enabled', false)
    config.set('images.remote.enabled', true)

    let req = {
      headers: {},
      url: '/test'
    }

    // set some expected values
    let expected = 'test.jpg'

    let im = new imageHandler('jpg', req)
    im.getFilename().should.eql(expected)

    done()
  })
})
