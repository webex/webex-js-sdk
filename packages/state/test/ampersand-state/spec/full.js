/* eslint-disable */

var tape = require('tape');
var State = require('../..');
var AmpersandRegistry = require('ampersand-registry');
var Collection = require('ampersand-collection');
var definition, Foo, registry;

// wrap test so we always run reset first
var test = function () {
    reset();
    tape.apply(tape, arguments);
};
test.only = function () {
    reset();
    tape.only.apply(tape, arguments);
};

function reset() {
    registry = new AmpersandRegistry();

    definition = {
        type: 'foo',
        props: {
            id: 'number',
            firstName: ['string', true, 'defaults'],
            lastName: ['string', true],
            thing: {
                type: 'string',
                required: true,
                default: 'hi'
            },
            num: ['number', true],
            today: ['date'],
            hash: ['object'],
            list: ['array'],
            myBool: ['boolean', true, false],
            someNumber: {type: 'number', allowNull: true},
            someNull: {type: 'object', default: null},
            good: {
                type: 'string',
                test: function (newVal) {
                    if (newVal !== 'good') {
                        return 'Value not good';
                    }
                }
            }
        },
        session: {
            active: ['boolean', true, true]
        },
        derived: {
            name: {
                deps: ['firstName', 'lastName'],
                fn: function () {
                    return this.firstName + ' ' + this.lastName;
                }
            },
            initials: {
                deps: ['firstName', 'lastName'],
                cache: false,
                fn: function () {
                    // This currently breaks without both deps being set
                    if (this.firstName && this.lastName) {
                        return (this.firstName.charAt(0) + this.lastName.charAt(0)).toUpperCase();
                    }
                    return '';
                }
            },
            isCrazy: {
                deps: ['crazyPerson'],
                fn: function () {
                    return !!this.crazyPerson;
                }
            }
        },
        // add a reference to the registry
        registry: registry
    };

    Foo = State.extend(definition);
}

test('should get the derived value', function (t) {
    var foo = new Foo({
        firstName: 'jim',
        lastName: 'tom'
    });
    foo.firstName = 'jim';
    foo.lastName = 'tom';

    t.strictEqual(foo.name, 'jim tom');
    t.strictEqual(foo.initials, 'JT');
    t.end();
});

test('should have default values for properties', function (t) {
    var foo = new Foo({
        firstName: 'jim',
        lastName: 'tom'
    });
    t.strictEqual(foo.myBool, false);
    t.strictEqual(foo.someNull, null);
    t.end();
});

test('should have default array/object properties', function (t) {
    var Bar = State.extend({
        props: {
            list: ['array', true],
            hash: ['object', true]
        }
    });
    var bar = new Bar();
    var otherBar = new Bar();

    t.ok(bar.list !== undefined);
    t.ok(bar.hash !== undefined);

    //Should create unique instances of the defaults
    otherBar.list.push('foo');
    otherBar.hash.foo = 'bar';

    t.ok(bar.list.length === 0);
    t.ok(bar.hash.foo === undefined);

    t.end();
});

test('should throw a useful error setting a default value to an array', function (t) {
    t.plan(2);
    try {
        State.extend({
            props: { list: ['array', true, []] }
        });
    } catch (err) {
        t.ok(err instanceof TypeError);
        t.ok(err.message.match(/value for list cannot be an object\/array/));
    }
});

test('should throw a useful error setting a default value to an object', function (t) {
    t.plan(2);
    try {
        State.extend({
            props: { list: ['array', true, []] }
        });
    } catch (err) {
        t.ok(err instanceof TypeError);
        t.ok(err.message.match(/value for list cannot be an object\/array/));
    }
});

test('a default should be settable as a function which returns a value', function (t) {
    var Foo = State.extend({
        props: {
            anObject: ['object', true, function () { return {foo: 'bar'}; }]
        }
    });

    var foo = new Foo();

    t.deepEqual(foo.anObject, {foo: 'bar'});
    t.end();
});

test('should throw an error setting a derived prop', function (t) {
    t.plan(1);
    var foo = new Foo();
    try { foo.name = 'bob'; }
    catch (err) { t.ok(err instanceof TypeError); }
});

test('Error when setting derived property should be helpful', function (t) {
    var foo = new Foo();
    try { foo.name = 'bob'; }
    catch (err) {
        t.equal(err.message, '`name` is a derived property, it can\'t be set directly.');
    }
    t.end();
});

test('should get correct defaults', function (t) {
    var foo = new Foo({});
    t.strictEqual(foo.firstName, 'defaults');
    t.strictEqual(foo.thing, 'hi');
    t.end();
});

test('Setting other properties when `extraProperties: "reject"` throws error', function (t) {
    var Foo = State.extend({
        extraProperties: 'reject'
    });
    var foo = new Foo();
    t.throws(function () {
        foo.set({
            craziness: 'new'
        });
    }, Error, 'Throws exception if set to reject');
    t.end();
});

test('Setting other properties ignores them by default', function (t) {
    var foo = new Foo();
    foo.set({
        craziness: 'new'
    });
    t.strictEqual(foo.craziness, undefined, 'property should be ignored');
    t.end();
});

test('Setting other properties is ok if extraProperties = "allow"', function (t) {
    var foo = new Foo();
    foo.extraProperties = 'allow';
    foo.set({
        craziness: 'new'
    });
    t.equal(foo.get('craziness'), 'new');
    t.end();
});

