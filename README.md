<img src="https://dadi.tech/assets/products/dadi-cdn-full.png" alt="DADI CDN" height="65"/>

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/cdn.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/cdn)
[![coverage](https://img.shields.io/badge/coverage-74%25-yellow.svg?style=flat)](https://github.com/dadi/cdn)
[![Build Status](https://travis-ci.org/dadi/cdn.svg?branch=master)](https://travis-ci.org/dadi/cdn)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![Greenkeeper badge](https://badges.greenkeeper.io/dadi/cdn.svg)](https://greenkeeper.io/)


## DADI CDN



* [Overview](#overview)
* [Requirements](#requirements)
* [Your First CDN Project](#your-first-cdn-project)
* [Links](#links)

## Overview

DADI CDN is built on Node.JS, with support for S3 and Redis. It is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversion; image recipes allow for SEO-friendly URLs; dynamic routing allows for media manipulation based on what is known about an individual; and an authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Requirements

* **[Node.js](https://www.nodejs.org/)** (supported versions: 4.7.0, 5.12.0, 6.9.2, 6.11.x)

## Your first CDN project

### Install dependencies

Ensure you have the required dependencies installed. See the first sections in the CDN  [installation](https://docs.dadi.tech/#cdn) documentation.

### Install CDN

All DADI platform microservices are available from [NPM](https://www.npmjs.com/). To add *CDN* to your project as a dependency:

```bash
$ cd my-app
$ npm install --save @dadi/cdn
```

### Add an entry point

You'll need an entry point for your project. We'll create a file called `index.js` and later we will start the application with `node index.js`. Add the following to the new file:

```js
/**
 *  index.js
 */
var app = require('@dadi/cdn')
```

### Start the server

CDN can be started from the command line simply by issuing the following command:

```bash
$ node index.js
```

With the default configuration, our CDN server is available at http://localhost:8001. Visiting this URL will display a welcome message.

### Configuration

CDN requires a configuration file specific to the application environment. For example in the production environment it will look for a file named `config.production.json`.

When CDN was installed, a development configuration file was created for you in a `config` folder at your application root. Full configuration documentation can be found at https://docs.dadi.tech/#cdn.


### Run CDN as a service
To run your CDN application in the background as a service, install Forever and Forever Service:

```bash
$ npm install forever forever-service -g

$ forever-service install -s index.js -e NODE_ENV=production cdn --start
```

> Note: the environment variable `NODE_ENV=production` must be set to the required configuration version matching the configuration files available in the `config` directory.

### Configuring an image source

Before you can serve assets or images you need to tell CDN where your files are located. Currently, CDN can serve your files from three types of source: [Amazon S3](https://docs.dadi.tech/#cdn/amazon-s3), [a remote server](https://docs.dadi.tech/#cdn/remote-server), and the [the local filesystem](https://docs.dadi.tech/#cdn/local-filesystem). We'll start using the local filesystem, but see the [full documentation](https://docs.dadi.tech/#cdn/defining-sources) for details on using the other source types.

The sample configuration file defines a local filesystem source. The `path` property is set to use an directory called `images` at the root of your application. CDN will look for your files at the location defined in this `path` property every time it handles a request.

#### Example

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 8001
  },
  "images": {
    "directory": {
      "enabled": true,
      "path": "./images"
    }
  }
}
```

We'll use the above configuration for an example. With image files in the `images` directory  we can make a request for one to view it in the browser:

##### Images available

```bash
$ my-app/images  ls -la
total 9464
drwxr-xr-x  4 root  wheel      136 13 Mar 13:02 .
drwxr-xr-x  4 root  wheel      136 13 Mar 13:01 ..
-rw-r--r--  1 root  wheel     9396 13 Mar 13:02 92875.jpg
-rw-r--r--  1 root  wheel  4832710 13 Mar 13:02 92876.jpg
```  

##### Browser request

http://127.0.0.1:8001/92875.jpg

## Links
* [CDN Documentation](https://docs.dadi.tech/#cdn)

## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2017 DADI+ Limited <support@dadi.tech><br />
All rights reserved

This product is part of DADI.<br />
DADI is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version ("the GPL").

**If you wish to use DADI outside the scope of the GPL, please
contact us at info@dadi.co for details of alternative licence
arrangements.**

**This product may be distributed alongside other components
available under different licences (which may not be GPL). See
those components themselves, or the documentation accompanying
them, to determine what licences are applicable.**

DADI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

The GNU General Public License (GPL) is available at
http://www.gnu.org/licenses/gpl-3.0.en.html.<br />
A copy can be found in the file GPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!
