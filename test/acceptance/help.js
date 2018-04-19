const fs = require('fs-extra')
const Jimp = require('jimp')
const path = require('path')
const should = require('should')
const config = require(__dirname + '/../../config')
const request = require('supertest')
const req = require('request')

module.exports.createTempFile = function (filePath, content, options, callback) {
  return fs.ensureDir(
    path.dirname(path.resolve(filePath))
  ).then(() => {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    let serialisedContent = typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2)

    return fs.writeFile(filePath, serialisedContent)
  }).then(() => {
    let removeFn = () => fs.removeSync(filePath)

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        callback(removeFn, content)

        resolve()
      }, (options.interval || 0))
    })
  })
}

module.exports.imagesEqual = function ({base, headers, test}) {
  let fullBasePath = path.resolve(base)

  if (test.indexOf('/') === 0) {
    test = `http://${config.get('server.host')}:${config.get('server.port')}${test}`
  }

  return Jimp
    .read(fullBasePath)
    .then(baselineImage => {
      return Jimp.read(test).then(testImage => {
        let diff = Jimp.diff(baselineImage, testImage, 0.1)
        let distance = Jimp.distance(baselineImage, testImage)

        if (distance < 0.15 || diff.percent < 0.15) {
          return true
        }

        return false
      })
    }).catch(err => {
      console.error(err)
    })
}

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
  fs.stat(config.get('caching.directory.path'), function (err, stats) {
    if (!err) {
      fs.readdirSync(config.get('caching.directory.path')).forEach(function (dirname) {
        deleteFolderRecursive(path.join(config.get('caching.directory.path'), dirname))
      })
    }
  })
}