test('#11 - multiple instances of the same state class should be able to use extraProperties = "allow" as expected', function (t) {
    var Foo = State.extend({
        extraProperties: 'allow'
    });

    var one = new Foo({ a: 'one.a', b: 'one.b' });
    var two = new Foo({ a: 'two.a', b: 'two.b', c: 'two.c' });

    t.equal(one.a, 'one.a');
    t.equal(one.b, 'one.b');

    t.equal(two.a, 'two.a');
    t.equal(two.b, 'two.b');
    t.equal(two.c, 'two.c');

    t.end();
});

test('extraProperties = "allow" properties should be defined entirely on the instance not the prototype', function (t) {
    var Foo = State.extend({
        extraProperties: 'allow'
    });

    var two = new Foo();

    t.deepEqual(two._definition, {});
    t.end();
});

test('should throw a type error for bad data types', function (t) {
    t.throws(function () {
        new Foo({firstName: 3});
    }, TypeError);
    t.throws(function () {
        new Foo({num: 'foo'});
    }, TypeError);
    t.throws(function () {
        new Foo({hash: 10});
    }, TypeError);
    t.throws(function () {
        new Foo({today: 'asdfadsfa'});
    }, TypeError);
    t.doesNotThrow(function () {
        new Foo({today: 1397631169892});
        new Foo({today: '1397631169892'});
        new Foo({today: '2014-11-13'});
        new Foo({today: '2014-11-13T21:01Z'});
        new Foo({today: '2014-11-13T21:01:28.752Z'});
    });
    t.throws(function () {
        new Foo({list: 10});
    }, TypeError);
    t.end();
});

test('should validate model', function (t) {
    var foo = new Foo();
    t.equal(foo._verifyRequired(), false);

    foo.firstName = 'a';
    foo.lastName = 'b';
    foo.thing = 'abc';
    foo.num = 12;
    t.ok(foo._verifyRequired());
    t.end();
});

test('should store previous attributes', function (t) {
    var foo = new Foo({
        firstName: 'beau'
    });
    foo.firstName = 'john';
    t.strictEqual(foo.firstName, 'john');
    t.strictEqual(foo.previous('firstName'), 'beau');
    foo.firstName = 'blah';
    t.strictEqual(foo.previous('firstName'), 'john');
    t.end();
});

test('should have data serialization methods', function (t) {
    var foo = new Foo({
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc'
    });

    t.deepEqual(foo.attributes, {
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc',
        myBool: false,
        active: true,
        someNull: null
    });
    t.deepEqual(foo.serialize(), {
        firstName: 'bob',
        lastName: 'tom',
        thing: 'abc',
        myBool: false,
        someNull: null
    });
    t.end();
});

test('serialize should not include session properties no matter how they\'re defined.', function (t) {
    var Foo = State.extend({
        props: {
            name: 'string'
        },
        session: {
            // simple definition
            active: 'boolean'
        }
    });

    var Bar = State.extend({
        props: {
            name: 'string'
        },
        session: {
            // fuller definition
            active: ['boolean', true, false]
        }
    });

    var foo = new Foo({name: 'hi', active: true});
    var bar = new Bar({name: 'hi', active: true});
    t.deepEqual(foo.serialize(), {name: 'hi'});
    t.deepEqual(bar.serialize(), {name: 'hi'});
    t.end();
});

test('serialize should serialize props/derived/session on request', function (t) {
    var Foo = State.extend({
        props: {
            name: 'string'
        },
        derived: {
            derivedAtrr: {
                fn: function() {
                    return 'derived-attr';
                }
            }
        },
        session: {
            active: 'boolean'
        }
    });
    var foo = new Foo({name: 'hi', active: true});
    t.deepEqual(foo.serialize({session: true}), {name: 'hi', active: true}, 'serializes session on request');
    t.deepEqual(foo.serialize({derived: true}), {name: 'hi', derivedAtrr: 'derived-attr'}, 'serializes derived on request');
    t.deepEqual(foo.serialize({props: false, session: true}), {active: true}, 'serialize ignores props on request');
    t.end();
});

test('should fire events normally for properties defined on the fly', function (t) {
    var foo = new Foo();
    foo.extraProperties = 'allow';
    foo.on('change:crazyPerson', function () {
        t.ok(true);
    });
    foo.set({
        crazyPerson: true
    });
    t.end();
});

test('should fire event on derived properties, even if dependent on ad hoc prop.', function (t) {
    var Foo = State.extend({
        extraProperties: 'allow',
        derived: {
            isCrazy: {
                deps: ['crazyPerson'],
                fn: function () {
                    return !!this.crazyPerson;
                }
            }
        }
    });
    var foo = new Foo();
    foo.on('change:isCrazy', function () {
        t.ok(true);
    });
    foo.set({
        crazyPerson: true
    });
    t.end();
});

test('throw error on invalid extraProperties', function (t) {
    var Foo = State.extend({
        extraProperties: 'qwijbo'
    });
    var foo = new Foo();
    t.throws(function () {
        foo.set('a', 'b');
    }, TypeError, 'Throws TypeError on invalid extraProperties');
    t.end();
});

test('should fire general change event on single attribute', function (t) {
    var foo = new Foo({firstName: 'coffee'});
    foo.on('change', function () {
        t.ok(true);
    });
    foo.firstName = 'bob';
    t.end();
});

test('should fire single change event for multiple attribute set', function (t) {
    var foo = new Foo({firstName: 'coffee'});
    foo.on('change', function () {
        t.ok(true);
    });
    foo.set({
        firstName: 'roger',
        lastName: 'smells'
    });
    t.end();
});

