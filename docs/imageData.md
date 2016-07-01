# DADI CDN

## Image data

Passing the format type `json` will return a JSON response containing all of the available information about the image requested.

For example: `http://cdn.example.com/guide-to-cosy-homes-chooser-im-55edc07ad2969.jpg?format=json`

```js
  {
    "fileName": "guide-to-cosy-homes-chooser-im-55edc07ad2969.jpg",
    "cacheReference": "6d33e1828e83f9693efd1fee4c0bd7842bd17fa5",
    "fileSize": 521419,
    "format": "jpeg",
    "width": "690",
    "height": "388",
    "density": {
      "width": 72,
      "height": 72,
      "unit": "dpi"
    },
    "exif": {
      "orientation": 1
    },
    "trim": 0,
    "trimFuzz": 0,
    "resizeStyle": "aspectfill",
    "gravity": "Center",
    "filter": "None",
    "blur": 0,
    "strip": 0,
    "rotate": 0,
    "flip": 0,
    "ratio": 0,
    "devicePixelRatio": 0,
    "primaryColor": "#3e342c",
    "palette": {
      "rgb": [
        [ 219, 185, 151 ],
        [ 58, 47, 40 ],
        [ 154, 116, 88 ],
        [ 162, 178, 182 ],
        [ 110, 114, 105 ]
      ],
      "hex": [ "#dbb997", "#3a2f28", "#9a7458", "#a2b2b6", "#6e7269", ]
    }
  }
  ```