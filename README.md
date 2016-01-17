# DADI CDN / Documentation

![Build Status](http://img.shields.io/badge/Release-0.1.10_Beta-green.svg?style=flat-square)&nbsp;![Coverage](https://img.shields.io/badge/Coverage-88%-yellow.svg?style=flat-square)

## Overview

CDN is built on Node.JS, with support for S3 and Redis. It is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversation. An authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Contents

* Overview (this document)
* [Requirements](https://github.com/dadi/cdn/blob/docs/docs/requirements.md)
* Setup, installation and use
	* [Setup and installation](https://github.com/dadi/cdn/blob/docs/docs/setup-and-installation.md)
	* [Configuration](https://github.com/dadi/cdn/blob/docs/docs/configuration.md)
	* [Configuration notes](https://github.com/dadi/cdn/blob/docs/docs/configuration-notes.md)
	* [Complete guide: Ubuntu](https://github.com/dadi/cdn/blob/docs/docs/install-guide.ubuntu.md)
* Images
	* [Working with images](https://github.com/dadi/cdn/blob/docs/docs/working-with-images.md)
	* [Image manipulation examples](https://github.com/dadi/cdn/blob/docs/docs/image-manipulation-examples.md)
	* [Image data](https://github.com/dadi/cdn/blob/docs/docs/image-data.md)
	* [Available filters](https://github.com/dadi/cdn/blob/docs/docs/available-filters.md)
	* [Compression](https://github.com/dadi/cdn/blob/docs/docs/compression.md)
* JavaScript and CSS
	* [Working with JavaScript and CSS](https://github.com/dadi/cdn/blob/docs/docs/working-with-javascript-and-css.md)
	* [JavaScript and CSS examples](https://github.com/dadi/cdn/blob/docs/docs/javascript-and-css-examples.md)
* [Delivery recipes](https://github.com/dadi/cdn/blob/docs/docs/delivery-recipes.md)
* [Multi-domain support](https://github.com/dadi/cdn/blob/docs/docs/multi-domain-support.md)
* [Invalidation API](https://github.com/dadi/cdn/blob/docs/docs/invalidation-api.md)
* [Testing](https://github.com/dadi/cdn/blob/docs/docs/testing.md)
* [Development](https://github.com/dadi/cdn/blob/docs/docs/development.md)
* [License](https://github.com/dadi/cdn/blob/docs/docs/license.md)