test('derived properties', function (t) {
    var ran = 0;
    var notCachedRan = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true]
        },
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    ran++;
                    return 'hi, ' + this.name;
                }
            },
            notCached: {
                cache: false,
                deps: ['name'],
                fn: function () {
                    notCachedRan++;
                    return 'hi, ' + this.name;
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    t.strictEqual(ran, 0, 'derived function should not have run yet.');
    t.equal(foo.greeting, 'hi, henrik');
    t.equal(foo.greeting, 'hi, henrik');
    t.equal(ran, 1, 'cached derived should only run once');
    t.equal(notCachedRan, 0, 'should not have been run yet');
    foo.name = 'someone';
    t.equal(foo.greeting, 'hi, someone');
    t.equal(foo.greeting, 'hi, someone');
    t.equal(ran, 2, 'cached derived should have been cleared and run once again');
    t.equal(notCachedRan, 1, 'should have been run once because it was triggered');
    t.equal(foo.notCached, 'hi, someone');
    t.equal(notCachedRan, 2, 'incremented again');
    t.equal(foo.notCached, 'hi, someone');
    t.equal(notCachedRan, 3, 'incremented each time');
    t.end();
});

test('cached, derived properties should only fire change event if they\'ve actually changed', function (t) {
    var changed = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true],
            other: 'string'
        },
        derived: {
            greeting: {
                deps: ['name', 'other'],
                fn: function () {
                    return 'hi, ' + this.name;
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    foo.on('change:greeting', function () {
        changed++;
    });
    t.equal(changed, 0);
    foo.name = 'new';
    t.equal(changed, 1);
    foo.other = 'new';
    t.equal(changed, 1);
    t.end();
});

test('derived properties with derived dependencies', function (t) {
    var ran = 0;
    var Foo = State.extend({
        props: {
            name: ['string', true]
        },
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    return 'hi, ' + this.name;
                }
            },
            awesomeGreeting: {
                deps: ['greeting'],
                fn: function () {
                    return this.greeting + '!';
                }
            }
        }
    });
    var foo = new Foo({name: 'henrik'});
    foo.on('change:awesomeGreeting', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change:greeting', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change:name', function () {
        ran++;
        t.ok(true, 'should fire derived event');
    });
    foo.on('change', function () {
        ran++;
        t.ok(true, 'should file main event');
    });
    foo.name = 'something';
    t.equal(ran, 4);
    t.end();
});

test('derived properties triggered with multiple instances', function (t) {
    var foo = new Foo({firstName: 'Silly', lastName: 'Fool'});
    var bar = new Foo({firstName: 'Bar', lastName: 'Man'});

    foo.on('change:name', function () {
        t.ok('name changed');
    });
    foo.firstName = 'bob';
    bar.on('change:name', function () {
        t.ok('name changed');
    });
    bar.firstName = 'bob too';
    t.end();
});

test('Calling `previous` during change of derived cached property should work', function (t) {
    var foo = new Foo({firstName: 'Henrik', lastName: 'Joreteg'});
    var ran = false;
    foo.on('change:name', function () {
        if (!ran) {
            t.equal(typeof foo.previous('name'), 'undefined');
            ran = true;
        } else {
            t.equal(foo.previous('name'), 'Crazy Joreteg');
        }
    });

    foo.firstName = 'Crazy';
    foo.firstName = 'Lance!';
    t.end();
});

test('Calling `previous` during change of derived property that is not cached, should be `undefined`', function (t) {
    var foo = new Foo({firstName: 'Henrik', lastName: 'Joreteg'});

    // the initials property is explicitly not cached
    // so you should not be able to get a previous value
    // for it.
    foo.on('change:initials', function () {
        t.equal(typeof foo.previous('initials'), 'undefined');
    });

    foo.firstName = 'Crazy';
    t.end();
});

test('Should be able to define and use custom data types', function (t) {
    var Foo = State.extend({
        props: {
            silliness: 'crazyType'
        },
        dataTypes: {
            crazyType: {
                set: function (newVal) {
                    return {
                        val: newVal,
                        type: 'crazyType'
                    };
                },
                get: function (val) {
                    return val + 'crazy!';
                }
            }
        }
    });

    var foo = new Foo({silliness: 'you '});

    t.equal(foo.silliness, 'you crazy!');
    t.end();
});

tape.skip('Throw typeError for invalid data types', function (t) {
    t.throws(function () {
        State.extend({
            props: {
                weight: 'randomType'
            }
        });
    });

    t.end();
});

test('Uses dataType compare', function (t) {
    var compareRun;

    var Foo = State.extend({
        props: {
            silliness: 'crazyType'
        },
        dataTypes: {
            crazyType: {
                compare: function () {
                    compareRun = true;
                    return false;
                },
                set: function (newVal) {
                    return {
                        val: newVal,
                        type: 'crazyType'
                    };
                },
                get: function (val) {
                    return val + 'crazy!';
                }
            }
        }
    });

    compareRun = false;
    var foo = new Foo({ silliness: 'you' });
    t.notOk(compareRun);

    foo.silliness = 'they';
    t.assert(compareRun);
    t.end();
});

test('Should only allow nulls where specified', function (t) {
    var foo = new Foo({
        firstName: 'bob',
        lastName: 'vila',
        someNumber: null
    });
    t.equal(foo.someNumber, null);
    t.throws(function () {
        foo.firstName = null;
    }, TypeError, 'Throws exception when setting disallowed null');
    t.end();
});

test('Attribute test function works', function (t) {
    var foo = new Foo({good: 'good'});
    t.equal(foo.good, 'good');

    t.throws(function () {
        foo.good = 'bad';
    }, TypeError, 'Throws exception on invalid attribute value');
    t.end();
});

