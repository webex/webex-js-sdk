import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import type {ClientEvent, PrivacyAndSecurityPermission} from '../../../src/metrics.types';
import PrivacyAndSecurityPermissionEnricher, {
  PERMISSION_ENRICHMENT_RULES,
} from '../../../src/privacy-and-security-permission-enricher';

describe('PrivacyAndSecurityPermissionEnricher', () => {
  const permission: PrivacyAndSecurityPermission = {
    camera: {status: 'GRANTED'},
    microphone: {status: 'DENIED', reason: 'DENIED_BY_USER'},
    contentShare: {status: 'REQUESTING'},
  };
  let onEnrichmentError: sinon.SinonStub;
  let enricher: PrivacyAndSecurityPermissionEnricher;

  beforeEach(() => {
    onEnrichmentError = sinon.stub();
    enricher = new PrivacyAndSecurityPermissionEnricher(onEnrichmentError);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('permission enrichment rules', () => {
    it('registers each production event in only one rule', () => {
      const registeredEvents = PERMISSION_ENRICHMENT_RULES.flatMap(({events}) => [...events]);

      assert.lengthOf(new Set(registeredEvents), registeredEvents.length);
    });

    [
      'client.call.initiated',
      'client.media.capabilities',
      'client.ice.end',
      'client.locus.join.request',
      'client.locus.join.response',
      'client.media-engine.ready',
    ].forEach((name) => {
      it(`projects camera and microphone for ${name}`, () => {
        enricher.setPermission(permission);

        const payload = enricher.enrich({name: name as ClientEvent['name'], scope: 'meeting'});

        assert.deepEqual(payload?.privacyAndSecurityPermission, {
          camera: permission.camera,
          microphone: permission.microphone,
        });
      });
    });

    ['client.media.tx.start', 'client.media.tx.stop'].forEach((name) => {
      [
        {mediaType: 'audio' as const, expected: {microphone: permission.microphone}},
        {mediaType: 'video' as const, expected: {camera: permission.camera}},
        {mediaType: 'share' as const, expected: {contentShare: permission.contentShare}},
      ].forEach(({mediaType, expected}) => {
        it(`projects ${mediaType} permission for ${name}`, () => {
          enricher.setPermission(permission);

          const payload = enricher.enrich({
            name: name as ClientEvent['name'],
            payload: {mediaType},
            scope: 'meeting',
          });

          assert.deepEqual(payload?.privacyAndSecurityPermission, expected);
        });
      });
    });

    [
      'client.share.initiated',
      'client.share.floor-grant.request',
      'client.share.floor-granted.local',
    ].forEach((name) => {
      it(`projects content-share permission for ${name}`, () => {
        enricher.setPermission(permission);

        const payload = enricher.enrich({
          name: name as ClientEvent['name'],
          payload: {mediaType: 'share'},
          scope: 'meeting',
        });

        assert.deepEqual(payload?.privacyAndSecurityPermission, {
          contentShare: permission.contentShare,
        });
      });
    });

    ['client.call.leave', 'client.call.remote-ended', 'client.call.aborted'].forEach((name) => {
      it(`projects every available permission for ${name}`, () => {
        enricher.setPermission(permission);

        const payload = enricher.enrich({name: name as ClientEvent['name'], scope: 'meeting'});

        assert.deepEqual(payload?.privacyAndSecurityPermission, permission);
      });
    });
  });

  describe('setPermission', () => {
    it('stores a defensive copy of the permission snapshot', () => {
      const mutablePermission: PrivacyAndSecurityPermission = {
        camera: {status: 'GRANTED'},
      };

      enricher.setPermission(mutablePermission);
      mutablePermission.camera = {status: 'DENIED', reason: 'DENIED_BY_USER'};

      const payload = enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});

      assert.deepEqual(payload?.privacyAndSecurityPermission, {
        camera: {status: 'GRANTED'},
      });
    });
  });

  describe('enrich', () => {
    it('does not mutate the input payload or stored permission state', () => {
      const inputPayload = {mediaType: 'audio' as const};

      enricher.setPermission(permission);
      const payload = enricher.enrich({
        name: 'client.call.initiated',
        payload: inputPayload,
        scope: 'meeting',
      });

      assert.notStrictEqual(payload, inputPayload);
      assert.notProperty(inputPayload, 'privacyAndSecurityPermission');
      assert.notStrictEqual(payload?.privacyAndSecurityPermission?.camera, permission.camera);
    });

    it('returns the original payload when the requested permission is unavailable', () => {
      const inputPayload = {mediaType: 'audio' as const};

      enricher.setPermission({camera: permission.camera});
      const payload = enricher.enrich({
        name: 'client.media.tx.start',
        payload: inputPayload,
        scope: 'meeting',
      });

      assert.strictEqual(payload, inputPayload);
    });

    it('returns the original payload for unsupported share media types', () => {
      const inputPayload = {mediaType: 'whiteboard' as const};

      enricher.setPermission(permission);
      const payload = enricher.enrich({
        name: 'client.share.initiated',
        payload: inputPayload,
        scope: 'meeting',
      });

      assert.strictEqual(payload, inputPayload);
    });

    it('reports initial permission once and suppresses an unchanged later event', () => {
      enricher.setPermission(permission);

      const initialPayload = enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});
      const unchangedPayload = enricher.enrich({name: 'client.ice.end', scope: 'meeting'});

      assert.property(initialPayload, 'privacyAndSecurityPermission');
      assert.isUndefined(unchangedPayload);
    });

    it('reports only permission resources that changed', () => {
      enricher.setPermission(permission);
      enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});
      enricher.setPermission({
        ...permission,
        camera: {status: 'DENIED', reason: 'DENIED_BY_SYSTEM'},
      });

      const payload = enricher.enrich({name: 'client.ice.end', scope: 'meeting'});

      assert.deepEqual(payload?.privacyAndSecurityPermission, {
        camera: {status: 'DENIED', reason: 'DENIED_BY_SYSTEM'},
      });
    });

    it('reports a changed reason when status is unchanged', () => {
      enricher.setPermission({microphone: {status: 'DENIED', reason: 'DENIED_BY_USER'}});
      enricher.enrich({
        name: 'client.media.tx.start',
        payload: {mediaType: 'audio'},
        scope: 'meeting',
      });
      enricher.setPermission({microphone: {status: 'DENIED', reason: 'DENIED_BY_SYSTEM'}});

      const payload = enricher.enrich({
        name: 'client.media.tx.stop',
        payload: {mediaType: 'audio'},
        scope: 'meeting',
      });

      assert.deepEqual(payload?.privacyAndSecurityPermission, {
        microphone: {status: 'DENIED', reason: 'DENIED_BY_SYSTEM'},
      });
    });

    it('shares resource history across enrichment rules', () => {
      enricher.setPermission(permission);
      enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});

      const payload = enricher.enrich({
        name: 'client.media.tx.start',
        payload: {mediaType: 'audio'},
        scope: 'meeting',
      });

      assert.notProperty(payload, 'privacyAndSecurityPermission');
    });

    it('tracks permission history independently by scope', () => {
      enricher.setPermission(permission);

      const firstMeeting = enricher.enrich({name: 'client.call.initiated', scope: 'meeting-1'});
      const secondMeeting = enricher.enrich({name: 'client.call.initiated', scope: 'meeting-2'});

      assert.property(firstMeeting, 'privacyAndSecurityPermission');
      assert.property(secondMeeting, 'privacyAndSecurityPermission');
    });

    it('clears only the terminal event scope', () => {
      enricher.setPermission(permission);
      enricher.enrich({name: 'client.call.initiated', scope: 'meeting-1'});
      enricher.enrich({name: 'client.call.initiated', scope: 'meeting-2'});
      enricher.enrich({name: 'client.call.leave', scope: 'meeting-1'});

      const reusedScope = enricher.enrich({name: 'client.call.initiated', scope: 'meeting-1'});
      const activeScope = enricher.enrich({name: 'client.ice.end', scope: 'meeting-2'});

      assert.property(reusedScope, 'privacyAndSecurityPermission');
      assert.isUndefined(activeScope);
    });

    it('preserves an explicit permission payload and uses it as the baseline', () => {
      const explicitPayload = {
        privacyAndSecurityPermission: {
          camera: permission.camera,
          microphone: permission.microphone,
        },
      };

      enricher.setPermission(permission);
      const returnedPayload = enricher.enrich({
        name: 'client.call.initiated',
        payload: explicitPayload,
        scope: 'meeting',
      });
      const laterPayload = enricher.enrich({name: 'client.ice.end', scope: 'meeting'});

      assert.strictEqual(returnedPayload, explicitPayload);
      assert.isUndefined(laterPayload);
    });

    it('clears history after an explicit terminal payload', () => {
      enricher.setPermission(permission);
      enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});
      enricher.enrich({
        name: 'client.call.leave',
        payload: {privacyAndSecurityPermission: permission},
        scope: 'meeting',
      });

      const payload = enricher.enrich({name: 'client.call.initiated', scope: 'meeting'});

      assert.property(payload, 'privacyAndSecurityPermission');
    });

    it('returns unchanged before permission state is supplied', () => {
      const inputPayload = {mediaType: 'audio' as const};

      const payload = enricher.enrich({
        name: 'client.call.initiated',
        payload: inputPayload,
        scope: 'meeting',
      });

      assert.strictEqual(payload, inputPayload);
    });

    it('does not enrich unrelated events', () => {
      enricher.setPermission(permission);

      const payload = enricher.enrich({name: 'client.alert.displayed', scope: 'meeting'});

      assert.isUndefined(payload);
    });

    it('reports enrichment errors and returns the original payload', () => {
      const inputPayload = {};

      Object.defineProperty(inputPayload, 'privacyAndSecurityPermission', {
        get: () => {
          throw new Error('permission read failed');
        },
      });

      const payload = enricher.enrich({
        name: 'client.call.initiated',
        payload: inputPayload,
        scope: 'meeting',
      });

      assert.strictEqual(payload, inputPayload);
      assert.calledOnce(onEnrichmentError);
    });
  });
});
