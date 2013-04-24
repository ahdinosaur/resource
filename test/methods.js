var tap = require("tap")
  , test = tap.test
  , plan = tap.plan
  , creature
  , resource
  , List = require("../vendor/jugglingdb/lib/list");

test("load resource module", function (t) {
  resource = require('../');
  t.ok(resource, "object loaded")
  t.end()
});

test("define creature resource", function (t) {
  creature = resource.define('creature');
  t.ok(creature, "creature resource defined")
  t.end()
});

test("define method on creature - with no method", function (t) {
  t.plan(1);
  try {
    creature.method('poke');
  } catch (err) {
    t.ok(true, 'could not add poke')
  }
});

test("define method on creature - with schema - single text argument", function (t) {
  creature.method('talk', function(text){
    return text;
  }, {
    "properties": {
      "text" : {
        "type": "string"
      }
    }
  });
  t.equal(creature.talk('hi'), 'hi', 'talked!');
  t.end()
});

test("define method on creature - with schema - and single text argument - with bad input", function (t) {
  creature.method('talk', function(text){
    return text;
  }, {
    "properties": {
      "text" : {
        "type": "string"
      }
    }
  });
  var result;
  try {
    result = creature.talk(123);
  }
  catch (err) {
    t.doesNotThrow(function () {
      t.equal(err.errors[0].attribute, 'type', 'did not talk - result[0].attribute == "type"');
      t.equal(err.errors[0].property, 'text', 'did not talk - result[0].attribute == "text"');
      t.equal(err.errors[0].actual, 'number', 'did not talk - result[0].actual == "number"');
    }, 'thrown error has array of validation errors');
    t.end()
  }
});

test("define method on creature - with schema - single text argument - with default", function (t) {
  creature.method('talk', function(text){
    return text;
  }, {
    "properties": {
      "text" : {
        "type": "string",
        "default": "hello"
      }
    }
  });
  t.equal(creature.talk('hi'), 'hi', 'talked!');
  t.end()
});

test("define method on creature - with schema - and single text argument - with default - and no input", function (t) {
  creature.method('talk', function(text){
    return text;
  }, {
    "properties": {
      "text" : {
        "type": "string",
        "default": "hello"
      }
    }
  });
  t.equal(creature.talk(), 'hello', 'talked!');
  t.end()
});

test("define method on creature - with schema - and two text arguments", function (t) {
  creature.method('talk', function(text, person){
    return text + ':' + person;
  }, {
    "properties": {
      "text" : {
        "type": "string"
      },
      "person" : {
        "type": "string"
      }
    }
  });
  t.equal(creature.talk('hi', 'marak'), 'hi:marak', 'talked!');
  t.end()
});

test("define method on creature - with schema - and single boolean argument", function (t) {
  creature.method('talk', function(mute){
    return mute ? '' : 'hi';
  }, {
    "properties": {
      "mute" : {
        "type": "boolean"
      }
    }
  });
  t.equal(creature.talk(false), 'hi', 'talked!');
  t.end()
});

test("define method on creature - with schema - and single boolean argument - with bad input", function (t) {
  creature.method('talk', function(mute){
    return mute ? '' : 'hi';
  }, {
    "properties": {
      "mute" : {
        "type": "boolean"
      }
    }
  });
  var result;
  try {
    result = creature.talk('hello');
  }
  catch (err) {
    t.doesNotThrow(function () {
    t.equal(err.errors[0].attribute, 'type', 'did not talk - result[0].attribute == "type"');
    t.equal(err.errors[0].property, 'mute', 'did not talk - result[0].attribute == "mute"');
    t.equal(err.errors[0].actual, 'string', 'did not talk - result[0].actual == "string"');
    }, 'thrown error has validation errors array');
    t.end();
  }
});

test("define method on creature - with schema - and one callback argument", function (t) {
  creature.method('poke', function(callback){
    return callback(null, 'poked!');
  }, {
    "properties": {
      "callback": {
        "type": "function"
      }
    }
  });
  creature.poke(function(err, result){
    t.equal(result, 'poked!', 'poked!');
    t.end()
  });
});

test("define method on creature - with schema - and one callback argument with multiple arguments", function (t) {
  creature.method('poke', function(callback){
    return callback(null, 'poked!', 'second poke');
  }, {
    "properties": {
      "callback": {
        "type": "function"
      }
    }
  });
  creature.poke(function(err, first_result, second_result){
    t.equal('poked!', first_result);
    t.equal('second poke', second_result);
    t.ok(true, 'poked!')
    t.end()
  });
});

