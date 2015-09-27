![Barbu](../barbu.png)

# Configuration

## Overview

Barbu's settings are defined in a single `config.json` file, which can be found at root. An example file, containing all of the available configuration options can be found in `config.example.json`.

## Config options

### server

The `server.host` config is passed to node's `server.listen` function
http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback

You should be able to set it to your IP as well, but depending on your hosting, that may be tricky. For example, on AWS you would have to use your private IP instead of your public IP.

The proper name should always resolve correctly. Alternately, you can set it to null, to accept connections on any IPv4 address.

**Example**

	"server": {
		"host": "0.0.0.0",
		"port": 3000
	}

### images

Source images can be called either locally, from an S3 bucket or remotely via a URL.

**Example #1: local directory**

	"images": {
		"directory": "./images"
	}

**Example #2: S3 lookup**

	"images": {
		"s3": {
			"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
			"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN",
			"bucketName": "dadi-image-testing"
		}
	}

**Example #3: remote lookup**

	"images": {
		"remote": "http://dh.dev.dadi.technology:3001"
	}

### assets (JavaScript/CSS)

Source assets (JavaScript/CSS) can be called either locally, from an S3 bucket or remotely via a URL.

**Example #1: local directory**

	"assets": {
		"directory": "./public"
	}

**Example #2: S3 lookup**

	"assets": {
		"s3": {
			"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
			"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN",
			"bucketName": "dadi-image-testing"
		}
	}

**Example #3: remote lookup**

	"assets": {
		"remote": "http://dh.dev.dadi.technology:3001"
	}

### caching

Barbu's cache can be set to be either local (held on disk [local filesystem]) or Redis. Redis is generally recommended as it provides an in memory cache which is substantially faster under load.

The `ttl` setting defines the default Time To Live for cached images and assets in seconds. The setting is applied to invidiual images/assets at the point that they are first cached. Once the threshold is met, cached images and assets are expired, and a fresh copy is drawn from the source location.

**Example #1: local caching**

	"caching": {
		"ttl": 3600,
		"directory": "./cache/"
	}

**Example #2: Redis cache**

	"caching": {
		"ttl": 3600,
		"redis": {
			"host": "tresting.qvhlji.ng.0001.euw1.cache.amazonaws.com",
			"port": 6379
		}
	}

### clientCache

The clientCache defines the cache headers that are sent with images/assets delivered by Barbu. They enable you to offset load by making use of modern browsers local caching.

You can read more about `cacheControl` and `etag` [here](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching?hl=en).

**Example**

	"clientCache": {
		"cacheControl": "public, max-age=3600",
		"etag": "15f0fff99ed5aae4edffdd6496d7131f"
	}

### security

The security setting allows you to set a maximum width and height to generated images. This prevents the potentual for a DOS attack based on the repeated generation of super large images, which could push your platform offline by exhausting CPU and/or available memory.

You should set this to the maximum size of image required in your product.

**Example**

	"security": {
		"maxWidth": 2048,
		"maxHeight": 1024
	}

### auth

Barbu's internal API for cache invalidation uses two-legged OAuth. This configuration allows you to define a clientId and secret to secure the invalidation API.

**Example**

	"auth": {
		"clientId": "1235488",
		"secret": "asd544see68e52"
	}

### cloudfront

Barbu works seamlessly with Cloudfront, allowing it to plug directly into global infrastructure. The `clodfront` settings in `config.json` enable Barbu's invalidation API to be chained directly with Cloudfront's invalidation API, meaning that an invalidation request sent to Barbu will have the effect of invalidating the same files in your Cloudfront distribution.

**Example**

	"cloudfront": {
		"accessKey": "AKIAJJHIE6YB7FVGVL7Q",
		"secretKey": "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
	}

### GZIP

Barbu supports GZIP compression, providiing a simple, effective way to save bandwidth and speed up your product.

**Example**

	"gzip": true

### feedback

With `feedbaack` set to `true`, Barbu will provide feedback directly to the console, enabling you monitor your installation. This is useful for intial setup and debugging. It should not be used in a proudction environment.

**Example**

	"feedback": true
