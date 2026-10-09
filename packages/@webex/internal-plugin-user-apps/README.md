# @webex/internal-plugin-user-apps

Internal Webex SDK access to Raindrop user applications. The initial supported consumer is Webex space-list sections.

Importing the plugin is inert. Consumers must call `webex.internal.userApps.register()` to attach scoped Mercury listeners and synchronize section state, and `unregister()` when the feature is disabled or the consumer is torn down.
