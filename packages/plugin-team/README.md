# addConversation

Move an existing group conversation into a team.

**Parameters**

-   `team` **TeamObject** 
-   `conversation` **ConversationObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the add activity

# addMember

Add a member to a team

**Parameters**

-   `team` **TeamObject** 
-   `participant` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with activity that was posted

# archive

Archive a team or team conversation.

**Parameters**

-   `target` **(TeamObject | ConversationObject)** team or team conversation that should be archived
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the posted activity

# create

Create a team

**Parameters**

-   `params` **NewTeamObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created team

# createConversation

Create a conversation within a team. Currently does not support
activities besides add (ie no post or share activities).

**Parameters**

-   `team` **TeamObject** 
-   `params` **NewConversationObject** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.includeAllTeamMembers` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the newly created conversation

# get

Retrieve a single team

**Parameters**

-   `team` **([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) | Team~TeamObject)** 
    -   `team.id` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.includeTeamConversations` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
    -   `options.includeTeamMembers` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the requested team

# listConversations

Get the list of conversations for a particular team

**Parameters**

-   `team` **TeamObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with an array of conversations

# joinConversation

Join a team conversation

**Parameters**

-   `team` **TeamObject** 
-   `conversation` **ConversationObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# list

Retrieve all teams

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.includeTeamConversations` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
    -   `options.includeTeamMembers` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the requested teams

# removeMember

Remove a member from a team

**Parameters**

-   `team` **TeamObject** 
-   `participant` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `activty` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `activity`  

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with activity that was posted

# removeConversation

Remove a team conversation from a team.

**Parameters**

-   `team` **TeamObject** 
-   `conversation` **ConversationObject** to be removed

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the leave activity

# update

Update the displayName, summary, or teamColor field for a team.

**Parameters**

-   `team` **TeamObject** with updated displayName, summary, or teamColor

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with posted activity

# forEach

Assign or unassign a team member to be a moderator of a team

**Parameters**

-   `team` **TeamObject** 
-   `participant` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `activity` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with activity that was posted