test("define method on creature - with schema - and two arguments - text, callback", function (t) {
  creature.method('talk', function(text, callback){
    return callback(null, text);
  }, {
    "properties": {
      "text": {
        "type": "string"
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.talk('hi!', function(err, result){
    t.equal(result, 'hi!', 'talked!');
    t.end()
  });
});

test("define method on creature - with schema - and two arguments - text, callback - with bad input", function (t) {
  creature.method('talk', function(text, callback){
    return callback(null, text);
  }, {
    "properties": {
      "text": {
        "type": "string"
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.talk(123, function(err, result){
    t.equal(err.errors[0].attribute, 'type', 'did not talk - err.errors[0].attribute == "type"');
    t.equal(err.errors[0].property, 'text', 'did not talk - err.errors[0].attribute == "text"');
    t.equal(err.errors[0].actual, 'number', 'did not talk - err.errors[0].actual == "number"');
    t.end()
  });
});

test("define method on creature - with schema - and two arguments - options, callback", function (t) {
  creature.method('fire', function(options, callback){
    return callback(null, options);
  }, {
    "properties": {
      "options": {
        "type": "object",
        "properties": {
          "direction" : {
            "type": "string"
          },
          "power": {
            "type": "string"
          },
          "stun": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.fire({ "direction": "up", "power": "HIGH" }, function(err, result){
    t.equal(result.direction, 'up', 'fired! - result.direction == "up"');
    t.equal(result.power, 'HIGH', 'fired! - result.power == "HIGH"');
    t.equal(result.stun, false, 'fired! - result.stun == false');
    t.end()
  });
});

test("define method on creature - with number schema - and good input", function (t) {
  creature.method('hit', function(damage, callback){
    damage++;
    return callback(null, damage);
  }, {
    "properties": {
      "damage": {
        "type": "number"
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.hit(8999, function(err, result){
    t.equal(result, 9000, 'hit for 9000!');
    t.end()
  });
});

test("define method on creature - with number schema - and bad input", function (t) {
  creature.method('hit', function(damage, callback){
    damage++;
    return callback(null, damage);
  }, {
    "properties": {
      "damage": {
        "type": "number"
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.hit("abc", function(err, result){
    t.equal(err.errors[0].attribute, 'type', 'did not hit - err.errors[0].attribute = "type"');
    t.equal(err.errors[0].property, 'damage', 'did not hit - err.errors[0].property = "damage"');
    t.equal(err.errors[0].actual, 'string', 'did not hit - err.errors[0].actual = "string"');
    t.end()
  });
});

test("define method on creature - with required string schema - and bad input", function (t) {
  creature.method('hit', function(target, callback){
    return callback(null, target);
  }, {
    "properties": {
      "target": {
        "type": "string",
        "required": true
      },
      "callback": {
        "type": "function"
      }
    }
  });
  creature.hit("", function(err, result){
    t.equal(err.errors[0].attribute, 'required', 'did not hit - err.errors[0].attribute = "required"');
    t.equal(err.errors[0].property, 'target', 'did not hit - err.errors[0].property = "target"');
    t.equal(err.errors[0].actual, '', 'did not hit - err.errors[0].actual = ""');
    t.end()
  });
});

test("define method on creature - with simple schema - and additional non-schema arguments", function (t) {
  creature.method('talk', function (text, target){
    return { text: text, target: target };
  }, {
    "properties": {
      "text" : {
        "type": "string"
      }
    }
  });
  var result = creature.talk('hi', 'bob');
  t.equal(result.text, 'hi', 'talked! - result.text == "hi"');
  t.equal(result.target, 'bob', 'talked! - result.target == "bob"');
  t.end()
});

test("define method on creature - with object schema - and additional non-schema arguments", function (t) {
  creature.method('talk', function (options, callback) {
    callback(null, options);
  }, {
    "properties": {
      "options": {
        "type": "object",
        "properties": {
          "text" : {
            "type": "string"
          }
        }
      }
    }
  });
  creature.talk({ text: 'hi', target: 'bob' }, function(err, result) {
    t.equal(result.text, 'hi', 'talked! - result.text == "hi"');
    t.equal(result.target, 'bob', 'talked! - result.target == "bob"');
    t.end()
  });
});

test("define method on creature - with schema - and two arguments - options, number", function (t) {
  creature.method('eat', function(options, n){
    return { food: options.food, amount: n };
  }, {
    "properties": {
      "options": {
        "food": "object",
        "properties": {
          "type": {
            "type": "string"
          }
        }
      },
      "n": {
        "type": "number"
      }
    }
  });
  var result = creature.eat({ "food": "cabbage" }, 3);
  t.equal(result.food, "cabbage", "creature ate cabbage");
  t.equal(result.amount, 3, "creature ate 3 of them");
  t.end();

});

//
// Tests for methods applied to persisted resources
//
test("define method on creature - with schema - and one argument - array", function (t) {
  creature.method('throw', function (items) {
    items.forEach(function (i) {
      // resource.logger.info(' threw ' + i + '!');
    });
  }, { properties: { items: { type: 'array' }}});
  t.end();
});

test("define property on creature - array", function (t) {
  creature.property('items', { type: 'array' });
  t.end();
});

test("create creature with array property and pass to method", function (t) {
  creature.persist('memory');
  creature.create({ id: 'korben', items: [ 'ball', 'hammer', 'potato' ] }, function (err, c) {
    t.type(c.id, 'string', 'id is a string');
    t.type(c.items, Array, 'items is a list');
    t.equal(c.items.length, 3, 'items has length 3');
    t.doesNotThrow(function () {
      creature.throw(c.items);
    }, 'call creature method without error');
    t.end();
  });
});
