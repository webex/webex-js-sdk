/* eslint-disable */

var test = require('tape');
var State = require('../..').default;

var Person = State.extend({
    props: {
        name: 'string'
    }
});

test('init with nothing should be okay', function (t) {
    var EmptyModel = State.extend();
    var something = new EmptyModel();
    something.foo = 'bar';
    t.ok(something);
    t.equal(something.foo, 'bar');
    t.end();
});

test('init with values', function (t) {
    var person = new Person({name: 'henrik'});
    t.ok(person);
    t.equal(person.name, 'henrik');
    t.end();
});

test('after initialized change should be empty until a set op', function (t) {
    var person = new Person({name: 'phil'});
    t.deepEqual(person._changed, {});
    t.notOk(person.changedAttributes());
    t.end();
});

test('extended object maintains existing props', function (t) {
    var AwesomePerson = Person.extend({
        props: {
            awesomeness: 'number'
        }
    });

    var awesome = new AwesomePerson({
        name: 'Captain Awesome',
        awesomeness: 11
    });

    t.equals(awesome.name, 'Captain Awesome');
    t.equals(awesome.awesomeness, 11);
    t.end();
});

test('extended object maintains existing methods', function (t) {
    var NewPerson = State.extend({
        props: {
            awesomeness: 'number'
        },
        isTrulyAwesome: function () {
            if (this.awesomeness > 10) return true;
        }
    });
    var AwesomePerson = NewPerson.extend({});
    var awesome = new AwesomePerson({
        awesomeness: 11
    });
    t.ok(awesome.isTrulyAwesome());
    t.end();
});

test('cached derived properties are calculated once per change', function (t) {
    var count = 0;
    var NewPerson = Person.extend({
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    count++;
                    return 'hi, ' + this.name + '!';
                }
            }
        }
    });
    var person = new NewPerson({name: 'henrik'});
    t.equal(person.greeting, 'hi, henrik!');

    // use again, should not increment counter
    person.greeting;
    t.equal(count, 1);

    person.name = 'something';
    t.equal(person.greeting, 'hi, something!');
    // reference again
    person.greeting;
    t.equal(count, 2);

    t.end();
});

test('cached derived properties fire events on dependency change', function (t) {
    var NewPerson = Person.extend({
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    return 'hi, ' + this.name + '!';
                }
            }
        }
    });
    var person = new NewPerson({name: 'henrik'});
    person.on('change:greeting', function (model, value) {
        t.equal(value, 'hi, something!', "shouldn't fire if value is unchanged same value");
        t.end();
    });
    person.name = 'something';
});

test('cached derived properties fire events if result is different', function (t) {
    t.plan(1);
    var NewPerson = Person.extend({
        derived: {
            greeting: {
                deps: ['name'],
                fn: function () {
                    return 'hi, ' + this.name + '!';
                }
            }
        }
    });
    var person = new NewPerson({name: 'henrik'});
    person.on('change:greeting', function () {
        t.ok(false, "shouldn't fire if value if derived value is unchanged");
    });
    person.name = 'henrik';
    t.equal(person.name, 'henrik');
});

test('cached && accessed derived properties do not fire events if result has not changed', function (t) {
    t.plan(2);
    var SomeNumber = State.extend({
        props: {
            num: 'number'
        },
        derived: {
            isEven: {
                cache: true,
                deps: ['num'],
                fn: function () {
                    return this.num % 2 === 0;
                }
            }
        }
    });
    var num = new SomeNumber({ num: 8 });
    num.on('change:isEven', function () {
        t.ok(false, "shouldn't fire if derived value is unchanged");
    });
    t.equal(num.isEven, true);
    num.num = 10;
    t.equal(num.isEven, true);
});

test('uncached & accessed derived properties fire events even if result has not changed', function (t) {
    t.plan(3);
    var SomeNumber = State.extend({
        props: {
            num: 'number'
        },
        derived: {
            isEven: {
                cache: false,
                deps: ['num'],
                fn: function () {
                    return this.num % 2 === 0;
                }
            }
        }
    });
    var num = new SomeNumber({ num: 8 });
    num.on('change:isEven', function () {
        t.equal(num.isEven, true, 'should fire even if derived value is unchanged');
    });
    t.equal(num.isEven, true);
    num.num = 10;
    t.equal(num.isEven, true);
});

