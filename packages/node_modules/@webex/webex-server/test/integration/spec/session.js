import path from 'path';

import {assert} from '@webex/test-helper-chai';
import app from '@webex/webex-server';
import request from 'supertest';
import testUsers from '@webex/test-helper-test-users';
import {nodeOnly} from '@webex/test-helper-mocha';

/* eslint-disable camelcase */
function expectSession(res) {
  const {webex} = res.body;

  assert.property(webex.credentials.supertoken, 'token_type');
  assert.property(webex.credentials.supertoken, 'access_token');
  assert.property(webex.credentials.supertoken, 'expires_in');

  assert.property(webex.credentials.supertoken, 'expires');

  assert.property(webex.internal.device, 'url');
  assert.property(webex.internal, 'services');

  return res;
}

nodeOnly(describe)('/api/v1/session', () => {
  describe('PUT', () => {
    it('requires a client_id', () => request(app)
      .put('/api/v1/session')
      .expect(400)
      .expect('clientId is missing'));

    it('requires a client_id', () => request(app)
      .put('/api/v1/session')
      .send({clientId: 'not a real client'})
      .expect(400)
      .expect('clientSecret is missing'));

    it('requires a user with a token', () => request(app)
      .put('/api/v1/session')
      .send({
        clientId: 'not a real client',
        clientSecret: 'not a real secret',
        redirectUri: process.env.WEBEX_REDIRECT_URI,
        scope: process.env.WEBEX_SCOPE,
        user: {}
      })
      .expect(400)
      .expect('user.token is missing'));

    it('authorizes a webex instance with the specified user', () => {
      const agent = request.agent(app);

      return testUsers.create({count: 1})
        .then(([user]) => agent
          .put('/api/v1/session')
          .send({
            clientId: process.env.WEBEX_CLIENT_ID,
            clientSecret: process.env.WEBEX_CLIENT_SECRET,
            redirectUri: process.env.WEBEX_REDIRECT_URI,
            scope: process.env.WEBEX_SCOPE,
            user
          })
          .expect(200)
          .expect(expectSession)
          .then(() => agent
            .get('/api/v1/session')
            .expect(200)
            .expect(expectSession))
          .then(() => agent
            .delete('/api/v1/session')
            .expect(204)));
    });
  });
});

describe('/api/v1/session/invoke*', () => {
  describe('POST', () => {
    it('returns the result of the method at the specified keypath', () => {
      const agent = request.agent(app);

      return testUsers.create({count: 1})
        .then(([user]) => agent
          .put('/api/v1/session')
          .send({
            clientId: process.env.WEBEX_CLIENT_ID,
            clientSecret: process.env.WEBEX_CLIENT_SECRET,
            redirectUri: process.env.WEBEX_REDIRECT_URI,
            scope: process.env.WEBEX_SCOPE,
            user
          })
          .expect(200)
          .expect(expectSession)
          .then(() => agent
            .post('/api/v1/session/invoke/internal/encryption/kms/createUnboundKeys')
            .send([{count: 1}])
            .expect(200)
            .expect((res) => {
              assert.isArray(res.body);
              assert.property(res.body[0], 'uri');
              assert.property(res.body[0], 'jwk');
            }))
          .then(() => agent
            .delete('/api/v1/session')
            .expect(204)));
    });

    it('creates a conversation', () => {
      const agent = request.agent(app);
      let conversation;

      return testUsers.create({count: 3})
        .then(([user, ...users]) => agent
          .put('/api/v1/session')
          .send({
            clientId: process.env.WEBEX_CLIENT_ID,
            clientSecret: process.env.WEBEX_CLIENT_SECRET,
            redirectUri: process.env.WEBEX_REDIRECT_URI,
            scope: process.env.WEBEX_SCOPE,
            user
          })
          .expect(200)
          // Create a conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/create')
            .send([
              {
                comment: 'first message',
                displayName: 'title',
                participants: [
                  user.id,
                  users[0].id,
                  users[1].id
                ]
              }
            ])
            .expect(200)
            .expect((res) => {
              conversation = res.body;
              assert.property(conversation, 'objectType');
              assert.equal(conversation.objectType, 'conversation');
            }))
          // Send a message to the conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/post')
            .send([
              conversation,
              {
                displayName: 'second comment'
              }
            ])
            .expect(200)
            .expect((res) => {
              assert.property(res.body, 'objectType');
              assert.equal(res.body.objectType, 'activity');
            }))
          // Fetch the conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/get')
            .send([
              {url: conversation.url}
            ])
            .expect(200)
            .expect((res) => {
              assert.property(res.body, 'objectType');
              assert.equal(res.body.objectType, 'conversation');
            }))
          .then(() => agent
            .delete('/api/v1/session')
            .expect(204)));
    });

    it('post a file', () => {
      const agent = request.agent(app);
      const filepath = path.join(__dirname, '../../../../', 'test-helper-server/static/sample-image-small-one.png');
      let conversation;

      return testUsers.create({count: 3})
        .then(([user, ...users]) => agent
          .put('/api/v1/session')
          .send({
            clientId: process.env.WEBEX_CLIENT_ID,
            clientSecret: process.env.WEBEX_CLIENT_SECRET,
            redirectUri: process.env.WEBEX_REDIRECT_URI,
            scope: process.env.WEBEX_SCOPE,
            user
          })
          .expect(200)
          // Create a conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/create')
            .send([
              {
                comment: 'first message',
                displayName: 'title',
                participants: [
                  user.id,
                  users[0].id,
                  users[1].id
                ]
              }
            ])
            .expect(200)
            .expect((res) => {
              conversation = res.body;
              assert.property(conversation, 'objectType');
              assert.equal(conversation.objectType, 'conversation');
            }))
          // Send a file to the conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/share')
            .send([
              conversation,
              {
                files: [{
                  path: filepath,
                  displayName: 'sample-image-small-one.png'
                }]
              }
            ])
            .expect(200)
            .expect((res) => {
              assert.property(res.body, 'objectType');
              assert.equal(res.body.objectType, 'activity');
            }))
          // Fetch the conversation
          .then(() => agent
            .post('/api/v1/session/invoke/internal/conversation/get')
            .send([
              {url: conversation.url}
            ])
            .expect(200)
            .expect((res) => {
              assert.property(res.body, 'objectType');
              assert.equal(res.body.objectType, 'conversation');
            }))
          .then(() => agent
            .delete('/api/v1/session')
            .expect(204)));
    });
  });
});
