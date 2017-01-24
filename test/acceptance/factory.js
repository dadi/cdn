var _ = require('underscore')
var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var HandlerFactory = require(__dirname + '/../../dadi/lib/handlers/factory')

var testConfigString

describe('HandlerFactory', function () {
  this.timeout(8000)

  beforeEach(function (done) {
    // delete require.cache[__dirname + '/../../config']
    // config = require(__dirname + '/../../config')
    //
    // testConfigString = fs.readFileSync(config.configPath())
    config.set('paths.processors', 'workspace/processors')

    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  afterEach(function (done) {
    help.clearCache()
    app.stop(done)
  })

  describe('Constructor', function () {
  })

  describe('getWorkspaceFiles', function () {
    it('should return Array of file names', function(done) {
      var spy = sinon.spy(HandlerFactory.HandlerFactory.prototype, 'getWorkspaceFiles')

      var factory = new HandlerFactory()
      spy.restore()
      spy.called.should.eql(true)
      spy.firstCall.returnValue.should.be.Array
      done()
    })

    it('should include layout.js and sample-image-recipe.json', function(done) {
      var spy = sinon.spy(HandlerFactory.HandlerFactory.prototype, 'getWorkspaceFiles')

      var factory = new HandlerFactory()
      spy.restore()
      spy.called.should.eql(true)
      var files = spy.firstCall.returnValue

      _.contains(files, 'sample-image-recipe').should.eql(true)
      _.contains(files, 'layout').should.eql(true)
      done()
    })
  })
})
