# DADI CDN / Documentation

![Build Status](http://img.shields.io/badge/Release-0.1.10_Beta-green.svg?style=flat-square)&nbsp;![Coverage](https://img.shields.io/badge/Coverage-88%-yellow.svg?style=flat-square)

## Overview

CDN is built on Node.JS, with support for S3 and Redis. It is a high performance, just-in-time asset manipulation and delivery layer designed as a modern content distribution solution.

You can consider a full installation of DADI CDN as being analogous to a traditional CDN (Content Distribution Network) such as Akamai or Limelight. It is designed to carry the processing and delivery load associated with image manipulation and asset delivery (CSS/JS/fonts). It acts autonomously as a layer on top of your core product.

It has full support for caching, header control, image manipulation, image compression and image format conversation. An authenticated API allows for fine grained cache control in the form of content invalidation on an individual file or collective path basis.

CDN is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Contents

* [Overview](#overview)
* [Requirements](#requirements)
* [Setup and installation](#setup-and-installation)
* [Working with images](#working-with-images)
* [Working iwth images](#examples)
* [Image data](#image-data)
* [Working with JavaScript and CSS](#working-with-javascript-and-css)
* [Delviery recipes](#delviery-recipes)
* [The invalidation API](#the-invalidation-api)
* [Configuration notes](#configuration-notes)
* [Testing](#testing)
* [Further reading](#further-reading)
* [Development](#development)



* [Available filters](https://github.com/bantam-framework/barbu/blob/master/docs/filters.md)
* [Compression](https://github.com/bantam-framework/barbu/blob/master/docs/compression.md)
* [Configuration](https://github.com/bantam-framework/barbu/blob/master/docs/configuration.md)
* [Multi-domain support](https://github.com/bantam-framework/barbu/blob/master/docs/domains.md)
