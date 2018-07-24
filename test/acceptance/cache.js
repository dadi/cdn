const fs = require('fs')
const should = require('should')
const request = require('supertest')
const sinon = require('sinon')
const assert = require('assert')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const cache = require(__dirname + '/../../dadi/lib/cache')
const config = require(__dirname + '/../../config')

let bearerToken
let client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
let configBackup = config.get()

const USER_AGENTS = {
  chrome64: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.167 Safari/537.36',
  chrome41: 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
  firefox40_1: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
  firefox54: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
  ie9: 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)'
}

describe('Cache', function () {
  this.timeout(10000)

  before(() => {
    config.set('caching.directory.enabled', true)
    config.set('caching.redis.enabled', false)
  })

  after(() => {
    config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
    config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
  })

  beforeEach(done => {
    app.start(function () {
      help.getBearerToken((err, token) => {
        if (err) return done(err)

        bearerToken = token
        done()
      })
    })
  })

  afterEach(done => {
    help.clearCache()
    app.stop(done)
  })

  describe('Images', () => {
    it('should get image from cache when available', done => {
      client
      .get('/test.jpg')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('image/jpeg')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.jpg')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('image/jpeg')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
      })
    })

    it('should get image JSON data from cache when available', done => {
      client
      .get('/test.jpg?format=json')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('application/json')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.jpg?format=json')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/json')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
      })
    })

    describe('caching 404 responses', () => {
      it('should not cache a 404 if caching.cache404 is false and the image fallback is disabled', done => {
        config.set('caching.cache404', false)
        config.set('notFound.images.enabled', false)

        client
        .get('/not-a-valid-image.jpg')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('application/json')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/not-a-valid-image.jpg')
            .expect(404)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('application/json')
              res.headers['x-cache'].should.eql('MISS')

              config.set('caching.cache404', configBackup.caching.cache404)
              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)

              done()
            })
          }, 500)
        })
      })

      it('should not cache a 404 if caching.cache404 is false and the image fallback is enabled', done => {
        config.set('caching.cache404', false)
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', 'test/images/missing.png')

        client
        .get('/not-a-valid-image.jpg')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('image/png')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/not-a-valid-image.jpg')
            .expect(404)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('image/png')
              res.headers['x-cache'].should.eql('MISS')

              config.set('caching.cache404', configBackup.caching.cache404)
              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
              config.set('notFound.images.path', configBackup.notFound.images.path)

              done()
            })
          }, 500)
        })
      })

      it('should cache a 404 if caching.cache404 is true and the image fallback is disabled', done => {
        config.set('caching.cache404', true)
        config.set('notFound.images.enabled', false)

        client
        .get('/not-a-valid-image.jpg')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('application/json')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/not-a-valid-image.jpg')
            .expect(404)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('application/json')
              res.headers['x-cache'].should.eql('HIT')

              config.set('caching.cache404', configBackup.caching.cache404)
              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)

              done()
            })
          }, 500)
        })
      })

      it('should cache a 404 if caching.cache404 is true and the image fallback is enabled', done => {
        config.set('caching.cache404', true)
        config.set('notFound.images.enabled', true)
        config.set('notFound.images.path', 'test/images/missing.png')

        client
        .get('/not-a-valid-image.jpg')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('image/png')
          res.headers['x-cache'].should.eql('MISS')

          // Setting a new fallback image to ensure that the content-type returned matches the
          // content-type of the image that was cached, not the one that is currently set.
          config.set('notFound.images.path', 'test/images/original.jpg')

          setTimeout(() => {
            client
            .get('/not-a-valid-image.jpg')
            .expect(404)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('image/png')
              res.headers['x-cache'].should.eql('HIT')

              config.set('caching.cache404', configBackup.caching.cache404)
              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)
              config.set('notFound.images.path', configBackup.notFound.images.path)

              done()
            })
          }, 500)
        })
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

      it('should cache as different items requests with identical paths but different domains', done => {
        client
        .get('/test.jpg')
        .set('Host', 'localhost:80')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('image/jpeg')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/test.jpg')
            .set('Host', 'localhost:80')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('image/jpeg')
              res.headers['x-cache'].should.eql('HIT')

              client
              .get('/test.jpg')
              .set('Host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('image/jpeg')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  client
                  .get('/test.jpg')
                  .set('Host', 'testdomain.com:80')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['content-type'].should.eql('image/jpeg')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                }, 150)
              })
            })
          }, 150)
        })
      })
    })
  })

  describe('JavaScript', () => {
    it('should get untranspiled JS from cache when available, not dependent on user agent', done => {
      client
      .get('/test.js')
      .set('user-agent', USER_AGENTS.chrome41)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('application/javascript')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.js')
          .set('user-agent', USER_AGENTS.ie9)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/javascript')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
      })
    })

    it('should get transpiled JS from cache when available, based on user agent', done => {
      client
      .get('/test-es6.js?transform=1&compress=1')
      .set('user-agent', USER_AGENTS.chrome64)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('application/javascript')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test-es6.js?transform=1&compress=1')
          .set('user-agent', USER_AGENTS.firefox54)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/javascript')
            res.headers['x-cache'].should.eql('HIT')

            setTimeout(() => {
              client
              .get('/test-es6.js?transform=1&compress=1')
              .set('user-agent', USER_AGENTS.ie9)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('application/javascript')
                res.headers['x-cache'].should.eql('MISS')

                done()
              })
            }, 500)
          })
        }, 500)
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

      it('should cache as different items requests with identical paths but different domains', done => {
        client
        .get('/test.js')
        .set('Host', 'localhost:80')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('application/javascript')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/test.js')
            .set('Host', 'localhost:80')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('application/javascript')
              res.headers['x-cache'].should.eql('HIT')

              client
              .get('/test.js')
              .set('Host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('application/javascript')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  client
                  .get('/test.js')
                  .set('Host', 'testdomain.com:80')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['content-type'].should.eql('application/javascript')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                }, 150)
              })
            })
          }, 150)
        })
      })
    })
  })

  describe('CSS', () => {
    it('should get CSS from cache when available', done => {
      client
      .get('/test.css')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('text/css')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.css')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('text/css')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
      })
    })

    it('should get compressed CSS from cache, independently from uncompressed version', done => {
      client
      .get('/test.css')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('text/css')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.css')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('text/css')
            res.headers['x-cache'].should.eql('HIT')

            setTimeout(() => {
              client
              .get('/test.css?compress=1')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('text/css')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  client
                  .get('/test.css?compress=1')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['content-type'].should.eql('text/css')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                }, 500)
              })
            }, 500)
          })
        }, 500)
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

      it('should cache as different items requests with identical paths but different domains', done => {
        client
        .get('/test.css')
        .set('Host', 'localhost:80')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('text/css')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/test.css')
            .set('Host', 'localhost:80')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('text/css')
              res.headers['x-cache'].should.eql('HIT')

              client
              .get('/test.css')
              .set('Host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('text/css')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  client
                  .get('/test.css')
                  .set('Host', 'testdomain.com:80')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['content-type'].should.eql('text/css')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                }, 150)
              })
            })
          }, 150)
        })
      })
    })
  })

  describe('Other assets', () => {
    it('should get TTF from cache when available', done => {
      client
      .get('/test.ttf')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('font/ttf')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.ttf')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('font/ttf')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
      })
    })

    it('should get PDF from cache when available', done => {
      client
      .get('/test.pdf')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['content-type'].should.eql('application/pdf')
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(() => {
          client
          .get('/test.pdf')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/pdf')
            res.headers['x-cache'].should.eql('HIT')

            done()
          })
        }, 500)
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

      it('should cache as different items requests with identical paths but different domains', done => {
        client
        .get('/test.pdf')
        .set('Host', 'localhost:80')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.headers['content-type'].should.eql('application/pdf')
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(() => {
            client
            .get('/test.pdf')
            .set('Host', 'localhost:80')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('application/pdf')
              res.headers['x-cache'].should.eql('HIT')

              client
              .get('/test.pdf')
              .set('Host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['content-type'].should.eql('application/pdf')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  client
                  .get('/test.pdf')
                  .set('Host', 'testdomain.com:80')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['content-type'].should.eql('application/pdf')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                }, 150)
              })
            })
          }, 150)
        })
      })
    })
  })

  describe('TTL', () => {
    it('should keep cached items for the period of time defined in caching.ttl', done => {
      let mockCacheGet = sinon.spy(cache.Cache.prototype, 'getStream')
      let mockCacheSet = sinon.spy(cache.Cache.prototype, 'cacheFile')

      config.set('caching.ttl', 3)

      setTimeout(() => {
        client
          .get('/test.pdf')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/pdf')
            res.headers['x-cache'].should.eql('MISS')

            mockCacheGet.firstCall.args[1].ttl.should.eql(3)
            mockCacheSet.firstCall.args[2].ttl.should.eql(3)

            mockCacheGet.restore()
            mockCacheSet.restore()

            done()
          })
      }, 1500)
    })

    it('when multi-domain is enabled, cached itemd should be kept for the period of time defined in each domain config', done => {
      let mockCacheGet = sinon.spy(cache.Cache.prototype, 'getStream')
      let mockCacheSet = sinon.spy(cache.Cache.prototype, 'cacheFile')

      config.set('multiDomain.enabled', true)
      config.loadDomainConfigs()

      config.set('caching.ttl', 3000)
      config.set('caching.ttl', 3, 'localhost')
      config.set('caching.ttl', 5, 'testdomain.com')

      setTimeout(() => {
        client
          .get('/test.pdf')
          .set('Host', 'localhost:80')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.headers['content-type'].should.eql('application/pdf')
            res.headers['x-cache'].should.eql('MISS')

            client
            .get('/test.pdf')
            .set('Host', 'testdomain.com:80')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-type'].should.eql('application/pdf')
              res.headers['x-cache'].should.eql('MISS')

              mockCacheGet.firstCall.args[1].ttl.should.eql(3)
              mockCacheSet.firstCall.args[2].ttl.should.eql(3)

              mockCacheGet.secondCall.args[1].ttl.should.eql(5)
              mockCacheSet.secondCall.args[2].ttl.should.eql(5)

              mockCacheGet.restore()
              mockCacheSet.restore()

              done()
            })
          })
      }, 500)
    })
  })
})

