import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`removes a webhook`, () => {
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
  await ciscospark.webhooks.remove(webhook);
  const webhooks = Array.from(await ciscospark.webhooks.list());
  assert.equal(webhooks.filter((w) => w.id === webhook.id).length, 0);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
