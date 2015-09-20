var request = require('request');
var _ = require('underscore');
var http = require('http');
var bodyParser = require('body-parser');
var finalhandler = require('finalhandler');
var crypto = require('crypto');

var Router = require('router');
var router = Router();

var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var url = require('url');

var fs = require('fs');
var path = require('path');
var Finder = require('fs-finder');

var imagemagick = require('imagemagick-native');
var redis  = require("redis");
var redisWStream = require('redis-wstream');
var redisRStream = require('redis-rstream');
var AWS = require('aws-sdk');
var cloudfront = require('cloudfront');

var configPath = path.resolve(__dirname + '/../../config.json');
var config = require(configPath);

var recipePath = path.resolve(__dirname + '/../../workspace/recipes/recipe.json');
var recipe = require(recipePath);

var Server = function() {
  this.s3 = null;
  this.client = null;
};

var cf = cloudfront.createClient(config.cloudfront.accessKey, config.cloudfront.secretKey);

Server.prototype.start = function(options, done) {
  var self = this;

  //Init S3 Instance
  if(config.images.s3) {
    this.initS3Bucket();
  }

  //Init Redis client
  if(config.caching.redis) {
    this.initRedisClient();
  }
  
  //Authentication middleware
  function isAuthenticated(req, res, next) {
    // check header or url parameters or post parameters for token
    var query = url.parse( req.url, true ).query;
    
    var token = query.token || req.headers['x-access-token'];
    

    // decode token
    if (token) {
      // verifies secret and checks exp
      jwt.verify(token, config.auth.secret, function(err, decoded) {      
        if (err) {
          res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
          res.setHeader('Expires', '-1');
          self.displayErrorPage(403, 'Failed to authenticate token.', res);
        } else {
          // if everything is good, save to request for use in other routes
          req.decoded = decoded;    
          next();
        }
      });

    } else {
      // if there is no token
      // return an error
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Expires', '-1');
      self.displayErrorPage(403, 'No token provided.', res);
      
    }
  };

  //Authentication router
  router.post('/authenticate', function(req, res) {
    var token = jwt.sign({client: config.auth.clientId}, config.auth.secret, {
      expiresInMinutes: 1440 // expires in 24 hours
    });

    // return the information including token as JSON
    res.end(JSON.stringify({
      success: true,
      message: 'Enjoy your token!',
      token: token
    }));
  });

  //Invalidation request middleware
  router.use('/api', isAuthenticated);

  router.use(bodyParser.json({ limit: '50mb' }));

  //Invalidation request
  router.post('/api', function(req, res) {
    if(req.body.invalidate) {
      var invalidate = req.body.invalidate.replace(/[\/.]/g, '');
      if(config.caching.redis) {
        self.client.keys("*"+invalidate+"*", function(err, data) {
          for(var i = 0; i < data.length; i++) {
            self.client.del(data[i]);
          }
          res.end('Success');
        });
      } else {
        var cacheDir = path.resolve(config.caching.directory);
        var files = Finder.in(cacheDir).findFiles('*'+invalidate+'*');
        _.each(files, function(file) {
          fs.unlinkSync(file);
        });
        res.end('Success');
      }
    }
  });


  router.get(/(.+)/, function (req, res) {

    var paramString = req.params[0].substring(1, req.params[0].length);
    if(paramString.split('/').length < 13 && paramString.split('/')[0] != recipe.recipe) {
      var errorMessage = '<p>Url path is invalid.</p><p>The valid url path format:</p><p>http://some-example-domain.com/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/Imagepath</p>';
      self.displayErrorPage(404, errorMessage, res);
    } else {
      if(paramString.split('/')[0] == recipe.recipe) {
        var url = paramString.substring(paramString.split('/')[0].length+1);
        var fileName = url.split('/')[url.split('/').length-1];
        var newFileName = url.replace(/[\/.]/g, '') + recipe.settings.format + 
            recipe.settings.quality + recipe.settings.trim + recipe.settings.trimFuzz + recipe.settings.width + recipe.settings.height +  
            recipe.settings.resizeStyle + recipe.settings.gravity + recipe.settings.filter + recipe.settings.blur + 
            recipe.settings.strip + recipe.settings.rotate + recipe.settings.flip + '.' + recipe.settings.format;
        var options = recipe.settings;
      } else {
        var optionsArray = paramString.split('/').slice(0, 13);
        var url = paramString.substring(optionsArray.join('/').length+1);
        var fileName = url.split('/')[url.split('/').length-1];
        var newFileName = url.replace(/[\/.]/g, '') + optionsArray.join('')+ '.' + optionsArray[0];

        var gravity = optionsArray[7].substring(0,1).toUpperCase() + optionsArray[7].substring(1);
        var filter = optionsArray[8].substring(0,1).toUpperCase() + optionsArray[8].substring(1);
        /*
        Options list
        format:[e.g. png, jpg]
        quality: [integer, 0>100]
        trim: [boolean 0/1]
        trimFuzz: [boolean 0/1]
        width: [integer]
        height: [integer]
        resizeStyle: [aspectfill/aspectfit/fill]
        gravity: ['NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast', 'None']
        filter: [e.g. 'Lagrange', 'Lanczos', 'none']
        blur: [integer 0>1, e.g. 0.8]
        strip: [boolean 0/1]
        rotate: [degrees]
        flip: [boolean 0/1]
        */
        var options = {
          format: optionsArray[0],
          quality: optionsArray[1],
          trim: optionsArray[2],
          trimFuzz: optionsArray[3],
          width: optionsArray[4],
          height: optionsArray[5],
          resizeStyle: optionsArray[6],
          gravity: gravity,
          filter:filter,
          blur:optionsArray[9],
          strip:optionsArray[10],
          rotate:optionsArray[11],
          flip:optionsArray[12]
        };
      }
      

      if(config.security.maxWidth&&config.security.maxWidth<options.width) options.width = config.security.maxWidth;
      if(config.security.maxHeight&&config.security.maxHeight<options.height) options.height = config.security.maxHeight;
      
      if(options.filter == 'None' || options.filter == 0) delete options.filter;
      if(options.gravity == 0) delete options.gravity;
      if(options.width == 0) delete options.width;
      if(options.height == 0) delete options.height;
      if(options.quality == 0) delete options.quality;
      if(options.trim == 0) delete options.trim;
      if(options.trimFuzz == 0) delete options.trimFuzz;
      if(options.resizeStyle == 0) delete options.resizeStyle;
      if(options.blur == 0) delete options.blur;
      if(options.strip == 0) delete options.strip;
      if(options.rotate == 0) delete options.rotate;
      if(options.flip == 0) delete options.flip;

      if(config.caching.redis) {
        self.client.exists(newFileName, function(err, exists) {
          if(exists>0) {
            redisRStream(self.client, newFileName).pipe(res);

            // Set cache header
            res.setHeader('X-Cache', 'HIT');

          } else {
            self.createNewConvertImage(url, newFileName, options, res);

            // Set cache header
            res.setHeader('X-Cache', 'MISS');
          }
        })
      } else {
        var cacheDir = path.resolve(config.caching.directory);
        if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
        var cachePath = path.join(cacheDir, newFileName);
        if(fs.existsSync(cachePath)) {
          fs.stat(cachePath, function(err, stats) {
            var lastMod = stats && stats.mtime && stats.mtime.valueOf();
            if(config.caching.ttl && lastMod && (Date.now() - lastMod)/1000<=config.caching.ttl){
              fs.createReadStream(cachePath).pipe(res);

              // Set cache header
              res.setHeader('X-Cache', 'HIT');
            } else {
              self.createNewConvertImage(url, newFileName, options, res);

              // Set cache header
              res.setHeader('X-Cache', 'MISS');
            }
          }); 
        } else {
          self.createNewConvertImage(url, newFileName, options, res);

          // Set cache header
          res.setHeader('X-Cache', 'MISS');
        }
      }
    }
  });
  
  var app = http.createServer(function(req, res) {
    res.setHeader('Server', 'Bantam / Barbu');
    if(config.clientCache.cacheControl) res.setHeader('Cache-Control', config.clientCache.cacheControl);
    if(config.clientCache.etag) res.setHeader('ETag', config.clientCache.etag);
    router(req, res, finalhandler(req, res));
  });

  app.listen(config.server.port);

  done && done();
};

