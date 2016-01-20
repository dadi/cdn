var _ = require('underscore');
var AWS = require('aws-sdk');
var bodyParser = require('body-parser');
var cloudfront = require('cloudfront');
var ColorThief = require('color-thief'),
    colorThief = new ColorThief();
var compressor = require('node-minify');
var crypto = require('crypto');
var finalhandler = require('finalhandler');
var Finder = require('fs-finder');
var fs = require('fs');
var http = require('http');
var imagemagick = require('imagemagick-native');
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var lengthStream = require('length-stream');
var path = require('path');
var redis = require("redis");
var redisWStream = require('redis-wstream');
var redisRStream = require('redis-rstream');
var request = require('request');
var sha1 = require('sha1');
var sharp = require('sharp');
var url = require('url');
var zlib = require('zlib');
var imagesize = require('imagesize');

var Router = require('router');
var router = Router();

var monitor = require(__dirname + '/monitor');

var configPath = path.resolve(__dirname + '/../../config.js');
var config = require(configPath);

var Server = function () {
    this.s3 = null;
    this.assetsS3 = null;
    this.client = null;
    this.monitors = {};
};

Server.prototype.start = function (options, done) {
    var self = this;

    //Monitor config.json file
    self.addMonitor(configPath, function (filename) {
        delete require.cache[configPath];
        config = require(configPath);

        //Init S3 Instance
        if (config.get('images.s3.enabled')) {
            self.initS3Bucket();
        }
        if (config.get('assets.s3.enabled')) {
            self.initS3AssettsBucket();
        }
        //Init Redis client
        if (config.get('caching.redis.enabled')) {
            self.initRedisClient();
        }
    });

    //Monitor recipes folders and files
    var recipeDir = path.resolve(__dirname + '/../../workspace/recipes');
    self.addMonitor(recipeDir, function (filename) {
        delete require.cache[recipeDir + '/' + filename];
    });

    //Init S3 Instance
    if (config.get('images.s3.enabled')) {
        this.initS3Bucket();
    }
    if (config.get('assets.s3.enabled')) {
        self.initS3AssetsBucket();
    }
    //Init Redis client
    if (config.get('caching.redis.enabled')) {
        this.initRedisClient();
    }

    //Authentication middleware
    function isAuthenticated(req, res, next) {
        // check header or url parameters or post parameters for token
        var query = url.parse(req.url, true).query;

        var token = query.token || req.headers['x-access-token'];


        // decode token
        if (token) {
            // verifies secret and checks exp
            jwt.verify(token, config.get('auth.secret'), function (err, decoded) {
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
    router.post('/authenticate', function (req, res) {
        var token = jwt.sign({client: config.get('auth.clientId')}, config.get('auth.secret'), {
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

    router.use(bodyParser.json({limit: '50mb'}));

    //Invalidation request
    router.post('/api', function (req, res) {
        if (req.body.invalidate) {
            var invalidate = req.body.invalidate.replace(/[\/.]/g, '');

            if (config.get('caching.redis.enabled')) {
                self.client.keys("*" + invalidate + "*", function (err, data) {
                    for (var i = 0; i < data.length; i++) {
                        self.client.del(data[i]);
                    }
                });
            } else {
                var cacheDir = path.resolve(config.get('caching.directory.path'));
                var files = Finder.in(cacheDir).findFiles('*' + invalidate + '*');
                _.each(files, function (file) {
                    fs.unlinkSync(file);
                });
            }
            if (config.get('cloudfront')) {
                var cf = cloudfront.createClient(config.get('cloudfront.accessKey'), config.get('cloudfront.secretKey'));
                cf.getDistribution(config.get('cloudfront.distribution'), function (err, distribution) {
                    var callerReference = (new Date()).toString();
                    distribution.invalidate(callerReference, ['/' + req.body.invalidate], function (err, invalidation) {
                        if (err) console.log(err)
                        console.log(invalidation);
                        res.end('Success');
                    });
                });
            } else {
                res.end('Success');
            }
        }
    });


    router.get(/(.+)/, function (req, res) {

        var paramString = req.params[0].substring(1, req.params[0].length);
        var returnJSON = false;
        if (paramString.split('/')[0] == 'js' || paramString.split('/')[0] == 'css') {
            var fileExt = paramString.split('/')[0];
            var compress = paramString.split('/')[1];
            var url = paramString.substring(paramString.split('/')[0].length + 3);
            var fileName = url.split('/')[url.split('/').length - 1];
            if(fileName.split('.').length == 1) fileName = fileName + '.' + fileExt;

            if (compress != 0 && compress != 1) {
                var error = '<p>Url path is invalid.</p><p>The valid url path format:</p><p>http://some-example-domain.com/{format-(js, css)}/{compress-(0, 1)}/JS,CSS file path</p>';
                self.displayErrorPage(404, error, res);
            } else {
                self.fetchOriginFileContent(url, fileName, fileExt, compress, res);
            }
        } else if(paramString.split('/')[0] == 'fonts') {
            var url = paramString.substring(paramString.split('/')[0].length + 1);
            var fileName = url.split('/')[url.split('/').length - 1];
            var fileExt = url.substring(url.lastIndexOf('.') + 1);
            var supportExts = ['ttf', 'otf', 'woff', 'svg', 'eot'];
            if(supportExts.indexOf(fileExt.toLowerCase()) < 0) {
                var error = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
                self.displayErrorPage(404, error, res);
            } else {
                self.fetchOriginFileContent(url, fileName, fileExt, 0, res);
            }
        } else {
            if (paramString.split('/').length < 15 && !fs.existsSync(path.resolve(__dirname + '/../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
                var errorMessage = '<p>Url path is invalid.</p><p>The valid url path format:</p><p>http://some-example-domain.com/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{crop-x}/{crop-y}/{ratio}/{devicePixelRatio}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/Imagepath</p>';
                self.displayErrorPage(404, errorMessage, res);
            } else {
                if (fs.existsSync(path.resolve(__dirname + '/../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
                    var recipePath = path.resolve(__dirname + '/../../workspace/recipes/' + paramString.split('/')[0] + '.json');
                    var recipe = require(recipePath);

                    var referencePath = recipe.path?recipe.path:'';
                    var url = referencePath + '/' + paramString.substring(paramString.split('/')[0].length + 1);

                    var fileName = url.split('/')[url.split('/').length - 1];
                    var fileExt = url.substring(url.lastIndexOf('.') + 1);
                    if(recipe.settings.format == 'js' || recipe.settings.format == 'css') {
                        if(fileName.split('.').length == 1) {
                            fileExt = recipe.settings.format;
                            fileName = fileName + '.' + fileExt;
                        }
                        var compress = recipe.settings.compress;
                        if (compress != 0 && compress != 1) {
                            var error = '<p>Compress value should be 0 or 1.</p>';
                            self.displayErrorPage(404, error, res);
                        } else {
                            self.fetchOriginFileContent(url, fileName, fileExt, compress, res);
                        }
                        var options = {
                            format: 'assets'
                        };
                    } else if(recipe.settings.format == 'fonts') {
                        var supportExts = ['ttf', 'otf', 'woff', 'svg', 'eot'];
                        if(supportExts.indexOf(fileExt.toLowerCase()) < 0) {
                            var error = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
                            self.displayErrorPage(404, error, res);
                        } else {
                            self.fetchOriginFileContent(url, fileName, fileExt, 0, res);
                        }
                        var options = {
                            format: 'assets'
                        };
                    } else {
                        var newFileName = url.replace(/[\/.]/g, '') + recipe.settings.format +
                        recipe.settings.quality + recipe.settings.trim + recipe.settings.trimFuzz + recipe.settings.width + recipe.settings.height +
                        recipe.settings.ratio + recipe.settings.devicePixelRatio +
                        recipe.settings.resizeStyle + recipe.settings.gravity + recipe.settings.filter + recipe.settings.blur +
                        recipe.settings.strip + recipe.settings.rotate + recipe.settings.flip + '.' + recipe.settings.format;

                        if (recipe.settings.format == 'json') {
                            if (fileExt == fileName) {
                                newFileName = url.replace(/[\/.]/g, '') + recipe.settings.format +
                                    recipe.settings.quality + recipe.settings.trim + recipe.settings.trimFuzz + recipe.settings.width + recipe.settings.height +
                                    recipe.settings.ratio + recipe.settings.devicePixelRatio +
                                    recipe.settings.resizeStyle + recipe.settings.gravity + recipe.settings.filter + recipe.settings.blur +
                                    recipe.settings.strip + recipe.settings.rotate + recipe.settings.flip + '.png';
                            } else {
                                newFileName = url.replace(/[\/.]/g, '') + recipe.settings.format +
                                    recipe.settings.quality + recipe.settings.trim + recipe.settings.trimFuzz + recipe.settings.width + recipe.settings.height +
                                    recipe.settings.ratio + recipe.settings.devicePixelRatio +
                                    recipe.settings.resizeStyle + recipe.settings.gravity + recipe.settings.filter + recipe.settings.blur +
                                    recipe.settings.strip + recipe.settings.rotate + recipe.settings.flip + '.' + fileExt;
                            }
                        }

                        var options = recipe.settings;
                    }
                } else {
                    var optionsArray = paramString.split('/').slice(0, 17);
                    var url = paramString.substring(optionsArray.join('/').length + 1);
                    var fileName = url.split('/')[url.split('/').length - 1];
                    var fileExt = url.substring(url.lastIndexOf('.') + 1);

                    var newFileName = url.replace(/[\/.]/g, '') + optionsArray.join('') + '.' + optionsArray[0];

                    if (optionsArray[0] == 'json') {
                        if (fileExt == fileName) {
                            newFileName = url.replace(/[\/.]/g, '') + optionsArray.join('') + '.png';
                        } else {
                            newFileName = url.replace(/[\/.]/g, '') + optionsArray.join('') + '.' + fileExt;
                        }
                    }

                    var gravity = optionsArray[11].substring(0, 1).toUpperCase() + optionsArray[11].substring(1);
                    var filter = optionsArray[12].substring(0, 1).toUpperCase() + optionsArray[12].substring(1);
                    /*
                     Options list
                     format:[e.g. png, jpg]
                     quality: [integer, 0>100]
                     trim: [boolean 0/1]
                     trimFuzz: [boolean 0/1]
                     width: [integer]
                     height: [integer]
                     cropX: [integer]
                     cropY: [integer]
                     ratio: [String]
                     devicePixelRatio: [integer]
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
                        cropX: optionsArray[6],
                        cropY: optionsArray[7],
                        ratio: optionsArray[8],
                        devicePixelRatio: optionsArray[9],
                        resizeStyle: optionsArray[10],
                        gravity: gravity,
                        filter: filter,
                        blur: optionsArray[13],
                        strip: optionsArray[14],
                        rotate: optionsArray[15],
                        flip: optionsArray[16]
                    };
                }

                if(options.format != 'assets') {
                    if (options.format == 'json') {
                        returnJSON = true;
                        if (fileExt == fileName) {
                            options.format = 'PNG';
                        } else {
                            options.format = fileExt;
                        }
                    }

                    var originFileName = fileName;

                    if (config.get('security.maxWidth') && config.get('security.maxWidth') < options.width) options.width = config.get('security.maxWidth');
                    if (config.get('security.maxHeight') && config.get('security.maxHeight') < options.height) options.height = config.get('security.maxHeight');

                    if (options.filter == 'None' || options.filter == 0) delete options.filter;
                    if (options.gravity == 0) delete options.gravity;
                    if (options.width == 0) delete options.width;
                    if (options.height == 0) delete options.height;
                    if (options.quality == 0) delete options.quality;
                    if (options.trim == 0) delete options.trim;
                    if (options.trimFuzz == 0) delete options.trimFuzz;
                    if (options.cropX == 0) delete options.cropX;
                    if (options.cropY == 0) delete options.cropY;
                    if (options.ratio == 0) delete options.ratio;
                    if (options.devicePixelRatio == 0) delete options.devicePixelRatio;
                    if (options.resizeStyle == 0) delete options.resizeStyle;
                    if (options.blur == 0) delete options.blur;
                    if (options.strip == 0) delete options.strip;
                    if (options.rotate == 0) delete options.rotate;
                    if (options.flip == 0) delete options.flip;

                    var encryptName = sha1(newFileName);

                    if (config.get('caching.redis.enabled')) {
                        self.client.exists(encryptName, function (err, exists) {
                            if (exists > 0) {
                                var readStream = redisRStream(self.client, encryptName);
                                if (returnJSON) {
                                    self.fetchImageInformation(readStream, originFileName, newFileName, options, res);
                                } else {
                                    // Set cache header
                                    res.setHeader('X-Cache', 'HIT');
                                    if(config.get('gzip')) {
                                        res.setHeader('content-encoding', 'gzip');
                                        var gzipStream = readStream.pipe(zlib.createGzip());
							            var buffers = [];
									    var fileSize = 0;

									    function lengthListener(length) {
									        fileSize = length;
									    }

									    gzipStream = gzipStream.pipe(lengthStream(lengthListener));
									    gzipStream.on('data', function (buffer) {
									        buffers.push(buffer);
									    });
									    gzipStream.on('end', function () {
									        var buffer = Buffer.concat(buffers);
									        res.setHeader('Content-Length', fileSize);
									        res.end(buffer);
									    });
                                    } else {
                                    	var buffers = [];
									    var fileSize = 0;

									    function lengthListener(length) {
									        fileSize = length;
									    }

									    readStream = readStream.pipe(lengthStream(lengthListener));
									    readStream.on('data', function (buffer) {
									        buffers.push(buffer);
									    });
									    readStream.on('end', function () {
									        var buffer = Buffer.concat(buffers);
									        res.setHeader('Content-Length', fileSize);
									        res.end(buffer);
									    });
                                    }
                                }
                            } else {
                                // Set cache header
                                res.setHeader('X-Cache', 'MISS');
                                self.createNewConvertImage(url, originFileName, newFileName, options, returnJSON, res);
                            }
                        })
                    } else {
                        var cacheDir = path.resolve(config.get('caching.directory.path'));
                        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
                        var cachePath = path.join(cacheDir, encryptName);
                        if (fs.existsSync(cachePath)) {
                            fs.stat(cachePath, function (err, stats) {
                                var lastMod = stats && stats.mtime && stats.mtime.valueOf();
                                if (config.get('caching.ttl') && lastMod && (Date.now() - lastMod) / 1000 <= config.get('caching.ttl')) {
                                    var readStream = fs.createReadStream(cachePath);
                                    if (returnJSON) {
                                        self.fetchImageInformation(readStream, originFileName, newFileName, options, res);
                                    } else {
                                        // Set cache header
                                        res.setHeader('X-Cache', 'HIT');
                                        if(config.get('gzip')) {
                                        	res.setHeader('content-encoding', 'gzip');
                                        	var gzipStream = readStream.pipe(zlib.createGzip());
								            var buffers = [];
										    var fileSize = 0;

										    function lengthListener(length) {
										        fileSize = length;
										    }

										    gzipStream = gzipStream.pipe(lengthStream(lengthListener));
										    gzipStream.on('data', function (buffer) {
										        buffers.push(buffer);
										    });
										    gzipStream.on('end', function () {
										        var buffer = Buffer.concat(buffers);
										        res.setHeader('Content-Length', fileSize);
										        res.end(buffer);
										    });
                                        } else {
                                            var buffers = [];
										    var fileSize = 0;

										    function lengthListener(length) {
										        fileSize = length;
										    }

										    readStream = readStream.pipe(lengthStream(lengthListener));
										    readStream.on('data', function (buffer) {
										        buffers.push(buffer);
										    });
										    readStream.on('end', function () {
										        var buffer = Buffer.concat(buffers);
										        res.setHeader('Content-Length', fileSize);
										        res.end(buffer);
										    });
                                        }
                                    }
                                } else {
                                    // Set cache header
                                    res.setHeader('X-Cache', 'MISS');
                                    self.createNewConvertImage(url, originFileName, newFileName, options, returnJSON, res);
                                }
                            });
                        } else {
                            // Set cache header
                            res.setHeader('X-Cache', 'MISS');
                            self.createNewConvertImage(url, originFileName, newFileName, options, returnJSON, res);
                        }
                    }
                }
            }
        }
    });

    var app = http.createServer(function (req, res) {
		config.updateConfigDataForDomain(req.headers.host);

        res.setHeader('Server', 'DADI CDN');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (config.get('clientCache.cacheControl')) res.setHeader('Cache-Control', config.get('clientCache.cacheControl'));
        if (config.get('clientCache.etag')) res.setHeader('ETag', config.get('clientCache.etag'));

        router(req, res, finalhandler(req, res));
    });

    app.listen(config.get('server.port'));

    done && done();
};

/**
 * Init S3 with configuration
 */
Server.prototype.initS3Bucket = function () {
    AWS.config.update({
        accessKeyId: config.get('images.s3.accessKey'),
        secretAccessKey: config.get('images.s3.secretKey')        
    });
    if(config.get('images.s3.region') && config.get('images.s3.region') != "") {
        AWS.config.update({
            region: config.get('images.s3.region')
        });
    }
    
    this.s3 = new AWS.S3();
};

Server.prototype.initS3AssetsBucket = function () {
    AWS.config.update({
        accessKeyId: config.get('assets.s3.accessKey'),
        secretAccessKey: config.get('assets.s3.secretKey')
    });
    if(config.get('images.s3.region') && config.get('images.s3.region') != "") {
        AWS.config.update({
            region: config.get('images.s3.region')
        });
    }
    
    this.assetsS3 = new AWS.S3();
};

/**
 * Create a Redis Client with configuration
 */
Server.prototype.initRedisClient = function () {
    this.client = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {
        detect_buffers: true
    })
    this.client.on("error", function (err) {
        console.log("Error " + err);
    }).on("connect", function () {
        console.log('Redis client Connected');
    })
    if (config.get('caching.redis.password')) {
        this.client.auth(config.get('caching.redis.password'), function () {
            console.log('Redis client connected');
        })
    }
};

/**
 * Display Error Page
 * status: status code
 * errorMessage: Error Message to display in the error page.
 */
Server.prototype.displayErrorPage = function (status, errorMessage, res) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html');
    res.write('<h1>Server Error</h1>');
    res.write('<pre>' + errorMessage + '</pre>');
    res.end();
}

/**
 * Convert image and store in local disk or Redis.
 * readStream: read stream from S3, local disk and url
 * fileName: file name to store converted image data
 * options: convert options
 */
Server.prototype.convertAndSave = function (readStream, imageInfo, originFileName, fileName, options, returnJSON, res) {
    var self = this;
    var encryptName = sha1(fileName);
    var displayOption = options;

    if(options.ratio) {
        var ratio = options.ratio.split('-');
        if(!options.width && parseFloat(options.height) > 0) {
            options.width = parseFloat(options.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]));
        } else if(!options.height && parseFloat(options.width) > 0) {
            options.height = parseFloat(options.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]));
        }
    }
    if(options.devicePixelRatio) {
        options.width = parseFloat(options.width) * parseFloat(options.devicePixelRatio);
        options.height = parseFloat(options.height) * parseFloat(options.devicePixelRatio);
    }

    var magickVar = imagemagick.streams.convert(options);
    magickVar.on('error', function (error) {
        self.displayErrorPage(404, error, res);
    });

    var sharpStream = null;

    if(options.quality >= 70 && options.format.toLowerCase() == 'png') {
        sharpStream = sharp().png().compressionLevel(9);
    } else if(options.quality >= 70 && (options.format.toLowerCase() == 'jpg' || options.format.toLowerCase() == 'jpeg')){
        sharpStream = sharp().jpeg().compressionLevel(9);
    } else if(options.cropX || options.cropY) {
        sharpStream = sharp();
    }

    if(sharpStream != null) {
        var convertedStream = readStream.pipe(sharpStream);
        if(options.cropX || options.cropY) {
            var cropX = options.cropX?parseFloat(options.cropX):0;
            var cropY = options.cropY?parseFloat(options.cropY):0;
            var width = options.width?(parseFloat(options.width) + parseFloat(cropX)):0;
            var height = options.height?(parseFloat(options.height) + parseFloat(cropY)):0;
            var originalWidth = parseFloat(imageInfo.width);
            var originalHeight = parseFloat(imageInfo.height);
            if(width <= (originalWidth-cropX) && height <= (originalHeight-cropY)) {
                if(width==0) width = originalWidth-cropX;
                if(height==0) height = originalHeight-cropY;
                convertedStream.extract(cropX, cropY, width, height);
            } else {
                self.displayErrorPage(404, 'Crop size is greater than image size.', res);
                return;
            }
        }
        convertedStream = convertedStream.pipe(magickVar);
    } else {
        var convertedStream = readStream.pipe(magickVar);
    }

    if (returnJSON) {
        self.fetchImageInformation(convertedStream, originFileName, fileName, displayOption, res);
    } else {
        if(config.get('gzip')) {

            res.setHeader('content-encoding', 'gzip');
            var gzipStream = convertedStream.pipe(zlib.createGzip());
            var buffers = [];
		    var fileSize = 0;

		    function lengthListener(length) {
		        fileSize = length;
		    }

		    gzipStream = gzipStream.pipe(lengthStream(lengthListener));
		    gzipStream.on('data', function (buffer) {
		        buffers.push(buffer);
		    });
		    gzipStream.on('end', function () {
		        var buffer = Buffer.concat(buffers);
		        res.setHeader('Content-Length', fileSize);
		        res.end(buffer);
		    });
        } else {
        	var buffers = [];
		    var fileSize = 0;

		    function lengthListener(length) {
		        fileSize = length;
		    }

		    convertedStream = convertedStream.pipe(lengthStream(lengthListener));
		    convertedStream.on('data', function (buffer) {
		        buffers.push(buffer);
		    });
		    convertedStream.on('end', function () {
		        var buffer = Buffer.concat(buffers);
		        res.setHeader('Content-Length', fileSize);
		        res.end(buffer);
		    });
        }
    }

    if (config.get('caching.redis.enabled')) {
        self.client.on("error", function (err) {
            self.displayErrorPage(404, err, res);
        });
        //Save to redis
        convertedStream.pipe(redisWStream(self.client, encryptName)).on('finish', function () {
            if (config.get('caching.ttl')) {
                self.client.expire(encryptName, config.get('caching.ttl'));
            }
        });
    } else {
        var cacheDir = path.resolve(config.get('caching.directory.path'));
        var file = fs.createWriteStream(path.join(cacheDir, encryptName));
        file.on('error', function (err) {
            self.displayErrorPage(404, err, res);
        });
        convertedStream.pipe(file);
    }
};

/**
 * Convert new image
 */
Server.prototype.createNewConvertImage = function (url, originFileName, newFileName, options, returnJSON, res) {
    var self = this;
    if (url.length > 0) {
        if (config.get('images.remote.enabled')) { // Load image from http or https url
            url = config.get('images.remote.path') + '/' + url;
            request({url: url}, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var tmpReadStream = request({url: url});
                    imagesize(tmpReadStream, function(err, imageInfo) {
                        self.convertAndSave(request({url: url}), imageInfo, originFileName, newFileName, options, returnJSON, res);
                    });
                }
                else {
                    self.displayErrorPage(404, 'Image path "' + url + '" isn\'t valid.', res);
                }
            })
        }
        else if (config.get('images.s3.enabled')) { //Load image from S3
            if(url.substring(0, 1) == '/') url = url.substring(1);
            self.s3.getObject({Bucket: config.get('images.s3.bucketName'), Key: url}, function (err, data) {
                if (err) {
                    self.displayErrorPage(404, err, res);
                }
                else {
                    var s3ReadStream = self.s3.getObject({
                        Bucket: config.get('images.s3.bucketName'),
                        Key: url
                    }).createReadStream();
                    var tmpReadStream = self.s3.getObject({
                        Bucket: config.get('images.s3.bucketName'),
                        Key: url
                    }).createReadStream();
                    imagesize(tmpReadStream, function(err, imageInfo) {
                        self.convertAndSave(s3ReadStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
                    });
                }
            })
        }
        else { // Load image from local disk
            var imageDir = path.resolve(config.get('images.directory.path'));
            url = path.join(imageDir, url);
            if (fs.existsSync(url)) {
                var fsReadStream = fs.createReadStream(url);
                var tmpReadStream = fs.createReadStream(url);
                imagesize(tmpReadStream, function(err, imageInfo) {
                    self.convertAndSave(fsReadStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
                });
            }
            else {
                self.displayErrorPage(404, 'File "' + url + '" doesn\'t exist.', res);
            }
        }
    }
    else {
        self.displayErrorPage(404, 'Image path doesn\'t exist.', res);
    }
};

/**
 * Get image information from image buffer.
 * readStream: read stream from S3, local disk and url
 * fileName: file name to store converted image data
 */
Server.prototype.fetchImageInformation = function (readStream, originFileName, fileName, options, res) {
    var buffers = [];
    var fileSize = 0;
    var encryptName = sha1(fileName);

    function lengthListener(length) {
        fileSize = length;
    }

    readStream = readStream.pipe(lengthStream(lengthListener));
    readStream.on('data', function (buffer) {
        buffers.push(buffer);
    });
    readStream.on('end', function () {
        var buffer = Buffer.concat(buffers);
        var primaryColor = RGBtoHex(colorThief.getColor(buffer)[0], colorThief.getColor(buffer)[1], colorThief.getColor(buffer)[2]);
        imagemagick.identify({
            srcData: buffer
        }, function (err, result) {
            var jsonData = {
                fileName: originFileName,
                cacheReference: encryptName,
                fileSize: fileSize,
                format: result.format,
                width: result.width,
                height: result.height,
                depth: result.depth,
                density: result.density,
                exif: result.exif,
                primaryColor: primaryColor,
                quality: options.quality ? options.quality : 75,
                trim: options.trim ? options.trim : 0,
                trimFuzz: options.trimFuzz ? options.trimFuzz : 0,
                width: options.width ? options.width : config.get('security.maxWidth'),
                height: options.height ? options.height : config.get('security.maxHeight'),
                resizeStyle: options.resizeStyle ? options.resizeStyle : 'aspectfill',
                gravity: options.gravity ? options.gravity : 'Center',
                filter: options.filter ? options.filter : 'None',
                blur: options.blur ? options.blur : 0,
                strip: options.strip ? options.strip : 0,
                rotate: options.rotate ? options.rotate : 0,
                flip: options.flip ? options.flip : 0,
                ratio: options.ratio ? options.ratio : 0,
                devicePixelRatio: options.devicePixelRatio ? options.devicePixelRatio : 0
            }

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', fileSize);
            res.setHeader('X-Cache', 'HIT');
            res.end(JSON.stringify(jsonData));
        });
    });
};

Server.prototype.addMonitor = function (filepath, callback) {
    filepath = path.normalize(filepath);
    if (this.monitors[filepath]) return;
    var m = monitor(filepath);
    m.on('change', callback);
    this.monitors[filepath] = m;
};

/**
 * Cache JS, CSS files to redis or local disk
 */
Server.prototype.cacheJSCSSFiles = function(readStream, fileName, res) {
    var self = this;
    if (config.get('caching.redis.enabled')) {
        self.client.on("error", function (err) {
            self.displayErrorPage(404, err, res);
        });
        readStream.pipe(redisWStream(self.client, fileName));

    } else {
        var fileOut = path.join(path.resolve(config.get('caching.directory.path')), fileName);
        var file = fs.createWriteStream(fileOut);
        file.on('error', function (err) {
            self.displayErrorPage(404, err, res);
        });
        readStream.pipe(file);
    }
    if(config.get('gzip')) {
        res.setHeader('content-encoding', 'gzip');
        readStream.pipe(zlib.createGzip()).pipe(res);
    } else {
        readStream.pipe(res);
    }
};

/**
 * Compress JS, CSS files
 */
Server.prototype.compressJsCSSFiles = function (readStream, fileName, fileExt, compress, res) {
    var self = this;
    if(compress == 1) {
        if(!fs.existsSync(path.resolve('./tmp'))) fs.mkdirSync(path.resolve('./tmp'));
        var fileIn = path.join(path.resolve('./tmp'), fileName);
        var newFileName = fileName.split('.')[0] + '.min.' + fileName.split('.')[1];
        readStream.pipe(fs.createWriteStream(fileIn)).on('finish', function () {
            var fileOut = path.join(path.resolve('./tmp'), newFileName);
            if (fileExt == 'js') {
                new compressor.minify({
                    type: 'uglifyjs',
                    fileIn: fileIn,
                    fileOut: fileOut,
                    callback: function (err, min) {
                        if (err) {
                            self.displayErrorPage(404, err, res);
                        } else {
                            fs.unlinkSync(fileIn);
                            var newReadStream = fs.createReadStream(fileOut);
                            newReadStream.on('close', function(){
                                fs.unlink(fileOut);
                            });
                            self.cacheJSCSSFiles(newReadStream, fileName, res);
                        }
                    }
                });
            } else if (fileExt == 'css') {
                new compressor.minify({
                    type: 'sqwish',
                    fileIn: fileIn,
                    fileOut: fileOut,
                    callback: function (err, min) {
                        if (err) {
                            self.displayErrorPage(404, err, res);
                        } else {
                            fs.unlinkSync(fileIn);
                            var newReadStream = fs.createReadStream(fileOut);
                            newReadStream.on('close', function(){
                                fs.unlink(fileOut);
                            });
                            self.cacheJSCSSFiles(newReadStream, fileName, res);
                        }
                    }
                });
            }
        });
    } else {
        self.cacheJSCSSFiles(readStream, fileName, res);
    }
};

/**
 * Fetch JS, CSS file from S3, Remote or local disk
 */
Server.prototype.fetchOriginFileContent = function (url, fileName, fileExt, compress, res) {
    var self = this;
    if (config.get('assets.remote.enabled')) { // Load file from http or https url
        url = config.get('assets.remote.path') + '/' + url;
        request({url: url}, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                self.compressJsCSSFiles(request({url: url}), fileName, fileExt, compress, res);
            } else {
                self.displayErrorPage(404, 'File path not valid.', res);
            }
        })
    } else if (config.get('assets.s3.enabled')) { //Load file from S3
        if(url.substring(0, 1) == '/') url = url.substring(1);
        self.assetsS3.getObject({Bucket: config.get('assets.s3.bucketName'), Key: url}, function (err, data) {
            if (err) {
                self.displayErrorPage(404, err, res);
            } else {
                var s3ReadStream = self.assetsS3.getObject({
                    Bucket: config.get('assets.s3.bucketName'),
                    Key: url
                }).createReadStream();
                self.compressJsCSSFiles(s3ReadStream, fileName, fileExt, compress, res);
            }
        })
    } else {
        var resourceDir = path.resolve(config.get('assets.directory.path'));
        url = path.join(resourceDir, url);
        if (fs.existsSync(url)) {
            var readStream = fs.createReadStream(url);
            self.compressJsCSSFiles(readStream, fileName, fileExt, compress, res);
        } else {
            self.displayErrorPage(404, 'File "' + url + '" doesn\'t exist.', res);
        }
    }
}

module.exports = new Server();

function encrypt(text) {
    var cipher = crypto.createCipher('aes-256-cbc', 'd6F3Efeq')
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
}
function decrypt(text) {
    var decipher = crypto.createDecipher('aes-256-cbc', 'd6F3Efeq')
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

function RGBtoHex(red, green, blue) {
    return '#' + ('00000' + (red << 16 | green << 8 | blue).toString(16)).slice(-6);
};
