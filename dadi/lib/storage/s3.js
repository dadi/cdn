var _ = require('underscore')
var AWS = require('aws-sdk')
var concat = require('concat-stream')
var lengthStream = require('length-stream')
var path = require('path')
var stream = require('stream')

var logger = require('@dadi/logger')
var Missing = require(path.join(__dirname, '/missing'))

var S3Storage = function (settings, url) {
  var self = this

  AWS.config.setPromisesDependency(require('bluebird'))
  AWS.config.update({ accessKeyId: settings.s3.accessKey, secretAccessKey: settings.s3.secretKey })

  if (settings.s3.region && settings.s3.region !== '') {
    AWS.config.update({ region: settings.s3.region })
  }

  this.url = url
  this.s3 = new AWS.S3()

  this.getBucket = function () {
    if (self.url.indexOf('s3') > 0) {
      return _.compact(self.urlParts())[0]
    } else {
      return settings.s3.bucketName
    }
  }

  this.getKey = function () {
    var url

    if (self.url.indexOf('s3') > 0) {
      var parts = _.compact(self.urlParts())
      parts.shift()
      url = parts.join('/')
    } else if (self.url.substring(0, 1) === '/') {
      url = self.url.substring(1)
    } else {
      url = self.url
    }

    return decodeURIComponent(url)
  }

  this.urlParts = function () {
    if (self.url.indexOf('/s3') === 0) {
      return self.url.replace('/s3', '').split('/')
    } else if (self.url.substring(0, 1) === '/') {
      return self.url.substring(1).split('/')
    } else {
      return self.url.split('/')
    }
  }
}

S3Storage.prototype.getFullUrl = function () {
  return this.url.replace('/s3', '')
}

S3Storage.prototype.getLastModified = function () {
  return this.lastModified
}

S3Storage.prototype.remove = function (fileName) {
  return new Promise((resolve, reject) => {
    var requestData = {
      Bucket: this.getBucket(),
      Key: fileName
    }

    logger.info('S3 Remove Request (' + this.url + '):' + JSON.stringify(requestData))

    if (requestData.Bucket === '' || requestData.Key === '') {
      var err = {
        statusCode: 400,
        message: 'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }
      return reject(err)
    }

    var request = this.s3.deleteObject(requestData)
    var promise = request.promise()
    promise.then(data => resolve(data), error => reject(error))
  })
}

S3Storage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    var requestData = {
      Bucket: this.getBucket(),
      Key: this.getKey()
    }

    logger.info('S3 Get Request (' + this.url + '):' + JSON.stringify(requestData))

    if (requestData.Bucket === '' || requestData.Key === '') {
      var err = {
        statusCode: 400,
        message: 'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }
      return reject(err)
    }

    // create the AWS.Request object
    var request = this.s3.getObject(requestData)

    var promise = request.promise()

    promise.then((data) => {
      if (data.LastModified) {
        this.lastModified = data.LastModified
      }

      var bufferStream = new stream.PassThrough()
      bufferStream.push(data.Body)
      bufferStream.push(null)
      resolve(bufferStream)
    },
    (error) => {
      if (error.statusCode === 404) {
        return new Missing().get().then((stream) => {
          this.notFound = true
          this.lastModified = new Date()
          return resolve(stream)
        }).catch((e) => {
          return reject(e)
        })
      }

      return reject(error)
    })
  })
}

/**
 *
 */
S3Storage.prototype.put = function (stream, folderPath) {
  return new Promise((resolve, reject) => {
    var fullPath = this.getKey().replace(path.basename(this.getKey()), path.join(folderPath, path.basename(this.getKey())))

    var requestData = {
      Bucket: this.getBucket(),
      Key: fullPath
    }

    if (requestData.Bucket === '' || requestData.Key === '') {
      var err = {
        statusCode: 400,
        statusText: 'Bad Request',
        message: 'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }
      return reject(err)
    }

    var contentLength = 0

    function lengthListener (length) {
      contentLength = length
    }

    // receive the concatenated buffer and send the response
    // unless the etag hasn't changed, then send 304 and end the response
    var sendBuffer = (buffer) => {
      requestData.Body = buffer
      requestData.ContentLength = contentLength

      logger.info('S3 PUT Request:' + JSON.stringify({
        Bucket: requestData.Bucket,
        Key: requestData.Key,
        // fileName: fileName,
        ContentLength: requestData.ContentLength
      }))

      // create the AWS.Request object
      var putObjectPromise = this.s3.putObject(requestData).promise()

      putObjectPromise.then((data) => {
        data.message = 'File uploaded'
        data.path = requestData.Key
        data.awsUrl = `https://${requestData.Bucket}.s3.amazonaws.com/${requestData.Key}`

        return resolve(data)
      }).catch((error) => {
        console.log(error)
        return reject(error)
      })
    }

    var concatStream = concat(sendBuffer)

    // send the file stream through:
    // 1) lengthStream to obtain contentLength
    // 2) concatStream to get a buffer, which then passes the buffer to sendBuffer
    // for sending to AWS
    stream.pipe(lengthStream(lengthListener)).pipe(concatStream)
  })
}

module.exports = function (settings, url) {
  return new S3Storage(settings, url)
}

module.exports.S3Storage = S3Storage
