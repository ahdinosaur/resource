//
// resource.js - resource module for node.js
//

//
// Create a resource singleton
//
var resource = {};

var EventEmitter = require('eventemitter2').EventEmitter2;

resource = new EventEmitter({
  wildcard: true, // event emitter should use wildcards ( * )
  delimiter: '::', // the delimiter used to segment namespaces
  maxListeners: 20, // the max number of listeners that can be assigned to an event
});

var colors = require('colors');

//
// Require a simple JSON-Schema validator
//
var validator = resource.validator = require('./vendor/validator');
var helper = resource.helper = require('./lib/helper');
var logger = resource.logger = require('./lib/logger');
resource.load = require('./lib/load');
resource.use = require('./lib/use');

//
// Resource environment, either set to NODE_ENV or "development"
//
resource.env = process.env.NODE_ENV || 'development';

resource.isResource = resource.helper.isResource;

resource.installing = {};
resource._queue = [];

//
// On the resource, create a "resources" object that will store a reference to every defined resource
//
resource.resources = {};


/*

 A quick primer on working with Events and Resource Methods

 The resource module itself is an Event Emitter

   resources('hello', fn);
   resource.emit('hello', fn)

 All defined resources are also Event Emitters

   resource.resources.creature.on('hello', fn)
   resource.resources.creature.emit('hello', fn)

 When resource methods are executed on a defined resource, a local resource event is emitted

   resource.resources.creature.create({ type: 'dragon' }, fn); => resource.resources.creature.emit('create', { type: 'dragon' });

 When any event is emitted from a defined resource, it is rebroadcasted to the resource module ( delimited with :: )

  resource.resources.creature.create({ type: 'dragon' }, fn); => resource.emit('creature::create', { type: 'dragon' });

*/
resource._emit = resource.emit;
resource.emit = function () {
  var args = [].slice.call(arguments),
      event = args.shift(),
      splitted = event.split('::'),
      r;

  if (splitted.length > 1 && resource[splitted[0]]) {
    r = resource[splitted[0]];
  }

  if (r && r._emit) {
    r._emit.apply(r, [ splitted.slice(1).join('::') ].concat(args));
  }
  return resource._emit.apply(resource, [ event ].concat(args));
};

//
// Defines a new resource
//
resource.define = function (name, options) {

  //
  // Resources are event emitters
  //
  var r = new EventEmitter({
    wildcard: true, // event emitter should use wildcards ( * )
    delimiter: '::', // the delimiter used to segment namespaces
    maxListeners: 20, // the max number of listeners that can be assigned to an event
  });

  options = options || {};

  //
  // Initalize the resource with default values
  //
  r.name = name;

  //
  // Resource starts with no methods
  //
  r.methods = {};

  //
  // Resource starts with no schema
  //
  r.schema = options.schema || {
    "description": "",
    "properties": {
      "id": {
        "type": "any"
      }
    }
  };

  //
  // If any additional configuration data has been passed in assign it to the resource
  //
  r.config = options.config || {};

  //
  // Any local resource events should be re-emitted to the resource module scope
  //
  r._emit = r.emit;
  r.emit = function () {
    var args = [].slice.call(arguments),
        event = args.shift();

    resource._emit.apply(resource, [ r.name + '::' + event ].concat(args));
    return r._emit.apply(r, [ event ].concat(args));
  };

  //
  // Give the resource a property() method for creating new resource properties
  //
  r.property = function (name, schema) {
    addProperty(r, name, schema);
  };

  //
  // Give the resource a method() method for creating new resource methods
  //
  r.method = function (name, method, schema) {
    if (typeof method !== 'function') {
      throw new Error('a function is required as the second argument to `resource.method()`');
    }
    addMethod(r, name, method, schema);
  };

  //
  // Give the resource a .before() method for defining before hooks on resource methods
  //
  r.before = function (method, callback) {
    //
    // If no method exists on the resource yet create a place holder,
    // in order to be able to lazily define hooks on methods that dont exist yet
    //
    if (typeof r.methods[method] === 'undefined') {
      r.methods[method] = {};
      r.methods[method].before = [];
      r.methods[method].after = [];
    }
    //
    // method exists on resource, push this new hook callback
    //
    r.methods[method].before.unshift(callback);
  };

  //
  // Give the resource a .after() method for defining after hooks on resource methods
  //
  r.after = function (method, callback) {
    //
    // If no method exists on the resource yet create a place holder,
    // in order to be able to lazily define hooks on methods that dont exist yet
    //
    if (typeof r.methods[method] === 'undefined') {
      r.methods[method] = {};
      r.methods[method].before = [];
      r.methods[method].after = [];
    }
    //
    // method exists on resource, push this new hook callback
    //
    r.methods[method].after.push(callback);
  };

  if (typeof r.config.datasource !== 'undefined') {
    r.schema.properties.id = {
      "type": "any"
    };
    resource.use('persistence');
    resource.persistence.enable(r, r.config.datasource);
  }

  //
  // TODO: add resource level beforeAll() hooks
  //
  // r.beforeAll = function (callback) {};

  //
  // Give the resource a persist() method as a short-cut to resource.persistence.enable
  //
  r.persist = function (datasource) {
    datasource = datasource || 'memory';
    r.config.datasource = datasource;
    resource.use('persistence');
    resource.persistence.enable(r, datasource);
  };


  //
  // Attach a copy of the resource to the resources scope ( for later reference )
  //
  resource[name] = r;
  resource.resources[name] = r;

  //
  // Return the new resource
  //
  return r;

};

