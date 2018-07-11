const fs = require('fs')
const nock = require('nock')
const path = require('path')
const sha1 = require('sha1')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

const app = require(__dirname + '/../../dadi/lib/')
const Cache = require(__dirname + '/../../dadi/lib/cache')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')

const cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`
const images = {
  'localhost': 'test/images/test.jpg',
  'testdomain.com': 'test/images/dog-w600.jpeg'
}

const stylesheets = {
  'localhost': 'test/assets/test.css',
  'testdomain.com': 'test/assets/test.css'
}

const jsFiles = {
  'localhost': 'test/assets/test.js',
  'testdomain.com': 'test/assets/test.js'
}

const txtFiles = {
  'localhost': 'test/assets/test.txt',
  'testdomain.com': 'test/assets/test.txt'
}

let configBackup = config.get()
let server1 = nock('http://one.somedomain.tech')
  .get('/test.jpg')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(images['localhost'])
    )
  })

let server2 = nock('http://two.somedomain.tech')
  .get('/test.jpg')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(images['testdomain.com'])
    )
  })

let cssScope1 = nock('http://one.somedomain.tech')
  .get('/test.css')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(stylesheets['localhost'])
    )
  })

let cssScope2 = nock('http://two.somedomain.tech')
  .get('/test.css')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(stylesheets['testdomain.com'])
    )
  })

let jsScope1 = nock('http://one.somedomain.tech')
  .get('/test.js')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(jsFiles['localhost'])
    )
  })

let jsScope2 = nock('http://two.somedomain.tech')
  .get('/test.js')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(jsFiles['testdomain.com'])
    )
  })

let txtScope1 = nock('http://one.somedomain.tech')
  .get('/test.txt')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(txtFiles['localhost'])
    )
  })

let txtScope2 = nock('http://two.somedomain.tech')
  .get('/test.txt')
  .times(Infinity)
  .reply(200, (uri, requestBody) => {
    return fs.createReadStream(
      path.resolve(txtFiles['testdomain.com'])
    )
  })

describe('Multi-domain', function () {
  describe('if multi-domain is disabled', () => {
    before(done => {
      config.set('multiDomain.enabled', false)

      help.proxyStart().then(() => {
        app.start(err => {
          if (err) return done(err)

          setTimeout(done, 500)
        })  
      })
    })

    after(done => {
      config.set('multiDomain.enabled', false)

      help.proxyStop().then(() => {
        app.stop(done)  
      })
    })

    it('should retrieve a remote image from a path specified by a recipe regardless of whether the domain is configured', () => {
      return help.imagesEqual({
        base: images['localhost'],
        test: `${cdnUrl}/sample-image-recipe/test.jpg`
      }).then(match => {
        match.should.eql(true)

        return help.imagesEqual({
          base: images['localhost'],
          test: `${help.proxyUrl}/sample-image-recipe/test.jpg?mockdomain=unknowndomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it('should retrieve a remote image regardless of whether the domain is configured', () => {
      return help.imagesEqual({
        base: images['localhost'],
        test: `${cdnUrl}/test.jpg`
      }).then(match => {
        match.should.eql(true)

        return help.imagesEqual({
          base: images['localhost'],
          test: `${help.proxyUrl}/test.jpg?mockdomain=unknowndomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    describe('Caching', () => {
      beforeEach(() => {
        help.clearCache()

        config.set('caching.redis.enabled', false)
        config.set('caching.directory.enabled', true)
      })

      after(() => {
        help.clearCache()
        Cache.reset()

        config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
        config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
      })

      it('should not include domain name as part of cache key', done => {
        let cacheSet = sinon.spy(
          Cache.Cache.prototype,
          'set'
        )

        request(cdnUrl)
          .get('/test.jpg')
          .set('Host', 'testdomain.com:80')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            setTimeout(() => {
              request(cdnUrl)
                .get('/test.jpg')
                .set('Host', 'testdomain.com:80')
                .expect(200)
                .end((err, res) => {
                  res.headers['x-cache'].should.eql('HIT')
                  cacheSet.getCall(0).args[0].includes('testdomain.com').should.eql(false)

                  cacheSet.restore()

                  done()
                })
            }, 1000)
          })
      }).timeout(5000)
    })    
  })

  describe('if multi-domain is enabled', () => {
    beforeEach(done => {
      config.set('images.s3.enabled', false)

      config.set('multiDomain.enabled', true)
      config.loadDomainConfigs()

      config.set('images.directory.enabled', false, 'localhost')
      config.set('images.remote.enabled', true, 'localhost')

      config.set('images.directory.enabled', false, 'testdomain.com')
      config.set('images.remote.enabled', true, 'testdomain.com')

      config.set('assets.directory.enabled', false, 'localhost')
      config.set('assets.remote.enabled', true, 'localhost')

      config.set('assets.directory.enabled', false, 'testdomain.com')
      config.set('assets.remote.enabled', true, 'testdomain.com')

      app.start(err => {
        if (err) return done(err)

        help.proxyStart().then(() => {
          setTimeout(done, 500)
        })
      })
    })

    afterEach(done => {
      config.set('images.s3.enabled', configBackup.images.s3.enabled)

      config.set('images.directory.enabled', configBackup.images.directory.enabled, 'localhost')
      config.set('images.remote.enabled', configBackup.images.remote.enabled, 'localhost')
      config.set('images.remote.path', configBackup.images.remote.path, 'localhost')

      config.set('assets.directory.enabled', configBackup.assets.directory.enabled, 'localhost')
      config.set('assets.remote.enabled', configBackup.assets.remote.enabled, 'localhost')
      config.set('assets.remote.path', configBackup.assets.remote.path, 'localhost')

      config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

      help.proxyStop().then(() => {
        app.stop(done)
      })
    })

    it('should retrieve a remote image from the path specified by a recipe at domain level', () => {
      return help.imagesEqual({
        base: images['localhost'],
        test: `${help.proxyUrl}/test-recipe/test.jpg?mockdomain=localhost`
      }).then(match => {
        match.should.eql(true)

        return help.imagesEqual({
          base: images['testdomain.com'],
          test: `${help.proxyUrl}/test-recipe/test.jpg?mockdomain=testdomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it('should retrieve a remote image from the path specified by the domain config', () => {
      return help.imagesEqual({
        base: images['localhost'],
        test: `${help.proxyUrl}/test.jpg?mockdomain=localhost`
      }).then(match => {
        match.should.eql(true)

        return help.imagesEqual({
          base: images['testdomain.com'],
          test: `${help.proxyUrl}/test.jpg?mockdomain=testdomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it('should retrieve a remote CSS file from the path specified by the domain config', () => {
      return help.filesEqual({
        base: stylesheets['localhost'],
        test: `${help.proxyUrl}/test.css?mockdomain=localhost`
      }).then(match => {
        match.should.eql(true)

        return help.filesEqual({
          base: stylesheets['testdomain.com'],
          test: `${help.proxyUrl}/test.css?mockdomain=testdomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it('should retrieve a remote TXT file from the path specified by the domain config', () => {
      return help.filesEqual({
        base: txtFiles['localhost'],
        test: `${help.proxyUrl}/test.txt?mockdomain=localhost`
      }).then(match => {
        match.should.eql(true)

        return help.filesEqual({
          base: txtFiles['testdomain.com'],
          test: `${help.proxyUrl}/test.txt?mockdomain=testdomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it.skip('should retrieve a remote JS file from the path specified by the domain config', () => {
      return help.filesEqual({
        base: jsFiles['localhost'],
        test: `${help.proxyUrl}/test.js?mockdomain=localhost`
      }).then(match => {
        match.should.eql(true)

        return help.filesEqual({
          base: jsFiles['testdomain.com'],
          test: `${help.proxyUrl}/test.js?mockdomain=testdomain.com`
        }).then(match => {
          match.should.eql(true)
        })
      })
    }).timeout(5000)

    it('should use the allowFullURL setting defined at domain level to determine whether or not a request with a full remote URL will be served', done => {
      config.set('images.remote.allowFullURL', true, 'localhost')
      config.set('images.remote.allowFullURL', false, 'testdomain.com')

      request(cdnUrl)
        .get('/http://one.somedomain.tech/test.jpg')
        .set('Host', 'localhost:80')
        .expect(200)
        .end((err, res) => {
          res.headers['content-type'].should.eql('image/jpeg')

          request(cdnUrl)
            .get('/http://one.somedomain.tech/test.jpg')
            .set('Host', 'testdomain.com:80')
            .end((err, res) => {
              res.statusCode.should.eql(403)
              res.body.message.should.eql(
                'Loading images from a full remote URL is not supported by this instance of DADI CDN'
              )

              done()
            })
        })
    }).timeout(5000)

    describe('when the target domain is not configured', () => {
      let testDomain = 'unknowndomain.com'

      it('should return 404 when trying to retrieve a remote image', done => {
        request(cdnUrl)
          .get('/test.jpg')
          .set('Host', `${testDomain}:80`)
          .expect(404)
          .end((err, res) => {
            res.body.message.should.eql(
              `Domain not configured: ${testDomain}`
            )

            done()
          })
      })

      it('should return 404 when trying to reach a recipe', done => {
        request(cdnUrl)
          .get('/sample-image-recipe/test.jpg')
          .set('Host', `${testDomain}:80`)
          .expect(404)
          .end((err, res) => {
            res.body.message.should.eql(
              `Domain not configured: ${testDomain}`
            )

            done()
          })
      })

      it('should return 404 when trying to retrieve an asset', done => {
        request(cdnUrl)
          .get('/test.js')
          .set('Host', `${testDomain}:80`)
          .expect(404)
          .end((err, res) => {
            res.body.message.should.eql(
              `Domain not configured: ${testDomain}`
            )

            request(cdnUrl)
              .get('/test.css')
              .set('Host', `${testDomain}:80`)
              .expect(404)
              .end((err, res) => {
                res.body.message.should.eql(
                  `Domain not configured: ${testDomain}`
                )

                done()
              })
          })
      })
    })

    describe('Caching', () => {
      beforeEach(() => {
        help.clearCache()

        config.set('caching.redis.enabled', false)
        config.set('caching.directory.enabled', true)
      })

      after(() => {
        help.clearCache()
        Cache.reset()

        config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
        config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
      })

      it('should include domain name as part of cache key', done => {
        let cacheSet = sinon.spy(
          Cache.Cache.prototype,
          'set'
        )

        request(cdnUrl)
          .get('/test.jpg')
          .set('Host', 'testdomain.com:80')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            setTimeout(() => {
              request(cdnUrl)
                .get('/test.jpg')
                .set('Host', 'testdomain.com:80')
                .expect(200)
                .end((err, res) => {
                  res.headers['x-cache'].should.eql('HIT')
                  cacheSet.getCall(0).args[0].includes('testdomain.com').should.eql(true)
                  cacheSet.restore()

                  request(cdnUrl)
                    .get('/test.jpg')
                    .set('Host', 'localhost:80')
                    .expect(200)
                    .end((err, res) => {
                      res.headers['x-cache'].should.eql('MISS')

                      done()
                    })
                })
            }, 1000)
          })
      }).timeout(5000)
    })
  })
})
