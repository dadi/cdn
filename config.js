const chokidar = require('chokidar')
const convict = require('convict')
const domainManager = require('./dadi/lib/models/domain-manager')
const fs = require('fs')
const logger = require('@dadi/logger')
const objectPath = require('object-path')
const path = require('path')

// Define a schema
const schema = {
  server: {
    host: {
      doc: 'The IP address the application will run on',
      format: 'ipaddress',
      default: '0.0.0.0'
    },
    port: {
      doc: 'The port number the application will bind to',
      format: 'port',
      default: 8080,
      env: 'PORT'
    },
    redirectPort: {
      doc: 'Port to redirect http connections to https from',
      format: 'port',
      default: 0,
      env: 'REDIRECT_PORT'
    },
    name: {
      doc: 'Server name',
      format: String,
      default: 'DADI (CDN)'
    },
    protocol: {
      doc: 'The protocol the web application will use',
      format: String,
      default: 'http',
      env: 'PROTOCOL'
    },
    sslPassphrase: {
      doc: 'The passphrase of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PASSPHRASE'
    },
    sslPrivateKeyPath: {
      doc: 'The filename of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PATH'
    },
    sslCertificatePath: {
      doc: 'The filename of the SSL certificate',
      format: String,
      default: '',
      env: 'SSL_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePath: {
      doc: 'The filename of an SSL intermediate certificate, if any',
      format: String,
      default: '',
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePaths: {
      doc: 'The filenames of SSL intermediate certificates, overrides sslIntermediateCertificate (singular)',
      format: Array,
      default: [],
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATHS'
    }
  },
  logging: {
    enabled: {
      doc: 'If true, logging is enabled using the following settings.',
      format: Boolean,
      default: false
    },
    level: {
      doc: 'Sets the logging level.',
      format: ['debug', 'info', 'warn', 'error', 'trace'],
      default: 'info'
    },
    path: {
      doc: 'The absolute or relative path to the directory for log files.',
      format: String,
      default: './log'
    },
    filename: {
      doc: 'The name to use for the log file, without extension.',
      format: String,
      default: 'cdn'
    },
    extension: {
      doc: 'The extension to use for the log file.',
      format: String,
      default: 'log'
    },
    accessLog: {
      enabled: {
        doc: "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `cdn.access.log`.",
        format: Boolean,
        default: true
      }
    }
  },
  aws: {
    accessKeyId: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_ACCESS_KEY'
    },
    secretAccessKey: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_SECRET_KEY'
    },
    region: {
      doc: '',
      format: String,
      default: '',
      env: 'AWS_REGION'
    }
  },
  notFound: {
    statusCode: {
      doc: 'If set, overrides the status code in the case of a 404',
      format: Number,
      default: 404
    },
    images: {
      enabled: {
        doc: 'If true, returns a default image when request returns a 404',
        format: Boolean,
        default: false
      },
      path: {
        doc: 'The path to the default image',
        format: String,
        default: './images/missing.png'
      }
    }
  },
  images: {
    directory: {
      enabled: {
        doc: 'If true, image files will be loaded from the filesystem',
        format: Boolean,
        default: false
      },
      path: {
        doc: 'The path to the image directory',
        format: String,
        default: './images'
      }
    },
    s3: {
      enabled: {
        doc: 'If true, image files will be requested from Amazon S3',
        format: Boolean,
        default: false
      },
      accessKey: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_IMAGES_ACCESS_KEY'
      },
      secretKey: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_IMAGES_SECRET_KEY'
      },
      bucketName: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_IMAGES_BUCKET_NAME'
      },
      region: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_IMAGES_REGION'
      }
    },
    remote: {
      enabled: {
        doc: 'If true, image files will be requested from a remote host',
        format: Boolean,
        default: false
      },
      path: {
        doc: 'The remote host to request images from, for example http://media.example.com',
        format: String,
        default: '',
        allowDomainOverride: true
      },
      allowFullURL: {
        doc: 'If true, images can be loaded from any remote URL',
        format: Boolean,
        default: true
      }
    }
  },
  assets: {
    directory: {
      enabled: {
        doc: 'If true, asset files will be loaded from the filesystem',
        format: Boolean,
        default: false
      },
      path: {
        doc: '',
        format: String,
        default: './public'
      }
    },
    s3: {
      enabled: {
        doc: 'If true, asset files will be requested from Amazon S3',
        format: Boolean,
        default: false
      },
      accessKey: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_ASSETS_ACCESS_KEY'
      },
      secretKey: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_ASSETS_SECRET_KEY'
      },
      bucketName: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_ASSETS_BUCKET_NAME'
      },
      region: {
        doc: '',
        format: String,
        default: '',
        env: 'AWS_S3_ASSETS_REGION'
      }
    },
    remote: {
      enabled: {
        doc: 'If true, asset files will be requested from a remote host',
        format: Boolean,
        default: false
      },
      path: {
        doc: 'The remote host to request assets from, for example http://media.example.com',
        format: String,
        default: ''
      }
    }
  },
  caching: {
    expireAt: {
      doc: 'Cron-style pattern specifying when the cache should be expired',
      format: String,
      default: null,
      allowDomainOverride: true
    },
    ttl: {
      doc: '',
      format: Number,
      default: 3600
    },
    directory: {
      enabled: {
        doc: 'If true, cache files will be saved to the filesystem',
        format: Boolean,
        default: true,
        env: 'CACHE_ENABLE_DIRECTORY'
      },
      path: {
        doc: 'The relative path to the cache directory',
        format: String,
        default: './cache/'
      }
    },
    redis: {
      enabled: {
        doc: 'If true, cache files will be saved to the specified Redis server',
        format: Boolean,
        default: false,
        env: 'CACHE_ENABLE_REDIS'
      },
      host: {
        doc: 'The Redis server host',
        format: String,
        default: '',
        env: 'REDIS_HOST'
      },
      port: {
        doc: 'The port for the Redis server',
        format: 'port',
        default: 6379,
        env: 'REDIS_PORT'
      },
      password: {
        doc: '',
        format: String,
        default: '',
        env: 'REDIS_PASSWORD'
      }
    }
  },
  status: {
    enabled: {
      doc: 'If true, status endpoint is enabled.',
      format: Boolean,
      default: true
    },
    requireAuthentication: {
      doc: 'If true, status endpoint requires authentication.',
      format: Boolean,
      default: true
    },
    standalone: {
      doc: 'If true, status endpoint will run on an standalone address/port.',
      format: Boolean,
      default: false
    },
    port: {
      doc: 'Accept connections on the specified port. A value of zero will assign a random port.',
      format: Number,
      default: 8003,
      env: 'STATUS_PORT'
    },
    routes: {
      doc: 'An array of routes to test. Each route object must contain properties `route` and `expectedResponseTime`. Note, `expectedResponseTime` is seconds.',
      format: Array,
      default: [
        {
          route: '/test.jpg?format=png&quality=50&width=800&height=600',
          expectedResponseTime: 0.025
        }
      ]
    }
  },
  security: {
    maxWidth: {
      doc: '',
      format: Number,
      default: 2048
    },
    maxHeight: {
      doc: '',
      format: Number,
      default: 1024
    }
  },
  auth: {
    tokenUrl: {
      doc: '',
      format: String,
      default: '/token'
    },
    clientId: {
      doc: '',
      format: String,
      default: '1235488',
      env: 'AUTH_TOKEN_ID'
    },
    secret: {
      doc: '',
      format: String,
      default: 'asd544see68e52',
      env: 'AUTH_TOKEN_SECRET'
    },
    tokenTtl: {
      doc: '',
      format: Number,
      default: 1800,
      env: 'AUTH_TOKEN_TTL'
    }
  },
  cloudfront: {
    enabled: {
      doc: '',
      format: Boolean,
      default: false
    },
    accessKey: {
      doc: '',
      format: String,
      default: '',
      env: 'CLOUDFRONT_ACCESS_KEY'
    },
    secretKey: {
      doc: '',
      format: String,
      default: '',
      env: 'CLOUDFRONT_SECRET_KEY'
    },
    distribution: {
      doc: '',
      format: String,
      default: '',
      env: 'CLOUDFRONT_DISTRIBUTION'
    }
  },
  cluster: {
    doc: 'If true, CDN runs in cluster mode, starting a worker for each CPU core',
    format: Boolean,
    default: true
  },
  paths: {
    plugins: {
      doc: 'Path to plugins directory',
      format: String,
      default: 'workspace/plugins',
      allowDomainOverride: true
    },
    recipes: {
      doc: 'Path to recipes directory',
      format: String,
      default: 'workspace/recipes',
      allowDomainOverride: true
    },
    routes: {
      doc: 'Path to routes directory',
      format: String,
      default: 'workspace/routes',
      allowDomainOverride: true
    }
  },
  gzip: {
    doc: "If true, uses gzip compression and adds a 'Content-Encoding:gzip' header to the response",
    format: Boolean,
    default: true
  },
  headers: {
    useGzipCompression: {
      doc: "If true, uses gzip compression and adds a 'Content-Encoding:gzip' header to the response.",
      format: Boolean,
      default: true
    },
    cacheControl: {
      doc: 'A set of cache control headers based on specified mimetypes or paths',
      format: Object,
      default: {
        'default': 'public, max-age=3600',
        'paths': [],
        'mimetypes': [
          {'text/css': 'public, max-age=86400'},
          {'text/javascript': 'public, max-age=86400'},
          {'application/javascript': 'public, max-age=86400'}
        ]
      }
    }
  },
  feedback: {
    doc: '',
    format: Boolean,
    default: false
  },
  robots: {
    doc: 'The path to a robots.txt file',
    format: String,
    default: ''
  },
  env: {
    doc: 'The applicaton environment.',
    format: String,
    default: 'development',
    env: 'NODE_ENV',
    arg: 'node_env'
  },
  geolocation: {
    enabled: {
      doc: 'Enable geolocation',
      format: Boolean,
      default: false
    },
    method: {
      doc: 'Method to use for geolocation',
      format: ['maxmind', 'remote'],
      default: 'maxmind'
    },
    maxmind: {
      countryDbPath: {
        doc: 'Path to Maxmind country database',
        format: String,
        default: __dirname + '/vendor/maxmind-country.mmdb'
      }
    },
    remote: {
      url: {
        doc: 'Remote URL to be used for geolocation. {key}, {secret} and {ip} will be replaced by the API key, secret and IP to locate, respectively',
        format: String,
        default: ''
      },
      key: {
        doc: 'Key to be used with remote geolocation service',
        format: String,
        default: '',
        env: 'GEOLOCATION_REMOTE_KEY'
      },
      secret: {
        doc: 'Secret to be used with remote geolocation service',
        format: String,
        default: '',
        env: 'GEOLOCATION_REMOTE_SECRET'
      },
      countryPath: {
        doc: 'Path to the country code within the response object',
        format: String,
        default: 'location.country.isoCode'
      }
    }
  },
  network: {
    url: {
      doc: 'Remote URL to be used for network test service. {key}, {secret} and {ip} will be replaced by the API key, secret and IP to locate, respectively',
      format: String,
      default: ''
    },
    key: {
      doc: 'Key to be used with network test service',
      format: String,
      default: '',
      env: 'NETWORK_REMOTE_KEY'
    },
    secret: {
      doc: 'Secret to be used with network test service',
      format: String,
      default: '',
      env: 'NETWORK_REMOTE_SECRET'
    },
    path: {
      doc: 'Path to the network type within the response object',
      format: String,
      default: 'speed.connectionType'
    }
  },
  engines: {
    sharp: {
      kernel: {
        doc: 'The kernel to use for image reduction',
        format: ['nearest', 'cubic', 'lanczos2', 'lanczos3'],
        default: 'lanczos3'
      },
      interpolator: {
        doc: 'The interpolator to use for image enlargement',
        format: [
          'nearest',
          'bilinear',
          'vertexSplitQuadraticBasisSpline',
          'bicubic',
          'locallyBoundedBicubic',
          'nohalo'
        ],
        default: 'bicubic'
      },
      centreSampling: {
        doc: 'Whether to use *magick centre sampling convention instead of corner sampling',
        format: Boolean,
        default: false
      }
    }
  },
  experimental: {
    jsTranspiling: {
      doc: 'Whether to enable experimental support for on-demand JavaScript transpiling',
      format: Boolean,
      default: false,
      env: 'JSTRANSPILING'
    }
  },
  multiDomain: {
    directory: {
      doc: 'Path to domains directory',
      format: 'String',
      default: 'domains'
    },
    enabled: {
      doc: 'Enable multi-domain configuration for this CDN instance',
      format: Boolean,
      default: false
    }
  }
}