test('uncached derived properties always fire events on dependency change', function (t) {
    t.plan(1);
    var NewPerson = Person.extend({
        derived: {
            greeting: {
                deps: ['name'],
                cache: false,
                fn: function () {
                    return 'hello!';
                }
            }
        }
    });
    var person = new NewPerson({name: 'henrik'});
    person.on('change:greeting', function (model, value) {
        t.equal(value, 'hello!', 'Fires despite being same value');
    });
    person.name = 'different';
});

test('everything should work with a property called `type`. Issue #6.', function (t) {
    var Model = State.extend({
        props: {
            id: 'string',
            type: 'string'
        }
    });
    var model = new Model({id: '50', type: 'hello'});
    t.equal(model.type, 'hello');
    model.type = 'wat?';
    t.equal(model.type, 'wat?');
    t.end();
});

test('should have cid', function (t) {
    var Model = State.extend({
        props: {
            id: 'string',
            type: 'string'
        }
    });
    var m = new Model();
    t.ok(m.cid);
    t.end();
});

test('instanceof checks should pass for all parents in the chain', function (t) {
    var P1 = Person.extend({});
    var P2 = P1.extend({});
    var P3 = P2.extend({});
    var p1 = new P1();
    var p2 = new P2();
    var p3 = new P3();
    t.ok(p1 instanceof Person);
    t.ok(p2 instanceof Person);
    t.ok(p3 instanceof Person);
    t.notOk(p1 instanceof P2);
    t.ok(p2 instanceof P2);
    t.ok(p3 instanceof P2);
    t.notOk(p2 instanceof P3);
    t.ok(p3 instanceof P3);

    // all of them should have the isState flag too
    t.ok(p1.isState);
    t.ok(p2.isState);
    t.ok(p3.isState);

    // shouldn't be possible to change
    p1.isState = false;
    p2.isState = false;
    p3.isState = false;
    t.ok(p1.isState);
    t.ok(p2.isState);
    t.ok(p3.isState);

    t.end();
});

test('custom id and namespace attributes', function (t) {
    var NewPerson = State.extend({
        props: {
            name: 'string',
            _id: 'number',
            ns: 'string'
        },
        idAttribute: '_id',
        namespaceAttribute: 'ns'
    });
    var person = new NewPerson({name: 'henrik', ns: 'group1', _id: 47});
    t.equal(person.getId(), 47);
    t.equal(person.getNamespace(), 'group1');
    t.end();
});

test('customizable `type` attribute', function (t) {
    var FirstModel = State.extend({
        type: 'hello',
        typeAttribute: 'type'
    });
    var SecondModel = State.extend({
        modelType: 'second'
    });
    var first = new FirstModel();
    var second = new SecondModel();
    t.equal(first.getType(), 'hello');
    t.equal(second.getType(), 'second');
    t.end();
});

test('constructor should be defined', function (t) {
    var Foo = State.extend({
        props: { name: 'string' }
    });
    var foo = new Foo();

    t.ok(foo.constructor);
    t.end();
});

test('isValid is a thing', function (t) {
    var Foo = State.extend({
        props: { name: ['string', true] },
        validate: function (attrs) {
            if (attrs.name.length < 2) {
                return "can't be too short";
            }
        }
    });

    var foo = new Foo();
    t.notOk(foo.isValid());
    foo.name = 'thing';
    t.ok(foo.isValid());
    t.end();
});

test('isNew', function (t) {
    var Foo = State.extend({
        props: {
            id: 'number',
            foo: 'number',
            bar: 'number',
            baz: 'number'
        }
    });
    var a = new Foo({ 'foo': 1, 'bar': 2, 'baz': 3});
    t.ok(a.isNew(), 'it should be new');
    a = new Foo({ 'foo': 1, 'bar': 2, 'baz': 3, 'id': -5 });
    t.ok(!a.isNew(), 'any defined ID is legal, negative or positive');
    a = new Foo({ 'foo': 1, 'bar': 2, 'baz': 3, 'id': 0 });
    t.ok(!a.isNew(), 'any defined ID is legal, including zero');
    t.ok(new Foo({}).isNew(), 'is true when there is no id');
    t.ok(!new Foo({'id': 2}).isNew(), 'is false for a positive integer');
    t.ok(!new Foo({'id': -5}).isNew(), 'is false for a negative integer');
    t.end();
});

