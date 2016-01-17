# DADI CDN

## Installation guide: Ubuntu

### Overview

This document provides a simple step by step guide to installation on Ubuntu [14.04.1 LTS](http://releases.ubuntu.com/14.04.1/).

This guide assumes a single server using utilising local caching. For Redis setup instruction see [https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis).

### Installing DADI CDN

#### Node.js latest

1. `curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -`
2. `sudo apt-get install -y nodejs`
3. `sudo apt-get install -y build-essential`

#### ImageMagick

1. `sudo apt-get install libmagick++-dev`

#### VIPS

1. `sudo add-apt-repository -y ppa:lovell/trusty-backport-vips`
2. `sudo apt-get update`
2. `sudo apt-get install -y libvips-dev libgsf-1-dev`

#### Misc. supporting packages

1. `sudo apt-get install make`
2. `sudo apt-get install g++`

#### CDN

Install GCC to provide the latest build of the c++ bson extension (not required, but improves performance) -

`sudo apt-get install gcc make build-essential`

Install Git and pull down the latest stable build of Serama -

1. `sudo apt-get install git`
2. `sudo git clone https://github.com/dadi/cdn.git`
3. `cd cdn/`

Install DADI CDN -

*Note:* DADI CDN's log and cache directories are created at startup using settings in the main configuration file `config.json`.

`[sudo] npm install`

Perform DADI CDN's tests -

`[sudo] npm test`

Start DADI CDN -

`[sudo] npm start`

#### Forever

To run DADI CDN in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service):

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

Install DADI CDN as a service and ensure it loads on boot:

`[sudo] forever-service install -s dadi/main.js -e NODE_ENV=production cdn --start`

_Note the environment variable - `NODE_ENV=production` - must be set to target the required config version._

You can then interact with DADI CDN as a service using the following command:

- Start: `[sudo] start cdn`
- Stop: `[sudo] stop cdn`
- Status: `[sudo] status cdn`
- Restart `[sudo] restart cdn`
