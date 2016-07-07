# CiscoSpark

**Extends SparkCore**

SDK for Cisco Spark

## Installation

```javascript
npm install --save ciscospark
```

## A Note on Browsers

Ciscospark is fully browser compatible but we don't distribute a browserified
bundle at this time; you'll need to build the bundle yourself. We use
[browserify](http://browserify.org/) internally and
[webpack](https://webpack.github.io/) should work as well.

## Getting Started

> The examples below have both ES5 and ES6 variations. The ES6 examples will
> require you to build your project using [babel](https://babeljs.io). The
> ES5 examples should be directly runnable.

The quickest way to get started is to set your access token as an environment
variable:

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

assert(process.env.CISCOSPARK_ACCESS_TOKEN);
(async function() {
 try {
   let room = await ciscospark.rooms.create({title: 'My First Room'});
   let message = await ciscospark.messages.create({
     text: 'Howdy!',
     roomId: room.id
   });
 }
 catch(error) {
   console.error(error.stack);
   process.exit(1);
 }
}());


```

```javascript
var assert = require('assert');
var ciscospark = require('ciscospark/dist');

assert(process.env.CISCOSPARK_ACCESS_TOKEN);
return ciscospark.rooms.create({title: 'My First Room'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .catch(function(reason) {
    console.error(reason);
    process.exit(1);
  });


```

### Refresh Tokens

For long-running use cases, you'll need to provide a refresh token, client
id, and client secret:

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

assert(process.env.CISCOSPARK_ACCESS_TOKEN);
assert(process.env.CISCOSPARK_REFRESH_TOKEN);
assert(process.env.CISCOSPARK_CLIENT_ID);
assert(process.env.CISCOSPARK_CLIENT_SECRET);
(async function run() {
  try {
    let room = await ciscospark.rooms.create({title: 'My First Room'});
    let message = await ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  }
  catch(error) {
    console.error(error.stack);
    process.exit(1);
  }
}());


```

## Runtime Configuration

While environment variables are handy for development, they don't really help
you write an app for lots of users. You can pass credentials to the spark
using init.

```javascript
import ciscospark from 'ciscospark/es6';
import {getAcessTokenFromSomewhereElse} from '../../../lib/my-auth-module';


(async function run() {
  try {
    const ciscospark2 = ciscospark.init({
      credentials: {
        access_token: getAcessTokenFromSomewhereElse()
      }
    });
    const room = await ciscospark2.rooms.create({title: `My First Room`});
    await ciscospark.messages.create({
      text: `Howdy!`,
      roomId: room.id
    });
  }
  catch(error) {
    console.error(error.stack);
    process.exit(1);
  }
}());


```

## OAuth

OAuth is baked right into spark so you don't need to figure it out.

To kick off an OAuth login, simply call `spark.authenticate()` which will
direct the current app to our login page.

```javascript
import ciscospark from 'ciscospark/es6';

spark.authenticate();


```

To refresh an access token, call `spark.authorize()`. (Note: this should
generally happen for you automatically).

```javascript
import ciscospark from 'ciscospark/es6';

spark.authorize();


```

## init

While environment variables are handy for development, they don't really help
you write an app for lots of users. You can pass credentials to the spark
using init.

**Parameters**

-   `attrs` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `attrs.credentials` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **CiscoSpark** 

# Page

## items

## length

## constructor

**Parameters**

-   `res` **HttpResponse** 
-   `spark` **ProxySpark** 

Returns **Page** 

## next

Get next page

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

## hasNext

Indicates if there's another page

Returns **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

## previous

Get previous page

Returns **Page** 

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

-   `membership` **Types~Membership** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const membership = await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
  });
  assert(membership.id);
  assert(membership.roomId);
  assert(membership.personId);
  assert(membership.personEmail);
  assert(`isModerator` in membership);
  assert(`isMonitor` in membership);
  assert(membership.created);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(room) {
    return ciscospark.memberships.create({
     personEmail: 'alice@example.com',
     roomId: room.id
   });
  })
  .then(function(membership) {
    assert(membership.id);
    assert(membership.roomId);
    assert(membership.personId);
    assert(membership.personEmail);
    assert('isModerator' in membership);
    assert('isMonitor' in membership);
    assert(membership.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Membership>** 

## get

Returns a single membership.

**Parameters**

-   `membership` **(Types~Membership | uuid)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
 const room = await ciscospark.rooms.create({title: `Memberships Example`});
 const membership = await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
 });
 const membership2 = await ciscospark.memberships.get(membership.id);
 assert.deepEqual(membership2, membership);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var membership;
return ciscospark.rooms.create({title: 'Memberships Example'})
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
    assert.deepEqual(m, membership);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Membership>** 

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
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
  });
  const memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 2);
  for (const membership of memberships) {
    assert.equal(membership.roomId, room.id);
  }
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room;
return ciscospark.rooms.create({title: 'Memberships Example'})
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
    assert.equal(memberships.length, 2);
    for (var i = 0; i < memberships.length; i++) {
      assert.equal(memberships.items[i].roomId, room.id);
    }
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Page&lt;Types~Membership>>** 

