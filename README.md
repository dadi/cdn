# DADI CDN / Documentation

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/cdn.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/@dadi/cdn)
&nbsp;![Coverage](https://img.shields.io/badge/Coverage-91%-brightgreen.svg?style=flat-square)&nbsp;[![Build](http://ci.dadi.technology/dadi/cdn/badge?branch=master&service=shield)](http://ci.dadi.technology/dadi/cdn)

## Overview

CDN is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversion. An authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is built on Node.JS, with support for external services  for retrieving assets from Amazon S3 and caching them in Redis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Why CDN?

The weight of the average product screen is about 2MB, and about two thirds of that weight comes from images. At the same time, a huge number of people are now accessing the Internet on 3G-or-worse connections that make a 2MB screen load a bit of a horror show. Even on a fast connection, a 2MB screen can wreak havoc on your users' data plans.

Average byte per screen by content type:

![Page weight breakdown](../assets/page-weight-graph.png)

Improving web performance and giving a better experience is critical to good product design.

Responsive images to the rescue! Right? Well, yes, but first we have to generate our responsive image assets. Thankfully DADI CDN makes this simple.

## Contents

* Overview (this document)
* Setup, installation and use
	* [Setup and installation](https://github.com/dadi/cdn/blob/docs/docs/setupAndInstallation.md)
  * [Complete guide: Ubuntu](https://github.com/dadi/cdn/blob/docs/docs/installGuide.ubuntu.md)
	* [Configuration](https://github.com/dadi/cdn/blob/docs/docs/configuration.md)
* Images
	* [Working with images](https://github.com/dadi/cdn/blob/docs/docs/workingWithImages.md)
	* [Image manipulation examples](https://github.com/dadi/cdn/blob/docs/docs/examples.imageManipulation.md)
	* [Image data](https://github.com/dadi/cdn/blob/docs/docs/imageData.md)
	* [Available filters](https://github.com/dadi/cdn/blob/docs/docs/availableFilters.md)
	* [Compression](https://github.com/dadi/cdn/blob/docs/docs/compression.md)
* JavaScript and CSS
	* [Working with JavaScript and CSS](https://github.com/dadi/cdn/blob/docs/docs/workingWithJavascriptAndCss.md)
	* [JavaScript and CSS examples](https://github.com/dadi/cdn/blob/docs/docs/examples.javascriptAndCss.md)
* [Delivery recipes](https://github.com/dadi/cdn/blob/docs/docs/deliveryRecipes.md)
* [Multi-domain support](https://github.com/dadi/cdn/blob/docs/docs/multiDomainSupport.md)
* [Invalidation API](https://github.com/dadi/cdn/blob/docs/docs/invalidationApi.md)
* [Response testing](https://github.com/dadi/cdn/blob/docs/docs/responseTesting.md)
* [Development](https://github.com/dadi/cdn/blob/docs/docs/development.md)
* [License](https://github.com/dadi/cdn/blob/docs/docs/license.md)
* [AGPL](https://github.com/dadi/cdn/blob/docs/docs/agpl.md)
