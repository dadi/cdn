var fs = require('fs');
var logger = require('@dadi/logger')
var PassThrough = require('stream').PassThrough
var path = require('path');
var redis = require('redis');
var redisRStream = require('redis-rstream');
var redisWStream = require('redis-wstream');
var sha1 = require('sha1');
var _ = require('underscore');
var async = require('async');

var config = require(__dirname + '/../../../config');

var Cache = function() {
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');
  this.dir = config.get('caching.directory.path');

  this.redisClient = null;
  this.initRedisClient();

  logger.info({module: 'cache'}, 'Cache logging started');

  if (config.get('caching.directory.enabled') && !fs.existsSync(this.dir)) {
    fs.mkdirSync(this.dir);
  }
};

var instance;
module.exports = function() {
  if (!instance) {
    instance = new Cache();
  }
  return instance;
};

// reset method for unit tests
module.exports.reset = function() {
  instance = null;
};

// get method for redis client
Cache.prototype.client = function() {
  if (instance) return instance.redisClient;
  return null;
};

/**
 * Create a Redis Client with configuration
 */
Cache.prototype.initRedisClient = function () {
  if (!config.get('caching.redis.enabled')) return;

  var self = this;

  if (this.redisClient) {
    if (this.redisClient.connection_option.port !== config.get('caching.redis.port') ||
      this.redisClient.connection_option.host !== config.get('caching.redis.host')) {
      this.redisClient.end(true);
      this.redisClient = null;
    } else {
      return;
    }
  }

  this.redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {
    detect_buffers: true
  })

  this.redisClient.on("error", function (err) {
    console.log("Error " + err);
    logger.error({module: 'cache'}, err);

    if (err.code === 'CONNECTION_BROKEN' || err.code === 'ECONNREFUSED') {
      logger.warn({module: 'cache'}, 'Resetting Redis client and cache instance. Falling back to directory cache.');

      // close the existing client
      self.redisClient.end(true);
      self.redisClient = null;

      // modify config
      config.set('caching.redis.enabled', false)
      config.set('caching.directory.enabled', true)

      // restart the cache
      instance = new Cache();
    }
  }).on("connect", function () {
    logger.info({module: 'cache'}, 'Redis client connected')
  });

  if (config.get('caching.redis.password')) {
    this.redisClient.auth(config.get('caching.redis.password'), function () {
      logger.info({module: 'cache'}, 'Redis client connected and authenticated')
    });
  }
};

Cache.prototype.cacheFile = function(stream, key, cb) {
  var self = this;

  if (!self.enabled) return cb(stream)

  var settings = config.get('caching');
  var encryptedKey = sha1(key);

  var cacheStream = PassThrough()
  var responseStream = PassThrough()
  stream.pipe(cacheStream)
  stream.pipe(responseStream)

  if (settings.redis.enabled) {
    var redisWriteStream = redisWStream(self.redisClient, encryptedKey)
    redisWriteStream.on('finish', function () {
      if (settings.ttl) {
        self.redisClient.expire(encryptedKey, settings.ttl);
      }
      console.log('cache write finished')
      return cb(responseStream);
    }).on('error', function(err) {
      logger.error({module: 'cache'}, err)
    })

    cacheStream.pipe(redisWriteStream)
  }
  else {
    var cacheDir = path.resolve(settings.directory.path);
    var file = fs.createWriteStream(path.join(cacheDir, encryptedKey));
    file.on('error', function (err) {
      logger.error({module: 'cache'}, err);
    })

   cacheStream.pipe(file);
   return cb(stream);
  }
}

Cache.prototype.get = function(key, cb) {
  var self = this;
    if (!self.enabled) return cb(null)

  var settings = config.get('caching');
  var encryptedKey = sha1(key);

  if (settings.redis.enabled) {
    self.redisClient.exists(encryptedKey, function(err, exists) {
      if (exists > 0) {
        var stream = redisRStream(self.redisClient, encryptedKey);
        return cb(stream);
      }
      else {
        return cb(null);
      }
    })
  }
  else {
    var cachePath = path.join(self.dir, encryptedKey);

    fs.stat(cachePath, function (err, stats) {
      if (err) {
        return cb(null);
      }

      var lastMod = stats && stats.mtime && stats.mtime.valueOf();

      if (settings.ttl && lastMod && (Date.now() - lastMod) / 1000 <= settings.ttl) {
        var stream = fs.createReadStream(cachePath);
        return cb(stream);
      }
      else {
        return cb(null);
      }
    })
  }
}

module.exports.delete = function(pattern, callback) {
  var iter = '0';
  pattern = pattern+"*";
  var cacheKeys = [];
  var self = this;

  async.doWhilst(
    function (acb) {
      //scan with the current iterator, matching the given pattern
      self.client().scan(iter, 'MATCH', pattern, function (err, result) {
        if (err) {
          acb(err);
        }
        else {
          //update the iterator
          iter = result[0];
          async.each(result[1],
            //for each key
            function (key, ecb) {
              cacheKeys.push(key);
              return ecb(err);
            },
            function (err) {
              //done with this scan iterator; on to the next
              return acb(err);
            }
          )
        }
      });
    },
    //test to see if iterator is done
    function () { return iter != '0'; },
    //done
    function (err) {
      if (err) {
        console.log("Error:", err);
      }
      else {
        if (cacheKeys.length === 0) {
          return callback(null);
        }

        var i = 0;
        _.each(cacheKeys, function(key) {
          self.client().del(key, function (err, result) {
            i++;
            // finished, all keys deleted
            if (i === cacheKeys.length) {
              return callback(null);
            }
          });
        });
      }
    }
  );
}
