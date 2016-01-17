# DADI CDN

## Invalidation API

Barbu's cache, both local and Redis, can be invalidated on an individual image or file path basis using the invalidation API.

### Authorisation

The API requires authentication (two-legged OAuth). Authenticaiton credentuals in the form of the `clientId` and `secret` can be set in the config.json file.

You can get a bearer token as follows:

    POST /token HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Cache-Control: no-cache

    { "clientId": "testClient", "secret": "superSecret" }

Once you have the token, each request to the api should include a header similar to the one below (of course use your specific token):

    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

### Examples

#### 1.

POST http://{url}/api

	{
	  "invalidate": "some-image-name.jpg"
	}

Invalidate the image `some-image-name.jpg`, causing it to be renegerated at the point of next request.

#### 2.

POST http://{url}/api

	{
	  "invalidate": "/some-path/to/images"
	}

Invalidates all images fount within the directory `/some-path/to/images`, causing them to be renegerated at the point of next request.
