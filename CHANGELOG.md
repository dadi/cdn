# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.7.0] - 2016-11-30

### Added
* image upload (https://github.com/dadi/cdn/issues/130). Allows configuration of CDN to accept image uploads. See documentation at http://docs.dadi.tech/cdn/concepts/upload
* external image requests now possible (https://github.com/dadi/cdn/issues/151). See documentation at http://docs.dadi.tech/cdn/
* CDN can be configured to respond to the route `/robots.txt` (https://github.com/dadi/cdn/issues/153). Specify the path to a robots.txt file in the configuration file:

```json
"robots": "path/to/robots.txt"
```

### Changed
* image is now returned even if no query is specified (https://github.com/dadi/cdn/issues/160)
* [@dadi/cache](http://www.npmjs.org/@dadi/cache) module now used in place of custom caching (https://github.com/dadi/cdn/issues/155)
* replaced Bluebird Promises with native Promises
* removed Redis dependencies, as these are now handled in @dadi/cache

## [1.6.2] - 2016-10-22
### Changed
When specifying only two crop coordinates, the crop rectangle wasn't being correctly set.

Using v2 of the request format, cropped images should be requested as follows:

**Format of parameters:** `?resize=crop&crop=top,left,bottom,right`

1. specifying the full crop rectangle: http://cdn.example.com/images/taylor_swift.jpg?resize=crop&crop=0,225,312,567
  * the image is not resized; the resulting image will be 312px x 342px
2. specifying the top left corner of the crop rectangle: http://cdn.example.com/images/taylor_swift.jpg?resize=crop&crop=0,225
  * the size of the crop rectangle is determined by the size of the image; if the original image is 800px x 600px, the crop rectangle and resulting image size will be 575px x 600px

Adding `width=400` will cause CDN to resize the image after cropping.

