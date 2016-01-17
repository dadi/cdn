# DADI CDN

## Testing

DADI CDN outputs `X-Cache` headers, which are set to `HIT` for images/assets delivered from the cach and `MISS` for images/assets that are delivered directly from source.

The first request to an uncached image or asset will always return `MISS`, as the image/asset has to be returned once in order for it to be cached.

Make use of a [header check tool](http://www.webconfs.com/http-header-check.php) in order to check that your installation is properly caching and delivering your media.
