const AWS = require('aws-sdk')
const concat = require('concat-stream')
const config = require('./../../../config')
const lengthStream = require('length-stream')
const path = require('path')
const stream = require('stream')

const logger = require('@dadi/logger')
const Missing = require(path.join(__dirname, '/missing'))

const S3Storage = function ({assetType = 'assets', url}) {
  AWS.config.setPromisesDependency(require('bluebird'))
  AWS.config.update({
    accessKeyId: config.get(`${assetType}.s3.accessKey`),
    secretAccessKey: config.get(`${assetType}.s3.secretKey`)
  })

  let region = config.get(`${assetType}.s3.region`)

  if (region && region !== '') {
    AWS.config.update({
      region
    })
  }

  this.bucketName = config.get(`${assetType}.s3.bucketName`)
  this.url = url
  this.urlParts = this.getUrlParts(url)
  this.s3 = new AWS.S3()
}

S3Storage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    var requestData = {
      Bucket: this.getBucket(),
      Key: this.getKey()
    }

    logger.info('S3 Request (' + this.url + '):' + JSON.stringify(requestData))

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

S3Storage.prototype.getBucket = function () {
  // If the URL start with /s3, it means the second parameter
  // is the name of the bucket.
  if (this.url.indexOf('/s3') === 0) {
    return this.urlParts[0]
  }

  return this.bucketName
}

S3Storage.prototype.getFullUrl = function () {
  return this.url
}

S3Storage.prototype.getKey = function () {
  // If the URL start with /s3, it means the second parameter
  // is the name of the bucket. Let's strip that out.
  if (this.url.indexOf('/s3') === 0) {
    return decodeURIComponent(
      this.urlParts.slice(1).join('/')
    )
  }

  return decodeURIComponent(
    this.urlParts.join('/')
  )
}

S3Storage.prototype.getLastModified = function () {
  return this.lastModified
}

S3Storage.prototype.getUrlParts = function (url) {
  let canonicalUrl = url

  if (canonicalUrl.indexOf('/s3/') === 0) {
    canonicalUrl = canonicalUrl.replace('/s3/', '')
  }

  if (canonicalUrl.substring(0, 1) === '/') {
    canonicalUrl = canonicalUrl.substring(1)
  }

  return canonicalUrl.split('/').filter(Boolean)
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

module.exports = S3Storage
module.exports.S3Storage = S3Storage