resource.before = [];

//
// For attaching module-scoped Resource.before hooks onto all resources.
// This differs from calling .before on a resource instance such as creature.before('create'),
// in that resource.beforeAll(fn) hooks will execute before all resource methods
//
resource.beforeAll = function (callback) {
  //
  // Method exists on resource, push this new hook callback
  //
  resource.before.unshift(callback);
};

//
// Installs npm dependencies from resource defintions
// After all npm deps are installed, any queued up resource methods that were defferred due to
// missing deps, will now drain and execute
//
resource.installDeps = function (r) {

  //
  // TODO: make this work with remote files as well as local
  //
  var _command = ["install"];

  Object.keys(r.dependencies).forEach(function (dep) {
    var resourcePath;

    //
    // Check to see if the dep is available
    //
    resourcePath = helper.appDir + '/node_modules/';
    resourcePath += dep;
    resourcePath = require('path').normalize(resourcePath);
    try {
      require.resolve(resourcePath);
    } catch (err) {
      logger.warn(r.name.magenta + ' resource is missing a required dependency: ' + dep.yellow);
      // TODO: check to see if dep is already in the process of being installed,
      // if so, don't attempt to install it twice
      if (typeof resource.installing[dep] === 'undefined') {
        resource.installing[dep] = {};
        _command.push(dep + '@' + r.dependencies[dep]);
      }
    }

  });

  if (_command.length === 1) {
    return;
  }

  // _command.push('--color', "false");

  var home = require.resolve('resources');
  home = home.replace('/index.js', '/');

  //
  // Spawn npm as child process to perform installation
  //
  logger.warn('spawning ' + 'npm'.grey + ' to install missing dependencies');
  logger.exec('npm ' + _command.join(' '));

  //
  // Cross-platform npm binary detection using `which` module
  // ( this is required for Windows )
  //
  var which = require('which'),
      npmBinary = which.sync('npm');

  var spawn = require('child_process').spawn,
      npm   = spawn(npmBinary, _command, { cwd: helper.appDir });

  npm.stdout.on('data', function (data) {
    process.stdout.write(data);
  });

  npm.stderr.on('data', function (data) {
    process.stderr.write(data);
  });

  npm.on('error', function () {
    logger.error('npm installation error!');
    process.exit();
  });

  npm.on('exit', function (code) {
    logger.info('npm just exited with code ' + code.toString().red);
    if (code === 3) {
      logger.error('cannot install as current user');
      logger.help('try running this command again with sudo');
      process.exit(3);
    }
    _command.forEach(function (c, i) {
      if (i !== 0) { // the first command is "install"
        var dep = c.split('@'); // split the dep name based on packagename@semver syntax
        dep = dep[0]; // take the package name
        delete resource.installing[dep]; // remove it from the list of installing packages
      }
    });
    if (Object.keys(resource.installing).length === 0) {
      logger.info('npm installation complete');
      logger.warn('now executing ' + resource._queue.length + ' defferred call(s)');

      //
      // Calling an element in the queue can add new elements to the queue on
      // the same tick. So we only do the ones that were ready *this* time,
      // and the new elements are properly deferred.
      //
      var length = resource._queue.length,
          m;

      for (m = 0; m < length; m++) {
        resource._queue.pop()();
      }
    }
  });

};