test('Values attribute basic functionality', function (t) {
    var Model = State.extend({
        props: {
            state: {
                type: 'string',
                values: ['CA', 'WA', 'NV']
            }
        }
    });

    var m = new Model();

    t.throws(function () {
        m.state = 'PR';
    }, TypeError, 'Throws exception when setting something not in list');

    t.equal(m.state, undefined, 'Should be undefined if no default');

    m.state = 'CA';

    t.equal(m.state, 'CA', 'State should be set');
    t.end();
});

test('Values attribute default works and is called only once', function (t) {
    var ran = 0;
    var Model = State.extend({
        dataTypes: {
            countryType: {
                default: 'Atlantis'
            }
        },
        props: {
            country: {
                type: 'countryType',
                required: true
            },
            state: {
                type: 'string',
                values: ['CA', 'WA', 'NV'],
                default: function(){
                    ran++;
                    return 'CA';
                }
            }
        }
    });

    var m = new Model();
    t.equal(m.state, 'CA', 'Should have applied the default');
    t.equal(ran, 1, 'Should have been invoked only once');
    t.equal(m.state, 'CA', 'Should have returned the same object');
    t.equal(ran, 1, 'Should have been invoked only once');
    t.equal(m.country, 'Atlantis');
    t.throws(function () {
        m.state = 'PR';
    }, TypeError, 'Throws exception when setting something not in list');
    t.end();
});

test('toggle() works on boolean and values properties.', function (t) {
    var Model = State.extend({
        props: {
            isAwesome: 'boolean',
            someNumber: 'number',
            state: {
                type: 'string',
                values: ['CA', 'WA', 'NV'],
                default: 'CA'
            }
        }
    });

    var m = new Model();

    t.throws(function () {
        m.toggle('someNumber');
    }, TypeError, 'Throws exception when toggling a non-toggleable property.');

    m.toggle('state');
    t.equal(m.state, 'WA', 'Should go to next');
    m.toggle('state');
    t.equal(m.state, 'NV', 'Should go to next');
    m.toggle('state');
    t.equal(m.state, 'CA', 'Should go to next with loop');

    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, true, 'Should toggle even if undefined');
    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, false, 'Should toggle if true.');
    m.toggle('isAwesome');
    t.strictEqual(m.isAwesome, true, 'Should toggle if false.');
    t.end();
});

test('property test function scope is correct.', function (t) {
    var m;
    var temp;
    var Model = State.extend({
        props: {
            truth: {
                type: 'boolean',
                test: function () {
                    temp = this;
                    return false;
                }
            }
        }
    });

    m = new Model();
    m.toggle('truth');
    t.equal(m, temp);
    t.end();
});

test('should be able to inherit for use in other objects', function (t) {
    var StateObj = State.extend({
        props: {
            name: 'string'
        }
    });
    function AwesomeThing() {
        StateObj.apply(this, arguments);
    }

    AwesomeThing.prototype = Object.create(StateObj.prototype);

    AwesomeThing.prototype.hello = function () {
        return this.name;
    };

    var awe = new AwesomeThing({name: 'cool'});

    t.equal(awe.hello(), 'cool');
    t.equal(awe.name, 'cool');
    t.end();
});

test('extended state objects should maintain child collections of parents', function (t) {
    var State1 = State.extend({
        collections: {
            myStuff: Collection
        }
    });
    var State2 = State1.extend({
        collections: {
            myOtherCollection: Collection
        }
    });
    var thing = new State2();
    t.ok(thing.myStuff);
    t.ok(thing.myOtherCollection);
    t.end();
});

test('`initialize` should have access to initialized child collections', function (t) {
    var StateObj = State.extend({
        initialize: function () {
            t.ok(this.myStuff);
            t.equal(this.myStuff.parent, this);
            t.end();
        },
        collections: {
            myStuff: Collection
        }
    });
    new StateObj();
});

test('parent collection references should be maintained when adding/removing to a collection', function (t) {
    var StateObj = State.extend({
        props: {
            id: 'string'
        }
    });
    var c = new Collection();
    var s = new StateObj({id: '47'});
    c.add(s);
    t.equal(s.collection, c);
    c.remove(s);
    t.notOk(s.collection);
    t.end();
});

test('children and collections should be instantiated', function (t) {
    var GrandChild = State.extend({
        props: {
            id: 'string'
        },
        collections: {
            nicknames: Collection
        }
    });

    var FirstChild = State.extend({
        props: {
            id: 'string'
        },
        children: {
            grandChild: GrandChild
        }
    });

    var StateObj = State.extend({
        props: {
            id: 'string'
        },
        children: {
            firstChild: FirstChild
        }
    });

    var data = {
        id: 'child',
        firstChild: {
            id: 'child',
            grandChild: {
                id: 'grandChild',
                nicknames: [
                    {name: 'munchkin'},
                    {name: 'kiddo'}
                ]
            }
        }
    };

    var first = new StateObj(data);

    t.ok(first.firstChild, 'child should be initted');
    t.ok(first.firstChild.grandChild, 'grand child should be initted');
    t.equal(first.firstChild.id, 'child');
    t.equal(first.firstChild.grandChild.id, 'grandChild');
    t.ok(first.firstChild.grandChild.nicknames instanceof Collection, 'should be collection');
    t.equal(first.firstChild.grandChild.nicknames.length, 2);

    t.deepEqual(first.serialize(), {
        id: 'child',
        firstChild: {
            id: 'child',
            grandChild: {
                id: 'grandChild',
                nicknames: [
                    {name: 'munchkin'},
                    {name: 'kiddo'}
                ]
            }
        }
    });

    t.equal(JSON.stringify(first), JSON.stringify({
        id: 'child',
        firstChild: {
            id: 'child',
            grandChild: {
                id: 'grandChild',
                nicknames: [
                    {name: 'munchkin'},
                    {name: 'kiddo'}
                ]
            }
        }
    }), 'should be able to pass whole object to JSON.stringify()');

    // using `set` should still apply to children
    first.set({
        firstChild: {
            id: 'firstChild',
            grandChild: {
                nicknames: [{name: 'runt'}]
            }
        }
    });
    t.ok(first.firstChild instanceof FirstChild, 'should still be instanceof');
    t.equal(first.firstChild.id, 'firstChild', 'change should have been applied');
    t.equal(first.firstChild.grandChild.nicknames.length, 3, 'collection should have been updated');

    // it should be ok to pass `null` as the child
    first.set("firstChild", null);
    first.set({"firstChild": undefined});
    t.equal(first.firstChild.id, "firstChild");

    t.end();
});

