# DADI CDN

## Installation guide: Ubuntu

### Overview

This document provides a simple step by step guide to installation on Ubuntu [14.04.1 LTS](http://releases.ubuntu.com/14.04.1/).

This guide assumes a single server using utilising local caching. For Redis setup instruction see [https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis).

### Installing DADI CDN

#### Prerequisites

The DADI platform follows the Node LTS (Long Term Support) release schedule, and as such
the version of Node required to run DADI CDN is coupled to the version of Node
currently in Active LTS. See the [LTS schedule](https://github.com/nodejs/LTS) for
further information.

#### Install Node.js v4 and NPM

```shell
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y build-essential
sudo npm install npm -g
```

#### Upgrade GCC++ Compiler

```shell
sudo add-apt-repository ppa:ubuntu-toolchain-r/test
sudo apt-get update -y
sudo apt-get install gcc-4.9 g++-4.9
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.9 60 --slave /usr/bin/g++ g++ /usr/bin/g++-4.9
```

#### Install dependencies

##### Image Libraries

sudo apt-get install libcairo2-dev libjpeg-dev libgif-dev

##### Sqwish CSS Compressor

sudo npm install -g sqwish

##### DADI CDN

###### Install from NPM

1. `mkdir my-cdn-app`
2. `cd my-cdn-app`
3. `npm init` - follow the prompts, accepting the defaults is usually enough`
4. `npm install --save @dadi/cdn`
5. `touch main.js`
6. add the following code to main.js
```js
var app = require('@dadi/cdn')
```
7. add the following to package.json
```json
"scripts": {
    "start": "node ./main.js --node-env=development"
}
```

###### Install from Git

1. `sudo git clone https://github.com/dadi/cdn.git`
2. `cd cdn/`
3. `sudo npm install`

#### Starting the server

*Note:* The CDN's log and cache directories are created at startup using settings in the current environment's configuration file. See files in `/config` for example configurations.

`[sudo] npm start`

#### Running DADI CDN as a service

To run DADI CDN as a service, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service):

`sudo npm install -g forever forever-service`

Install DADI CDN as a service and ensure it loads on boot:

`sudo forever-service install -s index.js -e NODE_ENV=production cdn --start`

_Note the environment variable - `NODE_ENV=production` - must be set to target the required config version._

You can then interact with DADI CDN as a service using the following command:

- Start: `[sudo] start cdn`
- Stop: `[sudo] stop cdn`
- Status: `[sudo] status cdn`
- Restart `[sudo] restart cdn`
