var convict = require('convict');
var fs = require('fs');
var path = require('path');

// Define a schema
var conf = convict({

  server: {
    host: {
      doc: "DADI CDN server IP address to bind to",
      format: 'ipaddress',
      default: '0.0.0.0'
    },
    port: {
      doc: "DADI CDN server port to bind to",
      format: 'port',
      default: 8080
    },
    name: {
      doc: "Server name",
      format: String,
      default: "DADI (CDN)"
    }
  },

  images: {
    directory: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      path: {
        doc: "",
        format: String,
        default: "./images"
      }
    },
    s3: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      accessKey: {
        doc: "",
        format: String,
        default: "AKIAJJHIE6YB7FVGVL7Q"
      },
      secretKey: {
        doc: "",
        format: String,
        default: "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
      },
      bucketName: {
        doc: "",
        format: String,
        default: "dadi-image-testing"
      },
      region: {
        doc: "",
        format: String,
        default: ""
      }
    },
    remote: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      path: {
        doc: "",
        format: String,
        default: "http://dh.dev.dadi.technology:3001"
      }
    }
  },

  assets: {
    directory: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      path: {
        doc: "",
        format: String,
        default: "./public"
      }
    },
    s3: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      accessKey: {
        doc: "",
        format: String,
        default: "AKIAJJHIE6YB7FVGVL7Q"
      },
      secretKey: {
        doc: "",
        format: String,
        default: "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
      },
      bucketName: {
        doc: "",
        format: String,
        default: "dadi-image-testing"
      },
      region: {
        doc: "",
        format: String,
        default: ""
      }
    },
    remote: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      path: {
        doc: "",
        format: String,
        default: "http://dh.dev.dadi.technology:3001"
      }
    }
  },

  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 3600
    },
    directory: {
      enabled: {
        doc: "",
        format: Boolean,
        default: true
      },
      path: {
        doc: "",
        format: String,
        default: "./cache/"
      }
    },
    redis: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      host: {
        doc: "",
        format: String,
        default: "tresting.qvhlji.ng.0001.euw1.cache.amazonaws.com"
      },
      port: {
        doc: "port to bind",
        format: 'port',
        default: 6379
      },
      password: {
        doc: "",
      	format: String,
      	default: ""
      }
    }
  },
  clientCache: {
    cacheControl: {
      doc: "",
      format: String,
      default: "public, max-age=3600"
    },
    etag: {
      doc: "",
      format: String,
      default: "15f0fff99ed5aae4edffdd6496d7131f"
    }
  },
  security: {
    maxWidth: {
      doc: "",
      format: Number,
      default: 2048
    },
    maxHeight: {
      doc: "",
      format: Number,
      default: 1024
    }
  },
  auth: {
    tokenUrl: {
      doc: "",
      format: String,
      default: "/token"
    },
    clientId: {
      doc: "",
      format: String,
      default: "1235488"
    },
    secret: {
      doc: "",
      format: String,
      default: "asd544see68e52"
    },
    tokenTtl: {
      doc: "",
      format: Number,
      default: 1800
    }
  },
  cloudfront: {
    enabled: {
      doc: "",
      format: Boolean,
      default: false
    },
    accessKey: {
      doc: "",
      format: String,
      default: "AKIAJJHIE6YB7FVGVL7Q"
    },
    secretKey: {
      doc: "",
      format: String,
      default: "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
    },
    distribution: {
      doc: "",
      format: String,
      default: "target_distribution"
    }
  },
  gzip: {
    doc: "",
    format: Boolean,
    default: true
  },
  feedback: {
    doc: "",
    format: Boolean,
    default: false
  },
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test", "qa"],
    default: "development",
    env: "NODE_ENV",
    arg: "node_env"
  }

});

// Load environment dependent configuration
var env = conf.get('env');
conf.loadFile('./config/config.' + env + '.json');

// Perform validation
conf.validate({strict: false});

//Update Config JSON file by domain name
conf.updateConfigDataForDomain = function(domain) {
  if(fs.existsSync(path.resolve(__dirname + '/workspace/domain-loader/' + domain + '.config.' + env + '.json'))) {
    conf.loadFile(__dirname + '/workspace/domain-loader/' + domain + '.config.' + env + '.json');
  } else {
    console.log('No Config File Exists');
  }
};

module.exports = conf;

module.exports.configPath = function() {
  return './config/config.' + conf.get('env') + '.json';
}