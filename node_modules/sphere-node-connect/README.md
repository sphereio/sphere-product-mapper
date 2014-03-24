# sphere-node-connect

[![Build Status](https://secure.travis-ci.org/emmenko/sphere-node-connect.png?branch=master)](http://travis-ci.org/emmenko/sphere-node-connect) [![NPM version](https://badge.fury.io/js/sphere-node-connect.png)](http://badge.fury.io/js/sphere-node-connect) [![Coverage Status](https://coveralls.io/repos/emmenko/sphere-node-connect/badge.png?branch=master)](https://coveralls.io/r/emmenko/sphere-node-connect?branch=master) [![Dependency Status](https://david-dm.org/emmenko/sphere-node-connect.png?theme=shields.io)](https://david-dm.org/emmenko/sphere-node-connect) [![devDependency Status](https://david-dm.org/emmenko/sphere-node-connect/dev-status.png?theme=shields.io)](https://david-dm.org/emmenko/sphere-node-connect#info=devDependencies)

Quick and easy way to connect your Node.js app with [SPHERE.IO](http://sphere.io).

## Getting Started
Install the module with: `npm install sphere-node-connect`

```javascript
var sphere_connect = require('sphere-node-connect');
var oa = sphere_connect.OAuth2;
var rest = sphere_connect.Rest;
```

## Documentation
The connector exposes 2 objects: `OAuth2` and `Rest`.

The `OAuth2` is used to retrieve an `access_token`

```javascript
var oa = new OAuth2({
  config: {
    client_id: "",
    client_secret: "",
    project_key: ""
  },
  host: "auth.sphere.io", // optional
  accessTokenUrl: "/oauth/token" // optional,
  timeout: 20000, // optional
  rejectUnauthorized: true // optional
});
oa.getAccessToken(callback)
```

The `Rest` is used to comunicate with the HTTP API.

```javascript
var rest = new Rest({
  config: {
    client_id: "",
    client_secret: "",
    project_key: ""
  },
  host: "api.sphere.io", // optional
  access_token: "", // optional (if not provided it will automatically retrieve an access_token)
  timeout: 20000, // optional
  rejectUnauthorized: true, // optional
  oauth_host: "auth.sphere.io" // optional (used when retrieving the access_token internally)
  user_agent: 'my client v0.1' // optional
});

rest.GET(resource, callback)
rest.POST(resource, payload, callback)
```

The `Rest` object, when instantiated, has an internal instance of the `OAuth` module accessible with `rest._oauth`. This is mainly used internally to automatically retrieve an `access_token`.

Currently `GET`, `POST` and `DELETE` are supported.


### Error handling
Since the connector is basically a wrapper of the [`request`](https://github.com/mikeal/request#requestoptions-callback) HTTP Client, the `callback` function comes directly from there, meaning that the 3 arguments are the same:

- `error`: an error object when applicable (usually from [`http.ClientRequest`](http://nodejs.org/api/http.html#http_class_http_clientrequest) object) otherwise `null`
- `response`: an [`http.IncomingMessage`](http://nodejs.org/api/http.html#http_http_incomingmessage) object containing all kind of information about the request / response
- `body`: a JSON object (automatically parsed)

As the SPHERE.IO [HTTP API](http://commercetools.de/dev/http-api.html) returns JSON responses either with resources or [error messages](http://commercetools.de/dev/http-api-projects-errors.html), the application should check the response `statusCode` and decide what to do.
It's always a good practice to check first for the existence of an `error` object in case there was a problem with the http client request.

```javascript
function(error, response, body) {
  if (error) {
    // do something
  }

  if (response.statusCode == 200) {
    // ok
  } else {
    // do something else
  }
}
```


## Examples
```javascript
oa.getAccessToken(function(error, response, body){
  if (response.statusCode is 200) {
    var access_token = body.access_token;
  } else
    throw new Error("Failed to get Access Token.")
})
```

```javascript
// Get a list of all products
rest.GET("/products", function(error, response, body){
  console.log(body);
});

// Create a new product
rest.POST("/products", {
  name: { en: "Foo" },
  slug: { en: "foo" },
  productType: { id: "123", typeId: "product-type" }
}, function(error, response, body){
  console.log(body);
});

// Update a product
rest.POST("/products/123", {
  version: 1,
  actions: [
    { action: "changeName", name: { en: "Boo" } }
  ]
}, function(error, response, body){
  console.log(body);
});

// Delete a product
rest.DELETE("/product/abc?version=3", function(error, response, body) {
  if (response.statusCode == 200) {
    console.log("Product successfully deleted.");
  } else if (response.statusCode == 404) {
    console.log("Product does not exist.");
  } else if (response.statusCode == 400) {
    console.log("Product version does not match.");
  }
});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

Define your SPHERE.IO credentials into a `config.js`. Since the tests run against 2 projects on different environments you need to provide the credentials for both. If you just have one project You can provide the same credentials for both.

```javascript
/* SPHERE.IO credentials */
exports.config = {
  staging: {
    client_id: "",
    client_secret: "",
    project_key: "",
    oauth_host: "auth.sphere.io",
    api_host: "api.sphere.io"
  },
  prod: {
    client_id: "",
    client_secret: "",
    project_key: "",
    oauth_host: "auth.sphere.io",
    api_host: "api.sphere.io"
  }
}
```

## Releasing
Releasing a new version is completely automated using the Grunt task `grunt release`.

```javascript
grunt release // patch release
grunt release:minor // minor release
grunt release:major // major release
```

## Styleguide
We <3 CoffeeScript! So please have a look at this referenced [coffeescript styleguide](https://github.com/polarmobile/coffeescript-style-guide) when doing changes to the code.

## License
Copyright (c) 2013 Nicola Molinari
Licensed under the MIT license.