test('escape', function (t) {
    var Doc = State.extend({
        props: {
            id: 'string',
            title: 'string',
            author: 'string',
            length: 'number',
            audience: 'string'
        }
    });
    var doc = new Doc({
        id: '1-the-tempest',
        title: 'The Tempest',
        author: 'Bill Shakespeare',
        length: 123
    });

    t.equal(doc.escape('title'), 'The Tempest');
    doc.set({audience: 'Bill & Bob'});
    t.equal(doc.escape('audience'), 'Bill &amp; Bob');
    doc.set({audience: 'Tim > Joan'});
    t.equal(doc.escape('audience'), 'Tim &gt; Joan');
    doc.unset('audience');
    t.equal(doc.escape('audience'), '');
    t.end();
});

test('set an empty string', function (t) {
    var Model = State.extend({
        props: {
            name: 'string'
        }
    });
    var model = new Model({name : 'Model'});
    model.set({name : ''});
    t.equal(model.get('name'), '');
    t.end();
});

test('setting an object', function (t) {
    var Model = State.extend({
        props: {
            custom: 'object'
        }
    });
    var model = new Model({
        custom: {foo: 1}
    });
    model.on('change', function () {
        t.equal(model.custom.foo, 2);
        t.end();
    });
    model.set({
        custom: {foo: 1} // no change should be fired
    });
    model.set({
        custom: {foo: 2} // change event should be fired
    });
});

test('clear', function (t) {
    var Model = State.extend({
        props: {
            name: 'string',
            id: 'number',
            length: 'number'
        }
    });
    var changed;
    var model = new Model({id: 1, name : 'Model', length: 1});
    model.on('change:name', function () { changed = true; });
    model.clear();
    t.equal(changed, true);
    t.equal(model.get('name'), undefined);
    t.end();
});

test('changedAttributes', function (t) {
    var Model = State.extend({
        props: {
            a: 'string',
            b: 'string'
        }
    });
    var model = new Model({a: 'a', b: 'b'});
    t.deepEqual(model.changedAttributes(), false);
    t.equal(model.changedAttributes({a: 'a'}), false);
    t.equal(model.changedAttributes({a: 'b'}).a, 'b');
    t.end();
});

test('change with options', function (t) {
    var value;
    var Model = State.extend({
        props: {
            name: 'string'
        }
    });
    var model = new Model({name: 'Rob'});
    model.on('change', function (model, options) {
        value = options.prefix + model.get('name');
    });
    model.set({name: 'Bob'}, {prefix: 'Mr. '});
    t.equal(value, 'Mr. Bob');
    model.set({name: 'Sue'}, {prefix: 'Ms. '});
    t.equal(value, 'Ms. Sue');
    t.end();
});

test('change after initialize', function (t) {
    var changed = 0;
    var Model = State.extend({
        props: {
            id: 'number',
            label: 'string'
        }
    });
    var attrs = {id: 1, label: 'c'};
    var obj = new Model(attrs);
    obj.on('change', function () { changed += 1; });
    obj.set(attrs);
    t.equal(changed, 0);
    t.end();
});

test('set triggers changes in the correct order', function (t) {
    var value = null;
    var M = State.extend({});
    var model = new M();
    model.on('last', function () { value = 'last'; });
    model.on('first', function () { value = 'first'; });
    model.trigger('first');
    model.trigger('last');
    t.equal(value, 'last');
    t.end();
});

test('multiple unsets', function (t) {
    var i = 0;
    var counter = function () { i++; };
    var Model = State.extend({
        props: {
            a: 'string'
        }
    });
    var model = new Model({a: 'a'});
    model.on('change:a', counter);
    model.set({a: 'b'});
    model.unset('a');
    model.unset('a');
    t.equal(i, 2, 'Unset does not fire an event for missing attributes.');
    t.end();
});

test('unset with array', function (t) {
    var Model = State.extend({
        props: {
            a: ['string', true, 'first'],
            b: ['string', true, 'second']
        }
    });
    var model = new Model({a: 'a', b: 'b'});
    model.unset(['a', 'b']);
    t.equal(model.a, 'first');
    t.equal(model.b, 'second');
    t.end();
});

