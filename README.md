# DADI CDN

![Build Status](http://img.shields.io/badge/Release-0.1.10_Beta-green.svg?style=flat-square)&nbsp;![Coverage](https://img.shields.io/badge/Coverage-88%-yellow.svg?style=flat-square)

## Contents

* [Overview](#overview)
* [Requirements](#requirements)
* [Setup and installation](#setup-and-installation)
* [Working with images](#working-with-images)
* [Examples](#examples)
* [Working with JavaScript and CSS](#working-with-javascript-and-css)
* [Delviery recipes](#delviery-recipes)
* [The invalidation API](#the-invalidation-api)
* [Configuration notes](#configuration-notes)
* [Testing](#testing)
* [Further reading](#further-reading)
* [Development](#development)

## Overview

CDN is built on Node.JS, with support for S3 and Redis. It is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversation. An authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Requirements

* Node.js (latest)
* ImageMagik (latest)
* libvips (latest)

## Setup and installation

`$ [sudo] git clone https://github.com/bantam-framework/barbu.git`

`$ cd barbu`

### Installing dependencies

To ensure your system has all the required dependencies, run the following command:

`$ [sudo] npm install`

### Running tests

The inclusion of opperational tests is work in progress. Watch this space.

### Starting the server

To start Barbu, issue the following command. This will start the server using the configuration settings found in the config.json file.

`$ [sudo] npm start`

#### Running the server in the background and as a service

Pro tip: to run Barbu in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service)

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

install barbu as a service and ensure it loads on boot:

`[sudo] forever-service install -s bantam/main.js barbu --start`

You can then interact with Barbu as a service using the following command:

- Start: `[sudo] start barbu`
- Stop: `[sudo] stop barbu`
- Status: `[sudo] status barbu`
- Restart `[sudo] restart barbu`

### Additional reading

You can see a complete installation guide for Barbu under Ubuntu [here](https://github.com/dadi/cdn/blob/docs/install.ubuntu.md).

## Working with images

The weight of the average product screen is about 2MB, and about two thirds of that weight comes from images. At the same time, a huge number of people are now accessing the Internet on 3G-or-worse connections that make a 2MB screen load a bit of a horror show. Even on a fast connection, a 2MB screen can wreak havoc on your users' data plans.

Average byte per screen by content type:

![Page weight breakdown](examples/page-weight-graph.png)

Improving web performance and giving a better experience is critical to good product design.

Responsive images to the rescue! Right? Well, yes, but first we have to generate our responsive image assets. Thankfully Barbu makes this simple.

### Request structure

`http{s}://{domain}/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/{srcData}`

### Image manipulation options

_Note: the format of the source image is automatically identified by Barbu_

| Parameter     | Type          | Description |
| :------------ | :------------ | :---------- |
| format | String | Output format, e.g. 'jpg', 'png', 'json' |
| quality | Integer | 1-100, default: 75. JPEG/MIFF/PNG compression level |
| trim | Boolean | Default: 0. Trims edges that are the background color |
| trimFuzz | Float | 0-1, default: 0. Trimmed color distance to edge color, 0 is exact |
| width | Integer | Default: 0 (inherits original image size). Px |
| height | Integer | Default: 0 (inherits original image size). Px |
| resizeStyle | String | Default: 0 (interipted as 'aspectfill'). Options: 'aspectfill', 'aspectfit', 'fill' |
| gravity | String | Default: 0 (interipted as 'none'). Used to position the crop area when resizeStyle is 'aspectfill'. Options: 'NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast', 'None' |
| filter | String | Default: 0 (interipted as 'none'). Resize filter. E.g. 'Lagrange', 'Lanczos'. See docs below for full list of candidates |
| blur | Integer | 0-1, default: 0. Adds blur to the image |
| strip | Boolean | Default: 0. Strips comments out from image |
| rotate | Integer | Default: 0. Rotates an image. Degrees |
| flip | Boolean | Default: 0. Flips an image vertically |
| srcData | String | Buffer with binary image data (including filepath) |

#### resizeStyle options

| Options     | Description |
| :------------ | :---------- |
| aspectfill | Keep the aspect ratio, get the exact provided size |
| fill | Forget the aspect ratio, get the exact provided size |
| aspectfit | Keep the aspect ratio, get maximum image that fits inside provided size |

### Examples

All images output in the examples below were created from this original image:

![Original image](examples/original.jpg)

#### Example #1: convert between formats

Convert from one format to another with quality control.

**Request**

`http(s)://your-domain.media/png/100/0/0/1920/1080/0/0/0/0/0/0/0/path/to/image.jpg`

**Converted to PNG**

![Converted to PNG at 100%](examples/jpeg-to-png.png)

#### Example #2: blur

**Request**

`http(s)://your-domain.media/jpg/80/0/0/1920/1080/0/0/0/5/0/0/0/path/to/image.jpg`

**Output**

![Original image](examples/blur.jpg)

#### Example #3: resize

Resized images by specifying width and height. There are three resizing styles:

* aspectfill: default. The resulting image will be exactly the specified size, and may be cropped
* aspectfit: scales the image so that it will not have to be cropped
* fill: squishes or stretches the image so that it fills exactly the specified size

**aspectfill**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/aspectfill/center/0/0/0/0/0/path/to/image.jpg`

![Original image](examples/aspectfill.jpg)

**aspectfit**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/aspectfit/center/0/0/0/0/0/path/to/image.jpg`

![Original image](examples/aspectfit.jpg)

**fill**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/fill/center/0/0/0/0/0/path/to/image.jpg`

![Original image](examples/fill.jpg)

#### Example #4: rotate, flip, and mirror

Rotate and flip images, and combine the two to mirror.

**Rotate 90º**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/0/0/0/0/0/90/0/path/to/image.jpg`

![Original image](examples/rotate-90.jpg)

**Rotate 180º**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/0/0/0/0/0/180/0/path/to/image.jpg`

![Original image](examples/rotate-180.jpg)

**Flip**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/0/0/0/0/0/0/1/path/to/image.jpg`

![Original image](examples/flip.jpg)

**Flip + rotate 180 degrees = mirror**

`http(s)://your-domain.media/jpg/100/0/0/1920/1080/0/0/0/0/0/180/1/path/to/image.jpg`

![Original image](examples/mirror.jpg)

### Outputting image details

Parsing the format type `json` will return JSON containing all of the available information about the image reuested.

For example:

	{
		"fileName": "guide-to-cosy-homes-chooser-im-55edc07ad2969.jpg",
		"cacheReference": "6d33e1828e83f9693efd1fee4c0bd7842bd17fa5",
		"fileSize": 521419,
		"format": "JPEG",
		"width": "690",
		"height": "388",
		"depth": 8,
		"density": {
			"width": 72,
			"height": 72
		},
		"exif": {
			"orientation": 1
		},
		"primaryColor": "#443831",
		"quality": "100",
		"trim": 0,
		"trimFuzz": 0,
		"resizeStyle": "aspectfill",
		"gravity": "Center",
		"filter": "None",
		"blur": 0,
		"strip": 0,
		"rotate": 0,
		"flip": 0
	}

## Working with JavaScript and CSS

After images, the second largest object of the average product screen is JavaScript and CSS. Minifying these assets alongside appropriately sized images ensures that your content reaches your audience in the fastest possible time.

Minification refers to the process of removing unnecessary or redundant data without affecting how the resource is processed by the browser - e.g. code comments and formatting, removing unused code, using shorter variable and function names, and so on.

### Request structure

`http{s}://{domain}/{input-format}/{minify}/{srcData}`

### Resource manipulation options

| Parameter     | Type          | Description |
| :------------ | :------------ | :---------- |
| input-format | String | The input format. Can be 'js' or 'css' |
| minify | Boolean | Default: 0. Minifys content for delivery |
| srcData | String | Buffer with JavaScript or CSS data (including filepath) |

### Examples

#### Example #1: JavaScript

Convert from one format to another with quality control.

**Request**

`http(s)://your-domain.media/js/1/path/to/javascript.js`

**Input**

	/**
	 * Says hello
	 */
	
	// display prompt box that ask for name and
	// store result in a variable called who
	var who = window.prompt("What is your name");
	
	// display prompt box that ask for favorite color and
	// store result in a variable called favcolor
	var favcolor = window.prompt("What is your favorite color");
	
	// write "Hello" followed by person' name to browser window
	document.write("Hello " + who);
	
	// Change background color to their favorite color
	document.bgColor = favcolor;

**Output**

	var who=window.prompt("What is your name");var favcolor=window.prompt("What is your favorite color");document.write("Hello "+who);document.bgColor=favcolor;

#### Example #2: CSS

**Request**

`http(s)://your-domain.media/css/1/path/to/css.css`

**Input**

	body {
	  background-color: silver;
	  color: white;
	  padding: 20px;
	  font-family: Arial, Verdana, sans-serif;}
	h1 {
	  background-color: #ffffff;
	  background-color: hsla(0,100%,100%,0.5);
	  color: #64645A;
	  padding: inherit;}
	p {
	  padding: 5px;
	  margin: 0px;}
	p.zero {
	  background-color: rgb(238,62,128);}
	p.one {
	  background-color: rgb(244,90,139);}
	p.two {
	  background-color: rgb(243,106,152);}
	p.three {
	  background-color: rgb(244,123,166);}
	p.four {
	  background-color: rgb(245,140,178);}
	p.five {
	  background-color: rgb(246,159,192);}
	p.six {
	  background-color: rgb(245,176,204);}

**Output**

	body{background-color:silver;color:white;padding:20px;font-family:Arial,Verdana,sans-serif}h1{background-color:#fff;background-color:hsla(0,100%,100%,0.5);color:#64645A;padding:inherit}p{padding:5px;margin:0}p.zero{background-color:rgb(238,62,128)}p.one{background-color:rgb(244,90,139)}p.two{background-color:rgb(243,106,152)}p.three{background-color:rgb(244,123,166)}p.four{background-color:rgb(245,140,178)}p.five{background-color:rgb(246,159,192)}p.six{background-color:rgb(245,176,204)}

## Delviery recipes

A Recipe is a predefined set of configuration options that are made avialble via a shortened URL, which hides the configuration options.

Recipes are defined in JSON files held in the `/workspace/recepes` folder.

### Example recepe

	{
		"recipe": "example-recipe-name",
		"settings": {
			"format": "jpg",
			"quality": "80",
			"trim": "0",
			"trimFuzz": "0",
			"width": "1024",
			"height": "768",
			"resizeStyle": "0",
			"gravity": "0",
			"filter": "0",
			"blur": "0",
			"strip": "0",
			"rotate": "0",
			"flip": "0"
		}
	}

### Using a recepe

Making use of a recepe is simple: call your image via the recipe name defined in the recepe JSON.

For example:

`http://youdomain.com/example-recipe-name/image-filename.png`

## The invalidation API

Barbu's cache, both local and Redis, can be invalidated on an individual image or file path basis using the invalidation API.

### Authorisation

The API requires authentication (two-legged OAuth). Authenticaiton credentuals in the form of the `clientId` and `secret` can be set in the config.json file.

You can get a bearer token as follows:

    POST /token HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Cache-Control: no-cache

    { "clientId": "testClient", "secret": "superSecret" }

Once you have the token, each request to the api should include a header similar to the one below (of course use your specific token):

    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

### Examples

#### 1.

POST http://{url}/api

	{
	  "invalidate": "some-image-name.jpg"
	}

Invalidate the image `some-image-name.jpg`, causing it to be renegerated at the point of next request.

#### 2.

POST http://{url}/api

	{
	  "invalidate": "/some-path/to/images"
	}

Invalidates all images fount within the directory `/some-path/to/images`, causing them to be renegerated at the point of next request.

## Configuration notes

The `server.host` config is passed to node's `server.listen` function
http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback

You should be able to set it to your IP as well, but depending on your hosting, that may be tricky. For example, on AWS you would have to use your private IP instead of your public IP.

The proper name should always resolve correctly. Alternately, you can set it to null, to accept connections on any IPv4 address.

Full information relating to the setting in `config.json` can be found [here](https://github.com/bantam-framework/barbu/blob/master/docs/configuration.md).

## Testing

Barbu outputs `X-Cache` headers, which are set to `HIT` for images/assets delivered from the cach and `MISS` for images/assets that are delivered directly from source.

The first request to an uncached image or asset will always return `MISS`, as the image/asset has to be returned once in order for it to be cached.

Make use of a [header check tool](http://www.webconfs.com/http-header-check.php) in order to check that your installation is properly caching and delivering your media.

## Further reading

The `docs/` directory contains additional documentation on the component parts of the system:

* [Available filters](https://github.com/bantam-framework/barbu/blob/master/docs/filters.md)
* [Compression](https://github.com/bantam-framework/barbu/blob/master/docs/compression.md)
* [Configuration](https://github.com/bantam-framework/barbu/blob/master/docs/configuration.md)
* [Multi-domain support](https://github.com/bantam-framework/barbu/blob/master/docs/domains.md)

Feel free to contact the Bantam core development team on team@bant.am with questions.

## Development

Bantam is based on an original concept by Joseph Denne.

Barbu was conceived, developed and is maintained by the engineering team at DADI+ ([https://dadi.co](https://dadi.co)).

Core contributors:

* Joseph Denne
* Carl Buelow

### Roadmap

We will capture planned updates and additions here. If you have anything to contribute in terms of future direction, please add as an enhancement request within [issues](https://github.com/bantam-framework/barbu/issues).

Planned additions:

* ~~CSS support (obfuscation and compression)~~
* ~~JavaScript support (obfuscation and compression)~~
* ~~Cloudfront invalidation chaining~~
* ~~Multiple domain support~~
* Cluster support (master/slave API construct)
* Integration of realtime analytics covering hits, bandwidth aggregates and throughput data
* Audio and video support (we like a challenge)

### Versioning

Semantic Versioning 2.0.0

Given a version number MAJOR.MINOR.PATCH, increment the:

* MAJOR version when you make incompatible API changes,
* MINOR version when you add functionality in a backwards-compatible manner, and
* PATCH version when you make backwards-compatible bug fixes.

_Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format._

### Contributing

Very daring.

Fork, hack, possibly even add some tests, then send a pull request :)

## Licence

Copyright (c) 2015, DADI+ Limited (https://dadi.co).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
