var convict = require('convict');

// Define a schema
var conf = convict({

  server: {
    host: {
      doc: "Rosecomb IP address",
      format: 'ipaddress',
      default: '0.0.0.0'
    },
    port: {
      doc: "port to bind",
      format: 'port',
      default: 8080
    }
  },

  // Either directory, s3 or remote should be set. Remove the unused options
  images: {
    directory: {
      doc: "",
      format: String,
      default: "./images"
    },
    s3: {
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
      }
    },
    remote: {
      doc: "",
      format: String,
      default: "http://dh.dev.dadi.technology:3001"
    }
  },

  assets: {
    directory: {
      doc: "",
      format: String,
      default: "./public"
    },
    s3: {
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
      }
    },
    remote: {
      doc: "",
      format: String,
      default: "http://dh.dev.dadi.technology:3001"
    }
  },
  
  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 3600
    },
    directory: {
      doc: "",
      format: String,
      default: "./cache/"
    },
    redis: {
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
    clientId: {
      doc: "",
      format: String,
      default: "1235488"
    },
    secret: {
      doc: "",
      format: String,
      default: "asd544see68e52"
    }
  },
  cloudfront: {
    accessKey: {
      doc: "",
      format: String,
      default: "AKIAJJHIE6YB7FVGVL7Q"
    },
    secretKey: {
      doc: "",
      format: String,
      default: "OvIoiLgxQZszDuGCr5YWqKE/mNKlgSop+RqrkBTN"
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

module.exports = conf;

