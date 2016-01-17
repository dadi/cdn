# DADI CDN

## Delviery recipes

A Recipe is a predefined set of configuration options that are made avialble via a shortened URL, which hides the configuration options.

Recipes are defined in JSON files held in the `/workspace/recepes` folder.

### Example recepe

	{
		"recipe": "example-recipe-name",
		"settings": {
			"format": "jpg",
			"quality": "80",
			"trim": "0",
			"trimFuzz": "0",
			"width": "1024",
			"height": "768",
			"resizeStyle": "0",
			"gravity": "0",
			"filter": "0",
			"blur": "0",
			"strip": "0",
			"rotate": "0",
			"flip": "0"
		}
	}

### Using a recepe

Making use of a recepe is simple: call your image via the recipe name defined in the recepe JSON.

For example:

`http://youdomain.com/example-recipe-name/image-filename.png`