test('unset and changedAttributes', function (t) {
    var Model = State.extend({
        props: {
            a: 'number'
        }
    });
    var model = new Model({a: 1});
    model.on('change', function () {
        t.ok('a' in model.changedAttributes(), 'changedAttributes should contain unset properties');
        t.end();
    });
    model.unset('a');
});

test('unset undefined prop', function (t) {
    var Model = State.extend({
        props: {
            a: 'number'
        }
    });
    var model = new Model({a: 1});
    t.doesNotThrow(function () {
        model.unset('b');
    });
    t.end();
});

test('change, hasChanged, changedAttributes, previous, previousAttributes', function (t) {
    var Model = State.extend({
        props: {
            name: 'string',
            age: 'number'
        }
    });
    var model = new Model({name: 'Tim', age: 10});
    t.deepEqual(model.changedAttributes(), false);
    model.on('change', function () {
        t.ok(model.hasChanged('name'), 'name changed');
        t.ok(!model.hasChanged('age'), 'age did not');
        t.deepEqual(model.changedAttributes(), {name : 'Rob'}, 'changedAttributes returns the changed attrs');
        t.equal(model.previous('name'), 'Tim');
        t.deepEqual(model.previousAttributes(), {name : 'Tim', age : 10}, 'previousAttributes is correct');
        t.end();
    });
    t.equal(model.hasChanged(), false);
    t.equal(model.hasChanged(undefined), false);
    model.set({name : 'Rob'});
    t.equal(model.get('name'), 'Rob');
});

test('validate on unset and clear', function (t) {
    var error;
    var Model = State.extend({
        props: {
            name: 'string'
        }
    });
    var model = new Model({name: 'One'});
    model.validate = function (attrs) {
        if (!attrs.name) {
            error = true;
            return 'No thanks.';
        }
    };
    model.set({name: 'Two'});
    t.equal(model.get('name'), 'Two');
    t.equal(error, undefined);
    model.unset('name', {validate: true});
    t.equal(error, true);
    t.equal(model.get('name'), 'Two');
    model.clear({validate: true});
    t.equal(model.get('name'), 'Two');
    delete model.validate;
    model.clear();
    t.equal(model.get('name'), undefined);
    t.end();
});

test('validate with error callback', function (t) {
    var boundError;
    var Model = State.extend({
        props: {
            a: 'number',
            admin: 'boolean'
        }
    });
    var model = new Model();
    model.validate = function (attrs) {
        if (attrs.admin) return "Can't change admin status.";
    };
    model.on('invalid', function () {
        boundError = true;
    });
    var result = model.set({a: 100}, {validate: true});
    t.equal(result, model);
    t.equal(model.get('a'), 100);
    t.equal(model.validationError, null);
    t.equal(boundError, undefined);
    result = model.set({a: 200, admin: true}, {validate: true});
    t.equal(result, false);
    t.equal(model.get('a'), 100);
    t.equal(model.validationError, "Can't change admin status.");
    t.equal(boundError, true);
    t.end();
});

test("Nested change events don't clobber previous attributes", function (t) {
    new (State.extend({props: {state: 'string', other: 'string'}}))()
        .on('change:state', function (model, newState) {
            t.equal(model.previous('state'), undefined);
            t.equal(newState, 'hello');
            // Fire a nested change event.
            model.set({other: 'whatever'});
        })
        .on('change:state', function (model, newState) {
            t.equal(model.previous('state'), undefined);
            t.equal(newState, 'hello');
            t.end();
        })
        .set({state: 'hello'});
});

test('hasChanged/set should use same comparison', function (t) {
    var changed = 0;
    var Model = State.extend({
        props: {
            a: 'string'
        }
    });
    var model = new Model({a: 'something'});
    model.on('change', function () {
            t.ok(this.hasChanged('a'));
        })
        .on('change:a', function () {
            changed++;
        })
        .set({a: 'else'});
    t.equal(changed, 1);
    t.end();
});

test('#582, #425, change:attribute callbacks should fire after all changes have occurred', 9, function (t) {
    var Model = State.extend({
        props: {
            a: 'string',
            b: 'string',
            c: 'string'
        }
    });
    var model = new Model();

    var assertion = function () {
        t.equal(model.get('a'), 'a');
        t.equal(model.get('b'), 'b');
        t.equal(model.get('c'), 'c');
    };

    model.on('change:a', assertion);
    model.on('change:b', assertion);
    model.on('change:c', assertion);

    model.set({a: 'a', b: 'b', c: 'c'});
    t.end();
});

