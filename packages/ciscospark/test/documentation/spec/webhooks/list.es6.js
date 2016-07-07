import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`lists webhooks`, () => {
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
  const webhooks = Array.from(await ciscospark.webhooks.list());
  assert.equal(webhooks.filter((w) => {
    return w.id === webhook.id;
  }).length, 1);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