/**
 * Init S3 with configuration
 */
Server.prototype.initS3Bucket = function() {
  AWS.config.update({
    accessKeyId: config.images.s3.accessKey,
    secretAccessKey: config.images.s3.secretKey,
  });
  this.s3 = new AWS.S3();
};

/**
 * Create a Redis Client with configuration
 */
Server.prototype.initRedisClient = function() {
  this.client = redis.createClient(config.caching.redis.port, config.caching.redis.host, {return_buffers: true, detect_buffers: true})
  this.client.on("error", function (err) {
    console.log("Error " + err);
  }).on("connect", function() {
    console.log('Redis client Connected');
  })
  if(config.caching.redis.password) {
    this.client.auth(config.caching.redis.password, function () {
      console.log('Redis client connected');
    })
  }
};

/**
 * Display Error Page
 * status: status code
 * errorMessage: Error Message to display in the error page.
 */
Server.prototype.displayErrorPage = function(status, errorMessage, res) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html');
  res.write('<h1>Server Error</h1>');
  res.write('<pre>' + errorMessage+ '</pre>');
  res.end();
}
/**
 * Convert image and store in local disk or Redis.
 * readStream: read stream from S3, local disk and url
 * fileName: file name to store converted image data
 * options: convert options
 */
Server.prototype.convertAndSave = function(readStream, fileName, options, res) {
  var self = this;
  var magickVar = imagemagick.streams.convert(options);
  magickVar.on('error', function(error) {
    self.displayErrorPage(404, error, res);
  });
  readStream.pipe(magickVar).pipe(res)
  if(config.caching.redis) {
    self.client.on("error", function (err) {
      self.displayErrorPage(404, err, res);
    });
    //Save to redis
    magickVar.pipe(redisWStream(self.client, fileName)).on('finish', function() {
      if(config.caching.ttl) {
        self.client.expire(fileName, config.caching.ttl);
      }
    }); 
  } else {
    var cacheDir = path.resolve(config.caching.directory);
    var file = fs.createWriteStream(path.join(cacheDir, fileName));
    file.on('error', function (err) {
      self.displayErrorPage(404, err, res);
    })
    magickVar.pipe(file);
  }
};

