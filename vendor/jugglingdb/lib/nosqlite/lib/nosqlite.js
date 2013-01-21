// Generated by CoffeeScript 1.4.0
(function() {
  var async, fs, nosqlite, path, rimraf;

  nosqlite = module.exports;

  path = require('path');

  fs = require('fs');

  rimraf = require('../vendor/rimraf');

  async = require('async');

  nosqlite.path = path.join(__dirname, '..', 'data');

  nosqlite.Connection = function(arg) {
    var options;
    options = {};
    this.path = nosqlite.path;
    if (typeof arg === 'object') {
      options = arg;
      return this.path = options.path;
    } else if (typeof arg === 'string') {
      return this.path = arg;
    }
  };

  nosqlite.Connection.prototype.database = function(name, mode) {
    var that;
    that = this;
    return {
      dir: path.resolve(that.path, name),
      name: name || 'test',
      mode: mode || '0775',
      file: function(id) {
        return path.resolve(this.dir, id + '.json');
      },
      project: function(onto, from) {
        Object.keys(from).forEach(function(k) {
          return onto[k] = from[k];
        });
        return onto;
      },
      satisfy: function(data, cond) {
        return Object.keys(cond).every(function(k) {
          if (data[k] === cond[k]) {
            return true;
          } else {
            return false;
          }
        });
      },
      _write: function(id, data, cb) {
        var _this = this;
        return fs.writeFile(this.file('.' + id), data, function(err) {
          if (err) {
            return cb(err);
          } else {
            return fs.rename(_this.file('.' + id), _this.file(id), cb);
          }
        });
      },
      _writeSync: function(id, data) {
        fs.writeFileSync(this.file('.' + id), data);
        return fs.renameSync(this.file('.' + id), this.file(id));
      },
      exists: function(cb) {
        return path.exists(this.dir, cb);
      },
      existsSync: function() {
        return path.existsSync(this.dir);
      },
      create: function(cb) {
        return fs.mkdir(this.dir, this.mode, cb);
      },
      createSync: function() {
        return fs.mkdirSync(this.dir, this.mode);
      },
      destroy: function(cb) {
        return rimraf(this.dir, cb);
      },
      destroySync: function() {
        return rimraf.sync(this.dir);
      },
      get: function(id, cb) {
        return fs.readFile(this.file(id), 'utf8', function(err, data) {
          return cb(err, (data ? JSON.parse(data) : void 0));
        });
      },
      getSync: function(id) {
        return JSON.parse(fs.readFileSync(this.file(id), 'utf8'));
      },
      "delete": function(id, cb) {
        return fs.unlink(this.file(id), cb);
      },
      deleteSync: function(id) {
        return fs.unlinkSync(this.file(id));
      },
      put: function(id, obj, cb) {
        var _this = this;
        return this.get(id, function(err, data) {
          data = _this.project(data, obj);
          return _this._write(id, JSON.stringify(data, null, 2), cb);
        });
      },
      putSync: function(id, obj) {
        var data;
        data = this.project(this.getSync(id), obj);
        return this._writeSync(id, JSON.stringify(data, null, 2));
      },
      post: function(obj, cb) {
        return this._write(obj.id || obj._id, JSON.stringify(obj, null, 2), cb);
      },
      postSync: function(obj) {
        return this._writeSync(obj.id || obj._id, JSON.stringify(obj, null, 2));
      },
      find: function(cond, cb) {
        var _this = this;
        return fs.readdir(this.dir, function(err, files) {
          return async.map(files, function(file, callback) {
            return _this.get(path.basename(file, '.json'), function(err, data) {
              if (_this.satisfy(data, cond)) {
                return callback(err, data);
              } else {
                return callback(err, null);
              }
            });
          }, function(err, files) {
            return cb(err, files.filter(function(file) {
              return file != null;
            }));
          });
        });
      },
      findSync: function(cond) {
        var files,
          _this = this;
        files = fs.readdirSync(this.dir);
        files = files.map(function(file) {
          var data;
          data = _this.getSync(path.basename(file, '.json'));
          if (_this.satisfy(data, cond)) {
            return data;
          } else {
            return null;
          }
        });
        return files.filter(function(file) {
          return file != null;
        });
      },
      all: function(cb) {
        var _this = this;
        return fs.readdir(this.dir, function(err, files) {
          return async.map(files, function(file, callback) {
            return _this.get(path.basename(file, '.json'), callback);
          }, cb);
        });
      },
      allSync: function() {
        var files,
          _this = this;
        files = fs.readdirSync(this.dir);
        return files.map(function(file) {
          return _this.getSync(path.basename(file, '.json'));
        });
      }
    };
  };

}).call(this);
