---
layout:      guide
title:       "Getting Started"
categories:  guides
description: "Getting Started with the Cisco Webex JS SDK"
redirect_from:
  - /example/getting-started/
---

# Creating your first NodeJS project

In this example, we'll make sure to get dependencies installed and then use environment variables to post a message to a room.

## Dependencies

First, make sure your system has [NodeJS](https://nodejs.org) and [npm](https://www.npmjs.com). We use nvm to install them, but the official downloads from nodejs.org will also work.

> Note: npm is typically bundled with node, but some Linux package managers may require you to install npm explicitly.

Once you've got the dependencies in place, create a new node project.

## Creating the Project Directory

```bash
cd /my/project/directory
npm init
```

You'll be prompted to answer a few simple questions, but typically the defaults are just fine.

## Installation

Now, install `ciscospark`.

```bash
npm install --save ciscospark
```

## Basic usage

So, you want to send a message. First, you need an access token. For demonstration purposes, we'll use environment variables to authorize the SDK. You can get an access token from the [Cisco Webex Developer Portal](https://developer.webex.com/).

Create a new file in your project directory named `index.js` and add the following to it:

```javascript
var spark = require('ciscospark/env');
spark.rooms.create({
  title: `My First Room!`
})
  // Make sure to log errors in case something goes wrong.
  .catch(function(reason) {
    console.error(reason);
    process.exit(1);
  });
```

Now, open the [Cisco Webex Teams Client](https://web.ciscospark.com) so you see your code in action. Then, back in your terminal, run the following command.

```bash
CISCOSPARK_ACCESS_TOKEN=<YOUR TOKEN FROM THE PORTAL> node index.js
```

Check out the web client. You should see your new room. Now, let's send a message to it.

Open up index.js again and replace its contents with the following code:

```javascript
var spark = require('ciscospark');
spark.rooms.list({
  max: 10
})
  .then(function(rooms) {
    var room = rooms.items.filter(function(room) {
      return room.title === 'My First Room!';
    })[0];

    return spark.messages.create({
      text: 'Hello World!',
      roomId: room.id
    });
  })
  // Make sure to log errors in case something goes wrong.
  .catch(function(reason) {
    console.error(reason);
    process.exit(1);
  });
```

Run it again with the following:

```bash
CISCOSPARK_ACCESS_TOKEN=<YOUR TOKEN FROM THE PORTAL> node index.js
```

And checkout the web client. Congrats! You've sent your first message!
