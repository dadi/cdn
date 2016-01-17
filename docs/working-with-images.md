# DADI CDN

## Working with images

The weight of the average product screen is about 2MB, and about two thirds of that weight comes from images. At the same time, a huge number of people are now accessing the Internet on 3G-or-worse connections that make a 2MB screen load a bit of a horror show. Even on a fast connection, a 2MB screen can wreak havoc on your users' data plans.

Average byte per screen by content type:

![Page weight breakdown](../assets/page-weight-graph.png)

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
