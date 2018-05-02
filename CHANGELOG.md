# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [3.0.0-RC2] - 2018-05-02

## Changed

* [#345](https://github.com/dadi/cdn/issues/345): stop requiring the existence of the domains directory if multi-domain is not enabled and handle it gracefully with an informative error message if it is enabled and the directory doesn't exist

## [3.0.0-RC1] - 2018-04-24

## Added

* [#254](https://github.com/dadi/cdn/issues/313): ability to define full remote URLs at recipe level
* [#313](https://github.com/dadi/cdn/issues/313): add config export
* [#314](https://github.com/dadi/cdn/issues/314): allow controller plugins to set X-Cache header
* [#326](https://github.com/dadi/cdn/pull/326): use domain as part of cache key
* [#327](https://github.com/dadi/cdn/pull/327): return 404 if multi-domain is enabled and a request is made for a domain that is not configured
* [#330](https://github.com/dadi/cdn/issues/331): add file monitors to domain-specific workspace directories
* [#331](https://github.com/dadi/cdn/issues/331): make `/api/recipes` and `/api/routes` endpoints work with multiple domains
* [#336](https://github.com/dadi/cdn/pull/336): flush cache by domain

## Changed

* [#324](https://github.com/dadi/cdn/issues/324): modify cache flush endpoint to match other products
* [#329](https://github.com/dadi/cdn/pull/329): remove upload support

## [2.0.0] - 2018-03-13

## Added

[Full release notes](https://github.com/dadi/cdn/releases/tag/v2.0.0)

* Plugin support
* On-demand JavaScript transpiling (experimental)
* Support for any type of asset
* [#259](https://github.com/dadi/cdn/issues/259) WebP image support
* Simplified paths for non-image assets

## Changed

* [#255](https://github.com/dadi/cdn/issues/255): default value for the `resizeStyle` property is now `aspectfit`, except when an explicit ratio is defined (i.e. `width` and `height` or `ratio` are defined)
* [#282](https://github.com/dadi/cdn/issues/282): deliver the fallback image even when crop is present
* [#283](https://github.com/dadi/cdn/issues/283): use correct dimensions when original or calculated size is above the configured security limit
* [#291](https://github.com/dadi/cdn/issues/291): cache JSON response of images, in the same way as the actual images are
* refactor parts of the code base to use ES6 features
* fix an issue where the `gravity` URL parameter was not applied correctly
* fix an issue whereby it was not possible to minify JavaScript files that contain ES6 code
* begin removal of Underscore.js dependency

## [1.13.3] - 2017-11-02

## Changed

* [#276](https://github.com/dadi/cdn/issues/276): ensure images can be processed with no sharpening

## [1.13.2] - 2017-10-25

## Changed

* fix an issue where the aspect ratio was not respected when maxWidth/maxHeight resizes were being made

## [1.13.1] - 2017-10-21

## Changed

* [#260](https://github.com/dadi/cdn/pulls/260): update [finalhandler](https://www.npmjs.com/package/finalhandler) to version 1.1.0
* [#264](https://github.com/dadi/cdn/pulls/264): update [request](https://www.npmjs.com/package/request) to version 2.83.0
* [#267](https://github.com/dadi/cdn/pulls/267): make options from recipe take precedence in Image handler
* [#272](https://github.com/dadi/cdn/pulls/272): update [should](https://www.npmjs.com/package/should) to version 13.1.2

## [1.13.0] - 2017-10-20

## Changed

* [#270](https://github.com/dadi/cdn/issues/270): cropping modifications to make it behave more intuitively. DevicePixelRatio is now respected, along with distorting images by providing both width & height. These changes only affect resize style `crop`. See the [documentation](https://docs.dadi.tech/#cdn) for more information.

## [1.12.0] - 2017-09-01

The image processor used in CDN has been replaced. We are currently pinned to Node.js 6.9.2 for most CDN installations, as lwip will not build on more recent (and less [vulnerable](https://nodejs.org/en/blog/vulnerability/july-2017-security-releases/)) versions of Node.js.

We’ve now implemented [Sharp](http://sharp.dimens.io/en/stable/) in CDN. It is much faster than lwip: running a test using a Buffer as both input and output, Sharp averages 29.08 operations per second, while lwip manages just 1.87 operations per second - that's around 15 times faster.

Other than improved performance, Sharp offers us a smoother transition into adding plugin support to CDN and being able to offer features such as [dynamic text and image compositing](https://github.com/dadi/cdn/issues/173).

### Changed

[#243](https://github.com/dadi/cdn/issues/243): remove restriction on configuration file names
[#247](https://github.com/dadi/cdn/issues/247): respond with error when loading from a URL returns no image data


## [1.11.1] - 2017-03-22

### Changed
* Remote image requests that followed a redirect sometimes return a redirect header that is a path only, without protocol and hostname. Updated the `wget-improved` dependency to handle this case

## [1.11.0] - 2017-03-21

### Added

* [#209](https://github.com/dadi/cdn/issues/209): Add post install script to copy a sample development configuration file to the application root

### Changed
* [#218](https://github.com/dadi/cdn/issues/218): Set a default file extension of JPG for remote image requests that don't include an extension
* [#223](https://github.com/dadi/cdn/issues/223): Ensure that querystring parameters on remote URLs are retained and passed to the remote request
* Return 403 errors from remote requests ([c31a980](https://github.com/dadi/cdn/pull/229/commits/c31a98061dc0b5ea54a8ba8cf3163f9d9b8ca7c0))

## [1.10.3] - 2017-03-10

### Changed

* package.json to reduce vulnerabilities ([728d4ea3](https://github.com/dadi/cdn/commit/728d4ea3))

## [1.10.2] - 2017-03-07

### Changed

* return file with extension when url is extension-less ([5d5774c1](https://github.com/dadi/cdn/commit/5d5774c1))

## [1.10.1] - 2017-03-05

### Changed

* [#216](https://github.com/dadi/cdn/issues/216): remove sharpening for PNG format ([ebc87e33](https://github.com/dadi/cdn/commit/ebc87e33))

## [1.10.0] - 2017-02-17

### Added
- [#211](https://github.com/dadi/cdn/pull/211): run in cluster mode by default when in production ([6902d119](https://github.com/dadi/cdn/commit/6902d119))

## [1.9.0] - 2017-02-17

### Added

- add a new configuration parameter (`images.remote.allowFullURL`) which toggles the use of remote images from a full URL (e.g. `https://cdn.com/https://another-full-url.com/image.jpg`). Allowing images to be loaded from anywhere means that people can, in theory, use my instance of CDN to load, manipulate and deliver their images on their site, so I think it should be something I actively choose to enable. ([1fbde477](https://github.com/dadi/cdn/commit/1fbde477))

- add three additional environment variables:
  - `PORT`: specifies the server port
  - `CACHE_ENABLE_DIRECTORY`: toggles directory-based caching
  - `CACHE_ENABLE_REDIS`: toggles Redis caching

## [1.8.2] - 2017-02-01

### Changed
- ensure uploaded files have safe filenames ([6b9fea42](https://github.com/dadi/cdn/commit/6b9fea42))

## [1.8.1] - 2017-01-24

### Changed
- load js files and json files in workspace ([ba5b4a92](https://github.com/dadi/cdn/commit/ba5b4a92))

## [1.8.0] - 2017-01-18

### Added
- SSL handling improvements ([2ab581e0](https://github.com/dadi/cdn/commit/2ab581e0))
- add redirectPort to config ([867f85e5](https://github.com/dadi/cdn/commit/867f85e5))

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

