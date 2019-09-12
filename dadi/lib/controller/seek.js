'use strict'

/*
https://github.com/glebec/send-seekable#readme
*/

const rangeStream = require('range-stream')
const parseRange = require('range-parser')
const sbuff = require('simple-bufferstream')

module.exports = function(req, res, next) {
  // every new request gets a thin wrapper over the generic function
  res.sendSeekable = function(stream, config) {
    return sendSeekable(stream, config, req, res, next)
  }

  next()
}

// the generic handler for serving up partial streams
function sendSeekable(stream, config, req, res, next) {
  if (stream instanceof Buffer) {
    config = config || {}
    config.length = stream.length
    stream = sbuff(stream)
  }

  if (!config.length) {
    const err = new Error('send-seekable requires `length` option')

    return next(err)
  }

  // indicate this resource can be partially requested
  res.setHeader('Accept-Ranges', 'bytes')

  // incorporate config
  if (config.length) res.setHeader('Content-Length', config.length)
  if (config.type) res.setHeader('Content-Type', config.type)

  // if this is a partial request
  if (req.headers.range) {
    // parse ranges
    const ranges = parseRange(config.length, req.headers.range)

    if (ranges === -2) {
      res.statusCode = 400

      return res.end() // malformed range
    }

    if (ranges === -1) {
      // unsatisfiable range
      res.setHeader('Content-Range', '*/' + config.length)
      res.statusCode = 416

      return res.end()
    }

    if (ranges.type !== 'bytes') {
      return stream.pipe(res)
    }

    if (ranges.length > 1) {
      return next(new Error('send-seekable can only serve single ranges'))
    }

    const start = ranges[0].start
    const end = ranges[0].end

    // formatting response
    res.statusCode = 206
    res.setHeader('Content-Length', end - start + 1) // end is inclusive
    res.setHeader(
      'Content-Range',
      'bytes ' + start + '-' + end + '/' + config.length
    )

    // slicing the stream to partial content
    stream = stream.pipe(rangeStream(start, end))
  }

  return stream.pipe(res)
}
