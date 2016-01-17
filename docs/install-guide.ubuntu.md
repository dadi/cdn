![Barbu](../barbu.png)

# Installation guide: Ubuntu

## Overview

This document provides a simple step by step guide to installation on Ubuntu [14.04.1 LTS](http://releases.ubuntu.com/14.04.1/).

This guide assumes a single server using utilising local caching. For Redis setup instruction see [https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis).

## Installing Barbu

### Node.js latest

1. `sudo apt-get update`
2. `sudo apt-get upgrade`
3. `sudo apt-get install python-software-properties`
4. `sudo add-apt-repository ppa:chris-lea/node.js`
5. `sudo apt-get update`
6. `sudo apt-get install nodejs`

### ImageMagick

1. `sudo apt-get install libmagick++-dev`

### VIPS

1. `sudo add-apt-repository -y ppa:lovell/trusty-backport-vips`
2. `sudo apt-get update`
2. `sudo apt-get install -y libvips-dev libgsf-1-dev`

### Misc. supporting packages

1. `sudo apt-get install make`
2. `sudo apt-get install g++`

### Barbu

Install GCC to provide the latest build of the c++ bson extension (not required, but improves performance) -

`sudo apt-get install gcc make build-essential`

Install Git and pull down the latest stable build of Serama -

1. `sudo apt-get install git`
2. `sudo git clone https://github.com/bantam-framework/barbu.git`
3. `cd barbu/`

Install Barbu -

*Note:* Barbu's log and cache directories are created at startup using settings in the main configuration file `config.json`.

`[sudo] npm install`

Perform Barbu's tests -

`[sudo] npm test`

Start Barbu -

`[sudo] npm start`

### Forever

To run Barbu in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service):

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

install barbu as a service and ensure it loads on boot:

`[sudo] forever-service install -s bantam/main.js -e NODE_ENV=production barbu --start`

_Note the environment variable - `NODE_ENV=production` - must be set to target the required config version._

You can then interact with Barbu as a service using the following command:

- Start: `[sudo] start barbu`
- Stop: `[sudo] stop barbu`
- Status: `[sudo] status barbu`
- Restart `[sudo] restart barbu`
