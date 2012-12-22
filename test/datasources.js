var tap = require("tap")
  , test = tap.test
  , plan = tap.plan
  , creature
  , resource;

test("load resource module", function (t) {
  resource = require('../');
  t.ok(resource, "object loaded")
  t.end()
});

test("define creature resource - with datasource config", function (t) {
  creature = resource.define('creature', { config: { datasource: 'memory' }});

  creature.property('life', {
    "type": "number"
  });

  t.type(creature.config, 'object', 'configuration defined - creature.config is object');
  t.equal('memory', creature.config.datasource, 'configuration defined - creature.config.datasource == "memory"');

  t.type(creature.methods, 'object', 'methods defined - creature.methods is object');
  t.type(creature.methods.create, 'function', 'methods defined - methods.create is function');
  t.type(creature.methods.get, 'function', 'methods defined - methods.get is function');
  t.type(creature.methods.find, 'function', 'methods defined - methods.find is function');
  t.type(creature.methods.destroy, 'function', 'methods defined - methods.destroy is function');

  t.type(creature.create, 'function', 'methods hoisted - creature.create is function');
  t.type(creature.get, 'function', 'methods hoisted - creature.get is function');
  t.type(creature.find, 'function', 'methods hoisted - creature.find is function');
  t.type(creature.destroy, 'function', 'methods hoisted - creature.destroy is function');

  t.end()
});

test("executing creature.all", function (t) {
  creature.all(function(err, result){
    t.equal(result.length, 0, 'no creatures');
    t.end();
  });
});

test("executing creature.create", function (t) {
  creature.create({ id: 'bobby' }, function(err, result){
    t.type(err, 'null', 'no error');
    t.type(result, 'object', 'result is object');
    t.end();
  });
});

test("executing creature.get", function (t) {
  creature.get('bobby', function(err, result){
    t.type(err, 'null', 'no error');
    t.type(result, 'object', 'result is object');
    t.end();
  });
});

test("executing creature.all", function (t) {
  creature.all(function(err, result){
    t.equal(result.length, 1, 'one creature');
    t.end();
  });
});

test("executing creature.create - with bad input", function (t) {
  creature.create({ id: 'larry', life: "abc" }, function(err, result){
    t.type(err, 'object', 'continues correct validation error - err is object');
    t.type(err.errors, 'object', 'continues correct validation error - err.errors is object');
    t.equal(err.errors.length, 1, 'continues correct validation error - one validation error');
    t.equal(err.errors[0].attribute, 'type', 'continues correct validation error - attribute == "type"');
    t.equal(err.errors[0].property, 'life', 'continues correct validation error - property == "life"');
    t.equal(err.errors[0].expected, 'number', 'continues correct validation error - expected == "number"');
    t.equal(err.errors[0].actual, 'string', 'continues correct validation error - actual == "string"');
    t.end();
  });
});

test("executing creature.get", function (t) {
  creature.get('larry', function(err, result){
    t.type(err, 'object', 'could not find larry');
    t.end();
  });
});

test("executing creature.all", function (t) {
  creature.all(function(err, result){
    t.equal(result.length, 1);
    t.end();
  });
});

test("executing creature.update", function (t) {
  creature.update({ id: 'bobby', life: 9999 }, function(err, result){
    t.type(err, 'null', 'updated bobby - no error');
    t.type(result, 'object', 'updated bobby - result is object');
    t.equal(result.life, 9999, 'updated bobby - result.life == 9999');
    t.end();
  });
});

test("executing creature.destroy", function (t) {
  creature.destroy('bobby', function(err, result){
    t.type(result, 'null', 'destroyed bobby');
    t.end();
  });
});

test("executing creature.get", function (t) {
  creature.get('bobby', function(err, result){
    t.type(err, 'object', 'could not find bobby');
    t.end();
  });
});

test("executing creature.all", function (t) {
  creature.all(function(err, result){
    t.equal(result.length, 0, 'no creatures');
    t.end();
  });
});