test('issue #82, child collections should not be cleared if they add data to themselves when instantiated', function (t) {
    var Widget = State.extend({
        props: {
            title: 'string'
        }
    });
    var Widgets = Collection.extend({
        initialize: function () {
            // some collections read from data they have immediate access to
            // like localstorage, or whatnot. This should not be wiped out
            // when instantiated by parent.
            this.add([{title: 'hi'}]);
        },
        model: Widget
    });
    var Parent = State.extend({
        collections: {
            widgets: Widgets
        }
    });
    var parent = new Parent();

    t.equal(parent.widgets.length, 1, 'should contain data added by initialize method of child collection');
    t.end();
});

test('listens to child events', function (t) {
    var GrandChild = State.extend({
        props: {
            id: 'string',
            name: 'string'
        },
        collections: {
            nicknames: Collection
        }
    });

    var FirstChild = State.extend({
        props: {
            id: 'string',
            name: 'string'
        },
        children: {
            grandChild: GrandChild
        }
    });

    var StateObj = State.extend({
        props: {
            id: 'string',
            name: 'string'
        },
        children: {
            firstChild: FirstChild
        }
    });

    var first = new StateObj({
        id: 'child',
        name: 'first-name',
        firstChild: {
            id: 'child',
            name: 'first-child-name',
            grandChild: {
                id: 'grandChild',
                name: 'Henrik',
                nicknames: [
                    {name: 'munchkin'},
                    {name: 'kiddo'}
                ]
            }
        }
    });

    t.plan(7);

    //Change property
    first.once('change:name', function (model, newVal) {
        t.equal(newVal, 'new-first-name');
    });
    first.name = 'new-first-name';
    t.equal(first.name, 'new-first-name');

    //Change child property
    first.once('change:firstChild.name', function (model, newVal) {
        t.equal(newVal, 'new-first-child-name');
    });
    first.firstChild.name = 'new-first-child-name';
    t.equal(first.firstChild.name, 'new-first-child-name');

    //Change grand child property
    first.once('change:firstChild.grandChild.name', function (unsure, name) {
        t.equal(name, 'Phil');
    });
    first.firstChild.grandChild.name = 'Phil';
    t.equal(first.firstChild.grandChild.name, 'Phil');

    //Propagates change events from children too
    first.once('change', function (model) {
        t.equal(model, first);
    });
    first.firstChild.grandChild.name = 'Bob';
});

test('Should be able to declare derived properties that have nested deps', function (t) {
    var GrandChild = State.extend({
        props: {
            id: 'string',
            name: 'string'
        }
    });

    var FirstChild = State.extend({
        props: {
            id: 'string',
            name: 'string'
        },
        children: {
            grandChild: GrandChild
        }
    });

    var StateObj = State.extend({
        props: {
            id: 'string',
            name: 'string'
        },
        children: {
            child: FirstChild
        },
        derived: {
            relationship: {
                deps: ['child.grandChild.name', 'name'],
                fn: function () {
                    return this.name + ' has grandchild ' + (this.child.grandChild.name || '');
                }
            }
        }
    });

    var first = new StateObj({
        name: 'henrik'
    });

    t.equal(first.relationship, 'henrik has grandchild ', 'basics properties working');

    first.on('change:relationship', function () {
        t.pass('got change event on derived property for child');
        t.end();
    });

    first.child.grandChild.name = 'something';
});

test('`state` properties', function (t) {
    var Person = State.extend({
        props: {
            sub: 'state',
            sub2: 'state'
        }
    });

    var SubState = State.extend({
        props: {
            id: 'string'
        }
    });

    var p = new Person();

    t.plan(4);

    t.equal(p.sub, undefined, 'should be undefined to start');

    t.throws(function () {
        p.sub = 'something silly';
    }, TypeError, 'Throws type error if not state object');

    p.once('change:sub', function () {
        t.pass('fired change for state');
    });

    var sub = new SubState({id: 'hello'});

    p.sub = sub;

    p.on('change:sub', function () {
        t.fail('shouldn\'t fire if same instance');
    });

    p.sub = sub;

    p.on('change:sub.id', function () {
        t.pass('child property event bubbled');
    });

    p.sub.id = 'new';

    // new person
    var p2 = new Person();
    var sub1 = new SubState({id: 'first'});
    var sub2 = new SubState({id: 'second'});

    p2.on('change:sub.id', function () {
        t.fail('should not bubble on old one');
    });

    p2.sub = sub1;
    p2.sub = sub2;

    sub1.id = 'something different';
});

