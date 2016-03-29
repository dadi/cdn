var fs = require('fs');
var path = require('path');
var redis = require('redis');
var redisWStream = require('redis-wstream');
var _ = require('underscore');
var async = require('async');

var config = require(__dirname + '/../../../config');

var Cache = function() {
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');
  this.dir = config.get('caching.directory.path');

  this.redisClient = null;
  this.initRedisClient();

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
module.exports.client = function() {
  if (instance) return instance.redisClient;
  return null;
};

/**
 * Create a Redis Client with configuration
 */
Cache.prototype.initRedisClient = function () {
  if (!config.get('caching.redis.enabled')) return;

  var self = this;
  this.redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {
    detect_buffers: true
  });

  this.redisClient.on("error", function (err) {
    console.log("Error " + err);
  }).on("connect", function () {
    console.log('Redis client Connected');
  });

  if (config.get('caching.redis.password')) {
    this.redisClient.auth(config.get('caching.redis.password'), function () {
      console.log('Redis client connected');
    });
  }
};

Cache.prototype.cacheImage = function(convertedStream, encryptName, next) {
	var self = this;

	if (config.get('caching.redis.enabled')) {
    convertedStream.pipe(redisWStream(self.redisClient, encryptName)).on('finish', function () {
      if (config.get('caching.ttl')) {
        self.redisClient.expire(encryptName, config.get('caching.ttl'));
        next();
      }
    });
  } else {
    var cacheDir = path.resolve(config.get('caching.directory.path'));
    var file = fs.createWriteStream(path.join(cacheDir, encryptName));
    file.on('error', function (err) {

    });

    convertedStream.pipe(file);
    next();
  }
};

Cache.prototype.cacheJSCSSFiles = function(readStream, fileName, next) {
  var self = this;
  if (config.get('caching.redis.enabled')) {
    readStream.pipe(redisWStream(self.redisClient, fileName));

  } else {
    var fileOut = path.join(path.resolve(config.get('caching.directory.path')), fileName);
    var file = fs.createWriteStream(fileOut);
    readStream.pipe(file);
  }
  next();
};

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
