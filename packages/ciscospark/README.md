# CiscoSpark

**Extends SparkCore**

See [Browser Guide](https://ciscospark.github.io/spark-js-sdk/example/browsers) and
[Server Guide](https://ciscospark.github.io/spark-js-sdk/example/servers)

## init

Create a new ciscospark instance.
Note: ciscospark.init() really only applies to node apps at this time. In web
browsers, you'll want to stick with manipulating the ciscospark instance you
get from `require('ciscospark')`

**Parameters**

-   `attrs` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `attrs.credentials` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** (optional)
    -   `attrs.device` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** (optional)
    -   `attrs.config` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** (optiona)

Returns **[CiscoSpark](#ciscospark)** 

# Page

## items

## length

## constructor

**Parameters**

-   `res` **HttpResponse** 
-   `spark` **ProxySpark** 

Returns **[Page](#page)** 

## next

Get next page

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

## hasNext

Indicates if there's another page

Returns **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

## previous

Get previous page

Returns **[Page](#page)** 

## hasPrevious

Indicates if there is a previous Page

Returns **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

## iterator

Iterator

Returns **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

# Types~Membership

**Properties**

-   `id` **uuid** Unique identifier for the membership
-   `roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The room ID
-   `personId` **uuid** The person ID
-   `personEmail` **email** The email address of the person / room member
-   `isModerator` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Indicates whether the specified person should be a room moderator.
-   `isMonitor` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Indicates whether the specified member is a room monitor.
-   `created` **isoDate** The date and time that this membership was created.

# Memberships

**Extends SparkPlugin**

## create

Adds a person to a room. The person can be added by ID (personId) or by
Email Address (personEmail). The person can be optionally added to the room
as a moderator.

**Parameters**

-   `membership` **[Types~Membership](#typesmembership)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.rooms.create({title: 'Create Membership Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
   });
  })
  .then(function(membership) {
    var assert = require('assert');
    assert(membership.id);
    assert(membership.roomId);
    assert(membership.personId);
    assert(membership.personEmail);
    assert('isModerator' in membership);
    assert('isMonitor' in membership);
    assert(membership.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Membership](#typesmembership)>** 

## get

Returns a single membership.

**Parameters**

-   `membership` **([Types~Membership](#typesmembership) | uuid)** 

**Examples**

```javascript
var ciscospark = require('../..');
var membership;
ciscospark.rooms.create({title: 'Get Membership Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.memberships.get(m.id);
  })
  .then(function(m) {
    var assert = require('assert');
    assert.deepEqual(m, membership);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Membership](#typesmembership)>** 

## list

Returns a list of memberships. In most cases the results will only contain
rooms that the authentiated user is a member of. You can filter the results
by room to list people in a room or by person to find rooms that a
specific person is a member of.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.personId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.personEmail` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.max` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

**Examples**

```javascript
var ciscospark = require('../..');
var room;
ciscospark.rooms.create({title: 'List Membership Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    var assert = require('assert');
    assert.equal(memberships.length, 2);
    for (var i = 0; i < memberships.length; i++) {
      assert.equal(memberships.items[i].roomId, room.id);
    }
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Page](#page)&lt;[Types~Membership](#typesmembership)>>** 

## remove

Deletes a single membership.

**Parameters**

-   `membership` **([Types~Membership](#typesmembership) | uuid)** 

**Examples**

```javascript
var ciscospark = require('../..');
var membership, room;
ciscospark.rooms.create({title: 'Remove Membership Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    var assert = require('assert');
    assert.equal(memberships.length, 2);
    return ciscospark.memberships.remove(membership);
  })
  .then(function() {
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    var assert = require('assert');
    assert.equal(memberships.length, 1);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Used to update a single membership's properties

**Parameters**

-   `membership` **([Types~Membership](#typesmembership) | uuid)** 

**Examples**

```javascript
var ciscospark = require('../..');
var membership, room;
ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    membership = memberships.items[0];
    var assert = require('assert');
    assert.equal(membership.isModerator, false);
    membership.isModerator = true;
    return ciscospark.memberships.update(membership);
  })
  .then(function() {
    return ciscospark.memberships.get(membership.id);
  })
  .then(function(membership) {
    var assert = require('assert');
    assert.equal(membership.isModerator, true);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Membership](#typesmembership)>** 

# Messages

**Extends SparkPlugin**

Messages are how people communicate in rooms. Each message timestamped and
represented in Spark as a distinct block of content. Messages can contain
plain text and a single file attachment. See the
[Attachments Guide](Message) for a list of supported media types.

## create

Post a new message and/or media content into a room.

**Parameters**

-   `message` **[Types~Message](#typesmessage)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.rooms.create({title: 'Create Message Example'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(message) {
    var assert = require('assert');
    assert(message.id);
    assert(message.personId);
    assert(message.personEmail);
    assert(message.roomId);
    assert(message.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Message](#typesmessage)>** 

## get

Returns a single message.

**Parameters**

-   `message` **([Types~Room](#typesroom) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var message;
ciscospark.rooms.create({title: 'Get Message Example'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(m) {
    message = m;
    return ciscospark.messages.get(message.id);
  })
  .then(function(message2) {
    var assert = require('assert');
    assert.deepEqual(message2, message);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Message](#typesmessage)>** 

## list

Returns a list of messages. In most cases the results will only contain
messages posted in rooms that the authentiated user is a member of.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.max` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

**Examples**

```javascript
var ciscospark = require('../..');
var message1, message2, room;
ciscospark.rooms.create({title: 'List Messages Example'})
  .then(function(r) {
    room = r;
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(m) {
    message1 = m;
    return ciscospark.messages.create({
      text: 'How are you?',
      roomId: room.id
    });
  })
  .then(function(m) {
    message2 = m;
    return ciscospark.messages.list({roomId: room.id});
  })
  .then(function(messages) {
    var assert = require('assert');
    assert.equal(messages.length, 2);
    assert.equal(messages.items[0].id, message2.id);
    assert.equal(messages.items[1].id, message1.id);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Page](#page)&lt;[Types~Message](#typesmessage)>>** 

## remove

Deletes a single message. Deleting a message will notify all members of the
room that the authenticated user deleted the message. Generally, users can
only delete their own messages except for the case of Moderated Rooms and
Org Administrators.

**Parameters**

-   `message` **([Types~Message](#typesmessage) | uuid)** 

**Examples**

```javascript
var ciscospark = require('../..');
var message1, room;
ciscospark.rooms.create({title: 'Messages Example'})
  .then(function(r) {
    room = r;
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(m) {
    message1 = m;
    return ciscospark.messages.create({
      text: 'How are you?',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.messages.remove(message1);
  })
  .then(function() {
    return ciscospark.messages.list({roomId: room.id});
  })
  .then(function(messages) {
    var assert = require('assert');
    assert.equal(messages.items.length, 1);
    assert(messages.items[0].id !== message1.id);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** }

# Types~Message

**Properties**

-   `id` **uuid** (server generated) Unique identifier for the message
-   `personId` **uuid** The ID for the author of the messasge
-   `personEmail` **email** The email for the author of the messasge
-   `roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The message posted to the room in plain text
-   `created` **isoDate** (server generated)The source URLs for the
    message attachment. See the {@link Content & Attachments{ Guide for a list of
    supported media types.

# Types~Person

**Properties**

-   `id` **uuid** Unique identifier for the person
-   `emails` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;email>** Email addresses of the person
-   `displayName` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Display name of the person
-   `created` **isoDate** The date and time that the person was created

# People

**Extends SparkPlugin**

## get

Returns a single person by ID

**Parameters**

-   `person` **([Types~Person](#typesperson) | uuid)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.rooms.create({title: 'Get Person Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function(membership) {
    return ciscospark.people.get(membership.personId);
  })
  .then(function(alice) {
    var assert = require('assert');
    assert(alice.id);
    assert(Array.isArray(alice.emails));
    assert.equal(alice.emails.filter(function(email) {
      return email === 'alice@example.com';
    }).length, 1);
    assert(alice.displayName);
    assert(alice.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Person](#typesperson)>** 

## list

Returns a list of people

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.email` **email** Returns people with an email that contains this string
    -   `options.name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Returns people with a name that contains this string

**Examples**

```javascript
var ciscospark = require('../..');
var room;
ciscospark.rooms.create({title: 'List People Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.create({
      personEmail: 'alice@example.com',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.memberships.create({
      personEmail: 'bob@example.com',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.people.list({email: 'alice@example.com'});
  })
  .then(function(people) {
    var assert = require('assert');
    assert.equal(people.length, 1);
    var person = people.items[0];
    assert(person.id);
    assert(Array.isArray(person.emails));
    assert(person.displayName);
    assert(person.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Page](#page)&lt;[Types~Person](#typesperson)>>** 

# Types~Room

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (server generated) Unique identifier for the room
-   `title` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The display name for the room. All room members
    will see the title so make it something good
-   `created` **isoDate** (server generated) The date and time that the
    room was created
-   `teamId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (optional): The id of the team to which the room
    belongs

# Rooms

**Extends SparkPlugin**

Rooms are virtual meeting places for getting stuff done. This resource
represents the room itself. Check out the Memberships API to learn how to add
and remove people from rooms and the Messages API for posting and managing
content.

## create

Creates a new room. The authenticated user is automatically added as a
member of the room. See the @{link Memberships} to learn how to add more
people to the room.
[Membership](Membership)

**Parameters**

-   `room` **[Types~Room](#typesroom)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.rooms.create({title: 'Create Room Example'})
  .then(function(room) {
    var assert = require('assert')
    assert(typeof room.created === 'string');
    assert(typeof room.id === 'string');
    assert(room.title === 'Create Room Example');
    console.log(room.title);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Room](#typesroom)>** 

## get

Returns a single room.

**Parameters**

-   `room` **([Types~Room](#typesroom) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Examples**

```javascript
var ciscospark = require('../..');
var room;
ciscospark.rooms.create({title: 'Get Room Example'})
  .then(function(r) {
    room = r
    return ciscospark.rooms.get(room.id)
  })
  .then(function(r) {
    var assert = require('assert');
    assert.deepEqual(r, room);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Room](#typesroom)>** 

## list

Returns a list of rooms. In most cases the results will only contain rooms
that the authentiated user is a member of.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Limit the maximum number of rooms in the
        response.

**Examples**

```javascript
var ciscospark = require('../..');
var createdRooms;
Promise.all([
  ciscospark.rooms.create({title: 'List Rooms Example 1'}),
  ciscospark.rooms.create({title: 'List Rooms Example 2'}),
  ciscospark.rooms.create({title: 'List Rooms Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.rooms.list({max: 3})
      .then(function(rooms) {
        var assert = require('assert');
        assert(rooms.length === 3);
        for (var i = 0; i < rooms.items.length; i++) {
          assert(createdRooms.filter(function(room) {
            return room.id === rooms.items[i].id;
          }).length === 1);
        }
        return 'success';
      });
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Page](#page)&lt;[Types~Room](#typesroom)>>** 

## remove

Deletes a single room.

**Parameters**

-   `room` **([Types~Room](#typesroom) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var room;
ciscospark.rooms.create({title: 'Remove Room Example'})
 .then(function(r) {
   room = r;
   return ciscospark.rooms.remove(room.id);
 })
 .then(function() {
   return ciscospark.rooms.get(room.id);
 })
 .then(function() {
   var assert = require('assert');
   assert(false, 'the previous get should have failed');
 })
 .catch(function(reason) {
   var assert = require('assert');
   assert.equal(reason.statusCode, 404);
   return 'success'
 });
 // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Used to update a single room's properties.

**Parameters**

-   `room` **[Types~Room](#typesroom)** 

**Examples**

```javascript
var ciscospark = require('../..');
var room;
ciscospark.rooms.create({title: 'Update Room Example'})
  .then(function(r) {
    room = r;
    room.title = 'Update Room Example (Updated Title)';
    return ciscospark.rooms.update(room);
  })
  .then(function() {
    return ciscospark.rooms.get(room.id);
  })
  .then(function(room) {
   var assert = require('assert');
    assert.equal(room.title, 'Update Room Example (Updated Title)');
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Room](#typesroom)>** 

# Types~Team

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (server generated) The unique ID for the team.
-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name of the team.
-   `created` **isoDate** (server generated) The date and time when the
    team was created, in ISO8601 format.

# Teams

**Extends SparkPlugin**

## create

Create a new team.

**Parameters**

-   `team` **[Types~Team](#typesteam)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.teams.create({name: 'Create Team Example'})
  .then(function(team) {
    var assert = require('assert');
    assert(team.id);
    assert(team.name);
    assert(team.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Team](#typesteam)>** 

## get

Returns a single team

**Parameters**

-   `team` **([Types~Team](#typesteam) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Examples**

```javascript
var ciscospark = require('../..');
var team;
ciscospark.teams.create({name: 'Get Team Example'})
  .then(function(r) {
    team = r;
    return ciscospark.teams.get(team.id);
  })
  .then(function(team2) {
    var assert = require('assert');
    assert.equal(team2.id, team.id);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Team](#typesteam)>** 

## list

List teams.

**Parameters**

-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Limit the maximum number of teams in the
        response.

**Examples**

```javascript
var ciscospark = require('../..');
var createdRooms;
Promise.all([
  ciscospark.teams.create({name: 'List Teams Example 1'}),
  ciscospark.teams.create({name: 'List Teams Example 2'}),
  ciscospark.teams.create({name: 'List Teams Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.teams.list({max: 3});
  })
  .then(function(teams) {
    var assert = require('assert');
    assert(teams.length === 3);
    for (var i = 0; i < teams.items.length; i++) {
      assert(createdRooms.filter(function(room) {
        return room.id === teams.items[i].id;
      }).length === 1);
    }
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Page](#page)&lt;[Types~Team](#typesteam)>>** 

## update

Update a team.

**Parameters**

-   `team` **[Types~Team](#typesteam)** 

**Examples**

```javascript
var ciscospark = require('../..');
var teams;
ciscospark.teams.create({name: 'Update Team Example'})
  .then(function(r) {
    teams = r;
    teams.name = 'Teams Example (Updated Title)';
    return ciscospark.teams.update(teams);
  })
  .then(function() {
    return ciscospark.teams.get(teams.id);
  })
  .then(function(teams) {
    var assert = require('assert');
    assert.equal(teams.name, 'Teams Example (Updated Title)');
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~Team](#typesteam)>** 

# Types~TeamMembership

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (server generated) The team ID
-   `personId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The person ID
-   `personEmail` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The email address of the person
-   `isModerator` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Set to `true` to make the person a team
    moderator

# TeamMemberships

**Extends SparkPlugin**

Team Memberships represent a person's relationship to a team. Use this API to
list members of any team that you're in or create memberships to invite
someone to a team. Team memberships can also be updated to make someome a
moderator or deleted to remove them from the team.

Just like in the Spark app, you must be a member of the team in order to list
its memberships or invite people.

## create

Add someone to a team by Person ID or email address; optionally making them
a moderator.

**Parameters**

-   `membership` **[Types~TeamMembership](#typesteammembership)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.teams.create({name: 'Create Team Membership Example'})
  .then(function(team) {
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
   });
  })
  .then(function(membership) {
    var assert = require('assert');
    assert(membership.id);
    assert(membership.teamId);
    assert(membership.personId);
    assert(membership.personEmail);
    assert('isModerator' in membership);
    assert(membership.created);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~TeamMembership](#typesteammembership)>** 

## get

Get details for a membership by ID.

**Parameters**

-   `membership` **([Types~TeamMembership](#typesteammembership) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var membership;
ciscospark.teams.create({name: 'Get Team Memberships Example'})
  .then(function(team) {
    return ciscospark.teamMemberships.create({
      personEmail: 'alice@example.com',
      teamId: team.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.teamMemberships.get(m.id);
  })
  .then(function(m) {
    var assert = require('assert');
    assert.deepEqual(m, membership);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~TeamMembership](#typesteammembership)>** 

## list

Lists all team memberships. By default, lists memberships for teams to
which the authenticated user belongs.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

**Examples**

```javascript
var ciscospark = require('../..');
var team;
ciscospark.teams.create({name: 'List Team Memberships Example'})
  .then(function(t) {
    team = t;
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
    });
  })
  .then(function() {
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    var assert = require('assert');
    assert.equal(teamMemberships.length, 2);
    for (var i = 0; i < teamMemberships.length; i++) {
      assert.equal(teamMemberships.items[i].teamId, team.id);
    }
    return 'success';
  });
  // => success
```

Returns **\[type]** 

## remove

Deletes a membership by ID.

**Parameters**

-   `membership` **([Types~TeamMembership](#typesteammembership) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var membership, team;
ciscospark.teams.create({name: 'Remove Team Memberships Example'})
  .then(function(t) {
    team = t;
    return ciscospark.teamMemberships.create({
     personEmail: 'alice@example.com',
     teamId: team.id
    });
  })
  .then(function(m) {
    membership = m;
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    var assert = require('assert');
    assert.equal(teamMemberships.length, 2);
    return ciscospark.teamMemberships.remove(membership);
  })
  .then(function() {
    return ciscospark.teamMemberships.list({teamId: team.id});
  })
  .then(function(teamMemberships) {
    var assert = require('assert');
    assert.equal(teamMemberships.length, 1);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Updates properties for a membership.

**Parameters**

-   `membership` **[Types~TeamMembership](#typesteammembership)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Types~TeamMembership](#typesteammembership)>** 

# Webhooks

**Extends SparkPlugin**

A webhook notifies an application when an event for which the application is
registered has occurred.

## create

Posts a webhook.

**Parameters**

-   `webhook` **[Types~Webhook](#typeswebhook)** 

**Examples**

```javascript
var ciscospark = require('../..');
ciscospark.rooms.create({title: 'Create Webhook Example'})
  .then(function(room) {
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(webhook) {
    var assert = require('assert');
    assert(webhook.id);
    assert(webhook.resource);
    assert(webhook.event);
    assert(webhook.filter);
    assert(webhook.targetUrl);
    assert(webhook.name);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 

## get

Shows details for a webhook.

**Parameters**

-   `webhook` **(Webhook | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var webhook;
ciscospark.rooms.create({title: 'Get Webhook Example'})
  .then(function(room) {
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(w) {
    webhook = w;
    return ciscospark.webhooks.get(webhook.id);
  })
  .then(function(webhook2) {
    var assert = require('assert');
    assert.deepEqual(webhook2, webhook);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;Webhook>>** 

## list

Lists all webhooks.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **integer** Limit the maximum number of webhooks in the response.

**Examples**

```javascript
var ciscospark = require('../..');
var room, webhook;
ciscospark.rooms.create({title: 'List Webhooks Example'})
  .then(function(r) {
    room = r;
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(w) {
    webhook = w;
    return ciscospark.webhooks.list();
  })
  .then(function(webhooks) {
    var assert = require('assert');
    assert.equal(webhooks.items.filter(function(w) {
      return w.id === webhook.id;
    }).length, 1);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 

## remove

Delete a webhook.

**Parameters**

-   `webhook` **(Webhook | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
var ciscospark = require('../..');
var room, webhook;
ciscospark.rooms.create({title: 'Remove Webhook Example'})
  .then(function(r) {
    room = r;
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(w) {
    webhook = w;
    return ciscospark.webhooks.remove(webhook);
  })
  .then(function() {
    return ciscospark.webhooks.list();
  })
  .then(function(webhooks) {
    var assert = require('assert');
    assert.equal(webhooks.items.filter(function(w) {
      return w.id === webhook.id;
    }).length, 0);
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Update a webhook.

**Parameters**

-   `webhook` **Webhook** 

**Examples**

```javascript
var ciscospark = require('../..');
var webhook;
ciscospark.rooms.create({title: 'Webhook Example'})
  .then(function(room) {
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(w) {
    webhook = w;
    webhook.targetUrl = 'https://example.com/webhook/newtarget';
    return ciscospark.webhooks.update(webhook);
  })
  .then(function() {
    return ciscospark.webhooks.get(webhook);
  })
  .then(function(webhook) {
    var assert = require('assert');
    assert.equal(webhook.targetUrl, 'https://example.com/webhook/newtarget');
    return 'success';
  });
  // => success
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 

# Types~Webhook

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The unique ID for the webhook.
-   `resource` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The resource type for the webhook.
-   `event` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The event type for the webhook.
-   `filter` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The filter that defines the webhook scope.
-   `targetUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The URL that receives POST requests for each event.
-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** A user-friendly name for this webhook.