test('Issue: #75 `state` property from undefined -> state', function (t) {
    t.plan(2);

    var Person = State.extend({
        props: {
            sub: 'state',
            sub2: 'state'
        }
    });

    var SubState = State.extend({
        props: {
            foo: 'string'
        }
    });

    var sub = new SubState({ foo: 'a' });
    var p = new Person({ sub: sub });

    p.on('change:sub.foo', function () {
        t.ok(true);
    });

    sub.foo = 'b';

    p.sub2 = new SubState({ foo: 'bar' });

    sub.foo = 'c';
});

test('`state` properties should invalidate dependent derived properties when changed', function (t) {
    var counter = 0;
    var Person = State.extend({
        props: {
            sub: 'state'
        },
        derived: {
            subId: {
                deps: ['sub.id'],
                fn: function () {
                    return this.sub && this.sub.id;
                }
            }
        }
    });

    var SubState = State.extend({
        props: {
            id: 'string'
        }
    });

    var p = new Person();

    // count each time it's changed
    p.on('change:subId', function () {
        counter++;
    });

    var sub1 = new SubState({id: '1'});

    t.equal(p.subId, undefined, 'should be undefined to start');

    p.sub = sub1;

    t.equal(p.subId, '1', 'should invalidated cache');
    t.equal(counter, 1, 'should fire change callback for derived item');

    p.on('change:sub.id', function (model, newVal) {
        t.pass('change event should fire');
        t.equal(model, sub1, 'callback on these should be sub model');
        t.equal(newVal, 'newId', 'should include new val');
        t.end();
    });

    sub1.id = 'newId';
});

test('#1664 - Changing from one value, silently to another, back to original triggers a change.', function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model({x: 1});
    model.on('change:x', function () { t.ok(true); t.end(); });
    model.set({x: 2}, {silent: true});
    model.set({x: 3}, {silent: true});
    model.set({x: 1});
});

test('#1664 - multiple silent changes nested inside a change event', function (t) {
    var changes = [];
    var Model = State.extend({
        props: {
            a: 'string',
            b: 'number',
            c: 'string'
        }
    });
    var model = new Model();
    model.on('change', function () {
        model.set({a: 'c'}, {silent: true});
        model.set({b: 2}, {silent: true});
        model.unset('c', {silent: true});
    });
    model.on('change:a change:b change:c', function (model, val) { changes.push(val); });
    model.set({a: 'a', b: 1, c: 'item'});
    t.deepEqual(changes, ['a', 1, 'item']);
    t.deepEqual(model.attributes, {a: 'c', b: 2});
    t.end();
});

test('silent changes in last `change` event back to original triggers change', function (t) {
    var changes = [];
    var Model = State.extend({
        props: {
            a: 'string'
        }
    });
    var model = new Model();
    model.on('change:a change:b change:c', function (model, val) { changes.push(val); });
    model.on('change', function () {
        model.set({a: 'c'}, {silent: true});
    });
    model.set({a: 'a'});
    t.deepEqual(changes, ['a']);
    model.set({a: 'a'});
    t.deepEqual(changes, ['a', 'a']);
    t.end();
});

test('#1943 change calculations should use _.isEqual', function (t) {
    var Model = State.extend({
        props: {
            a: 'object'
        }
    });
    var model = new Model({a: {key: 'value'}});
    model.set('a', {key: 'value'}, {silent: true});
    t.equal(model.changedAttributes(), false);
    t.end();
});

test('#1964 - final `change` event is always fired, regardless of interim changes', function (t) {
    var Model = State.extend({
        props: {
            property: 'string'
        }
    });
    var model = new Model();
    model.on('change:property', function () {
        model.set('property', 'bar');
    });
    model.on('change', function () {
        t.ok(true);
        t.end();
    });
    model.set('property', 'foo');
});

test('isValid', function (t) {
    var Model = State.extend({
        props: {
            valid: 'boolean'
        }
    });
    var model = new Model({valid: true});
    model.validate = function (attrs) {
        if (!attrs.valid) return 'invalid';
    };
    t.equal(model.isValid(), true);
    t.equal(model.set({valid: false}, {validate: true}), false);
    t.equal(model.isValid(), true);
    model.set({valid: false});
    t.equal(model.isValid(), false);
    t.ok(!model.set('valid', false, {validate: true}));
    t.end();
});

test('#1545 - `undefined` can be passed to a model constructor without coercion', function (t) {
    var Model = State.extend({
        defaults: { one: 1 },
        initialize : function (attrs) {
            t.equal(attrs, undefined);
        }
    });
    new Model();
    new Model(undefined);
    t.end();
});

test('#1961 - Creating a model with {validate: true} will call validate and use the error callback', function (t) {
    var Model = State.extend({
        props: {
            id: 'number'
        },
        validate: function (attrs) {
            if (attrs.id === 1) return "This shouldn't happen";
        }
    });
    var model = new Model({id: 1}, {validate: true});
    t.equal(model.validationError, "This shouldn't happen");
    t.end();
});

test('#2034 - nested set with silent only triggers one change', function (t) {
    var Model = State.extend({
        props: {
            a: 'boolean',
            b: 'boolean'
        }
    });
    var model = new Model();
    model.on('change', function () {
        model.set({b: true}, {silent: true});
        t.ok(true);
        t.end();
    });
    model.set({a: true});
});

test('#2030 - set with failed validate, followed by another set triggers change', function (t) {
    var attr = 0, main = 0, error = 0;
    var Model = State.extend({
        props: {
            x: 'number'
        },
        validate: function (attr) {
            if (attr.x > 1) {
                error++;
                return 'this is an error';
            }
        }
    });
    var model = new Model({x: 0});
    model.on('change:x', function () { attr++; });
    model.on('change', function () { main++; });
    model.set({x: 2}, {validate: true});
    model.set({x: 1}, {validate: true});
    t.deepEqual([attr, main, error], [1, 1, 1]);
    t.end();
});

