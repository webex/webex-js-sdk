# Activity Threading Ordering

Activity thread ordering (or "threading") is the act of flattening the hierarchical relationship of thread parents and thread replies.

## Why Thread Order?
When a client fetches activities from conversation service, convo returns chronologically ordered activities (by published date). If you are a client that attempts to display activities to a user, this is mostly useless. An example:

Client: hey convo, give me 10 activities

Convo: here.
  1. reaction
  2. root
  3. reaction
  4. reply
  5. edit
  6. edit
  7. reply
  8. reaction
  9. meeting
  10. reply
  
Client: ...

Convo: ...

By contrast, thread ordering returns activities in _thread order_, otherwise known as _useful order_. An example:

Client: hey convo, give me 10 activities in thread order

Convo: here.
  1. root 4
  2. reply to root 4
  3. reply to root 4
  4. root 3
  5. reply to root 3
  6. reply to root 3
  7. root 2
  8. reply to root 2
  9. reply to root 2
  10. root 1 (newest root activity)
  
Client: 👍

Convo: 👍

As you can see, thread ordering is useful, and as you may _not_ see, it is difficult to implement. The fewer clients that are forced to implement thread ordering themselves, the better for the wellbeing of the entire world.

<!-- ## Useful terminology

* thread parent, parent - an activity that has replies
* root activity, root - an activity that is or could be a thread parent
* child activity, child - an activity that points to a parent activity, but not necessarily a root
* thread reply, thread - an activity that is a reply to a root activity
* orphan - a child activity whose parent has not been fetched
-->

# The Code

Thread ordering methods live in the internal converation plugin
```
webex.internal.conversation[*]
```

There are two methods that compose thread ordering, a public and private method. The public method is simply a facade of the private method, abstracting the complex away from the caller.

### `_listActivitiesThreadOrdered(options)` (private)
The `_listActivitiesThreadOrdered` method is a stateful async generator function that fetches thread ordered activities.

#### Description
The `_listActivitiesThreadOrdered` method instantiates a generator function that yields a promise. It yields results in an infinite loop for the life of the generator (until the instance is no longer referenced and JS garbage collects). This means when the method yields a result it pauses execution until its next invocation, freezing its current state to be used by the next invocation. The generator instance internally tracks the oldest and newest activities it has fetched, using them as the timestamps to query the next set of results in either direction, thus the caller is not required to maintain any state to fetch older and newer activities. This method does not cache all fetched activities, therefore the caller is still required to store their fetched activities or be forced to refetch them. 

The generator's returned `next` method accepts arguments as well, which allows the caller to change the direction of their querying from newer messages to older ones without creating a new generator instance. `next`

#### Parameters
_generator initialization options_

options

  options.url: the conversation's convo URL

  options.minActivities: the minimum number of activities you would like in your batch

  options.queryType: the direction to fetch activities. One of 'newer', 'older', 'mid'

  options.search: a server activity object to return as the middle point of the batch, along with its surrounding activities

_parameters accepted by the generator's `next` method_

options

  options.queryType: see above

  options.search: see above


#### Return value
Calling `_listActivitiesThreadOrdered` returns the generator instance, and does not execute any work. The generator returned has a `next` method that begins the first round of work and returns a `done` boolean and a `value`, the asked-for thread ordered activities.

```
interface IActivity {
  id: string;
  activity: <server Activity>;
  reaction: <server ReactionSummary>
  reactionSelf: <server ReactionSelfSummary>
}

done: boolean,
value: IActivity[]
```

#### Examples
```
const options = {
  url: 'myconvourl.com',
  minActivities: 20,
  queryType: 'older',
  search: null
}
const threadOrderedFetcher = webex.internal.conversation._listActivitiesThreadOrdered(options);
await threadOrderedFetcher.next() // => { done: boolean, value: IActivity[] }
```

#### The nitty gritty: design

There are 3 main phases of the method, with one major subphase:
1. initialization: up to the ` while (true)` loop
2. execution: the ` while (true)` loop
3. (subphase of execution) fetching: the ` while (!getNoMoreActs())` loop
4. re-calculation: after the ` yield`

##### initialization
Parsing the arguments and initializing state is done in this first phase, before the generator's first execution. State that must be retained independent of each execution loop (the code run by the generator's `next` method) is instantiated here. The following variables (or grouped of variables) are created and maintained for the life of the generator:

* oldestAct - the oldest activity (by published date) that has been fetched by the gen. instance
* newestAct - the newest activity that has been fetched by the gen. instance
* batchSize - the number of activities to fetch to achieve minActivities. This value is set lower in cases where we fetch children, because adding the children to their parents may help us reach minActivities count
* query - initialize fetching query. The first query will be forced to fetch newest activities in a space to initialize the activity states, unless a search is requested
* ***ActivityHash(es): cache objects for children activities. These caches store all child activity types returned from convo fetches in order to keep track of "orphans", or child activities that come in before their parent activity

##### execution
The execution phase will be run for every call to `next` method. Its job is to fetch activities until the minimum activity limit is reached, then it will build the ordered list of activities and yield them to the caller. Similar to init phase, execution phase has variables declared outside the fetching loop in order to keep track of what we have fetched so far, and whether continuing to fetch is necessary. The execuction phase runs the fetching subphase. The following state variables are tracked by this outer loop, before the fetching phase:

