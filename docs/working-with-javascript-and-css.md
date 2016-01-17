# DADI CDN

## Working with JavaScript and CSS

After images, the second largest object of the average product screen is JavaScript and CSS. Minifying these assets alongside appropriately sized images ensures that your content reaches your audience in the fastest possible time.

Minification refers to the process of removing unnecessary or redundant data without affecting how the resource is processed by the browser - e.g. code comments and formatting, removing unused code, using shorter variable and function names, and so on.

### Request structure

`http{s}://{domain}/{input-format}/{minify}/{srcData}`

### Resource manipulation options

| Parameter     | Type          | Description |
| :------------ | :------------ | :---------- |
| input-format | String | The input format. Can be 'js' or 'css' |
| minify | Boolean | Default: 0. Minifys content for delivery |
| srcData | String | Buffer with JavaScript or CSS data (including filepath) |