test('set same value does not trigger change', function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model({x: 1});
    model.on('change change:x', function () { t.ok(false); });
    model.set({x: 1});
    model.set({x: 1});
    t.end();
});

test('unset does not fire a change for undefined attributes', 0, function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model({x: undefined});
    model.on('change:x', function () { t.ok(false); });
    model.unset('x');
    t.end();
});

test('hasChanged works outside of change events, and true within', 6, function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model({x: 1});
    model.on('change:x', function () {
        t.ok(model.hasChanged('x'));
        t.equal(model.get('x'), 1);
    });
    model.set({x: 2}, {silent: true});
    t.ok(model.hasChanged());
    t.equal(model.hasChanged('x'), true);
    model.set({x: 1});
    t.ok(model.hasChanged());
    t.equal(model.hasChanged('x'), true);
    t.end();
});

test('hasChanged gets cleared on the following set', function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model();
    model.set({x: 1});
    t.ok(model.hasChanged());
    model.set({x: 1});
    t.ok(!model.hasChanged());
    model.set({x: 2});
    t.ok(model.hasChanged());
    model.set({});
    t.ok(!model.hasChanged());
    t.end();
});

test('`hasChanged` for falsey keys', function (t) {
    var Model = State.extend({
        props: {
            x: 'boolean'
        }
    });
    var model = new Model();
    model.set({x: true}, {silent: true});
    t.ok(!model.hasChanged(0));
    t.ok(!model.hasChanged(''));
    t.end();
});

test('`hasChanged` for derived properties with single dep', function (t) {
    var Greeter = Person.extend({
        derived: {
            greet: {
                deps: ['name'],
                fn: function () {
                    return 'Hello ' + this.name + '!';
                }
            }
        }
    });
    var greeter = new Greeter({name: 'Krystian'});
    greeter.name = 'Kamil';
    t.ok(greeter.hasChanged('greet'));
    greeter.name = 'Kamil';
    t.ok(!greeter.hasChanged('greet'));
    greeter.name = 'Krystian';
    t.ok(greeter.hasChanged('greet'));
    t.end();
});

test('`hasChanged` for derived properties with multiple deps', function (t) {
    var Greeter = Person.extend({
        props: {
            firstName: 'string',
            lastName: 'string'
        },
        derived: {
            greet: {
                deps: ['firstName', 'lastName'],
                fn: function () {
                    return 'Hello ' + this.firstName + ' ' + this.lastName + '!';
                }
            }
        }
    });
    var greeter = new Greeter({firstName: 'Krystian', lastName: 'Kocur'});
    greeter.firstName = 'Kamil';
    t.ok(greeter.hasChanged('greet'));
    greeter.lastName = 'Ogorek';
    t.ok(greeter.hasChanged('greet'));
    greeter.firstName = 'Krystian';
    greeter.lastName = 'Kocur';
    t.ok(greeter.hasChanged('greet'));
    greeter.lastName = 'Kocur';
    t.ok(!greeter.hasChanged('greet'));
    greeter.firstName = 'Krystian';
    t.ok(!greeter.hasChanged('greet'));
    t.end();
});

test('`previous` for falsey keys', function (t) {
    var Model = State.extend({
        props: {
            0: 'boolean',
            '': 'boolean'
        }
    });
    var model = new Model({0: true, '': true});
    model.set({0: false, '': false}, {silent: true});
    t.equal(model.previous(0), true);
    t.equal(model.previous(''), true);
    t.end();
});

test('validate', function (t) {
    var lastError;
    var Model = State.extend({
        props: {
            admin: ['boolean', true, true],
            a: 'number'
        }
    });
    var model = new Model();
    model.validate = function (attrs) {
        if (attrs.admin != this.get('admin')) return "Can't change admin status.";
    };
    model.on('invalid', function (model, error) {
        lastError = error;
    });
    var result = model.set({a: 100});
    t.equal(result, model);
    t.equal(model.get('a'), 100);
    t.equal(lastError, undefined);
    result = model.set({admin: true});
    t.equal(model.get('admin'), true);
    result = model.set({a: 200, admin: false}, {validate: true});
    t.equal(lastError, "Can't change admin status.");
    t.equal(result, false);
    t.equal(model.get('a'), 100);
    t.end();
});

