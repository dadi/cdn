var AWS = require('aws-sdk')
var Promise = require('bluebird')
var stream = require('stream')
var _ = require('underscore')

var logger = require('@dadi/logger')
var Missing = require(__dirname + '/missing')
var config = require(__dirname + '/../../../config')

var S3Storage = function (settings, url) {
  var self = this

  AWS.config.setPromisesDependency(require('bluebird'))
  AWS.config.update({ accessKeyId: settings.s3.accessKey, secretAccessKey: settings.s3.secretKey })

  if (settings.s3.region && settings.s3.region != '') {
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
    }
    else if (self.url.substring(0,1) === '/') {
      url = self.url.substring(1)
    } else {
      url = self.url
    }

    return decodeURIComponent(url)
  }

  this.urlParts = function () {
    if (self.url.indexOf('/s3') === 0) {
      return self.url.replace('/s3', '').split('/')
    }
    else if (self.url.substring(0,1) === '/') {
      return self.url.substring(1).split('/')
    } else {
      return self.url.split('/')
    }
  }
}

S3Storage.prototype.getFullUrl = function () {
  return self.url.replace('/s3', '')
}

S3Storage.prototype.getLastModified = function () {
  return this.lastModified
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

module.exports = function (settings, url) {
  return new S3Storage(settings, url)
}

module.exports.S3Storage = S3Storage
