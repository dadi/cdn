const fs = require('fs')
const should = require('should')
const request = require('supertest')
const assert = require('assert')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const cache = require(__dirname + '/../../dadi/lib/cache')
const config = require(__dirname + '/../../config')

let bearerToken

const USER_AGENTS = {
  chrome64: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.167 Safari/537.36',
  chrome41: 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
  firefox40_1: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1',
  firefox54: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0',
  ie9: 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)'
}

describe('Cache', function () {
  this.timeout(10000)

  beforeEach(done => {
    let newTestConfig = JSON.parse(fs.readFileSync(config.configPath()))

    newTestConfig.caching.directory.enabled = true
    newTestConfig.caching.redis.enabled = false

    cache.reset()
    help.clearCache()

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

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
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

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
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

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
  })

  describe('JavaScript', () => {
    it('should get untranspiled JS from cache when available, not dependent on user agent', done => {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

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
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

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
  })
})