describe('Frequency cache flush', () => {
  afterEach(() => {
    cache.reset()
    help.clearCache()
  })

  describe('with multi-domain disabled', () => {
    it('should flush the entire cache in the interval defined by the `expireAt` property', done => {
      // Every second.
      config.set('caching.expireAt', '* * * * * *')
      config.set('multiDomain.enabled', false)

      app.start(() => {
        let mockCacheDelete = sinon.spy(cache.Cache.prototype, 'delete')

        setTimeout(() => {
          mockCacheDelete.args.every(callArgs => {
            return callArgs.length === 0
          }).should.eql(true)
          mockCacheDelete.callCount.should.eql(5)

          mockCacheDelete.restore()

          config.set('caching.expireAt', configBackup.caching.expireAt)
          config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

          app.stop(done)
        }, 5200)
      })
    }).timeout(6000)
  })

  describe('with multi-domain enabled', () => {
    it('should flush the entire cache in the interval defined by the `expireAt` property', done => {
      config.set('multiDomain.enabled', true)
      config.loadDomainConfigs()

      // Every second.
      config.set('caching.expireAt', '* * * * * *', 'testdomain.com')

      app.start(() => {
        let mockCacheDelete = sinon.spy(cache.Cache.prototype, 'delete')

        setTimeout(() => {
          mockCacheDelete.args.every(callArgs => {
            callArgs.length.should.eql(1)
            callArgs[0].should.eql(['testdomain.com'])

            return true
          }).should.eql(true)
          mockCacheDelete.callCount.should.eql(5)

          mockCacheDelete.restore()

          config.set('caching.expireAt', configBackup.caching.expireAt, 'testdomain.com')
          config.set('multiDomain.enabled', configBackup.multiDomain.enabled)

          app.stop(done)
        }, 5200)
      })
    }).timeout(6000)
  })
})
