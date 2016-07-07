import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`creates a webhook`, () => {
/* END_EXAMPLE_IGNORE */
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
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
