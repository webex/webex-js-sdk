# MachineAccount

Interacts with the deprecated /bots API on the conversation service. _THESE
ARE NOT THE BOTS YOU'RE LOOKING FOR_. This package is only for helping with
tests and should not/cannot be used to create production bots

# create

Creates a machine account

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.contactEmail` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[MachineAccount](#machineaccount)>** 

# delete

deletes a machine account

**Parameters**

-   `bot` **[MachineAccount](#machineaccount)** 

Returns **Promse** 