const Config = function () {
  this.loadFile(this.configPath())

  this.watcher = chokidar.watch(
    this.configPath(),
    {usePolling: true}
  ).on('all', (event, filePath) => {
    this.loadFile(this.configPath())
  })

  this.domainSchema = {}
  this.createDomainSchema(schema, this.domainSchema)

  this.domainConfigs = this.loadDomainConfigs()
}

Config.prototype = convict(schema)

/**
 * Retrieves the full path for the configuration file associated
 * with the current environment,
 *
 * @return {String}
 */
Config.prototype.configPath = function () {
  let environment = this.get('env')

  return `./config/config.${environment}.json`
}

/**
 * Creates a Convict schema for domains, including only the properties
 * that can be overridden at domain level, as well as the default values
 * obtained from the main config.
 *
 * @param  {Object} schema - main schema
 * @param  {Object} target - variable to write the schema to
 * @param  {Array}  tail   - helper variable for recursion
 */
Config.prototype.createDomainSchema = function (schema, target, tail = []) {
  if (!schema || typeof schema !== 'object') return

  if (schema.allowDomainOverride) {
    let path = tail.join('.')

    objectPath.set(
      target,
      path,
      Object.assign({}, schema, {
        default: this.get(path)
      })
    )
    
    return
  }
  
  Object.keys(schema).forEach(key => {
    this.createDomainSchema(
      schema[key],
      target,
      tail.concat(key)
    )
  })
}