test('set and unset', function (t) {
    var Model = State.extend({
        props: {
            id: 'string',
            foo: 'number',
            bar: 'number',
            baz: 'number',
            extra: 'string'
        }
    });
    var a = new Model({id: 'id', foo: 1, bar: 2, baz: 3});
    var changeCount = 0;
    a.on('change:foo', function () { changeCount += 1; });
    a.set({'foo': 2});
    t.ok(a.get('foo') == 2, 'Foo should have changed.');
    t.ok(changeCount == 1, 'Change count should have incremented.');
    a.set({'foo': 2}); // set with value that is not new shouldn't fire change event
    t.ok(a.get('foo') == 2, 'Foo should NOT have changed, still 2');
    t.ok(changeCount == 1, 'Change count should NOT have incremented.');

    a.validate = function (attrs) {
        t.equal(attrs.foo, void 0, 'validate: true passed while unsetting');
    };
    a.unset('foo', {validate: true});
    t.equal(a.get('foo'), void 0, 'Foo should have changed');
    delete a.validate;
    t.ok(changeCount == 2, 'Change count should have incremented for unset.');

    a.unset('id');
    t.equal(a.id, undefined, 'Unsetting the id should remove the id property.');
    t.end();
});

test('unset even if value has been specified', function (t) {
    var Model = State.extend({
        props: {
            foo: 'string'
        }
    });
    var model = new Model({ foo: 'bar' });
    model.on('change:foo', function () {
        t.equal(model.get('foo'), undefined);
    });
    model.set({ foo: 'baz' }, { unset: true });
    t.equal(model.get('foo'), undefined);
    t.end();
});

test("nested `set` during `'change:attr'`", function (t) {
    var events = [];
    var Model = State.extend({
        props: {
            x: 'boolean',
            y: 'boolean',
            z: 'boolean'
        }
    });
    var model = new Model();
    model.on('all', function (event) { events.push(event); });
    model.on('change', function () {
        model.set({z: true}, {silent: true});
    });
    model.on('change:x', function () {
        model.set({y: true});
    });
    model.set({x: true});
    t.deepEqual(events, ['change:y', 'change:x', 'change']);
    events = [];
    model.set({z: true});
    t.deepEqual(events, []);
    t.end();
});

test('nested `change` only fires once', function (t) {
    t.plan(1);
    var model = new (State.extend({props: {x: 'boolean'}}))();
    model.on('change', function () {
        t.ok(true);
        model.set({x: true});
    });
    model.set({x: true});
});

test("nested `set` during `'change'`", function (t) {
    var count = 0;
    var Model = State.extend({
        props: {
            x: 'boolean',
            y: 'boolean',
            z: 'boolean'
        }
    });
    var model = new Model();
    model.on('change', function () {
        switch (count++) {
        case 0:
            t.deepEqual(this.changedAttributes(), {x: true});
            t.equal(model.previous('x'), undefined);
            model.set({y: true});
            break;
        case 1:
            t.deepEqual(this.changedAttributes(), {x: true, y: true});
            t.equal(model.previous('x'), undefined);
            model.set({z: true});
            break;
        case 2:
            t.deepEqual(this.changedAttributes(), {x: true, y: true, z: true});
            t.equal(model.previous('y'), undefined);
            break;
        default:
            t.ok(false);
        }
    });
    model.set({x: true});
    t.end();
});

test('nested `change` with silent', function (t) {
    var count = 0;
    var Model = State.extend({
        props: {
            x: 'boolean',
            y: 'boolean',
            z: 'boolean'
        }
    });
    var model = new Model();
    model.on('change:y', function () { t.ok(false); });
    model.on('change', function () {
        switch (count++) {
        case 0:
            t.deepEqual(this.changedAttributes(), {x: true});
            model.set({y: true}, {silent: true});
            model.set({z: true});
            break;
        case 1:
            t.deepEqual(this.changedAttributes(), {x: true, y: true, z: true});
            break;
        case 2:
            t.deepEqual(this.changedAttributes(), {z: false});
            break;
        default:
            t.ok(false);
        }
    });
    model.set({x: true});
    model.set({z: false});
    t.end();
});

