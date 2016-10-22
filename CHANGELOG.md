# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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

