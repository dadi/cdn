const AWS = require('aws-sdk-mock')
const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

const cache = require(path.join(__dirname, '/../../dadi/lib/cache'))
const help = require(path.join(__dirname, '/help'))
const app = require(path.join(__dirname, '/../../dadi/lib/'))
const imageHandler = require(path.join(__dirname, '/../../dadi/lib/handlers/image'))

let config = require(path.join(__dirname, '/../../config'))
let configBackup = config.get()
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

  describe('cache control header', () => {
    it('should set the cache-control header according to the mimetype configuration in headers.cacheControl', done => {
      let cacheControl = {
        'default': 'public, max-age=3600',
        'paths': [],
        'mimetypes': [
          {'text/css': 'public, max-age=86400'},
          {'text/javascript': 'public, max-age=86400'},
          {'application/javascript': 'public, max-age=86400'}
        ]
      }

      config.set('headers.cacheControl', cacheControl)

      request(cdnUrl)
        .get('/test.jpg')
        .expect(200)
        .end((err, res) => {
          res.headers['cache-control'].should.eql(cacheControl.default)

          request(cdnUrl)
            .get('/test.css')
            .expect(200, (err, res) => {
              res.headers['cache-control'].should.eql(cacheControl.mimetypes[0]['text/css'])

              config.set('headers.cacheControl', configBackup.headers.cacheControl)

              done()
            })
        })
    })

    it('should respect the value of headers.cacheControl defined at domain level', done => {
      let cacheControl1 = {
        'default': 'public, max-age=3600',
        'paths': [],
        'mimetypes': [
          {'text/css': 'public, max-age=86400'}
        ]
      }
      let cacheControl2 = {
        'default': 'public, max-age=3600',
        'paths': [],
        'mimetypes': [
          {'text/css': 'public, max-age=172800'}
        ]
      }

      config.set('multiDomain.enabled', true)
      config.loadDomainConfigs()

      config.set('headers.cacheControl', cacheControl1, 'localhost')
      config.set('headers.cacheControl', cacheControl2, 'testdomain.com')

      request(cdnUrl)
        .get('/test.css')
        .set('Host', 'localhost:80')
        .expect(200, (err, res) => {
          res.headers['cache-control'].should.eql(cacheControl1.mimetypes[0]['text/css'])

          request(cdnUrl)
            .get('/test.css')
            .set('Host', 'testdomain.com:80')
            .expect(200, (err, res) => {
              res.headers['cache-control'].should.eql(cacheControl2.mimetypes[0]['text/css'])

              config.set('headers.cacheControl', configBackup.headers.cacheControl)
              config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

              done()
            })
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

    describe('gzip encoding', () => {
      it('should return gzipped content when headers.useGzipCompression is true', done => {
        config.set('headers.useGzipCompression', false)

        request(cdnUrl)
          .get('/css/0/test.css')
          .end((err, res) => {
            res.statusCode.should.eql(200)
            should.not.exist(res.headers['content-encoding'])

            config.set('headers.useGzipCompression', true)

            request(cdnUrl)
              .get('/css/0/test.css')
              .set('Accept-Encoding', 'gzip, deflate')
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.headers['content-encoding'].should.eql('gzip')

                config.set('headers.useGzipCompression', configBackup.headers.useGzipCompression)

                done()
              })
          })
      })

      it('should use the value of headers.useGzipCompression defined at domain level', done => {
        config.set('multiDomain.enabled', true)
        config.loadDomainConfigs()

        config.set('headers.useGzipCompression', true)
        config.set('headers.useGzipCompression', false, 'localhost')
        config.set('headers.useGzipCompression', true, 'testdomain.com')

        request(cdnUrl)
          .get('/css/0/test.css?cache=false')
          .set('Host', 'localhost')
          .end((err, res) => {
            res.statusCode.should.eql(200)
            should.not.exist(res.headers['content-encoding'])

            config.set('headers.useGzipCompression', true)

            request(cdnUrl)
              .get('/css/0/test.css?cache=false')
              .set('Host', 'testdomain.com')
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.headers['content-encoding'].should.eql('gzip')

                config.set('headers.useGzipCompression', configBackup.headers.useGzipCompression)
                config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

                done()
              })
          })
      })
    })
  })

  describe('HTML passthrough', function () {
    let server
    let remoteUrl = 'http://localhost:8888'

    before(() => {
      config.set('images.directory.enabled', false)
      config.set('images.remote.enabled', true)
      config.set('images.remote.path', remoteUrl)
      config.set('images.s3.enabled', false)

      config.set('assets.directory.enabled', false)
      config.set('assets.s3.enabled', false)

      config.set('assets.remote.enabled', true)
      config.set('assets.remote.path', remoteUrl)

      config.set('caching.directory.enabled', true)

      server = require('http').createServer((req, res) => {
        switch (req.url) {
          case '/':
            fs.readFile(path.join(__dirname, '../assets/test.html'), 'utf8', (_err, data) => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/html')
              res.end(data)
            })

            break

          case '/test.jpg':
            fs.readFile(path.join(__dirname, '../images/test.jpg'), null, (_err, data) => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'image/jpeg')
              res.end(data)
            })

            break

          default:
            res.statusCode = 404
            res.end('Page not found.')

            break
        }
      })

      server.listen(8888)
    })

    after(done => {
      config.set('images.directory.enabled', configBackup.images.directory.enabled)
      config.set('images.remote.enabled', configBackup.images.remote.enabled)
      config.set('images.remote.path', configBackup.images.remote.path)
      config.set('images.remote.allowFullURL', configBackup.images.remote.allowFullURL)
      config.set('images.s3.enabled', configBackup.images.s3.enabled)

      config.set('assets.directory.enabled', configBackup.assets.directory.enabled)
      config.set('assets.remote.enabled', configBackup.assets.remote.enabled)
      config.set('assets.remote.path', configBackup.assets.remote.path)
      config.set('assets.remote.allowFullURL', configBackup.assets.remote.allowFullURL)
      config.set('assets.s3.enabled', configBackup.assets.s3.enabled)

      config.set('caching.directory.enabled', configBackup.caching.directory.enabled)

      server = null
      done()
    })

    it('should pass an html request through from the configured remote origin', function (done) {
      let client = request(cdnUrl)

      client
      .get('/')
      .expect(200)
      .end((_err, res) => {
        res.headers['content-type'].should.exist
        res.headers['content-type'].should.eql('text/html')

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('MISS')

        done()
      })
    })

    it('should cache and return an html request from the configured remote origin', function (done) {
      let client = request(cdnUrl)

      client
      .get('/')
      .expect(200)
      .end((_err, res) => {
        res.headers['content-type'].should.exist
        res.headers['content-type'].should.eql('text/html')

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('MISS')

        client
        .get('/')
        .expect(200)
        .end((_err, res) => {
          res.headers['content-type'].should.exist
          res.headers['content-type'].should.eql('text/html')

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          done()
        })
      })
    })

    it('should pass an image request through from the configured remote origin', function (done) {
      let client = request(cdnUrl)

      client
      .get('/test.jpg')
      .expect(200)
      .end((_err, res) => {
        res.body.should.be.an.instanceOf(Buffer)

        res.headers['content-type'].should.exist
        res.headers['content-type'].should.eql('image/jpeg')

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('MISS')

        done()
      })
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

    describe('transpiling', () => {
      let originalJs = fs.readFileSync(
        path.join(__dirname, '/../assets/test-es6.js'),
        'utf8'
      )
      let transpiledJs = '"use strict";\n\nvar makeFoo = function makeFoo(bar) {\n  return "I foo, you " + bar;\n};'

      it('should deliver original JS file if experimental.jsTranspiling is disabled', done => {
        config.set('experimental.jsTranspiling', false)

        request(cdnUrl)
          .get('/test-es6.js?transform=1')
          .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
          .expect(200, (err, res) => {
            res.text.should.eql(originalJs)

            config.set('experimental.jsTranspiling', configBackup.experimental.jsTranspiling)

            done()
          })
      })

      it('should deliver transpiled JS file if experimental.jsTranspiling is enabled', done => {
        config.set('experimental.jsTranspiling', true)

        request(cdnUrl)
          .get('/test-es6.js?transform=1')
          .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
          .expect(200, (err, res) => {
            res.text.should.eql(transpiledJs)
            config.set('experimental.jsTranspiling', configBackup.experimental.jsTranspiling)

            done()
          })
      })

      describe('when multi-domain is enabled', () => {
        before(() => {
          config.set('multiDomain.enabled', true)
          config.loadDomainConfigs()
        })

        after(() => {
          config.set('multiDomain.enabled', configBackup.multiDomain.enabled)
        })

        it('should deliver original JS file if experimental.jsTranspiling is disabled at domain level', done => {
          config.set('experimental.jsTranspiling', true)
          config.set('experimental.jsTranspiling', false, 'localhost')
          config.set('experimental.jsTranspiling', true, 'testdomain.com')

          request(cdnUrl)
            .get('/test-es6.js?transform=1')
            .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
            .set('Host', 'localhost:80')
            .expect(200, (err, res) => {
              res.text.should.eql(originalJs)

              request(cdnUrl)
                .get('/test-es6.js?transform=1')
                .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
                .set('Host', 'testdomain.com:80')
                .expect(200, (err, res) => {
                  res.text.should.eql(transpiledJs)

                  config.set('experimental.jsTranspiling', configBackup.experimental.jsTranspiling)

                  done()
                })
            })
        })

        it('should deliver transpiled JS file if experimental.jsTranspiling is enabled at domain level', done => {
          config.set('experimental.jsTranspiling', false)
          config.set('experimental.jsTranspiling', false, 'localhost')
          config.set('experimental.jsTranspiling', true, 'testdomain.com')

          request(cdnUrl)
            .get('/test-es6.js?transform=1')
            .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
            .set('Host', 'localhost:80')
            .expect(200, (err, res) => {
              res.text.should.eql(originalJs)

              request(cdnUrl)
                .get('/test-es6.js?transform=1')
                .set('User-Agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
                .set('Host', 'testdomain.com:80')
                .expect(200, (err, res) => {
                  res.text.should.eql(transpiledJs)

                  config.set('experimental.jsTranspiling', configBackup.experimental.jsTranspiling)

                  done()
                })
            })
        })
      })
    })
  })

  describe('Video', function () {
    it('should respond with 206 Partial Content if uri is valid', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/video.mp4')
        .set('Range', 'bytes=0-')
        .end((err, res) => {
          res.statusCode.should.eql(206)
          done()
        })
    })

    it('should respond with 416 if range header is invalid', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/video.mp4')
        .set('Range', 'bytes=a')
        .end((err, res) => {
          res.statusCode.should.eql(416)
          done()
        })
    })

    it('should respond with 400 if range header is malformed', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request(cdnUrl)
      client
        .get('/video.mp4')
        .set('Range', 'bytes')
        .end((err, res) => {
          res.statusCode.should.eql(400)
          done()
        })
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
            res.body.should.be.instanceof(Buffer)
            res.headers['content-type'].should.eql('image/png')
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
          .get('/test.jpg?format=json')
          .end(function (err, res) {
            res.statusCode.should.eql(200)
            var info = res.body

            info.fileName.should.eql('test.jpg')
            info.format.should.eql('jpg')
            done()
          })
      })

      it('should include EXIF data when format = JSON', function (done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.images.directory.enabled = true
        newTestConfig.images.directory.path = './test/images'
        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        config.loadFile(config.configPath())

        var client = request(cdnUrl)
        client
          .get('/dm.jpg?format=json')
          .end(function (err, res) {
            res.statusCode.should.eql(200)

            res.body.density.should.be.Object
            res.body.density.width.should.be.Number
            res.body.density.height.should.be.Number
            res.body.density.unit.should.be.String
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
        .end((err, res) => {
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
        .end((err, res) => {
          res.statusCode.should.eql(200)

          res.body.entropyCrop.should.have.property('x1').and.be.type('number')
          res.body.entropyCrop.should.have.property('x2').and.be.type('number')
          res.body.entropyCrop.should.have.property('y1').and.be.type('number')
          res.body.entropyCrop.should.have.property('y2').and.be.type('number')

          done()
        })
    })

    it('should return pre and post image details', function (done) {
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

          let fileSizePre = res.body.fileSizePre
          res.body.fileSizePost.should.be.below(fileSizePre)

          let primaryColorPre = res.body.primaryColorPre
          res.body.primaryColorPost.should.not.eql(primaryColorPre)

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

    describe('comma-separated conditional formats', () => {
      it('should return an image as WebP if format is `webp,jpg` and the requesting browser indicates support for WebP', done => {
        request(cdnUrl)
        .get('/test.jpg?format=webp,jpg')
        .set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8')
        .end((err, res) => {
          res.statusCode.should.eql(200)
          res.headers['content-type'].should.eql('image/webp')

          done()
        })
      })

      it('should return an image as JPEG if format is `webp,jpg` and the requesting browser does not indicate support for WebP', done => {
        request(cdnUrl)
        .get('/test.jpg?format=webp,jpg')
        .set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
        .end((err, res) => {
          res.statusCode.should.eql(200)
          res.headers['content-type'].should.eql('image/jpeg')

          done()
        })
      })
    })

    describe('placeholder image is disabled', () => {
      it('should return "404 Not Found" when the remote image returns 404', done => {
        config.set('notFound.images.enabled', false)

        let client = request(cdnUrl)
          .get('/images/not-found.jpg')
          .expect(404)
          .end((err, res) => {
            res.body.message.includes('File not found:').should.eql(true)

            done()
          })
      })
    })

    describe('default files', () => {
      it('should return a configured default file if no path is specified', function (done) {
        config.set('defaultFiles', ['test.css'])

        request(cdnUrl)
        .get('/')
        .expect(200)
        .end((err, res) => {
          res.headers['content-type'].should.eql('text/css')

          config.set('defaultFiles', [])
          done()
        })
      })

      it('should return 404 if no default file is found', function (done) {
        config.set('defaultFiles', ['index.html'])

        request(cdnUrl)
        .get('/')
        .expect(404)
        .end((err, res) => {
          config.set('defaultFiles', [])
          done()
        })
      })
    })

    describe('placeholder image is enabled', () => {
      it('should return a placeholder image when the remote image returns 404', () => {
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')

        return help.imagesEqual({
          base: 'test/images/missing.png',
          test: `${cdnUrl}/not-found.jpg`
        }).then(match => {
          match.should.eql(true)
        })
      })

      it('should return configured statusCode if image is not found', function (done) {
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')
        config.set('notFound.statusCode', 410)

        let client = request(cdnUrl)
          .get('/not-found.jpg')
          .expect(410)
          .end((err, res) => {
            res.body.should.be.instanceof(Buffer)
            res.headers['content-type'].should.eql('image/png')
            res.statusCode.should.eql(410)

            config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
            config.set('notFound.statusCode', configBackup.notFound.statusCode)

            done()
          })
      })

      it('should return a json response when a directory is requested', function (done) {
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')
        config.set('notFound.statusCode', 410)

        let client = request(cdnUrl)
          .get('/path/to/missing/')
          .expect(410)
          .end((err, res) => {
            res.body.message.includes('File not found:').should.eql(true)
            res.statusCode.should.eql(404)

            config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
            config.set('notFound.statusCode', configBackup.notFound.statusCode)

            done()
          })
      })

      describe('when multi-domain is enabled', () => {
        let fallbackImages = {
          localhost: 'test/images/original.jpg',
          'testdomain.com': 'test/images/dog-w600.jpeg'
        }

        before(() => {
          config.set('multiDomain.enabled', true)
          config.loadDomainConfigs()

          config.set('notFound.images.enabled', false)

          config.set('notFound.statusCode', 418, 'localhost')
          config.set('notFound.images.enabled', true, 'localhost')
          config.set('notFound.images.path', fallbackImages.localhost, 'localhost')

          config.set('notFound.statusCode', 451, 'testdomain.com')
          config.set('notFound.images.enabled', true, 'testdomain.com')
          config.set('notFound.images.path', fallbackImages['testdomain.com'], 'testdomain.com')

          return help.proxyStart()
        })

        after(() => {
          config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

          return help.proxyStop()
        })

        it('returns the fallback image and status code defined by each domain if the image is not found', done => {
          help.imagesEqual({
            base: fallbackImages.localhost,
            test: `${help.proxyUrl}/not-found.jpg?mockdomain=localhost`
          }).then(match => {
            match.should.eql(true)

            request(help.proxyUrl)
              .get('/not-found.jpg?mockdomain=testdomain.com')
              .expect(418)
              .end((err, res) => {
                help.imagesEqual({
                  base: fallbackImages['testdomain.com'],
                  test: `${help.proxyUrl}/not-found.jpg?mockdomain=testdomain.com`
                }).then(match => {
                  match.should.eql(true)

                  request(help.proxyUrl)
                    .get('/not-found.jpg?mockdomain=testdomain.com')
                    .expect(451)
                    .end(done)
                })
              })
          })
        })

        it('returns an error message if the fallback image is disabled for the domain', done => {
          config.set('notFound.images.enabled', false, 'testdomain.com')

          help.imagesEqual({
            base: fallbackImages.localhost,
            test: `${help.proxyUrl}/not-found.jpg?mockdomain=localhost`
          }).then(match => {
            match.should.eql(true)

            request(help.proxyUrl)
              .get('/not-found.jpg?mockdomain=testdomain.com')
              .expect(418)
              .end((err, res) => {
                request(help.proxyUrl)
                  .get('/not-found.jpg?mockdomain=testdomain.com')
                  .expect(451)
                  .end((err, res) => {
                    res.body.message.includes('File not found:').should.eql(true)

                    done()
                  })
              })
          })
        })
      })
    })

    describe('Remote images', () => {
      beforeEach(() => {
        config.set('images.directory.enabled', false)
        config.set('images.remote.enabled', true)
        config.set('images.s3.enabled', false)
      })

      afterEach(() => {
        config.set('images.directory.enabled', configBackup.images.directory.enabled)
        config.set('images.remote.enabled', configBackup.images.remote.enabled)
        config.set('images.remote.path', configBackup.images.remote.path)
        config.set('images.remote.allowFullURL', configBackup.images.remote.allowFullURL)
        config.set('images.s3.enabled', configBackup.images.s3.enabled)
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

      it('should retrieve image from remote URL and follow redirects', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(301, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo2.png'
          })
          .get('/images/mock/logo2.png')
          .reply(302, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo3.png'
          })
          .get('/images/mock/logo3.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('images.remote.path', 'https://one.somedomain.tech')

        request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(200)
          .end((err, res) => {
            res.headers['content-type'].should.eql('image/png')

            server.isDone().should.eql(true)

            done()
          })
      })

      it('should retrieve image from remote URL and follow redirects with relative paths', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(301, undefined, {
            Location: '/images/mock/logo2.png'
          })
          .get('/images/mock/logo2.png')
          .reply(302, undefined, {
            Location: '/images/mock/logo3.png'
          })
          .get('/images/mock/logo3.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('images.remote.path', 'https://one.somedomain.tech')

        request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(200)
          .end((err, res) => {
            res.headers['content-type'].should.eql('image/png')

            server.isDone().should.eql(true)

            done()
          })
      })

      it('should return a 404 when retrieving a remote asset that includes more redirects than the ones allowed in `http.followRedirects`', done => {
        let server = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(301, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo2.png'
          })
          .get('/images/mock/logo2.png')
          .reply(302, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo3.png'
          })
          .get('/images/mock/logo3.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('images.remote.path', 'https://one.somedomain.tech')
        config.set('http.followRedirects', 1)

        request(cdnUrl)
          .get('/images/mock/logo.png')
          .expect(404)
          .end((err, res) => {
            server.pendingMocks().length.should.eql(1)

            config.set('http.followRedirects', configBackup.http.followRedirects)

            done()
          })
      })

      it('should return a 404 when retrieving a remote asset that includes more redirects than the ones allowed in `http.followRedirects` at domain level', done => {
        let server1 = nock('https://one.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(301, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo2.png'
          })
          .get('/images/mock/logo2.png')
          .reply(302, undefined, {
            Location: 'https://one.somedomain.tech/images/mock/logo3.png'
          })
          .get('/images/mock/logo3.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        let server2 = nock('https://two.somedomain.tech')
          .get('/images/mock/logo.png')
          .reply(301, undefined, {
            Location: 'https://two.somedomain.tech/images/mock/logo2.png'
          })
          .get('/images/mock/logo2.png')
          .reply(302, undefined, {
            Location: 'https://two.somedomain.tech/images/mock/logo3.png'
          })
          .get('/images/mock/logo3.png')
          .replyWithFile(200, 'test/images/visual/measure1.png', {
            'Content-Type': 'image/png'
          })

        config.set('multiDomain.enabled', true)
        config.loadDomainConfigs()

        config.set('images.directory.enabled', false, 'localhost')
        config.set('images.remote.enabled', true, 'localhost')
        config.set('images.remote.path', 'https://one.somedomain.tech', 'localhost')
        config.set('http.followRedirects', 1, 'localhost')

        config.set('images.directory.enabled', false, 'testdomain.com')
        config.set('images.remote.enabled', true, 'testdomain.com')
        config.set('images.remote.path', 'https://two.somedomain.tech', 'testdomain.com')
        config.set('http.followRedirects', 10, 'testdomain.com')

        request(cdnUrl)
          .get('/images/mock/logo.png')
          .set('Host', 'localhost:80')
          .expect(404)
          .end((err, res) => {
            res.body.statusCode.should.eql(404)

            server1.pendingMocks().length.should.eql(1)

            request(cdnUrl)
              .get('/images/mock/logo.png')
              .set('Host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                res.headers['content-type'].should.eql('image/png')

                server2.isDone().should.eql(true)

                config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

                done()
              })
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

      describe('placeholder image is disabled', () => {
        it('should return "404 Not Found" when the remote image returns 404', done => {
          let server = nock('https://one.somedomain.tech')
            .get('/images/mock/logo.png')
            .reply(404)

          config.set('images.remote.path', 'https://one.somedomain.tech')
          config.set('notFound.images.enabled', false)

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
      })

      describe('placeholder image is enabled', () => {
        it('should return a placeholder image when the remote image returns 404', () => {
          let server = nock('https://one.somedomain.tech')
            .get('/images/mock/logo.png')
            .reply(404)

          config.set('images.remote.path', 'https://one.somedomain.tech')
          config.set('notFound.images.enabled', true)
          config.set('notFound.images.path', './test/images/missing.png')

          return help.imagesEqual({
            base: 'test/images/missing.png',
            test: `${cdnUrl}/images/mock/logo.png`
          }).then(match => {
            match.should.eql(true)

            server.isDone().should.eql(true)
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
              res.body.should.be.instanceof(Buffer)
              res.headers['content-type'].should.eql('image/png')
              res.statusCode.should.eql(410)

              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
              config.set('notFound.statusCode', configBackup.notFound.statusCode)

              done()
            })
        })

        describe('when multi-domain is enabled', () => {
          let fallbackImages = {
            localhost: 'test/images/original.jpg',
            'testdomain.com': 'test/images/dog-w600.jpeg'
          }

          before(() => {
            config.set('multiDomain.enabled', true)
            config.loadDomainConfigs()

            config.set('notFound.images.enabled', false)

            config.set('notFound.statusCode', 418, 'localhost')
            config.set('notFound.images.enabled', true, 'localhost')
            config.set('notFound.images.path', fallbackImages.localhost, 'localhost')

            config.set('notFound.statusCode', 451, 'testdomain.com')
            config.set('notFound.images.enabled', true, 'testdomain.com')
            config.set('notFound.images.path', fallbackImages['testdomain.com'], 'testdomain.com')

            return help.proxyStart()
          })

          after(() => {
            config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

            return help.proxyStop()
          })

          it('returns the fallback image and status code defined by each domain if the image is not found', done => {
            let server1 = nock('https://one.somedomain.tech')
              .get('/not-found.jpg')
              .reply(404)

            let server2 = nock('https://two.somedomain.tech')
              .get('/not-found.jpg')
              .reply(404)

            help.imagesEqual({
              base: fallbackImages.localhost,
              test: `${help.proxyUrl}/not-found.jpg?mockdomain=localhost`
            }).then(match => {
              match.should.eql(true)

              request(help.proxyUrl)
                .get('/not-found.jpg?mockdomain=testdomain.com')
                .expect(418)
                .end((err, res) => {
                  help.imagesEqual({
                    base: fallbackImages['testdomain.com'],
                    test: `${help.proxyUrl}/not-found.jpg?mockdomain=testdomain.com`
                  }).then(match => {
                    match.should.eql(true)

                    request(help.proxyUrl)
                      .get('/not-found.jpg?mockdomain=testdomain.com')
                      .expect(451)
                      .end(done)
                  })
                })
            })
          })

          it('returns an error message if the fallback image is disabled for the domain', done => {
            config.set('notFound.images.enabled', false, 'testdomain.com')

            let server1 = nock('https://one.somedomain.tech')
              .get('/not-found.jpg')
              .reply(404)

            help.imagesEqual({
              base: fallbackImages.localhost,
              test: `${help.proxyUrl}/not-found.jpg?mockdomain=localhost`
            }).then(match => {
              match.should.eql(true)

              request(help.proxyUrl)
                .get('/not-found.jpg?mockdomain=testdomain.com')
                .expect(418)
                .end((err, res) => {
                  request(help.proxyUrl)
                    .get('/not-found.jpg?mockdomain=testdomain.com')
                    .expect(451)
                    .end((err, res) => {
                      res.body.message.includes('File not found:').should.eql(true)

                      done()
                    })
                })
            })
          })
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

    describe('S3 images', () => {
      beforeEach(() => {
        config.set('images.directory.enabled', false)
        config.set('images.remote.enabled', false)
        config.set('images.s3.enabled', true)
      })

      afterEach(() => {
        config.set('images.directory.enabled', configBackup.images.directory.enabled)
        config.set('images.remote.enabled', configBackup.images.remote.enabled)
        config.set('images.remote.path', configBackup.images.remote.path)
        config.set('images.remote.allowFullURL', configBackup.images.remote.allowFullURL)
        config.set('images.s3.enabled', configBackup.images.s3.enabled)
      })

      it('should return 200 when image is returned', function (done) {
        // return a buffer from the S3 request
        let stream = fs.createReadStream('./test/images/missing.png')
        let buffers = []
        stream
          .on('data', function (data) { buffers.push(data) })
          .on('end', function () {
            let buffer = Buffer.concat(buffers)

            AWS.mock('S3', 'getObject', Promise.resolve({
              LastModified: Date.now(),
              Body: buffer
            }))

            config.set('images.s3.bucketName', 'test-bucket')
            config.set('images.s3.accessKey', 'xxx')
            config.set('images.s3.secretKey', 'xyz')
            config.set('notFound.statusCode', 404)
            config.set('notFound.images.enabled', true)
            config.set('notFound.images.path', './test/images/missing.png')

            let client = request(cdnUrl)
            .get('/images/mock/logo.png')
            .expect(200)
            .end((err, res) => {
              AWS.restore()

              res.body.should.be.instanceof(Buffer)
              res.headers['content-type'].should.eql('image/png')
              res.statusCode.should.eql(200)

              done()
            })
          })
      })

      it('should return a placeholder image when the S3 image returns 404', function (done) {
        // return 404 from the S3 request
        AWS.mock('S3', 'getObject', Promise.reject({ statusCode: 404 }))

        config.set('images.s3.bucketName', 'test-bucket')
        config.set('images.s3.accessKey', 'xxx')
        config.set('images.s3.secretKey', 'xyz')
        config.set('notFound.statusCode', 404)
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')

        let client = request(cdnUrl)
        .get('/images/mock/logo.png')
        .expect(404)
        .end((err, res) => {
          AWS.restore()

          res.body.should.be.instanceof(Buffer)
          res.headers['content-type'].should.eql('image/png')
          res.statusCode.should.eql(404)

          done()
        })
      })

      it('should return a json response when a directory is requested', function (done) {
        // return 404 from the S3 request
        AWS.mock('S3', 'getObject', Promise.reject({ statusCode: 404 }))

        config.set('images.s3.bucketName', 'test-bucket')
        config.set('images.s3.accessKey', 'xxx')
        config.set('images.s3.secretKey', 'xyz')
        config.set('notFound.statusCode', 404)
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/')

        let client = request(cdnUrl)
          .get('/images/mock/')
          .expect(404)
          .end((err, res) => {
            AWS.restore()

            res.body.message.includes('File not found:').should.eql(true)
            res.statusCode.should.eql(404)

            done()
          })
      })

      it('should return configured statusCode if image is not found', function (done) {
        // return 404 from the S3 request
        AWS.mock('S3', 'getObject', Promise.reject({ statusCode: 404 }))

        config.set('images.s3.bucketName', 'test-bucket')
        config.set('images.s3.accessKey', 'xxx')
        config.set('images.s3.secretKey', 'xyz')
        config.set('notFound.statusCode', 410)
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', './test/images/missing.png')

        let client = request(cdnUrl)
        .get('/images/mock/logo.png')
        .expect(410)
        .end((err, res) => {
          AWS.restore()

          res.body.should.be.instanceof(Buffer)
          res.headers['content-type'].should.eql('image/png')
          res.statusCode.should.eql(410)

          config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
          config.set('notFound.statusCode', configBackup.notFound.statusCode)

          done()
        })
      })
    })

    describe('Other', function () {
      it('should respond to the hello endpoint', function (done) {
        var client = request(cdnUrl)
        client
          .get('/hello')
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
})
