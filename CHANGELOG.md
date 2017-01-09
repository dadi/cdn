# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.7.1] - 2017-01-07

### Changed
* [#84](https://github.com/dadi/cdn/issues/184): Fix bug where the first part of the path was interpreted as a recipe/route/processor

## [1.7.0] - 2017-01-05

### Added
* [#130](https://github.com/dadi/cdn/issues/130): Add image upload support, allowing configuration of CDN to accept image uploads. See documentation at http://docs.dadi.tech/cdn/concepts/upload
* [#151](https://github.com/dadi/cdn/issues/151): Add external image support. See documentation at http://docs.dadi.tech/cdn/
* [#153](https://github.com/dadi/cdn/issues/153): CDN can be configured to respond to the route `/robots.txt`. Specify the path to a robots.txt file in the configuration file:

```json
"robots": "path/to/robots.txt"
```

### Changed
* [#155](https://github.com/dadi/cdn/issues/155): [@dadi/cache](http://www.npmjs.org/@dadi/cache) module now used in place of custom caching
* [#160](https://github.com/dadi/cdn/issues/160): Fix: image is now returned even if no query is specified
* [#177](https://github.com/dadi/cdn/issues/177): Fix compression when changing formats from PNG to JPG
* [#181](https://github.com/dadi/cdn/issues/181): Removed node-canvas dependency, which was only used for determining the primary colour of an image. This is now handled by [node-vibrant](https://github.com/akfish/node-vibrant). Removing node-canvas simplifies the install process. If interested, you can compare results from the new module with color-thief's demo page at http://lokeshdhakar.com/projects/color-thief/.
* [#182](https://github.com/dadi/cdn/issues/182): Fix crash when caching is enabled and a JSON response is requested (e.g. `/test.jpg?format=json`).
* Modified package dependencies to include the `lwip` dependency using the same identifying string as used by `smartcrop-lwip`. This fixes the problem where NPM treated the two dependencies as separate and compiled them both when installing, extending the installation process.
* validation added to route and recipe names, to ensure they are 5 or more characters and only a mix of letters, dashes and underscores
* creating a Recipe by sending a POST request must now be sent to `/api/recipes`, not `/api/recipes/new`
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

