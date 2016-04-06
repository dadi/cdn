var fs = require('fs');
var path = require('path');
var should = require('should');
var sinon = require('sinon');
var Promise = require('bluebird');
var stream = require('stream');
var imageHandle = require(__dirname + '/../../dadi/lib/imagehandle');
var factory = require(__dirname + '/../../dadi/lib/storage/factory');
var DiskStorage = require(__dirname + '/../../dadi/lib/storage/disk');
var HTTPStorage = require(__dirname + '/../../dadi/lib/storage/http');
var S3Storage = require(__dirname + '/../../dadi/lib/storage/s3');

var config;
var stub;
var testConfigString;

describe('ImageHandler', function (done) {

  beforeEach(function(done) {

    delete require.cache[__dirname + '/../../config'];
    config = require(__dirname + '/../../config');

    testConfigString = fs.readFileSync(config.configPath());
    testConfigString = testConfigString.toString()

    // stub the convert method to access the provided arguments
    stub = sinon.stub(imageHandle.ImageHandle.prototype, 'convertAndSave', function (readStream, imageInfo, originFileName, fileName, options, returnJSON, res) {
      readStream.resume();
    })

    done()
  })

  afterEach(function(done) {
    setTimeout(function() {
      imageHandle.ImageHandle.prototype.convertAndSave.restore()
      fs.writeFileSync(config.configPath(), testConfigString);
      done()
    }, 1000)
  })

  it('should use Disk Storage storage adapter when nothing else is configured', function(done) {
    var imageHandler = imageHandle(null, null);
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = false;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    //console.log(newTestConfig)
    config.loadFile(config.configPath());

    var spy = sinon.spy(factory, 'create');

    var req = {
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    req.headers.accept = 'application/vnd.dadicdn-v1+json'

    // set some expected values
    var expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    var get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get', function() { return new Promise(function(resolve, reject) {
        var readable = new stream.Readable();
        readable.push('');
        readable.push(null);
        resolve(readable);
      })
    })

    // this is the test
    imageHandler.createNewConvertImage (req, 'originFileName', 'newFileName', {}, false, {});

    factory.create.restore()
    DiskStorage.DiskStorage.prototype.get.restore()

    spy.called.should.eql(true)
    get.called.should.eql(true)

    var returnValue = spy.firstCall.returnValue;
    returnValue.getFullUrl().should.eql(expected)

    done()
  })

  it('should use Disk Storage storage adapter when configured', function(done) {
    var imageHandler = imageHandle(null, null);
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    //console.log(newTestConfig)
    config.loadFile(config.configPath());

    var spy = sinon.spy(factory, 'create');

    var req = {
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    req.headers.accept = 'application/vnd.dadicdn-v1+json'

    // set some expected values
    var expected = path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')

    // stub the get method so it doesn't do anything
    var get = sinon.stub(DiskStorage.DiskStorage.prototype, 'get', function() { return new Promise(function(resolve, reject) {
        var readable = new stream.Readable();
        readable.push('');
        readable.push(null);
        resolve(readable);
      })
    })

    // this is the test
    imageHandler.createNewConvertImage (req, 'originFileName', 'newFileName', {}, false, {});

    factory.create.restore()
    DiskStorage.DiskStorage.prototype.get.restore()

    spy.called.should.eql(true)
    get.called.should.eql(true)

    var returnValue = spy.firstCall.returnValue;
    returnValue.getFullUrl().should.eql(expected)

    done()
  })

  it('should use HTTP Storage storage adapter when configured', function(done) {
    var imageHandler = imageHandle(null, null);
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = false;
    newTestConfig.images.remote.enabled = true;
    newTestConfig.images.remote.path = 'https://nodejs.org';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    //console.log(newTestConfig)
    config.loadFile(config.configPath());

    var spy = sinon.spy(factory, 'create');

    var req = {
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/static/images/logos/nodejs-new-white-pantone.png'
    }

    req.headers.accept = 'application/vnd.dadicdn-v1+json'

    // set some expected values
    var expected = 'https://nodejs.org/static/images/logos/nodejs-new-white-pantone.png'

    // stub the get method so it doesn't do anything
    var get = sinon.stub(HTTPStorage.HTTPStorage.prototype, 'get', function() { return new Promise(function(resolve, reject) {
        var readable = new stream.Readable();
        readable.push('');
        readable.push(null);
        resolve(readable);
      })
    })

    // this is the test
    imageHandler.createNewConvertImage (req, 'originFileName', 'newFileName', {}, false, {});

    factory.create.restore()
    HTTPStorage.HTTPStorage.prototype.get.restore()

    spy.called.should.eql(true)
    get.called.should.eql(true)

    var returnValue = spy.firstCall.returnValue;
    returnValue.getFullUrl().should.eql(expected)

    done()
  })

  it('should use S3 Storage storage adapter when configured', function(done) {
    var imageHandler = imageHandle(null, null);
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = false;
    newTestConfig.images.remote.enabled = false;
    newTestConfig.images.s3.enabled = true;
    //newTestConfig.images.remote.path = 'https://nodejs.org';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    //console.log(newTestConfig)
    config.loadFile(config.configPath());

    var spy = sinon.spy(factory, 'create');

    var req = {
      headers: {},
      url: '/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'
    }

    req.headers.accept = 'application/vnd.dadicdn-v1+json'

    // set some expected values
    var expected = ['test.jpg']

    // stub the get method so it doesn't do anything
    var get = sinon.stub(S3Storage.S3Storage.prototype, 'get', function() { return new Promise(function(resolve, reject) {
        var readable = new stream.Readable();
        readable.push('');
        readable.push(null);
        resolve(readable);
      })
    })

    // this is the test
    imageHandler.createNewConvertImage (req, 'originFileName', 'newFileName', {}, false, {});

    factory.create.restore()
    S3Storage.S3Storage.prototype.get.restore()

    spy.called.should.eql(true)
    get.called.should.eql(true)

    var returnValue = spy.firstCall.returnValue;
    returnValue.urlParts().should.eql(expected)

    done()
  })
});
