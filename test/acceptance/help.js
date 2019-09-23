const fs = require('fs-extra')
const http = require('http')
const httpProxy = require('http-proxy')
const Jimp = require('jimp')
const path = require('path')
const should = require('should')
const config = require(__dirname + '/../../config')
const request = require('supertest')
const req = require('request')
const url = require('url')

const cdnUrl = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

module.exports.cdnUrl = cdnUrl

module.exports.createTempFile = function(filePath, content, options, callback) {
  return fs
    .ensureDir(path.dirname(path.resolve(filePath)))
    .then(() => {
      if (typeof options === 'function') {
        callback = options
        options = {}
      }

      const serialisedContent =
        typeof content === 'string' ? content : JSON.stringify(content, null, 2)

      return fs.writeFile(filePath, serialisedContent)
    })
    .then(() => {
      const removeFn = () => fs.removeSync(filePath)

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          callback(removeFn, content)

          resolve()
        }, options.interval || 0)
      })
    })
}

module.exports.imagesEqual = function({base, headers, test}) {
  const fullBasePath = path.resolve(base)

  if (test.indexOf('/') === 0) {
    test = `http://${config.get('server.host')}:${config.get(
      'server.port'
    )}${test}`
  }

  return Jimp.read(fullBasePath)
    .then(baselineImage => {
      return Jimp.read(test).then(testImage => {
        const diff = Jimp.diff(baselineImage, testImage, 0.1)
        const distance = Jimp.distance(baselineImage, testImage)

        if (distance < 0.15 || diff.percent < 0.15) {
          return Promise.resolve(true)
        }

        return Promise.resolve(false)
      })
    })
    .catch(err => {
      console.error(err)
    })
}

module.exports.filesEqual = function({base, headers, test}) {
  const fullBasePath = path.resolve(base)

  if (test.indexOf('/') === 0) {
    test = `http://${config.get('server.host')}:${config.get(
      'server.port'
    )}${test}`
  }

  const getFileContents = fileName => {
    return new Promise((resolve, reject) => {
      fs.readFile(fileName, (err, data) => {
        return err ? reject(err) : resolve(data.toString())
      })
    })
  }

  const getRemoteFileContents = url => {
    return new Promise((resolve, reject) => {
      require('http').get(url, res => {
        let string = ''

        res.on('data', chunk => {
          string += chunk.toString()
        })

        res.on('end', () => {
          return resolve(string)
        })
      })
    })
  }

  return getFileContents(fullBasePath)
    .then(baselineFile => {
      return getRemoteFileContents(test).then(testFile => {
        return testFile === baselineFile
      })
    })
    .catch(err => {
      console.error(err)
    })
}

module.exports.getBearerToken = function(domain, done) {
  if (typeof domain === 'function') {
    done = domain
    domain = 'localhost'
  }

  request(
    'http://' + config.get('server.host') + ':' + config.get('server.port')
  )
    .post(config.get('auth.tokenUrl'))
    .set('host', `${domain}:80`)
    .send({
      clientId: 'test',
      secret: 'test'
    })
    .expect(200)
    // .expect('content-type', 'application/json')
    .end(function(err, res) {
      if (err) return done(err)

      const bearerToken = res.body.accessToken

      should.exist(bearerToken)
      done(null, bearerToken)
    })
}

module.exports.clearCache = function() {
  const deleteFolderRecursive = function(filepath) {
    if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
      fs.readdirSync(filepath).forEach(function(file, index) {
        const curPath = filepath + '/' + file

        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          deleteFolderRecursive(curPath)
        } else {
          // delete file
          try {
            fs.unlinkSync(path.resolve(curPath))
          } catch (err) {
            // no-op
          }
        }
      })
      fs.rmdirSync(filepath)
    } else {
      try {
        fs.unlinkSync(filepath)
      } catch (err) {
        // no-op
      }
    }
  }

  // for each directory in the cache folder, remove all files then
  // delete the folder
  fs.stat(config.get('caching.directory.path'), function(err, stats) {
    if (!err) {
      fs.readdirSync(config.get('caching.directory.path')).forEach(function(
        dirname
      ) {
        deleteFolderRecursive(
          path.join(config.get('caching.directory.path'), dirname)
        )
      })
    }
  })
}

// Proxy server, useful for testing multi-domain. It forwards
// requests to the main CDN URL, modifying the `Host` header to
// contain whatever value is sent in the `mockdomain` URL parameter.
//
// Example: http://{proxyUrl}/test.jpg?mockdomain=testdomain.com will
// be forwarded to http://{cdnUrl}/test.jpg with `Host: testdomain.com`.
const proxyPort = config.get('server.port') + 1
const proxyUrl = `http://localhost:${proxyPort}`
const proxy = httpProxy.createProxyServer({})

proxy.on('proxyReq', (proxyReq, req, res, options) => {
  const parsedUrl = url.parse(req.url, true)
  const mockDomain = parsedUrl.query.mockdomain

  parsedUrl.search = null
  delete parsedUrl.query.mockdomain

  proxyReq.path = url.format(parsedUrl)
  proxyReq.setHeader('Host', mockDomain)
})

const proxyServer = http.createServer((req, res) => {
  proxy.web(req, res, {
    target: cdnUrl
  })
})

module.exports.proxyStart = () => {
  return new Promise((resolve, reject) => {
    proxyServer.listen(proxyPort, resolve)
  })
}

module.exports.proxyStop = () => {
  return new Promise((resolve, reject) => {
    proxyServer.close(resolve)
  })
}

module.exports.proxyUrl = proxyUrl
