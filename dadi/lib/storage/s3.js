const AWS = require('aws-sdk')
const config = require('./../../../config')
const path = require('path')
const stream = require('stream')

const logger = require('@dadi/logger')
const Missing = require(path.join(__dirname, '/missing'))

const S3Storage = function ({assetType = 'assets', domain, url}) {
  this.providerType = 'Amazon S3'

  AWS.config.update({
    accessKeyId: config.get(`${assetType}.s3.accessKey`),
    secretAccessKey: config.get(`${assetType}.s3.secretKey`),
    s3ForcePathStyle: config.get(`${assetType}.s3.pathStyle`)
  })

  let region = config.get(`${assetType}.s3.region`)
  let endpoint = config.get(`${assetType}.s3.endpoint`)

  if (region !== '') {
    AWS.config.update({region})
  }

  // Allow configuration of endpoint for Digital Ocean Spaces
  if (endpoint !== '') {
    AWS.config.update({endpoint})

    this.providerType = 'DigitalOcean'
  }

  this.bucketName = config.get(`${assetType}.s3.bucketName`)
  this.domain = domain
  this.url = url
  this.urlParts = this.getUrlParts(url)
  this.s3 = new AWS.S3()
}

S3Storage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    let requestData = {
      Bucket: this.getBucket(),
      Key: this.getKey()
    }

    logger.info(`${this.providerType} Request (${this.url}):${JSON.stringify(requestData)}`)

    if (requestData.Bucket === '' || requestData.Key === '') {
      let err = {
        statusCode: 400,
        message: 'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }
      return reject(err)
    }

    // create the AWS.Request object
    let request = this.s3.getObject(requestData)

    let promise = request.promise()

    promise.then(data => {
      if (data.LastModified) {
        this.lastModified = data.LastModified
      }

      let bufferStream = new stream.PassThrough()
      bufferStream.push(data.Body)
      bufferStream.push(null)
      resolve(bufferStream)
    },
    (error) => {
      if (error.statusCode === 404) {
        return new Missing().get({
          domain: this.domain,
          isDirectory: path.parse(this.getFullUrl()).ext === ''
        }).then(stream => {
          this.notFound = true
          this.lastModified = new Date()
          return resolve(stream)
        }).catch(err => {
          return reject(err)
        })
      }

      return reject(error)
    })
  })
}

S3Storage.prototype.getBucket = function () {
  // If the URL starts with /s3, it means the second parameter
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

module.exports = S3Storage
module.exports.S3Storage = S3Storage