//
// Creates a new instance of a schema based on default data as arguments array
//
var instantiate = resource.instantiate = function (schema, levelData) {
  var obj = {};

  levelData = levelData || {};

  if (typeof schema.properties === 'undefined') {
    return obj;
  }

  Object.keys(schema.properties).forEach(function (prop, i) {

    if (typeof schema.properties[prop].default !== 'undefined') {
      if (typeof schema.properties[prop].default === 'object') {
        obj[prop] = {};
        for (var p in schema.properties[prop].default) {
          obj[prop][p] = schema.properties[prop].default[p];
        }
      } else {
        obj[prop] = schema.properties[prop].default;
      }
    }

    if (typeof levelData[prop] !== 'undefined') {
      obj[prop] = levelData[prop];
    }

    if (typeof schema.properties[prop].properties === 'object') {
      obj[prop] = instantiate(schema.properties[prop], levelData[prop]);
    }

  });

  return obj;

};

//
// Attachs a method onto a resources as a named function with optional schema and tap
//
function addMethod(r, name, method, schema, tap) {

  //
  // Create a new method that will act as a wrap for the passed in "method"
  //
  var fn = function () {
    var args  = Array.prototype.slice.call(arguments),
        _args = [],
        validationError;

    var payload = [],
        callback = args[args.length - 1];

    //
    // Determine if a exports.dependencies hash has been specified in the resource,
    // if so, determine if there are any missing deps that will need to be installed
    //
    if (typeof r.dependencies === 'object') {
      resource.installDeps(r);
    }


    if (Object.keys(resource.installing).length > 0) {
      resource._queue.unshift(function () {
        fn.apply(this, args);
      });
      logger.warn('deffering execution of `' + (r.name + '.' + name).yellow + '` since dependencies are missing');
      return;
    }

    //
    // Apply beforeAll and before hooks, then execute the method
    // TODO: Pass returns up the stack for sync functions
    return beforeAllHooks(function (err) {
      if (err) {
        if (typeof callback === 'function') {
          return callback(err);
        }
        else {
          throw err;
        }
      }
      return beforeHooks(function (err) {
        if (err) {
          if (typeof callback === 'function') {
            return callback(err);
          }
          else {
            throw err;
          }
        }
        return execute();
      });
    });

    //
    // Check for any beforeAll hooks,
    // if they exist, execute them in LIFO order
    //
    function beforeAllHooks(cb) {
      var hooks;
      if (Array.isArray(resource.before) && resource.before.length > 0) {
        hooks = resource.before.slice();

        function iter() {
          var hook = hooks.pop();
          hook(args[0], function (err, data) {
            if (err) {
              return cb(err);
            }
            args[0] = data;
            if (hooks.length > 0) {
              iter();
            }
            else {
              cb(null);
            }
          });
        }
        iter();
      }
      else {
        return cb(null);
      }
    }

    //
    // Check for any before hooks,
    // if they exist, execute them in LIFO order
    //
    function beforeHooks(cb) {
      var hooks;

      if (Array.isArray(fn.before) && fn.before.length > 0) {
        hooks = fn.before.slice();
        function iter() {
          var hook = hooks.pop();
          hook(args[0], function (err, data) {
            if (err) {
              return cb(err);
            }
            args[0] = data;
            if (hooks.length > 0) {
              iter();
            }
            else {
              cb(null);
            }
          });
        }
        iter();
      }
      else {
        return cb(null);
      }
    }

    function execute() {
      //
      // Inside this method, we must take into account any schema,
      // which has been defined with the method signature and validate against it
      //
      if (typeof schema === 'object') {

        var _instance = {},
            _data = {};

        if (typeof schema.description === 'undefined') {
          schema.description = "";
        }

        //
        //  Merge in arguments data based on supplied schema
        //
        //
        //  If the the schema has a "properties" property, assume the convention of,
        //  schema property order to function arguments array order
        //
        // Ex:
        //
        //    The following schema:
        //
        //       { properties : { "options" : { "type": "object" }, "callback" : { "type": "function" } } }
        //
        //    Maps to the following method signature:
        //
        //       function(options, callback)
        //
        //    With this association:
        //
        //       properties.options  = arguments['0']
        //       properties.callback = arguments['1']
        //
        //
        if (typeof schema.properties === "object") {
          Object.keys(schema.properties).forEach(function (prop, i) {
            _data[prop] = args[i];
          });
        }

        //
        // Create a new schema instance with default values, mixed in with supplied arguments data
        //
        _instance = resource.instantiate(schema, _data);

        //
        // Perform a schema validation on the new instance to ensure validity
        //
        var validate = validator.validate(_instance, schema);

        //
        // If the schema validation fails, do not fire the wrapped method
        //
        if (!validate.valid) {
          //
          // Create an error of type Error
          //
          validationError = new Error(
            'Invalid arguments for method `' + r.name + '.' + name + '`. '
          );
          validationError.errors = validate.errors;
          validationError.message = validationError.message + JSON.stringify(validationError.errors, true, 2);

          resource.emit(r.name + '::' + name + '::error', validationError);
          if (typeof callback === 'function') {
            //
            // If a valid callback was provided, continue with the error
            //

            return callback(validationError);
          } else {
            throw validationError;
          }
        }

        //
        // The schema validation passed, prepare method for execution
        //

        //
        // Convert schema data back into arguments array
        //
        if (Object.keys(_instance).length === 0) {
          _args = args;
        }

        //
        // In the case that a schema was provided but additional arguments,
        // were passed into the resource method call outside of the schema,
        // make sure to add back those additional arguments
        //

        Object.keys(_instance).forEach(function (item) {
          if (item !== 'callback') {
            _args.push(_instance[item]);
          }
        });

        if (typeof schema.properties === "undefined" || typeof schema.properties.options === "undefined") {
          //
          // If an options object is not defined in the schema and the amount of incoming arguments exceeds,
          // the amount of expected arguments then push the additional arguments
          //
          if (args.length > _args.length) {
            for (var i = _args.length; i < args.length; i++) {
              _args.push(args[i]);
            }
          }
        }
        else if (typeof schema.properties.options === "object" && typeof args[0] === 'object' && typeof _args[0] === 'object') {
          //
          // If an options object is defined in the schema, merge the additional arguments,
          // into the options object

          //
          // `options` corresponds to the first argument in each of these arrays.
          //
          var keys = Object.keys(args[0]),
              _keys = Object.keys(_args[0]);

          //
          // Merge the additional options arguments with the original options arguments
          //
          Object.keys(args[0]).forEach(function (k, i) {
            if (!_args[0][k]) {
              _args[0][k] = args[0][k];
            }
          });
        }

        //
        // Check to see if a callback was expected, but not provided.
        //
        if (typeof schema.properties === 'object' && typeof schema.properties.callback === 'object' && typeof callback !== 'function') {
          //
          // If so, create a "dummy" callback so _method() won't crash
          //
          callback = function (err, result) {
            //
            // In the "dummy" callback, add a throw handler for errors,
            // so that any possible async error won't die silently
            //
            if (err) {
              logger.warn('about to throw an error from ' + r.name + '.' + name + ' since no callback was provided and an async error occurred!');
              logger.help('adding a callback argument to ' + r.name + '.' + name + ' will prevent this throw from happening');
              throw err;
            }
            //
            // Since a method that expected a callback was called without a callback,
            // nothing is done with the result. Consider this a "fire and forget"
            //
            // console.log(result);
            //
          };
        }

        //
        // Check to see if the last supplied argument was a function.
        // If so, it is assumed the method signature follows the node.js,
        // convention of the last argument being a callback andd will be added to the end of the array
        //
        if (typeof callback === 'function') {
          //
          // If a callback already exists as the last argument,
          // remove it
          //
          if (typeof _args[_args.length - 1] === "function") {
            _args.pop();
          }
          _args.push(function () {
            //
            // Add the wrapped callback as the last argument
            //
            return callbackWrap.apply(this, arguments);
          });
        }
      } else {
        _args = args;
        if (typeof callback === "function") {
          _args[_args.length - 1] = function (err, result) {
            //
            // Replace the original callback with the new wrapped callback
            //
            return callbackWrap.apply(this, arguments);
          };
        }
      }

      function callbackWrap(err, result) {
        var argv = [].slice.call(arguments);

        //
        // Only consider the method complete, if it has not errored
        //
        if (err === null) {
          //
          // Since the method has completed, emit it as an event
          //
          resource.emit(r.name + '::' + name, result);

          //
          // Resource.after() hooks will NOT be executed if an error has occured on the event the hook is attached to
          //
          return afterHooks(argv, function (err, data) {
            if (err) {
              throw err;
            }
            return callback.apply(this, data);
          });
        }
        else {
          return callback.apply(this, argv);
        }
      }

      //
      // Everything seems okay, execute the method with the modified arguments
      //
      var result = method.apply(this, _args);

      if (typeof callback !== 'function') {
        resource.emit(r.name + '::' + name, result);
      }

      //
      // Could still return undefined, and that is OK
      //
      return result;
    }

    //
    // Executes "after" hooks in FIFO (First-In-First-Out) Order
    //
    function afterHooks(args, cb) {
      var hooks;
      if (Array.isArray(fn.after) && fn.after.length > 0) {
        hooks = fn.after.slice();
        function iter() {
          var hook = hooks.shift();
          hook(args[1], function (err, data) {
            if (err) {
              return cb(err);
            }
            args[1] = data;
            if (hooks.length > 0) {
              iter();
            }
            else {
              return cb(null, args);
            }
          });
        }
        iter();
      }
      else {
        cb(null, args);
      }
    }
  };

  // store the schema on the fn for later reference
  fn.schema = schema || {
    "description": ""
  };

  // store the original method on the fn for later reference ( useful for documentation purposes )
  fn.unwrapped = method;

  // store the name of the method, on the method ( for later reference )
  fn.name = name;

  // placeholders for before and after hooks
  fn.before = [];
  fn.after = [];

  //
  // If the method about to be defined, already has a stub containing hooks,
  // copy those hooks to the newly defined fn that is about to be created
  // These previous stubs will then be overwritten.
  // This is used to allow the ability to define hooks on,
  // lazily defined resource methods
  //
  if (typeof r.methods[name] !== 'undefined') {
    if (Array.isArray(r.methods[name].before)) {
      r.methods[name].before.forEach(function (b) {
        fn.before.push(b);
      });
    }
    if (Array.isArray(r.methods[name].after)) {
      r.methods[name].after.forEach(function (b) {
        fn.after.push(b);
      });
    }
  }

  //
  // The method is bound onto the "methods" property of the resource
  //
  r.methods[name] = fn;

  //
  // The method is also bound directly onto the resource
  //
  // TODO: add warning / check for override of existing method if r[name] already exists as a function
  r[name] = fn;

}

