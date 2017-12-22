var path = require('path')
var should = require('should')
var sinon = require('sinon')
var server = require(__dirname + '/../../dadi/lib')
var Server = require(__dirname + '/../../dadi/lib').Server
var fs = require('fs')

describe('Server', function () {
  it('should export an instance', function (done) {
    server.start.should.be.Function
    server.stop.should.be.Function
    done()
  })

  describe('start', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(fs, 'readdirSync').callsFake(function () { return [] })

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(server.server, 'close').callsFake(function (cb) { cb() })

      server.stop(function (err) {
        if (err) return done(err)

        server.readyState.should.equal(0)
        stub.called.should.be.true
        stub.restore()

        done()
      })
    })
  })

  describe('getWorkspace', function () {
    it('should return hash of file names', function (done) {
      var spy = sinon.spy(Server.prototype, 'getWorkspace')

      const s = new Server()
      const workspace = s.getWorkspace()

      spy.restore()
      spy.called.should.eql(true)

      var files = spy.firstCall.returnValue

      Object.keys(files).includes('layout').should.eql(true)
      Object.keys(files).includes('sample-image-recipe').should.eql(true)

      done()
    })

    it('should include type and path properties', function (done) {
      var spy = sinon.spy(Server.prototype, 'getWorkspace')

      const s = new Server()
      const workspace = s.getWorkspace()

      spy.restore()
      spy.called.should.eql(true)

      var files = spy.firstCall.returnValue

      files['layout'].type.should.eql('plugins')
      files['layout'].path.should.eql(
        path.resolve(__dirname + '/../../workspace/plugins/layout.js')
      )
      files['sample-asset-recipe'].type.should.eql('recipes')
      files['sample-asset-recipe'].path.should.eql(
        path.resolve(__dirname + '/../../workspace/recipes/sample-asset-recipe.json')
      )

      done()  
    })

    it('should include source property for recipes', function (done) {
      var spy = sinon.spy(Server.prototype, 'getWorkspace')

      const s = new Server()
      const workspace = s.getWorkspace()

      spy.restore()
      spy.called.should.eql(true)

      var files = spy.firstCall.returnValue
      var recipePath = path.resolve(__dirname + '/../../workspace/recipes/sample-asset-recipe.json')

      files['sample-asset-recipe'].type.should.eql('recipes')
      files['sample-asset-recipe'].path.should.eql(recipePath)
      files['sample-asset-recipe'].source.toString().should.eql(require(recipePath).toString())

      done()
    })
  })
})