test('nested `change:attr` with silent', function (t) {
    var Model = State.extend({
        props: {
            x: 'boolean',
            y: 'boolean',
            z: 'boolean'
        }
    });
    var model = new Model();
    model.on('change:y', function () { t.ok(false); });
    model.on('change', function () {
        model.set({y: true}, {silent: true});
        model.set({z: true});
    });
    model.set({x: true});
    t.end();
});

test('multiple nested changes with silent', function (t) {
    var Model = State.extend({
        props: {
            x: 'boolean',
            y: 'number'
        }
    });
    var model = new Model();
    model.on('change:x', function () {
        model.set({y: 1}, {silent: true});
        model.set({y: 2});
    });
    model.on('change:y', function (model, val) {
        t.equal(val, 2);
    });
    model.set({x: true});
    t.end();
});

test('multiple nested changes with silent', function (t) {
    var changes = [];
    var Model = State.extend({
        props: {
            b: 'number'
        }
    });
    var model = new Model();
    model.on('change:b', function (model, val) { changes.push(val); });
    model.on('change', function () {
        model.set({b: 1});
    });
    model.set({b: 0});
    t.deepEqual(changes, [0, 1]);
    t.end();
});

test('basic silent change semantics', function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model();
    model.set({x: 1});
    model.on('change', function () { t.ok(true); });
    model.set({x: 2}, {silent: true});
    model.set({x: 1});
    t.end();
});

test('nested set multiple times', function (t) {
    var Model = State.extend({
        props: {
            a: 'boolean',
            b: 'boolean'
        }
    });
    var model = new Model();
    model.on('change:b', function () {
        t.ok(true);
    });
    model.on('change:a', function () {
        model.set({b: true});
        model.set({b: true});
    });
    model.set({a: true});
    t.end();
});

test('#1122 - clear does not alter options.', function (t) {
    var model = new (State.extend({}))();
    var options = {};
    model.clear(options);
    t.ok(!options.unset);
    t.end();
});

test('#1122 - unset does not alter options.', function (t) {
    var Model = State.extend({
        props: {
            x: 'number'
        }
    });
    var model = new Model();
    var options = {};
    model.unset('x', options);
    t.ok(!options.unset);
    t.end();
});

test('#53 - previousAttributes set correctly when it was a default', function (t) {
    var MyState = State.extend({
        props: {
            test1: ['boolean', true, true],
            test2: ['boolean', true, true]
        }
    });

    var a = new MyState();
    a.on('change:test1', function () {
        t.deepEqual(a.previousAttributes(), {
            test1: true,
            test2: true
        });
        t.end();
    });
    a.test1 = false;
});

test('#74 - ensure default array/object types are mutable', function (t) {
    var MyState = State.extend({
        props: {
            anArray: ['array', true],
            anObject: ['object', true]
        }
    });

    var s = new MyState();
    s.anArray.push(1);
    t.equal(s.anArray.length, 1);
    t.equal(s.anArray[0], 1);

    s.anObject.foo = 'bar';
    t.equal(s.anObject.foo, 'bar');
    t.end();
});

test('unset on prop with values array - issue #144', function (t) {
    var Model = State.extend({
        props: {
            stuff: {
                type: 'string',
                required: false,
                values: ['a', 'b', 'c']
            }
        }
    });
    var model = new Model({ stuff: 'a' });
    t.doesNotThrow(function () {
        model.unset('stuff');
    });
    t.equal(model.stuff, undefined);
    t.end();
});

test('unset on prop with values array and default - issue #144', function (t) {
    var Model = State.extend({
        props: {
            stuff: {
                type: 'string',
                required: false,
                values: ['a', 'b', 'c'],
                default: 'c'
            }
        }
    });
    var model = new Model({ stuff: 'a' });
    t.doesNotThrow(function () {
        model.unset('stuff');
    });
    t.equal(model.stuff, 'c');
    t.end();
});

test('clear including prop with values array - issue #144', function (t) {
    var Model = State.extend({
        props: {
            stuff: {
                type: 'string',
                required: false,
                values: ['a', 'b', 'c']
            }
        }
    });
    var model = new Model({ stuff: 'a' });
    t.doesNotThrow(function () {
        model.clear();
    });
    t.equal(model.stuff, undefined);
    t.end();
});
