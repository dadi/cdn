const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

const cache = require(__dirname + '/../../dadi/lib/cache')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

let config = require(__dirname + '/../../config')
let cdnUrl = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let testConfigString

describe('Controller', function () {
  this.timeout(10000)
  let tokenRoute = config.get('auth.tokenUrl')

  before(done => {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    app.start(err => {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(done, 500)
    })
  })

  after(done => {
    app.stop(done)
  })

  afterEach(() => {
    help.clearCache()
  })

  describe('Options Discovery', function (done) {
    describe('Legacy URL syntax', () => {
      it('should extract options from url path if no querystring', function (done) {
        // spy on the sanitiseOptions method to access the provided arguments
        var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
          .expect(200)
          .end(function (err, res) {
            imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
            var options = method.returnValues[0]
            options.quality.should.eql(50)
            options.width.should.eql(801)
            options.height.should.eql(478)
            options.resizeStyle.should.eql('aspectfit')
            done()
          })
      })

      it('should extract options from url path if using legacyURLFormat', function (done) {
        // spy on the sanitiseOptions method to access the provided arguments
        var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/aspectfit/North/0/0/0/0/0/test.jpg')
          .expect(200)
          .end(function (err, res) {
            imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
            var options = method.returnValues[0]

            options.quality.should.eql(50)
            options.width.should.eql(801)
            options.height.should.eql(478)
            options.resizeStyle.should.eql('aspectfit')

            done()
          })
      })

      it('should extract options from url path if using legacyURLFormat with missing params', function (done) {
        // spy on the sanitiseOptions method to access the provided arguments
        var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/test.jpg')
          .expect(200)
          .end(function (err, res) {
            imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
            var options = method.returnValues[0]

            options.quality.should.eql(50)
            options.width.should.eql(801)
            options.height.should.eql(478)
            options.gravity.should.eql('North')

            done()
          })
      })
    })

    it('should extract options from querystring if one is present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request(cdnUrl)
      client
        .get('/test.jpg?quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.format.should.eql('jpg')
          done()
        })
    })

    it('should extract options from querystring using abbreviated params', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request(cdnUrl)
      client
        .get('/test.jpg?q=50&w=801&h=478&g=North&resize=aspectfit&dpr=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.devicePixelRatio.should.eql(2)
          options.format.should.eql('jpg')
          done()
        })
    })

    it('should extract options from querystring when it is encoded', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request(cdnUrl)
      client
        .get('/test.jpg?q=50&amp;w=801&amp;h=478&amp;g=North&amp;resize=aspectfit&amp;dpr=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.devicePixelRatio.should.eql(2)
          options.format.should.eql('jpg')
          done()
        })
    })

    it('should extract output format from querystring if present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request(cdnUrl)
      client
        .get('/test.jpg?format=png&quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]
          options.format.should.eql('png')
          done()
        })
    })

    it('should extract options from querystring if an external URL is provided', function (done) {
      let server = nock('https://cdn.somedomain.tech')
        .get('/images/mock/logo.png')
        .replyWithFile(200, 'test/images/visual/measure1.png', {
          'Content-Type': 'image/png'
        })

      // spy on the sanitiseOptions method to access the provided arguments
      let method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      let configStub = sinon.stub(config, 'get')
      configStub.withArgs('images.remote.enabled').returns(true)
      configStub.withArgs('images.remote.allowFullURL').returns(true)
      configStub.callThrough()

      let client = request(cdnUrl)
      client
        .get('/https://cdn.somedomain.tech/images/mock/logo.png?quality=50&width=80&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]

          options.quality.should.eql(50)
          options.width.should.eql(80)
          options.format.should.eql('png')

          server.isDone().should.eql(true)

          configStub.restore()

          done()
        })
    })

    it('should extract options from querystring if an external URL with URL params is provided', function (done) {
      let server = nock('https://cdn.somedomain.tech')
        .get('/images/mock/logo.png')
        .query({height: '100', width: '500'})
        .replyWithFile(200, 'test/images/visual/measure1.png', {
          'Content-Type': 'image/png'
        })

      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var configStub = sinon.stub(config, 'get')
      configStub.withArgs('images.remote.enabled').returns(true)
      configStub.withArgs('images.remote.allowFullURL').returns(true)
      configStub.callThrough()

      var client = request(cdnUrl)
      client
        .get('/https://cdn.somedomain.tech/images/mock/logo.png?height=100&width=500?quality=50&width=80&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.returnValues[0]

          options.quality.should.eql(50)
          options.width.should.eql(80)
          options.format.should.eql('png')

          server.isDone().should.eql(true)

          configStub.restore()

          done()
        })
    })
  })

  describe('Assets', function () {
    this.timeout(10000)

    it('should handle uncompressed CSS file if uri is valid', function (done) {
      var client = request(cdnUrl)
      client
      .get('/css/0/test.css')
      .expect(200, done)
    })

    it('should handle compressed CSS file if uri is valid', function (done) {
      var client = request(cdnUrl)
      client
      .get('/css/1/test.css')
      .expect(200, done)
    })

    it('should handle TTF file if uri is valid', function (done) {
      var client = request(cdnUrl)
      client
      .get('/fonts/test.ttf')
      .expect('Content-Type', 'font/ttf')
      .expect(200, done)
    })

    it('should handle TTF file in subfolder if uri is valid', function (done) {
      var client = request(cdnUrl)
      client
      .get('/fonts/next-level/test.ttf')
      .expect('Content-Type', 'font/ttf')
      .expect(200, done)
    })
  })

  describe('JavaScript', function () {
    this.timeout(10000)

    describe('legacy URL syntax', () => {
      it('should handle uncompressed JS file if uri is valid', function (done) {
        var client = request(cdnUrl)
        client
        .get('/js/0/test.js')
        .expect(200, done)
      })

      it('should handle compressed JS file if uri is valid', function (done) {
        var client = request(cdnUrl)
        client
        .get('/js/1/test.js')
        .expect(200, done)
      })
    })

    it('should return JS file', function (done) {
      var client = request(cdnUrl)
      client
        .get('/test.js')
        .expect(200, done)
    })
  })

  describe('Images', function () {
    describe('Legacy URL syntax', () => {
      it('should handle test image if image uri is valid', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(200)
            done()
          })
      })

      it('should handle deep nested test image', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/aspectfit/North/0/0/0/0/0/next-level/test.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(200)
            done()
          })
      })

      it('should handle test image with missing params', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/test.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(200)
            done()
          })
      })

      it('should handle deep nested test image with missing params', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0//0/North/0/0/0/0/0/next-level/test.jpg')
          .end(function (err, res) {
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

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test%20copy.jpg')
          .end(function (err, res) {
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

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/700/700/0/0/0/1/aspectfit/North/0/0/0/0/0/768px-Rotating_earth_%28huge%29.gif')
          .end(function (err, res) {
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

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/aspectfit/North/0/0/xxxtest.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(404)
            done()
          })
      })

      it('should return a placeholder image if image is not found', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'

        newTestConfig.notFound = {
          images: {
            enabled: true,
            path: './test/images/missing.png'
          }
        }

        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/testxxx.jpg')
          .end(function (err, res) {
            let isBuffer = (res.body instanceof Buffer)
            ;(isBuffer === true).should.eql(true)
            res.headers['content-type'].should.eql('image/jpeg')
            res.statusCode.should.eql(404)
            done()
          })
      })

      it('should return configured statusCode if image is not found', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'

        newTestConfig.notFound = {
          statusCode: 410,
          images: {
            enabled: true,
            path: './test/images/missing.png'
          }
        }

        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/testxxx.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(410)

            newTestConfig.notFound.statusCode = 404
            newTestConfig.notFound.images.enabled = false
            fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
            config.loadFile(config.configPath())

            done()
          })
      })

      it('should return image info when format = JSON', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/json/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(200)
            var info = res.body

            info.fileName.should.eql('test.jpg')
            info.format.should.eql('jpg')
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

        var client = request(cdnUrl)
        client
          .get('/jpg/50/0/0/801/478/0/0/0/1/aspectfit/North/0/0/0/0/0/test.jpg')
          .end(function (err, res) {
            res.statusCode.should.eql(200)

            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            setTimeout(function () {
              client
                .get('/jpg/50/0/0/801/478/0/0/0/1/aspectfit/North/0/0/0/0/0/test.jpg')
                .end(function (err, res) {
                  res.statusCode.should.eql(200)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')
                  done()
                })
            }, 1000)
          })
      })
    })

    it('should handle deep nested test image', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/next-level/test.jpg')
        .end(function (err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should handle image uri with uppercase extension', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/shane%20long%20new%20contract.JPG?quality=100')
        .end(function (err, res) {
          res.statusCode.should.eql(200)
          done()
        })
    })

    it('should extract entropy data from an image', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/test.jpg?quality=100&width=180&height=180&resizeStyle=entropy&format=json')
        .end(function (err, res) {
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

      var client = request(cdnUrl)
      client
        .get('/test.jpg?resize=crop&crop=0,0,3000,3000')
        .end(function (err, res) {
          res.statusCode.should.eql(400)
          res.body.message.should.exist

          done()
        })
    })

    describe('Remote images', () => {
      let configBackup = config.get('images')

      beforeEach(() => {
        config.set('images.directory.enabled', false)
        config.set('images.remote.enabled', true)
        config.set('images.s3.enabled', false)
      })

      afterEach(() => {
        config.set('images.directory.enabled', configBackup.directory.enabled)
        config.set('images.remote.enabled', configBackup.remote.enabled)
        config.set('images.remote.path', configBackup.remote.path)
        config.set('images.remote.allowFullURL', configBackup.remote.allowFullURL)
        config.set('images.s3.enabled', configBackup.s3.enabled)
      })

      it('should retrieve image from remote URL using `images.remote.path` as base URL', () => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('images.remote.path', 'https://one.somedomain.tech')

        return help.imagesEqual({
          base: 'test/images/visual/measure1.png',
          test: `${cdnUrl}/images/mock/logo.png`
        }).then(match => {
          match.should.eql(true)

          server.isDone().should.eql(true)
        })
      })

      it('should return 400 when requesting a relative remote URL and `image.remote.path` is not set', done => {
        config.set('images.remote.path', null)

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(400)
          .end((err, res) => {
            res.body.message.should.eql('Remote address not specified')

            done()
          })
      })

      it('should retrieve image from remote URL using a full URL', () => {
        let server = nock('https://two.somedomain.tech')
          .get('/images/mock/logo.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('images.remote.allowFullURL', true)
        config.set('images.remote.path', 'https://one.somedomain.tech')

        return help.imagesEqual({
          base: 'test/images/visual/measure1.png',
          test: `${cdnUrl}/https://two.somedomain.tech/images/mock/logo.png`
        }).then(match => {
          match.should.eql(true)

          server.isDone().should.eql(true)
        })
      })

      it('should return 403 when requesting a full remote URL and `image.remote.enabled` is false', done => {
        config.set('images.remote.enabled', false)
        config.set('images.remote.allowFullURL', true)

        let client = request(cdnUrl)
          .get('/https://two.somedomain.tech/images/mock/logo.png')
          .expect(403)
          .end((err, res) => {
            res.body.message.should.eql(
              'Loading images from a full remote URL is not supported by this instance of DADI CDN'
            )

            done()
          })
      })

// JIM
      it('should return 403 when requesting a full remote URL and `image.remote.allowFullURL` is false', done => {
        config.set('images.remote.allowFullURL', false)

        let client = request(cdnUrl)
          .get('/https://two.somedomain.tech/images/mock/logo.png')
          .expect(403)
          .end((err, res) => {
            res.body.message.should.eql(
              'Loading images from a full remote URL is not supported by this instance of DADI CDN'
            )

            done()
          })
      })

      it('should return "404 Not Found" when the remote image returns 404', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(404)

        config.set('images.remote.path', 'https://one.somedomain.tech')

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(404)
          .end((err, res) => {
            res.body.message.should.eql(
              'Not Found: https://one.somedomain.tech/images/mock/logo.png'
            )

            done()
          })
      })

      it('should return a placeholder image when the remote image returns 404', function (done) {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(404)

        config.set('images.remote.path', 'https://one.somedomain.tech')
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(404)
          .end((err, res) => {
            let isBuffer = (res.body instanceof Buffer)
            ;(isBuffer === true).should.eql(true)
            res.headers['content-type'].should.eql('image/png')
            res.statusCode.should.eql(404)

            done()
          })
      })

      it('should return configured statusCode if image is not found', function (done) {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(404)

        config.set('images.remote.path', 'https://one.somedomain.tech')
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')
        config.set('notFound.statusCode', 410)

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(410)
          .end((err, res) => {
            let isBuffer = (res.body instanceof Buffer)
            ;(isBuffer === true).should.eql(true)
            res.headers['content-type'].should.eql('image/png')
            res.statusCode.should.eql(410)

            config.set('notFound.images.enabled', false)
            config.set('notFound.statusCode', 410)

            done()
          })
      })

      it('should return "403 Forbidden" when the remote image returns 403', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(403)

        config.set('images.remote.path', 'https://one.somedomain.tech')

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(403)
          .end((err, res) => {
            res.body.message.should.eql(
              'Forbidden: https://one.somedomain.tech/images/mock/logo.png'
            )

            done()
          })
      })

      it('should return whatever error code the remote server sends back, along with a generic error message', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(418)

        config.set('images.remote.path', 'https://one.somedomain.tech')

        let client = request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(418)
          .end((err, res) => {
            res.body.message.should.eql(
              'Remote server responded with error code 418 for URL: https://one.somedomain.tech/images/mock/logo.png'
            )

            done()
          })
      })
    })
  })

  describe('Other', function () {
    it('should respond to the root', function (done) {
      var client = request(cdnUrl)
      client
        .get('/')
        .end(function (err, res) {
          res.statusCode.should.eql(200)
          res.text.should.eql('Welcome to DADI CDN')
          done()
        })
    })

    it('should return 404 if there is no configured robots.txt file', function (done) {
      var client = request(cdnUrl)
      client
        .get('/robots.txt')
        .end(function (err, res) {
          res.statusCode.should.eql(404)
          res.text.should.eql('File not found')
          done()
        })
    })

    it('should return a configured robots.txt file', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.robots = 'test/robots.txt'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/robots.txt')
        .end(function (err, res) {
          res.statusCode.should.eql(200)
          res.text.should.eql('User-Agent: *\nDisallow: /')
          done()
        })
    })

    it('should return a 204 for favicons', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
      .get('/favicon.ico')
      .end(function (err, res) {
        res.statusCode.should.eql(204)
        done()
      })
    })

    it('should handle requests for unknown formats', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
      .get('/something-else.zip')
      .end(function (err, res) {
        res.statusCode.should.eql(404)
        done()
      })
    })
  })
})