test('#1179 - isValid returns true in the absence of validate.', function(t) {
    var Model = State.extend({
        validate: null
    });
    var model = new Model();
    t.ok(model.isValid());
    t.end();
});

test('#1791 - `attributes` is available for `parse`', function(t) {
    var Model = State.extend({
        //Backbone test used this.has which was a this.get !== null test
        parse: function() { this.get('a') !== null; } // shouldn't throw an error
    });
    new Model(null, {parse: true});
    t.end();
});

test('#96 - changedAttributes includes properties that are not direct model attributes', function(t) {
    var Submodel = State.extend({
        props: {
            b: 'number'
        }
    });

    var Model = State.extend({
        props: {
            a: 'number'
        },
        children: {
            submodels: Submodel
        }
    });

    var model = new Model({ a: 1 });
    var old = JSON.parse(JSON.stringify(model));
    var diff = model.changedAttributes(old);
    t.ok(diff === false, 'should return false');

    diff = model.changedAttributes({ a: 5, submodels: [] });
    t.ok(diff.hasOwnProperty('a'), 'should return the changed `a`');
    t.ok(!diff.hasOwnProperty('submodels'), 'should not return `submodels`');

    t.end();
});

test('#99 #101 - string dates can be parsed', function(t) {
    var Today = State.extend({
        props: {
            today: 'date'
        }
    });

    var isDate = function (obj) { return Object.prototype.toString.call(obj) === '[object Date]'; };
    var isoString = '2014-04-16T06:52:49.892Z';
    var date = new Date(isoString);

    var model = new Today();

    model.today = 1397631169892;
    t.ok(isDate(model.today));
    t.equal(model.today.valueOf(), date.valueOf(), 'date should accept an integer');

    model.today = '1397631169892';
    t.ok(isDate(model.today));
    t.equal(model.today.valueOf(), date.valueOf(), 'date should accept a string which will be parsed to an integer');

    model.today = isoString;
    t.ok(isDate(model.today));
    t.equal(model.today.toJSON(), isoString, 'date should accept an iso string');

    model.today = new Date(isoString);
    t.ok(isDate(model.today));
    t.equal(model.today.toJSON(), isoString, 'date should accept a native date object');

    model.today = '2014-11-13';
    t.ok(isDate(model.today));
    t.equal(model.today.toJSON(), '2014-11-13T00:00:00.000Z', 'date should accept YYYY-MM-DD');

    model.today = '2014-11-13T21:01Z';
    t.ok(isDate(model.today));
    t.equal(model.today.toJSON(), '2014-11-13T21:01:00.000Z', 'date should accept YYYY-MM-DDTHH:MMZ');

    t.end();
});

test('#128 don\'t coerce null date as 0', function (t) {
    var Day = State.extend({
        props: {
            theDate: 'date'
        }
    });

    var day = new Day({ theDate: null });
    t.notOk(day.theDate, 'date should not be set if null');
    t.equal(day.theDate, null);

    day = new Day({ theDate: undefined });
    t.notOk(day.theDate, 'date should not be set if undefined');
    t.equal(day.theDate, undefined);

    var Day2 = State.extend({
        props: {
            theDate: {
                type: 'date',
                required: true,
                allowNull: false
            }
        }
    });

    t.throws(function () {
        new Day2({ theDate: null });
    }, /cannot be null/, 'if allowNull:false, and required:true should still throw');

    t.end();
});

test('#68, #110 mixin props should not be deleted', function (t) {
    var SelectedMixin = {
      session : {
        selected : 'boolean'
      }
    };

    var Widget = State.extend(SelectedMixin,{});
    t.deepEqual(SelectedMixin.session, { selected: 'boolean' });
    var Sprocket = State.extend(SelectedMixin,{});

    var widget = new Widget({selected : true});
    var sprocket = new Sprocket({selected : true});

    t.ok(widget.selected);
    t.ok(sprocket.selected);
    t.end();
});

test('#114 setOnce allows values to be set once and only once', function (t) {
    var Model = State.extend({
        props: {
            x: {
                type: 'string',
                setOnce: true,
                required: true,
            }
        }
    });

    var model = new Model({ x: 'foo' });

    t.equal(model.x, 'foo');

    t.throws(function () {
        model.x = 'bar';
    }, /can only be set once/);

    t.end();
});

test('#118 setOnce can be used with default string', function (t) {
    var TimeRange = State.extend({
        props: {
            timezone: {
                type: 'string',
                default: 'something that can only be set as the default',
                setOnce: true
            }
        }
    });

    var tr = new TimeRange();

    t.throws(function () {
        tr.timezone = 'new thing';
    }, 'since it has a default, this should throw');

    var tr2;

    t.doesNotThrow(function () {
        tr2 = new TimeRange({timezone: 'my thing'});
    }, 'if we set on init, should overwrite default');

    t.throws(function () {
        tr.timezone = 'new thing';
    }, 'should now fail since its been set');

    var OtherTimeRange = State.extend({
        props: {
            timezone: {
                type: 'string',
                setOnce: true
            }
        }
    });

    tr = new OtherTimeRange();

    t.doesNotThrow(function () {
        tr.timezone = 'thing';
    }, 'should not throw first time');

    t.throws(function () {
        tr.timezone = 'other thing';
    }, 'throws second time');

    t.end();
});