/**
 * Convert new image
 */
Server.prototype.createNewConvertImage = function(url, newFileName, options, res) {
  var self = this;
  if(url.length>0) {
    if (config.images.remote) { // Load image from http or https url
      url = config.images.remote + '/' + url;
      request({ url: url }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          self.convertAndSave(request({ url: url}), newFileName, options, res);
        } else {
          self.displayErrorPage(404, 'Image path not valid.', res);
        }
      })
    } else if(config.images.s3) { //Load image from S3
        self.s3.getObject({ Bucket: config.images.s3.bucketName, Key: url}, function(err, data) {
          if(err) {
            self.displayErrorPage(404, err, res);
          } else {
            var s3ReadStream = self.s3.getObject({ Bucket: config.images.s3.bucketName, Key: url}).createReadStream();
            self.convertAndSave(s3ReadStream, newFileName, options, res);
          }
        })
    } else { // Load image from local disk
      var imageDir = path.resolve(config.images.directory);
      url = path.join(imageDir, url);
      if(fs.existsSync(url)) {
        var fsReadStream = fs.createReadStream(url);
        self.convertAndSave(fsReadStream, newFileName, options, res);
      } else {
        self.displayErrorPage(404, 'File not exist.', res);
      }
    }
  } else {
    self.displayErrorPage(404, 'Image path not exist.', res);
  }
};

module.exports = new Server();

function encrypt(text){
  var cipher = crypto.createCipher('aes-256-cbc','d6F3Efeq')
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
function decrypt(text){
  var decipher = crypto.createDecipher('aes-256-cbc','d6F3Efeq')
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}
