# DADI CDN

## Configuration

### Overview

DADI CDN's settings are defined in configuration files mapped to environment variables. These are contained within a `config` directory at the root of your application. An example file, containing all of the available configuration options can be found [here](https://github.com/dadi/cdn/blob/master/config/config.development.json.sample).

### Configuration options

#### server

The address the server will accept connections on.

**Note:** on AWS you need to use your private IP instead of your public IP, or use `0.0.0.0`.

If set to `null` CDN will accept connections on any IPv4 address.

**Example**
```js
"server": {
  "host": "0.0.0.0",
  "port": 3000
}
```

#### images

Sets the configuration options for source images.

Source images can be accessed from the local filesystem, from an Amazon S3 bucket or remotely via a URL.

In each case, the `path` or `bucketName` acts as the root location for your images.

**Local filesystem**

```json
"images": {
  "directory": {
    "enabled": true,
    "path": "./images"
  },
  "s3": {
    "enabled": false
  },
  "remote": {
    "enabled": false
  }
}
```

**Amazon S3**

```json
"images": {
  "directory": {
    "enabled": false
  },
  "s3": {
    "enabled": true,
    "accessKey": "accessKeyGoesHere",
    "secretKey": "secretGoesHere",
    "bucketName": "bucketNameGoesHere",
    "region": "eu-west-1"
  },
  "remote": {
    "enabled": false
  }
}
```

**URL lookup**

```json
"images": {
  "directory": {
    "enabled": false
  },
  "s3": {
    "enabled": false
  },
  "remote": {
    "enabled": true,
    "path": "http://media.example.com"
  }
}
```

#### assets

Sets the configuration options for source asset files such as Javascript, CSS and fonts.

Source assets can be accessed from the local filesystem, from an Amazon S3 bucket or remotely via a URL.

**Local filesystem**

```json
"assets": {
  "directory": {
    "enabled": true,
    "path": "./images"
  },
  "s3": {
    "enabled": false
  },
  "remote": {
    "enabled": false
  }
}
```

**Amazon S3**

```json
"assets": {
  "directory": {
    "enabled": false
  },
  "s3": {
    "enabled": true,
    "accessKey": "accessKeyGoesHere",
    "secretKey": "secretGoesHere",
    "bucketName": "bucketNameGoesHere",
    "region": "eu-west-1"
  },
  "remote": {
    "enabled": false
  }
}
```

**URL lookup**

```json
"assets": {
  "directory": {
    "enabled": false
  },
  "s3": {
    "enabled": false
  },
  "remote": {
    "enabled": true,
    "path": "http://media.example.com"
  }
}
```

#### caching

DADI CDN's cache can utilise the local filesystem or a Redis server (local or remote).

Redis is generally recommended as it provides an in memory cache which is substantially faster under load. Redis also allows multiple instances of DADI CDN to share a cache, ensuring consistency in delivery within a clustered environment.

The `ttl` setting defines the default Time To Live for cached images and assets in seconds. The setting is applied to individual images/assets at the point that they are first cached. Once the threshold is met, cached images and assets are expired and a fresh copy is retrieved from the source location.

**Local filesystem**

```js
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
```

**Redis server**
```js
"caching": {
  "ttl": 3600,
  "directory": {
    "enabled": false,
  },
  "redis": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 6379
  }
}
```

### clientCache

Defines the cache headers that are sent with images/assets delivered by DADI CDN. They enable you to offset load by making use of modern browsers local caching.

You can read more about `cacheControl` and `etag` [here](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/http-caching?hl=en).

**Example**

```js
"clientCache": {
  "cacheControl": "public, max-age=3600",
  "etag": "15f0fff99ed5aae4edffdd6496d7131f"
}
```

#### security

Allows setting a maximum width and height for generated images. This prevents the potential for a DOS attack based on the repeated generation of super large images, which could push your platform offline by exhausting CPU and/or available memory.

You should set this to the maximum size of image required in your product.

**Example**
```js
"security": {
  "maxWidth": 2048,
  "maxHeight": 1024
}
```

#### auth

DADI CDN features an internal API for performing system tasks such as cache invalidation and status reporting. This configuration property allows you to specify the credentials that can be used to generate a Bearer token for use with the API.

**Example**

```js
"auth": {
  "clientId": "1235488",
  "secret": "asd544see68e52"
}
```

#### cloudfront

DADI CDN works seamlessly with Cloudfront, allowing it to plug directly into global infrastructure. This configuration setting enables DADI CDN's cache invalidation API to be chained directly to Cloudfront's invalidation API, meaning that an invalidation request sent to DADI CDN will have the effect of invalidating the same files in your Cloudfront distribution.

**Example**
```js
"cloudfront": {
  "accessKey": "GIWJBDJWBDKJBWDJKW",
  "secretKey": "JbdiwjgdiwdgiuHIHiwndinduNUNWUNSWuww",
  "bucketName": "",
  "region": ""
}
```

#### gzip

DADI CDN supports GZIP compression, providing a simple and effective way to save bandwidth and speed up your product.

**Example**

```js
"gzip": true
```

#### status

[TODO]

#### logging

[TODO]

#### feedback

With `feedbaack` set to `true`, DADI CDN will provide feedback directly to the console, enabling you monitor your installation. This is useful for intial setup and debugging. It should not be used in a proudction environment.

**Example**

	"feedback": true