## remove

Deletes a single membership.

**Parameters**

-   `membership` **(Types~Membership | uuid)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const membership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  let memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 2);
  await ciscospark.memberships.remove(membership);
  memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 1);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var membership, room;
return ciscospark.rooms.create({title: 'Memberships Example'})
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
    assert.equal(memberships.length, 2);
    return ciscospark.memberships.remove(membership);
  })
  .then(function() {
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    assert.equal(memberships.length, 1);
  });



```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Used to update a single membership's properties

**Parameters**

-   `membership` **(Types~Membership | uuid)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const memberships = await ciscospark.memberships.list({roomId: room.id});
  let membership = memberships.items[0];
  assert.equal(membership.isModerator, false);
  membership.isModerator = true;
  await ciscospark.memberships.update(membership);
  membership = await ciscospark.memberships.get(membership.id);
  assert.equal(membership.isModerator, true);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var membership, room;
return ciscospark.rooms.create({title: 'Memberships Example'})
  .then(function(r) {
    room = r;
    return ciscospark.memberships.list({roomId: room.id});
  })
  .then(function(memberships) {
    membership = memberships.items[0];
    assert.equal(membership.isModerator, false);
    membership.isModerator = true;
    return ciscospark.memberships.update(membership);
  })
  .then(function() {
    return ciscospark.memberships.get(membership.id);
  })
  .then(function(membership) {
    assert.equal(membership.isModerator, true);
  });



```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Membership>** 

# Types~Message

**Properties**

-   `id` **uuid** (server generated) Unique identifier for the message
-   `personId` **uuid** The ID for the author of the messasge
-   `personEmail` **email** The email for the author of the messasge
-   `roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The message posted to the room in plain text
-   `created` **isoDate** (server generated)The source URLs for the
    message attachment. See the {@link Content & Attachments{ Guide for a list of
    supported media types.

# Messages

**Extends SparkPlugin**

Messages are how people communicate in rooms. Each message timestamped and
represented in Spark as a distinct block of content. Messages can contain
plain text and a single file attachment. See the
[Attachments Guide](Message) for a list of supported media types.

## create

Post a new message and/or media content into a room.

**Parameters**

-   `message` **Types~Message** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  let room = await ciscospark.rooms.create({title: `Messages Example`});
  let message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  assert(message.id);
  assert(message.personId);
  assert(message.personEmail);
  assert(message.roomId);
  assert(message.created);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.rooms.create({title: 'Messages Example'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(message) {
    assert(message.id);
    assert(message.personId);
    assert(message.personEmail);
    assert(message.roomId);
    assert(message.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Message>** 

## get

Returns a single message.

**Parameters**

-   `message` **(Types~Room | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  const message2 = await ciscospark.messages.get(message.id);
  assert.deepEqual(message2, message);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var message;
return ciscospark.rooms.create({title: 'Messages Example'})
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
    assert.deepEqual(message2, message);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Message>** 

## list

Returns a list of messages. In most cases the results will only contain
messages posted in rooms that the authentiated user is a member of.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.roomId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.max` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message1 = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  const message2 = await ciscospark.messages.create({
    text: `How are you?`,
    roomId: room.id
  });

  const messages = Array.from(await ciscospark.messages.list({roomId: room.id}));
  assert.equal(messages.length, 2);
  assert.equal(messages[0].id, message2.id);
  assert.equal(messages[1].id, message1.id);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var message1, message2, room;
