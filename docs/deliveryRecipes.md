# DADI CDN

## Asset Delivery Recipes

A "recipe" is a predefined set of configuration options that are made avialble via a shortened URL, hiding the configuration options from the end user.

Recipes are defined in JSON files held in the `/workspace/recipes` folder.

**Example recipe**

```js
{
  "recipe": "thumbnail",
  "settings": {
    "format": "jpg",
    "quality": "80",
    "width": "150",
    "height": "150",
    "resizeStyle": "crop"
  }
}
```

### Using a Recipe

Making use of a recipe is simple: call your image via the recipe name defined in the recipe JSON.

For example:

`http://www.example.com/thumbnail/image-filename.jpg`

