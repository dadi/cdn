var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

var testConfigString

describe('Controller', function () {
  this.timeout(6000)
  var tokenRoute = config.get('auth.tokenUrl')

  // beforeEach(function (done) {
  //   delete require.cache[__dirname + '/../../config']
  //   config = require(__dirname + '/../../config')
  //
  //   testConfigString = fs.readFileSync(config.configPath())
  //
  //   app.start(function (err) {
  //     if (err) return done(err)
  //
  //     // give it a moment for http.Server to finish starting
  //     setTimeout(function () {
  //       done()
  //     }, 500)
  //   })
  // })

  before(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  after(function (done) {
    //help.clearCache()
    app.stop(done)
  })

  describe('Options Discovery', function (done) {
    it('v1: should extract options from url path if no querystring', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
        .expect(200)
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
          var options = method.firstCall.args[0]
          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.resizeStyle.should.eql('aspectfit')
          done()
        })
    })

    it('v1: should extract options from url path if using legacyURLFormat', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/aspectfit/North/0/0/0/0/0/test.jpg')
        .expect(200)
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
          var options = method.firstCall.args[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.resizeStyle.should.eql('aspectfit')

          done()
        })
    })

    it('v1: should extract options from url path if using legacyURLFormat with missing params', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/test.jpg')
        .expect(200)
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
          var options = method.firstCall.args[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.gravity.should.eql('North')

          done()
        })
    })

    it('v2: should extract options from querystring if one is present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.firstCall.args[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.format.should.eql('jpg')
          done()
        })
    })

    it.skip('v2: should extract options from querystring using abbreviated params', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?q=50&w=801&h=478&g=North&rs=aspectfit&dpr=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.firstCall.args[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.devicePixelRatio.should.eql(2)
          options.format.should.eql('jpg')
          done()
        })
    })

    it('v2: should extract output format from querystring if present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?format=png&quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.firstCall.args[0]
          options.format.should.eql('png')
          done()
        })
    })
  })

  describe('Assets', function () {
    this.timeout(10000)

    // beforeEach(function (done) {
    //   var newTestConfig = JSON.parse(testConfigString)
    //   newTestConfig.assets.directory.enabled = true
    //   newTestConfig.assets.directory.path = './test/assets'
    //   fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
    //
    //   config.loadFile(config.configPath())
    //
    //   done()
    // })

    it('should return error if compress parameter is not 0 or 1', function (done) {
      // var newTestConfig = JSON.parse(testConfigString)
      // newTestConfig.assets.directory.enabled = true
      // newTestConfig.assets.directory.path = './test/assets'
      // fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
      //
      // config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/js/2/test.js')
        .expect(400, done)
    })

    it('should return error if font file type is not TTF, OTF, WOFF, SVG or EOT', function (done) {
      // var newTestConfig = JSON.parse(testConfigString)
      // newTestConfig.assets.directory.enabled = true
      // newTestConfig.assets.directory.path = './test/assets'
      // fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
      //
      // config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/fonts/test.bad')
        .expect(400, done)
    })

    it('should handle uncompressed JS file if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/js/0/test.js')
      .expect(200, done)
    })

    it('should handle uncompressed CSS file if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/css/0/test.css')
      .expect(200, done)
    })

    it('should handle compressed JS file if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/js/1/test.js')
      .expect(200, done)
    })

    it('should handle compressed CSS file if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/css/1/test.css')
      .expect(200, done)
    })

    it('should handle TTF file if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/fonts/test.ttf')
      .expect('Content-Type', 'application/font-sfnt')
      .expect(200, done)
    })

    it('should handle TTF file in subfolder if uri is valid', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/fonts/next-level/test.ttf')
      .expect('Content-Type', 'application/font-sfnt')
      .expect(200, done)
    })
  })

  describe('Images', function () {
    it('should handle test image if image uri is valid', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle test image if image uri using legacyURLFormat', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/aspectfit/North/0/0/0/0/0/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle deep nested test image if image uri using legacyURLFormat', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/aspectfit/North/0/0/0/0/0/next-level/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle test image if image uri using legacyURLFormat with missing params', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle deep nested test image if image uri using legacyURLFormat with missing params', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/next-level/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle image uri with spaces', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test%20copy.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle image uri with special characters', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/768px-Rotating_earth_%28huge%29.gif')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should return error if image uri is invalid', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/aspectfit/North/0/0/xxxtest.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(404)
          done()
        })
    })

    it('should return image info when format = JSON', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/json/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          var info = res.body

          info.fileName.should.eql('test.jpg')
          info.format.should.eql('jpeg')
          done()
        })
    })

    it('should extract entropy data from an image', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?quality=100&width=180&height=180&resizeStyle=entropy&format=json')
        .end(function(err, res) {

          res.statusCode.should.eql(200)

          res.body.entropyCrop.should.have.property('x1').and.be.type('number')
          res.body.entropyCrop.should.have.property('x2').and.be.type('number')
          res.body.entropyCrop.should.have.property('y1').and.be.type('number')
          res.body.entropyCrop.should.have.property('y2').and.be.type('number')

          done()
        })
    })

    it('should return 400 when requested crop dimensions are larger than the original image', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?width=2000&cropX=20&cropY=20')
        .end(function(err, res) {
          res.statusCode.should.eql(400)
          res.body.message.should.exist

          done()
        })
    })

    it('should get image from cache if cache is enabled and cached item exists', function (done) {
      this.timeout(4000)

      help.clearCache()

      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = true
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      cache.reset()

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
        .end(function(err, res) {
          res.statusCode.should.eql(200)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(function () {
            client
              .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
              .end(function(err, res) {
                res.statusCode.should.eql(200)

                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('HIT')
                done()
              })
          }, 1000)
        })
    })
  })

  describe('Other', function () {
    it('should respond to the root', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/')
        .end(function(err, res) {
          res.statusCode.should.eql(200)
          res.text.should.eql('Welcome to DADI CDN')
          done()
        })
    })

    it('should handle requests for unknown formats', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
      .get('/favicon.ico')
      .end(function (err, res) {
        res.statusCode.should.eql(404)
        done()
      })
    })
  })
})
