const app = require('./../../dadi/lib/')
const assert = require('assert')
const cache = require('./../../dadi/lib/cache')
const config = require('./../../config')
const fs = require('fs')
const help = require('./help')
const ImageHandler = require('./../../dadi/lib/handlers/image').ImageHandler
const request = require('supertest')
const sinon = require('sinon')
const should = require('should')

let bearerToken
let cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`
let client = request(cdnUrl)
let configBackup = config.get()

describe('Work queue', function () {
  this.timeout(10000)

  beforeEach(done => {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    config.set('images.directory.enabled', true)
    config.set('images.remote.enabled', false)

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

    config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
    config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
    config.set('images.directory.enabled', configBackup.images.directory.enabled)
    config.set('images.remote.enabled', configBackup.images.remote.enabled)
  })

  it('should process the image just once on subsequent requests and render the correct result (5 requests)', () => {
    let processorSpy = sinon.spy(ImageHandler.prototype, 'process')
    let numberOfRequests = 5
    let ops = Array.apply(null, {
      length: numberOfRequests
    }).map(() => {
      return help.imagesEqual({
        base: 'test/images/original.jpg',
        test: `${cdnUrl}/original.jpg`
      })
    })

    return Promise.all(ops).then(results => {
      results.every(Boolean).should.eql(true)
      processorSpy.callCount.should.eql(1)
      processorSpy.restore()
    })
  })

  it('should process the image just once on subsequent requests (200 requests)', () => {
    let processorSpy = sinon.spy(ImageHandler.prototype, 'process')
    let numberOfRequests = 200
    let ops = Array.apply(null, {
      length: numberOfRequests
    }).map(() => {
      return new Promise((resolve, reject) => {
        client
        .get('/original.jpg')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return reject(err)
          }

          resolve(res)
        })
      })
    })

    return Promise.all(ops).then(results => {
      results.every(res => {
        res.statusCode.should.eql(200)
        res.headers['content-type'].should.eql(
          'image/jpeg'
        )

        return true
      }).should.eql(true)
      processorSpy.callCount.should.eql(1)
      processorSpy.restore()
    })
  })
})