* rootActivityHash - the data structure used to track root activities we have fetched in a given batch
* [* helpers] - many helper functions are declared. They close over state variables and are used to group functionality used by the fetching loop, and for self-documenting purposes
* fetchLoopCount - track count of fetch loops run. Used to break out of loop in unlikely case that we fetch the same query over and over.

##### fetching
The fetching phase is contained within the execution phase, and is a loop that will run until we run out of activities to fetch, or explicitly break the loop when we reach the minActivities count with what we've fetched so far. Each fetch loop begins by setting up the query and passing options to `#listActivities` method. All query types depend on a first query to activities to get N root activities. midDate queries (aliased MID) and sinceDate queries (aliased NEWER) also must recursively fetch children to ensure we don't return to caller a root activity that is missing children.*

*NOTE: These sometimes-necessary children queries depend on the addition of a new method, `#listAllChildActivitiesByParentId`. This method is similar to `listChildActivitiesByParentId`, but this method recursively fetches all the chilren of a certain type, rather than forcing the calling method to fetch 10 children at a time (as is the current child limit set by underlying convo API).

Activities returned to us by convo fetches are sorted and placed into maps based off their activity type. Root activities are stored on a per-batch basis, whereas children are stored globally (prevents orphans). Root activities are keyed by their ID, where children are keyed by their parent's ID (`activity.parent.id`).

When reactions are fetched, however, we call a _different_ convo API that helps us reduce server roundtrips (this is why the fetch for reactions is different from the fetch for edits and replies).

Fetching loop can be explicitly broken out of when we have decided we have the necessary activities for the current batch. If we _don't_ have enough activities, we initialize a new query derived from the former query and return to the top of the fetching loop to continue building our list.

##### execution (revisited)
After a successful series of fetches have given us the activities necessary for the current batch, we initialize an empty array that acts as our ordered list. To begin, the current batch's root activities are sorted by their published date, and using the ordered list of IDs, we begin to loop over the rootActivityHash. 

For every root activity, the ID of the root is used to check all the child hashes (keyed by _parent ID_, recall), and implement IActivity. When a root activity has replies, a similar process is undergone for the reply activity: sorting it by published date, checking its ID against the edits and reactions hash, and sanitizing to implement IActivity. Replies are then looped over and added to the ordered list before moving on to the next root.

We have successfully finished a batch, and will now yield the ordered list to the caller.

##### recalculation
The generator's `next` method may accepts arguments in order to alter the behavior of the existing generator. Assigning `yield` to a variable captures the arguments passed into `next` method. The `next` method accepts a new value for minActivities, as well as an override for `queryType`. This allows the same generator (and its state) to be used for multiple queries that build one upon another.

The first call to `next` (the first call) is initialized automatically as an INITIAL fetch, to populate the generator state, but subsequent calls to `next` method without a passed-in `queryType` will close the generator.

### `listActivitiesThreadOrdered(options)` (public)
The public facade exposes wrappers for ease of managing an instance of the generator. All methods implement the iterator protocol The following methods are exposed:

#### `getOlder()`
Implements iterator protocol. Returns oldest activities, then returns any older activities than the oldest fetched.

example:
```
const myGen = webex.internal.conversation.listActivitiesThreadOrdered(opts);
const firstBatch = await myGen.getOlder();
console.log(firstBatch)
/*
{
  done: false,
  value: IActivity[] // the most recent activities from the given conversation
}
*/
const secondBatch = await myGen.getOlder();
console.log(secondBatch)
/*
{
  done: boolean (true if we reach beginning of convo, else false),
  value: IActivity[] // activities older than firstBatch[0]
}
*/
```

#### jumpToActivity(searchActivity)
Implements iterator protocol. Returns searched activity as the middle activity in a batch, with older and newer activities surrounding. 

example: 
```
const activitySearchResult = IServerActivity // actual activity object returned by server, most commonly returned by activity search
const myGen = webex.internal.conversation.listActivitiesThreadOrdered(opts);
const results = await myGen.jumpToActivity(activitySearchResult);
console.log(results)
/*
{
  done: true,
  value: [...IActivity[], IActivity<activitySearchResult>, ...IActivity[]]
}
*/
```
#### `getNewer()` 
Implements iterator protocol. Returns most recent activities, then returns any newer activities than the newest fetched.

example:
```
const myGen = webex.internal.conversation.listActivitiesThreadOrdered(opts);
const firstBatch = await myGen.getNewer();
console.log(firstBatch)
/*
{
   done: false,
   value: IActivity[] // the most recent activities from the given conversation
}
*/
// NOTE: assume second batch is fetched before any new activities are created in the conversation
const secondBatch = await myGen.getNewer();
console.log(secondBatch)
/*
{
  done: true,
  value: []
}
*/
```
`getNewer()` is of limited use at first, but consider the following example, when used in conjunction with `jumpToActivity`:
```
const activitySearchResult = IServerActivity // actual activity object returned by server, most commonly returned by activity search
const myGen = webex.internal.conversation.listActivitiesThreadOrdered(opts);
const firstBatch = await myGen.jumpToActivity(activitySearchResult);
console.log(firstBatch)
/*
{
  done: true,
  value: [...IActivity[], IActivity<activitySearchResult>, ...IActivity[]]
}
*/

const secondBatch = await myGen.getNewer();
console.log(secondBatch);
/*
{
  done: false,
  value: IActivity[] // where secondBatch[0] is the next activity after the last of firstBatch
}
*/
```





