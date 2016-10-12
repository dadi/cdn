var path = require('path')
var sha1 = require('sha1')

var Busboy = require('busboy')
var config = require(path.join(__dirname, '/../../../config'))
var HandlerFactory = require(path.join(__dirname, '/../handlers/factory'))
var help = require(path.join(__dirname, '/../help'))
var PassThrough = require('stream').PassThrough

module.exports.post = (req, res) => {
  var busboy = new Busboy({ headers: req.headers })
  this.data = []
  this.fileName = ''

  // Listen for event when Busboy finds a file to stream
  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    this.fileName = filename
    this.mimetype = mimetype

    file.on('data', (chunk) => {
      this.data.push(chunk)
    })

    file.on('end', () => {
      // console.log('Finished with ' + fieldname)
    })
  })

  // Listen for event when Busboy finds a non-file field
  busboy.on('field', (fieldname, val) => {
    // Do something with non-file field.
  })

  // Listen for event when Busboy is finished parsing the form
  busboy.on('finish', () => {
    return writeFile(req, this.fileName, this.mimetype, this.data).then((result) => {
      help.sendBackJSON(201, result, res)
    })
  })

  // Pipe the HTTP Request into Busboy
  req.pipe(busboy)
}

function writeFile (req, fileName, mimetype, data) {
  return new Promise((resolve, reject) => {
    var bufferStream = new PassThrough()
    bufferStream.end(Buffer.concat(data))

    req.url = fileName

    var folderPath = getPath(fileName)

    new HandlerFactory().create(req, mimetype).then((handler) => {
      handler.put(bufferStream, folderPath).then((result) => {
        return resolve(result)
      }).catch((err) => {
        return reject(err)
      })
    })
  })
}

function getPath (fileName) {
  var settings = config.get('upload')
  var reSplitter

  switch (settings.pathFormat) {
    case 'sha1/4':
      reSplitter = new RegExp('.{1,4}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'sha1/5':
      reSplitter = new RegExp('.{1,5}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'sha1/8':
      reSplitter = new RegExp('.{1,8}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'date':
      return formatDate()
    case 'datetime':
      return formatDate(true)
    default:
      return ''
  }
}

function formatDate (includeTime) {
  var d = new Date()
  var dateParts = [
    d.getFullYear(),
    ('0' + (d.getMonth() + 1)).slice(-2),
    ('0' + d.getDate()).slice(-2)
  ]

  if (includeTime) {
    dateParts.push(d.getHours())
    dateParts.push(d.getMinutes())
    dateParts.push(d.getSeconds())
  }

  return dateParts.join('/')
}
