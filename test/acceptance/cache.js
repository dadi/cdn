const fs = require('fs')
const should = require('should')
const request = require('supertest')
const assert = require('assert')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const cache = require(__dirname + '/../../dadi/lib/cache')
const config = require(__dirname + '/../../config')

let bearerToken

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
