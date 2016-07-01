# DADI CDN

## Working with images

### Request structure

There are currently two formats for requesting assets from DADI CDN.

#### Version 1

`http(s)://cdn.example.com/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{crop-x}/{crop-y}/{ratio}/{devicePixelRatio}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/{srcData}`

**Example**

`http://cdn.example.com/png/75/0/0/100/100/0/0/1-1/1/0/0/0/0/0/0/0/path/to/file.jpg`

#### Version 2

The second version of the request is less rigid than the original, utilising the querystring instead of the path to specify parameters. Using this structure allows specifying as many or as few options as actually required.

The basic form is:

`http(s)://cdn.example.com/{srcData}`

Any of the below parameters can then be added as querystring options.

**Example**

`http://cdn.example.com/path/to/file.jpg?format=png&quality=75&width=100&height=100`

**Note:** The version of request structure is determined by the presence or absence of a querystring. If you need
to deliver an asset in it's original state with no manipulation options specified, it is required
to add a dummy querystring to the request, e.g. `http(s)://www.example.com/{srcData}?v2`.

If the querystring is not present, DADI CDN will assume the request structure is using Version 1 and the
request will fail due to missing path parameters.

### Image manipulation options

_Note: the format of the source image is automatically identified by DADI CDN_

| Parameter     | Type          | Description |
| :------------ | :------------ | :---------- |
| format | String | Output format, e.g. 'jpg', 'png', 'json' |
| quality | Integer | 1-100, default: 75. JPEG/MIFF/PNG compression level |
| trim | Boolean | Default: 0. Trims edges that are the background color |
| trimFuzz | Float | 0-1, default: 0. Trimmed color distance to edge color, 0 is exact |
| width | Integer | Default: 0 (inherits original image size). Px |
| height | Integer | Default: 0 (inherits original image size). Px |
| crop-x | Integer | Default: 0. X position of crop area |
| crop-y | Integer | Default: 0. Y position of crop area |
| ratio | String | Default: 0.  Aspect ratio cropping. E.g. '16-9', '3-2' |
| devicePixelRatio | Integer | Default: 0. Zoom In/Out of Image |
| resizeStyle | String | Default: 0 (interpreted as 'aspectfill'). Options: 'aspectfill', 'aspectfit', 'fill', 'crop' |
| gravity | String | Default: 0 (interpreted as 'none'). Used to position the crop area when resizeStyle is 'aspectfill'. Options: 'NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast', 'None' |
| filter | String | Default: 0 (interpreted as 'none'). Resize filter. E.g. 'Lagrange', 'Lanczos'. See docs below for full list of filters |
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
| crop | x |