function addProperty(r, name, schema) {

  if (typeof schema === 'undefined') {
    schema = {
      "type": "string"
    };
  }

  r.schema.properties[name] = schema;
  //
  // When adding new properties to a resource,
  // create an updated JugglingDB Model
  //
  if (resource.persistence && typeof r.config.datasource !== 'undefined') {
    resource.persistence.enable(r, r.config.datasource);
  }
}

//
// Special helper method for invoking resource methods from various interfaces
// In most cases, you will never call resource.invoke()
//
// resource.invoke() is useful when dealing with situations where you have arguments data for a resource method,
// but are not sure of the resource methods arguments schema.
//
// It's also useful for invoking sync resource methods from async interfaces such as,
// calling a method that returns a value from an HTTP interface ( which expects a continued value to respond with )
//
//
resource.invoke = function (method, data, callback) {

  var result;
  //
  // If any data was passed in
  //
  if (Object.keys(data).length > 0) {

    //
    // If an options hash is expected as part of the resource method schema
    //
    if (method.schema.properties.options) {
      result = method.call(this, data, callback);
    } else {
      //
      // If no options hash is expected, curry the arguments left to right into an array
      //
      var args = [];
      for (var p in data) {
        args.push(data[p]);
      }
      args.push(callback);
      result = method.apply(this, args);
    }
  } else {
    //
    // No data was passed in, execute the resource method with no data
    //
    result = method.call(this, callback);
  }

  //
  // Remark: If the resource method returns a value this indicates method is sync,
  // and that the continuation must be manually called with no error condition
  //
  if (typeof result !== 'undefined') {
    return callback(null, result);
  }

};

resource._queue = [];

//
// Creates a "safe" non-circular JSON object for easy stringification purposes
//
resource.toJSON = function (r) {

  if (typeof r === 'undefined') {
    throw new Error('resource is a required argument');
  }

  var obj = {
    name: r.name,
    schema: r.schema,
    methods: methods(r)
  };

  function methods(r) {
    var obj = {};
    for (var m in r.methods) {
      obj[m] = r.methods[m].schema;
    }
    return obj;
  }

  return obj;
};

resource.schema = {
  properties: {}
};

//
// Create logger resource
//

var _logger = resource.define('logger');
_logger.schema.description = "a simple STDOUT based logger";
_logger.method("log", logger.log, {
  "description": "logs data to STDOUT",
  "properties": {
    "level": {
      "type": "string",
      "default": "info"
    },
    "message": {
      "type": "any"
    }
  }
});

//
// Override original logger with new logger resource
// TODO: cleanup override logic
resource.logger = _logger;

//
// Preserve old logging levels
//
for (var level in logger.levels) {
  resource.logger[level] = logger[level];
}

resource.logger.put = logger.put;

//
// end logger resource
//

resource.methods = [];
resource.name = "resource";

module['exports'] = resource;