return ciscospark.rooms.create({title: 'Messages Example'})
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
    assert.equal(messages.length, 2);
    assert.equal(messages.items[0].id, message2.id);
    assert.equal(messages.items[1].id, message1.id);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Page&lt;Types~Message>>** 

## remove

Deletes a single message. Deleting a message will notify all members of the
room that the authenticated user deleted the message. Generally, users can
only delete their own messages except for the case of Moderated Rooms and
Org Administrators.

**Parameters**

-   `message` **(Types~Message | uuid)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  await ciscospark.messages.create({
    text: `How are you?`,
    roomId: room.id
  });
  await ciscospark.messages.remove(message);
  const messages = await ciscospark.messages.list({roomId: room.id});
  assert.equal(messages.length, 1);
  assert(messages.items[0].id !== message.id);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var message1, room;
return ciscospark.rooms.create({title: 'Messages Example'})
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
    assert.equal(messages.items.length, 1);
    assert(messages.items[0].id !== message1.id);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** }

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

-   `person` **(Types~Person | uuid)** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `People Example`});
  const membership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  const alice = await ciscospark.people.get(membership.personId);
  assert(alice.id);
  assert(Array.isArray(alice.emails));
  assert(alice.emails.includes(`alice@example.com`));
  assert(alice.displayName);
  assert(alice.created);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.rooms.create({title: 'People Example'})
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
    assert(alice.id);
    assert(Array.isArray(alice.emails));
    assert.equal(alice.emails.filter(function(email) {
      return email === 'alice@example.com';
    }).length, 1);
    assert(alice.displayName);
    assert(alice.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Person>** 

## list

Returns a list of people

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.email` **email** Returns people with an email that contains this string
    -   `options.name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Returns people with a name that contains this string

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `People Example`});
  const aliceMembership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  const bobMembership = await ciscospark.memberships.create({
    personEmail: `bob@example.com`,
    roomId: room.id
  });

  let people = await ciscospark.people.list({email: `alice@example.com`});
  assert.equal(people.length, 1);
  for (const person of people) {
    if (person.emails.includes(`alice@example.com`)) {
      assert(person.id);
      assert(Array.isArray(person.emails));
      assert(person.displayName);
      assert(person.created);
    }
  }
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room;
return ciscospark.rooms.create({title: 'People Example'})
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
    assert.equal(people.length, 1);
    var person = people.items[0];
    assert(person.id);
    assert(Array.isArray(person.emails));
    assert(person.displayName);
    assert(person.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Page&lt;Types~Person>>** 

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

-   `room` **Types~Room** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Rooms Example`});
  assert(room.id);
  assert(room.title);
  assert(room.created);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(room) {
    assert(room.id);
    assert(room.title);
    assert(room.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Room>** 

## get

Returns a single room.

**Parameters**

-   `room` **(Types~Room | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.includeSipAddress` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** To show the SIP address for the
        room in the response, set this value to `true`. A session initiation
        protocol (SIP) address is a URI that addresses a specific telephone
        extension on a voice over IP (VOIP) system.

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  let room2 = await ciscospark.rooms.get(room.id);
  assert.equal(room2.id, room.id);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    return ciscospark.rooms.get(room.id);
  })
  .then(function(room2) {
    assert.equal(room2.id, room.id);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Room>** 

## list

Returns a list of rooms. In most cases the results will only contain rooms
that the authentiated user is a member of.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Limit the maximum number of rooms in the
        response.
    -   `options.includeSipAddress` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** To show the SIP address for the
        room in the response, set this value to `true`. A session initiation
        protocol (SIP) address is a URI that addresses a specific telephone
        extension on a voice over IP (VOIP) system.

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const createdRooms = await Promise.all([
    await ciscospark.rooms.create({title: `Rooms Example 1`}),
    await ciscospark.rooms.create({title: `Rooms Example 2`}),
    await ciscospark.rooms.create({title: `Rooms Example 3`})
  ]);

  const rooms = await ciscospark.rooms.list({max: 3});
  assert(rooms.length === 3);
  for (const room of rooms) {
    assert(createdRooms.find((r) => r.id === room.id));
  }
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var createdRooms;
return Promise.all([
  ciscospark.rooms.create({title: 'Rooms Example 1'}),
  ciscospark.rooms.create({title: 'Rooms Example 2'}),
  ciscospark.rooms.create({title: 'Rooms Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.rooms.list({max: 3});
  })
  .then(function(rooms) {
    assert(rooms.length === 3);
    for (var i = 0; i < rooms.items.length; i++) {
      /* eslint no-loop-func: [0] */
      assert(createdRooms.filter(function(room) {
        return room.id === rooms.items[i].id;
      }).length === 1);
    }
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Page&lt;Types~Room>>** 

## remove

Deletes a single room.

**Parameters**

-   `room` **(Types~Room | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  await ciscospark.rooms.remove(room.id);
  try {
    room = await ciscospark.rooms.get(room.id);
    assert(false, `the previous line should have failed`);
  }
  catch(reason) {
    assert.equal(reason.statusCode, 404);
  }
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    return ciscospark.rooms.remove(room.id);
  })
  .then(function() {
    return ciscospark.rooms.get(room.id);
  })
  .then(function() {
    assert(false, 'the previous get should have failed');
  })
  .catch(function(reason) {
    assert.equal(reason.statusCode, 404);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Used to update a single room's properties.

**Parameters**

-   `room` **Types~Room** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  room.title = `Rooms Example (Updated Title)`;
  await ciscospark.rooms.update(room);
  room = await ciscospark.rooms.get(room.id);
  assert.equal(room.title, `Rooms Example (Updated Title)`);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room;
return ciscospark.rooms.create({title: 'Rooms Example'})
  .then(function(r) {
    room = r;
    room.title = 'Rooms Example (Updated Title)';
    return ciscospark.rooms.update(room);
  })
  .then(function() {
    return ciscospark.rooms.get(room.id);
  })
  .then(function(room) {
    assert.equal(room.title, 'Rooms Example (Updated Title)');
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Room>** 

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

-   `team` **Types~Team** 

**Examples**

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(team) {
    assert(team.id);
    assert(team.name);
    assert(team.created);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Team>** 

## get

Returns a single team

**Parameters**

-   `team` **(Types~Team | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 
-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

**Examples**

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var team;
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(r) {
    team = r;
    return ciscospark.teams.get(team.id);
  })
  .then(function(team2) {
    assert.equal(team2.id, team.id);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Team>** 

## list

List teams.

**Parameters**

-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Limit the maximum number of teams in the
        response.

**Examples**

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var createdRooms;
return Promise.all([
  ciscospark.teams.create({name: 'Teams Example 1'}),
  ciscospark.teams.create({name: 'Teams Example 2'}),
  ciscospark.teams.create({name: 'Teams Example 3'})
])
  .then(function(r) {
    createdRooms = r;
    return ciscospark.teams.list({max: 3});
  })
  .then(function(teams) {
    assert(teams.length === 3);
    for (var i = 0; i < teams.items.length; i++) {
      /* eslint no-loop-func: [0] */
      assert(createdRooms.filter(function(room) {
        return room.id === teams.items[i].id;
      }).length === 1);
    }
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Page&lt;Types~Team>>** 

## update

Update a team.

**Parameters**

-   `team` **Types~Team** 

**Examples**

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var teams;
return ciscospark.teams.create({name: 'Teams Example'})
  .then(function(r) {
    teams = r;
    teams.name = 'Teams Example (Updated Title)';
    return ciscospark.teams.update(teams);
  })
  .then(function() {
    return ciscospark.teams.get(teams.id);
  })
  .then(function(teams) {
    assert.equal(teams.name, 'Teams Example (Updated Title)');
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Team>** 

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

-   `membership` **Types~TeamMembership** 

**Examples**

```javascript

```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~TeamMembership>** 

## get

Get details for a membership by ID.

**Parameters**

-   `membership` **(Types~TeamMembership | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript

```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~TeamMembership>** 

## list

Lists all team memberships. By default, lists memberships for teams to
which the authenticated user belongs.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

**Examples**

```javascript

```

Returns **\[type]** 

## remove

Deletes a membership by ID.

**Parameters**

-   `membership` **(Types~TeamMembership | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript

```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Updates properties for a membership.

**Parameters**

-   `membership` **Types~TeamMembership** 

**Examples**

```javascript

```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~TeamMembership>** 

# Types~TeamMembership

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (server generated) The team ID
-   `personId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The person ID
-   `personEmail` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The email address of the person
-   `isModerator` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** Set to `true` to make the person a team
    moderator

# Types~Webhook

**Properties**

-   `id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The unique ID for the webhook.
-   `resource` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The resource type for the webhook.
-   `event` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The event type for the webhook.
-   `filter` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The filter that defines the webhook scope.
-   `targetUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The URL that receives POST requests for each event.
-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** A user-friendly name for this webhook.

# Webhooks

**Extends SparkPlugin**

A webhook notifies an application when an event for which the application is
registered has occurred.

## create

Posts a webhook.

**Parameters**

-   `webhook` **Types~Webhook** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  const webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  assert(webhook.id);
  assert(webhook.resource);
  assert(webhook.event);
  assert(webhook.filter);
  assert(webhook.targetUrl);
  assert(webhook.name);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

return ciscospark.rooms.create({title: 'Webhook Example'})
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
    assert(webhook.id);
    assert(webhook.resource);
    assert(webhook.event);
    assert(webhook.filter);
    assert(webhook.targetUrl);
    assert(webhook.name);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 

## get

Shows details for a webhook.

**Parameters**

-   `webhook` **(Webhook | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  const webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  const webhook2 = await ciscospark.webhooks.get(webhook.id);
  assert.deepEqual(webhook2, webhook);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
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
    assert.deepEqual(webhook2, webhook);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;Webhook>>** 

## list

Lists all webhooks.

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.max` **integer** Limit the maximum number of webhooks in the response.

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  const webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  const webhooks = Array.from(await ciscospark.webhooks.list());
  assert.equal(webhooks.filter((w) => {
    return w.id === webhook.id;
  }).length, 1);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room, webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
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
    assert.equal(webhooks.items.filter(function(w) {
      return w.id === webhook.id;
    }).length, 1);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 

## remove

Delete a webhook.

**Parameters**

-   `webhook` **(Webhook | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  const webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  await ciscospark.webhooks.remove(webhook);
  const webhooks = Array.from(await ciscospark.webhooks.list());
  assert.equal(webhooks.filter((w) => w.id === webhook.id).length, 0);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var room, webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
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
    assert.equal(webhooks.items.filter(function(w) {
      return w.id === webhook.id;
    }).length, 0);
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## update

Update a webhook.

**Parameters**

-   `webhook` **Webhook** 

**Examples**

```javascript
import assert from 'assert';
import ciscospark from 'ciscospark/es6';

return (async function() {
  const room = await ciscospark.rooms.create({title: `Webhook Example`});
  let webhook = await ciscospark.webhooks.create({
    resource: `messages`,
    event: `created`,
    filter: `roomId=${room.id}`,
    targetUrl: `https://example.com/webhook`,
    name: `Test Webhook`
  });
  webhook.targetUrl = `https://example.com/webhook/newtarget`;
  await ciscospark.webhooks.update(webhook);
  webhook = await ciscospark.webhooks.get(webhook);
  assert.equal(webhook.targetUrl, `https://example.com/webhook/newtarget`);
}());


```

```javascript
'use strict';

var assert = require('assert');
var ciscospark = require('ciscospark');

var webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
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
    assert.equal(webhook.targetUrl, 'https://example.com/webhook/newtarget');
  });


```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Webhook>** 
