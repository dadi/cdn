var fs = require('fs')
var path = require('path')
var should = require('should')
var config = require(__dirname + '/../../config')
var request = require('supertest')
var _ = require('underscore')

module.exports.getBearerToken = function (done) {
  request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post(config.get('auth.tokenUrl'))
    .send({
      clientId: 'test',
      secret: 'test'
    })
    .expect(200)
    // .expect('content-type', 'application/json')
    .end(function (err, res) {
      if (err) return done(err)

      var bearerToken = res.body.accessToken
      should.exist(bearerToken)
      done(null, bearerToken)
    })
}

module.exports.clearCache = function () {
  var deleteFolderRecursive = function (filepath) {
    if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
      fs.readdirSync(filepath).forEach(function (file, index) {
        var curPath = filepath + '/' + file
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath)
        } else { // delete file
          fs.unlinkSync(path.resolve(curPath))
        }
      })
      fs.rmdirSync(filepath)
    } else {
      fs.unlinkSync(filepath)
    }
  }

  // for each directory in the cache folder, remove all files then
  // delete the folder
  fs.stat(config.get('caching.directory.path'), function(err, stats) {
    if (!err) {
      fs.readdirSync(config.get('caching.directory.path')).forEach(function (dirname) {
        deleteFolderRecursive(path.join(config.get('caching.directory.path'), dirname))
      })
    }
  })
}
