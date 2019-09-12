const path = require('path')
const should = require('should')
const sinon = require('sinon')
const server = require(__dirname + '/../../dadi/lib')
const Server = require(__dirname + '/../../dadi/lib').Server
const fs = require('fs')

describe('Server', function() {
  it('should export an instance', function(done) {
    server.start.should.be.Function
    server.stop.should.be.Function
    done()
  })

  it('should export the Server prototype', function(done) {
    server.Server.should.be.Function
    done()
  })

  it('should export the app config', function(done) {
    server.config.should.be.Function
    done()
  })

  describe('start', function() {
    it('should set readyState', function(done) {
      const stub = sinon.stub(fs, 'readdirSync').callsFake(function() {
        return []
      })

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function() {
    it('should set readyState', function(done) {
      const stub = sinon.stub(server.server, 'close').callsFake(function(cb) {
        cb()
      })

      server.stop(function(err) {
        if (err) return done(err)

        server.readyState.should.equal(0)
        stub.called.should.be.true
        stub.restore()

        done()
      })
    })
  })
})
