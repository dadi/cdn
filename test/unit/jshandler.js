const fs = require('fs')
const path = require('path')
const Readable = require('stream').Readable
const should = require('should')
const sinon = require('sinon')

const Cache = require(__dirname + '/../../dadi/lib/cache')
const DiskStorage = require(__dirname + '/../../dadi/lib/storage/disk').DiskStorage
const JSHandler = require(__dirname + '/../../dadi/lib/handlers/js')

const mockRequest = (url, browser) => {
  let request = {
    headers: {},
    url
  }

  switch (browser) {
    case 'chrome-65':
      request.headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.146 Safari/537.36'

      break

    case 'ie-9':
      request.headers['user-agent'] = 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)'

      break
  }

  return request
}

const makeStream = string => {
  const stream = new Readable()

  stream._read = () => {}

  stream.push(string)
  stream.push(null)

  return stream
}

const readStream = stream => {
  return new Promise((resolve, reject) => {
    let output = ''

    stream.on('data', chunk => {
      output += chunk
    })

    stream.on('end', () => {
      resolve(output)
    })
  })
}

describe('JS handler', function () {
  let mockCacheGet = sinon.spy(Cache.Cache.prototype, 'getStream')

  beforeEach(() => {
    mockCacheGet.reset()
  })

  afterEach(() => {
    mockDiskStorageGet.restore()
  })

  after(() => {
    mockCacheGet.restore()
  })

  describe('legacy URL syntax', () => {
    it('reads the correct file from the URL path', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/js/0/foo.js'))

      return jsHandler.get().then(readStream).then(out => {
        mockCacheGet.getCall(0).args[0].should.eql('/foo.js')

        out.should.eql(mockJsFile)
      })
    })

    it('delivers the compressed JS file', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/js/1/foo.js'))

      return jsHandler.get().then(readStream).then(out => {
        mockCacheGet.getCall(0).args[0].should.eql('/foo.js')

        out.should.eql('const greeter=(a)=>`Hello, ${a}`;')
      })
    })
  })

  it('reads the correct file from the URL path', () => {
    const mockJsFile = [
      'const greeter = name => {',
      '  return \`Hello, \${name}\`;',
      '};'
    ].join('\n')

    mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

    const jsHandler = new JSHandler('.js', mockRequest('/foo.js'))

    return jsHandler.get().then(readStream).then(out => {
      mockCacheGet.getCall(0).args[0].should.eql('/foo.js')

      out.should.eql(mockJsFile)
    })
  })

  it('delivers the compressed JS file', () => {
    const mockJsFile = [
      'const greeter = name => {',
      '  return \`Hello, \${name}\`;',
      '};'
    ].join('\n')

    mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

    const jsHandler = new JSHandler('.js', mockRequest('/foo.js?compress=1'))

    return jsHandler.get().then(readStream).then(out => {
      mockCacheGet.getCall(0).args[0].should.eql('/foo.js?compress=1')

      out.should.eql('const greeter=(a)=>`Hello, ${a}`;')
    })
  })

  describe('transpiling', () => {
    it('delivers transpiled JS for browsers that do not support original features', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/foo.js?transform=1', 'ie-9'))

      return jsHandler.get().then(readStream).then(out => {
        out.should.eql(
          [
            '"use strict";',
            '',
            'var greeter = function greeter(name) {',
            '  return "Hello, " + name;',
            '};'
          ].join('\n')
        )
      })
    })

    it('delivers transpiled JS when the user agent header is missing', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/foo.js?transform=1'))

      return jsHandler.get().then(readStream).then(out => {
        out.should.eql(
          [
            '"use strict";',
            '',
            'var greeter = function greeter(name) {',
            '  return "Hello, " + name;',
            '};'
          ].join('\n')
        )
      })
    })

    it('delivers transpiled JS when the user agent has not been matched to a valid browser target', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/foo.js?transform=1', 'some funky user agent'))

      return jsHandler.get().then(readStream).then(out => {
        out.should.eql(
          [
            '"use strict";',
            '',
            'var greeter = function greeter(name) {',
            '  return "Hello, " + name;',
            '};'
          ].join('\n')
        )
      })
    })

    it('delivers untouched JS for browsers that support original features', () => {
      const mockJsFile = [
        'const greeter = name => {',
        '  return \`Hello, \${name}\`;',
        '};'
      ].join('\n')

      mockDiskStorageGet = sinon.stub(DiskStorage.prototype, 'get').resolves(makeStream(mockJsFile))

      const jsHandler = new JSHandler('.js', mockRequest('/foo.js?transform=1', 'chrome-65'))

      return jsHandler.get().then(readStream).then(out => {
        out.should.eql('"use strict";\n\n' + mockJsFile)
      })
    })
  })
})