test('#24 validate date properties can now be set to null', function (t) {
    var Thing = State.extend({
        props: {
            date: {
                type: 'date',
                allowNull: true
            }
        }
    });

    var thing = new Thing();
    var date = new Date();
    thing.date = date;
    t.equal(thing.date.valueOf(), date.valueOf());
    thing.date = null;
    t.equal(thing.date, null);

    t.end();
});

test('throw helpful error if trying to extend with `prop` that already is defined', function (t) {
    t.plan(3);
    var Parent = State.extend({
        props: {
            model: 'state'
        }
    });
    try {
        Parent.extend({
            model: {}
        });
    } catch (e) {
        t.ok(e.message.indexOf('extend') !== -1, 'message should contain "extend"');
        t.ok(e.message.indexOf('model') !== -1, 'message should contain name of prop being extended over');
        t.ok(e.message.indexOf('props') !== -1, 'message should say it has been defined in props');
    }
});

// https://github.com/AmpersandJS/ampersand-view/issues/96
test('Provide namespace collision error on collection with property already defined', function (t) {
    var Parent = State.extend({
        collections: {
            items: Collection
        },
        items: true
    });

    var Parent2 = State.extend({
        props: {
            items: 'boolean'
        },
        collections: {
            items: Collection
        }
    });

    t.throws(function () {
        new Parent();
    }, Error, 'Throws collision error on property and collections');

    t.throws(function () {
        new Parent2();
    }, Error, 'Throws collision error on collections and props');
    t.end();
});

test('Provide namespace collision error on children with property already defined', function (t) {
    var Parent = State.extend({
        children: {
            items: State
        },
        items: true
    });

    var Parent2 = State.extend({
        props: {
            items: 'boolean'
        },
        children: {
            items: Collection
        }
    });

    t.throws(function () {
        new Parent();
    }, Error, 'Throws collision error on property and children');

    t.throws(function () {
        new Parent2();
    }, Error, 'Throws collision error on children and props');
    t.end();
});

test('collision in model extend - issue #144', function(t) {
    var Parent = State.extend({
        props: {
            'title': ['string', false, '']
        }
    });
    t.throws(function() {
        Parent.extend({
            'title': 'more info',
        });
    }, Error, 'throws a collision error on extending a prop');
    t.end();
});

test('toJSON should serialize state props - issue #197', function(t) {
    var Person = State.extend({
        props: {
            child: {
                type: 'state'
            }
        }
    });

    var Child = State.extend({
        props: {
            name: {
                type: 'string'
            }
        }
    });

    var father = new Person();
    var child = new Child({ name: 'john' });
    father.child = child;
    t.deepEqual(father.toJSON(), { child: { name: 'john' }}, 'should serialize existing state props');

    var mother = new Person();
    var child2 = new Child();
    mother.child = child2;
    t.deepEqual(mother.toJSON(), { child: {}}, 'should serialize non-existent state props');

    t.end();
});

test('toJSON should serialize customType props - issue #197', function(t) {
    function CustomType(props) {
        this.props = props;
        this.serialize = function() {
            return this.props;
        };
    }
    var Person = State.extend({
        dataTypes: {
            customType: {
                set: function(newVal) {
                    return {
                        val: newVal,
                        type: 'customType'
                    };
                },
                compare: function(currentVal, newVal) {
                    return currentVal === newVal;
                }
            },
            compare : function(currentVal, newVal){
                return currentVal.equals(newVal);
            }
        },
        props: {
            child: {
                type: 'customType'
            }
        }
    });

    var father = new Person();
    var child = new CustomType({ name: 'john'});
    father.child = child;
    t.deepEqual(father.toJSON(), { child: { name: 'john' }}, 'should serialize existing state props');

    t.end();
});

test("#112 - should not set up events on child state if setOnce check fails", function(t){
    var Person = State.extend({
        props : {
            birthday : {
                type : 'state',
                setOnce : true
            }
        }
    });
    var Birthday = State.extend({
        props : {
            day : 'date'
        }
    });

    var p = new Person();
    var bday = new Birthday({day : new Date()});
    p.once('change:birthday', function() {
        t.pass('birthday can change once');
    });
    p.birthday = bday;
    var newBday = new Birthday({day : new Date()});
    t.throws(function() {
        p.birthday = newBday;
    }, TypeError, 'Throws error on change of setOnce');

    p.on('change:birthday.day', function() {
        t.fail('should not trigger change event on old one');
    });

    newBday.day = new Date(1);

    t.end();
});

test('#112 - onChange should be called for default values', function (t) {
  var Person = State.extend({
    dataTypes: {
      'custom-type': {
        set: function (newVal) {
          return {
            type: 'custom-type',
            val: newVal
          };
        },
        onChange: function (newVal, curVal, name) {
          t.equal(newVal.value, 100, 'should get the default value as newVal');
          t.equal(curVal, undefined, 'should get undefined as current value');
          t.equal(name, 'strength', 'should get the attribute name');
          t.pass('onChange was called');
        }
      }
    },
    props: {
      strength: {
        type: 'custom-type',
        default: function () {
          t.pass('default function should be called');
          return {
            value: 100
          };
        }
      }
    }
  });

  t.plan(6);
  var p = new Person();
  t.equal(p.strength.value, 100);
});

test('keeps event listeners when changing property of type state', function (t) {
  var Organization = State.extend({});
  var Person = State.extend({
    props: {
      organization: { type: 'state' }
    },
    initialize: function() {
      this.listenTo(this.organization, 'customEvent', function() {
        t.pass('customEvent handler was called');
      });
    },
  });

  t.plan(1);
  var orgA = new Organization();
  var orgB = new Organization();
  var p = new Person({ organization: orgA });
  p.organization = orgB;
  orgA.trigger('customEvent');
  t.end();
});
