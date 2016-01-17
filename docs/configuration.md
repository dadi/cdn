# DADI CDN

## Configuration

### Overview

DADI CDN's settings are defined in a configuration files mapped to environment variables. These are contained wihtin `/config`. An example file, containing all of the available configuration options can be found in `/config/config.development.json.sample`.

### Config options

#### server

The `server.host` config is passed to node's `server.listen` function
http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback

You should be able to set it to your IP as well, but depending on your hosting, that may be tricky. For example, on AWS you would have to use your private IP instead of your public IP (or use `0.0.0.0`).

The proper name should always resolve correctly. Alternately, you can set it to null, to accept connections on any IPv4 address.

**Example**

	"server": {
		"host": "0.0.0.0",
		"port": 3000
	}

#### images

Source images can be called either locally, from an S3 bucket or remotely via a URL.

**Example #1: local directory**

	"images": {
		"directory": {
			"enabled": true,
			"path": "./images"
		},
		"s3": {
			"enabled": false,
			"accessKey": "",
			"secretKey": "",
			"bucketName": ""
		},
		"remote": {
			"enabled": false,
			"path": ""
		}
	}

**Example #2: S3 lookup**

	"images": {
		"directory": {
			"enabled": false,
			"path": ""
		},
		"s3": {
			"enabled": true,
			"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
			"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN",
			"bucketName": "dadi-image-testing"
		},
		"remote": {
			"enabled": false,
			"path": ""
		}
	}

**Example #3: remote lookup**

	"images": {
		"directory": {
			"enabled": false,
			"path": "./images"
		},
		"s3": {
			"enabled": false,
			"accessKey": "",
			"secretKey": "",
			"bucketName": ""
		},
		"remote": {
			"enabled": true,
			"path": "http://dh.dev.dadi.technology:3001"
		}
	}

#### assets (JavaScript/CSS)

Source assets (JavaScript/CSS) can be called either locally, from an S3 bucket or remotely via a URL.

**Example #1: local directory**

	"assets": {
		"directory": {
			"enabled": true,
			"path": "./public"
		},
		"s3": {
			"enabled": false,
			"accessKey": "",
			"secretKey": "",
			"bucketName": ""
		},
		"remote": {
			"enabled": false,
			"path": ""
		}
	}

**Example #2: S3 lookup**

	"assets": {
		"directory": {
			"enabled": false,
			"path": ""
		},
		"s3": {
			"enabled": true,
			"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
			"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN",
			"bucketName": "dadi-image-testing"
		},
		"remote": {
			"enabled": false,
			"path": ""
		}
	}

**Example #3: remote lookup**

	"assets": {
		"directory": {
			"enabled": false,
			"path": ""
		},
		"s3": {
			"enabled": false,
			"accessKey": "",
			"secretKey": "",
			"bucketName": ""
		},
			"remote": {
			"enabled": true,
			"path": "http://dh.dev.dadi.technology:3001"
		}
	}

#### caching

DADI CDN's cache can be set to be either local (held on disk [local filesystem]) or Redis. Redis is generally recommended as it provides an in memory cache which is substantially faster under load. Redis also allows multiple instances of DADI CDN to share a cache, ensuring consistency in delivery within a clustered environment.

The `ttl` setting defines the default Time To Live for cached images and assets in seconds. The setting is applied to invidiual images/assets at the point that they are first cached. Once the threshold is met, cached images and assets are expired, and a fresh copy is drawn from the source location.

**Example #1: local caching**

	"caching": {
		"ttl": 3600,
		"directory": {
			"enabled": true,
			"path": "./cache/"
		},
		"redis": {
			"enabled": false,
			"host": "",
			"port": 6379
		}
	}

**Example #2: Redis cache**

	"caching": {
		"ttl": 3600,
		"directory": {
			"enabled": false,
			"path": ""
		},
		"redis": {
			"enabled": true,
			"host": "testing.qvhlji.ng.0001.euw1.cache.amazonaws.com",
			"port": 6379
		}
	}

### clientCache

The clientCache defines the cache headers that are sent with images/assets delivered by DADI CDN. They enable you to offset load by making use of modern browsers local caching.

You can read more about `cacheControl` and `etag` [here](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching?hl=en).

**Example**

	"clientCache": {
		"cacheControl": "public, max-age=3600",
		"etag": "15f0fff99ed5aae4edffdd6496d7131f"
	}

#### security

The security setting allows you to set a maximum width and height to generated images. This prevents the potentual for a DOS attack based on the repeated generation of super large images, which could push your platform offline by exhausting CPU and/or available memory.

You should set this to the maximum size of image required in your product.

**Example**

	"security": {
		"maxWidth": 2048,
		"maxHeight": 1024
	}

#### auth

DADI CDN's internal API for cache invalidation uses two-legged OAuth. This configuration allows you to define a clientId and secret to secure the invalidation API.

**Example**

	"auth": {
		"clientId": "1235488",
		"secret": "asd544see68e52"
	}

#### cloudfront

DADI CDN works seamlessly with Cloudfront, allowing it to plug directly into global infrastructure. The `clodfront` settings in `config.json` enable DADI CDN's invalidation API to be chained directly with Cloudfront's invalidation API, meaning that an invalidation request sent to DADI CDN will have the effect of invalidating the same files in your Cloudfront distribution.

**Example**

	"cloudfront": {
		"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
		"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
	}

#### GZIP

DADI CDN supports GZIP compression, providiing a simple, effective way to save bandwidth and speed up your product.

**Example**

	"gzip": true

#### feedback

With `feedbaack` set to `true`, DADI CDN will provide feedback directly to the console, enabling you monitor your installation. This is useful for intial setup and debugging. It should not be used in a proudction environment.

**Example**

	"feedback": true
