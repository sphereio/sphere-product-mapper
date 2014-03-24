![SPHERE.IO icon](https://admin.sphere.io/assets/images/sphere_logo_rgb_long.png)

# Node.js Utils

[![Build Status](https://secure.travis-ci.org/sphereio/sphere-node-utils.png?branch=master)](http://travis-ci.org/sphereio/sphere-node-utils) [![Coverage Status](https://coveralls.io/repos/sphereio/sphere-node-utils/badge.png)](https://coveralls.io/r/sphereio/sphere-node-utils) [![Dependency Status](https://david-dm.org/sphereio/sphere-node-utils.png?theme=shields.io)](https://david-dm.org/sphereio/sphere-node-utils) [![devDependency Status](https://david-dm.org/sphereio/sphere-node-utils/dev-status.png?theme=shields.io)](https://david-dm.org/sphereio/sphere-node-utils#info=devDependencies) [![NPM version](https://badge.fury.io/js/sphere-node-utils.png)](http://badge.fury.io/js/sphere-node-utils)

This module shares helpers among all [SPHERE.IO](http://sphere.io/) Node.js components.

## Table of Contents
* [Getting Started](#getting-started)
* [Documentation](#documentation)
  * [Helpers](#helpers)
    * [Logger](#logger)
    * [Sftp](#sftp)
    * [ProjectCredentialsConfig](#projectcredentialsconfig)
  * [Mixins](#mixins)
    * [Qbatch](#qbatch)
      * [all (batch processing)](#all-batch-processing)
    * [Underscore](#underscore)
      * [_.deepClone](#_deepclone)
      * [_.percentage](#_percentage)
      * [_.stringifyQuery](#_stringifyquery)
      * [_.parseQuery](#_parsequery)
* [Examples](#examples)
* [Releasing](#releasing)
* [License](#license)


## Getting Started

```coffeescript
SphereUtils = require 'sphere-node-utils'
Logger = SphereUtils.Logger
Sftp = SphereUtils.Sftp
Qbatch = SphereUtils.Qbatch
_u = SphereUtils._u

# or
{Logger, Sftp, Qbatch, _u} = require 'sphere-node-utils'
```

## Documentation

### Helpers
Currently following helpers are provided by `SphereUtils`:

- `Logger`
- `Sftp`

#### Logger
Logging is supported by the lightweight JSON logging module called [Bunyan](https://github.com/trentm/node-bunyan).

The `Logger` can be configured with following options
```coffeescript
logConfig:
  levelStream: 'info' # log level for stdout stream
  levelFile: 'debug' # log level for file stream
  path: './sphere-node-utils-debug.log' # where to write the file stream
  name: 'sphere-node-utils' # name of the application
  serializers:
    request: reqSerializer # function that maps the request object with fields (uri, method, headers)
    response: resSerializer # function that maps the response object with fields (status, headers, body)
  src: false # includes a log of the call source location (file, line, function).
             # Determining the source call is slow, therefor it's recommended not to enable this on production.
  streams: [ # a list of streams that defines the type of output for log messages
    {level: 'info', stream: process.stdout}
    {level: 'debug', path: './sphere-node-utils-debug.log'}
  ]
```

> A `Logger` instance should be extended by the component that needs logging by providing the correct configuration

```coffeescript
{Logger} = require 'sphere-node-utils'

module.exports = class extends Logger

  # we can override here some of the configuration options
  @appName: 'my-application-name'
  @path: './my-application-name.log'
```

A `Bunyan` logger can also be created from another existing logger. This is useful to connect sub-components of the same application by sharing the same configuration.
This concept is called **[child logger](https://github.com/trentm/node-bunyan#logchild)**.

```coffeescript
{Logger} = require 'sphere-node-utils'
class MyCustomLogger extends Logger
  @appName: 'my-application-name'

myLogger = new MyCustomLogger logConfig

# assume we have a component which already implements logging
appWithLogger = new AppWithLogger
  logConfig:
    logger: myLogger

# now we can use `myLogger` to log and everything logged from the child logger of `AppWithLogger`
# will be logged with a `widget_type` field, meaning the log comes from the child logger
```

Once you configure your logger, you will get JSON stream of logs based on the level you defined. This is great for processing, but not for really human-friendly.
This is where the `bunyan` command-line tool comes in handy, by providing **pretty-printed** logs and **filtering**. More info [here](https://github.com/trentm/node-bunyan#cli-usage).

```bash
# examples

# this will output the content of the log file in a `short` format
bunyan sphere-node-connect-debug.log -o short
00:31:47.760Z  INFO sphere-node-connect: Retrieving access_token...
00:31:48.232Z  INFO sphere-node-connect: GET /products

# directly pipe the stdout stream
jasmine-node --verbose --captureExceptions test | ./node_modules/bunyan/bin/bunyan -o short
00:34:03.936Z DEBUG sphere-node-connect: OAuth constructor initialized. (host=auth.sphere.io, accessTokenUrl=/oauth/token, timeout=20000, rejectUnauthorized=true)
    config: {
      "client_id": "S6AD07quPeeTfRoOHXdTx2NZ",
      "client_secret": "7d3xSWTN5jQJNpnRnMLd4qICmfahGPka",
      "project_key": "my-project",
      "oauth_host": "auth.sphere.io",
      "api_host": "api.sphere.io"
    }
00:34:03.933Z DEBUG sphere-node-connect: Failed to retrieve access_token, retrying...1

```

#### Sftp
_(Coming soon)_

#### ProjectCredentialsConfig

Provides sphere credentials based on the project key.

Following files are used to store the credentials and would be searched (descending priority):

* ./.sphere-project-credentials
* ./.sphere-project-credentials.json
* ~/.sphere-project-credentials
* ~/.sphere-project-credentials.json
* /etc/.sphere-project-credentials
* /etc/.sphere-project-credentials.json

### Mixins
Currently following mixins are provided by `SphereUtils`:

- `Qbatch`
  - `all`
- `underscore`
  - `deepClone`
  - `percentage`
  - `stringifyQuery`
  - `parseQuery`

#### Qbatch

##### `all` (batch processing)
Batch processing allows a list of promises to be executed in chunks, by defining a limit to how many requests can be sent in parallel.
The `Qbatch.all` function is actually a promise itself which recursively resolves all given promises in batches.

```coffeescript
# let's assume we have a bunch of promises (e.g.: 200)
allPromises = [p1, p2, p3, ...]

Qbatch.all(allPromises)
.then (result) ->
.fail (error) ->
```

Default max number of parallel request is `**50**`, you can configure this in the second argument.

```coffeescript
# with custom limit (max number of parallel requests)
Qbatch.all(allPromises, 100)
.then (result) ->
.fail (error) ->
```

You can also subscribe to **progress notifications** of the promise

```coffeescript
Qbatch.all(allPromises)
.then (result) ->
.progress (progress) ->
  # progress is an object containing the current progress percentage
  # and the value of the current results (array)
  # {percentage: 20, value: [r1, r2, r3, ...]}
.fail (error) ->
```

#### Underscore
A collection of methods to be used as `underscore` mixins. To install

```coffeescript
_ = require 'underscore'
{_u} = require 'sphere-node-utils'
_.mixin _u

# or
_.mixin require('sphere-node-utils')._u
```

##### `_.deepClone`
Returns a deep clone of the given object

```coffeescript
obj = {...} # some object with nested values
cloned = _.deepClone(obj)
```

##### `_.percentage`
Returns the percentage of the given values

```coffeescript
value = _.percentage(30, 500)
# => 6
```

##### `_.stringifyQuery`
Returns a URL query string from a key-value object

```coffeescript
params =
  where: encodeURIComponent('name = "Foo"')
  staged: true
  limit: 100
  offset: 2
_.stringifyQuery(params)
# => 'where=name%20%3D%20%22Foo%22&staged=true&limit=100&offset=2'
```

##### `_.parseQuery`
Returns a key-value JSON object from a query string
> Note that all values are parsed as string

```coffeescript
query = 'where=name%20%3D%20%22Foo%22&staged=true&limit=100&offset=2'
_.parseQuery(query)
# => {where: encodeURIComponent('name = "Foo"'), staged: 'true', limit: '100', offset: '2'}
```

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).
More info [here](CONTRIBUTING.md)

## Releasing
Releasing a new version is completely automated using the Grunt task `grunt release`.

```javascript
grunt release // patch release
grunt release:minor // minor release
grunt release:major // major release
```

## License
Copyright (c) 2014 SPHERE.IO
Licensed under the [MIT license](LICENSE-MIT).