/**
 * A reference to the original `get` method from convict.
 *
 * @type {Function}
 */
Config.prototype._get = Config.prototype.get

/**
 * Gets a configuration value for a domain if the property can
 * be defined at domain level *and* a domain name is supplied.
 * Otherwise, behaves as the native `get` method from Convict.
 *
 * @param  {String} path   - config property
 * @param  {String} domain - domain name
 * @return {Object}
 */
Config.prototype.get = function (path, domain) {
  if (
    domain === undefined ||
    this.domainConfigs[domain] === undefined ||
    !objectPath.get(schema, `${path}.allowDomainOverride`)
  ) {
    return this._get(path)
  }

  return this.domainConfigs[domain].get(path)
}

/**
 * Builds a hash map with a Convict instance for each configured
 * domain.
 *
 * @return {Object}
 */
Config.prototype.loadDomainConfigs = function () {
  let configs = {}
  let domainsDirectory = this.get('multiDomain.directory')

  domainManager
    .scanDomains(domainsDirectory)
    .getDomains().forEach(({domain, path: domainPath}) => {
      let configPath = path.join(
        domainPath,
        `config/config.${this.get('env')}.json`
      )

      try {
        let file = fs.statSync(configPath)

        if (file.isFile()) {
          configs[domain] = convict(this.domainSchema)
          configs[domain].loadFile(configPath)
        }
      } catch (err) {
        logger.info(
          {module: 'config'},
          `'${this.get('env')}' config not found for domain ${domain}`
        )
      }    
    })

  return configs
}

/**
 * A reference to the original `set` method from convict.
 *
 * @type {Function}
 */
Config.prototype._set = Config.prototype.set

/**
 * Sets a configuration value for a given domain name, if one
 * is specified. If not, the method behaves like the original
 * `set` method from Convict.
 *
 * @param {String} path
 * @param {Object} value
 * @param {String} domain
 */
Config.prototype.set = function (path, value, domain) {
  if (
    domain === undefined ||
    this.domainConfigs[domain] === undefined ||
    !objectPath.get(schema, `${path}.allowDomainOverride`)
  ) {
    return this._set(path, value)
  }

  return this.domainConfigs[domain].set(path, value)  
}

module.exports = new Config()
module.exports.Config = Config
module.exports.schema = schema
