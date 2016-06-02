# DADI CDN

## Working with JavaScript and CSS

After images, the second largest object of the average product screen is JavaScript and CSS. Minifying these assets alongside appropriately sized images ensures that your content reaches your audience in the fastest possible time.

Minification refers to the process of removing unnecessary or redundant data without affecting how the resource is processed by the browser - e.g. code comments and formatting, removing unused code, using shorter variable and function names, and so on.

### Request structure

There are currently two formats for requesting assets from DADI CDN.

#### Version 1

`http(s)://www.exmaple.com/{input-format}/{compress}/{srcData}`

#### Version 2

The second version of the request is less rigid than the original, utilising the querystring instead of the path to specify parameters. Using this structure allows specifying as many or as few options as actually required.

`http(s)://www.exmaple.com/{srcData}?compress=0`

**Note:** The format of the asset is determined from the file extension.

**Note:** The version of the request structure is determined by the presence or absence of a querystring. If you want
to deliver an asset with no compression and leave out the `compress` parameter (as it will default to no compression), it is still required
to add a dummy querystring to the request, e.g. `http(s)://www.example.com/{srcData}?v2`.

If the querystring is not present, DADI CDN will assume the request structure is using Version 1 and the
request will fail due to the missing path parameters.

### Resource manipulation options

| Parameter     | Type          | Description |
| :------------ | :------------ | :---------- |
| input-format | String | The input format. Can be 'js' or 'css' |
| compress | Boolean | Default: 0. Minifies content for delivery |
| srcData | String | Buffer with JavaScript or CSS data (including filepath) |
