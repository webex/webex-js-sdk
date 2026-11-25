/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MemberMLSReconciler from '@webex/plugin-meetings/src/e2ee/MemberMLSReconciler';
import MembersCollection from '@webex/plugin-meetings/src/members/collection';
import Member from '@webex/plugin-meetings/src/member';
import {
  E2eeIdentityType,
  E2eeMemberVerificationState,
  E2eeValidationResult,
} from '@webex/plugin-meetings/src/e2ee/types';
import type {E2eeIdentityResult} from '@webex/plugin-meetings/src/e2ee/types';

describe('plugin-meetings', () => {
  describe('MemberMLSReconciler', () => {
    let membersCollection;
    let reportMembersUpdated;
    let reconciler;

    const makeMember = (id, deviceUrls) =>
      new Member({id, controls: {}, status: {}, devices: deviceUrls.map((url) => ({url}))});

    const VERIFIED_IDENTITY_RESULTS = [
      {
        result: E2eeValidationResult.Success,
        certificateChain: [{identityType: E2eeIdentityType.WebexUserIdentity}],
      },
    ];
    const FAILED_IDENTITY_RESULTS = [{result: E2eeValidationResult.Failure, certificateChain: []}];

    // Defaults to a device whose credential validated as a Webex user identity.
    const rosterMember = (
      deviceUrl,
      {
        validationResult = E2eeValidationResult.Success,
        identityResults = VERIFIED_IDENTITY_RESULTS,
      }: {validationResult?: E2eeValidationResult; identityResults?: E2eeIdentityResult[]} = {}
    ) => ({
      deviceUrl,
      displayName: 'Alice',
      deviceType: 'WEB',
      validationResult,
      identityResults,
    });

    const unverifiedRosterMember = (url) =>
      rosterMember(url, {
        validationResult: E2eeValidationResult.Failure,
        identityResults: FAILED_IDENTITY_RESULTS,
      });

    // Adds a member to the collection and stamps it via the Members processor path.
    const addMember = (member) => {
      membersCollection.set(member.id, member);
      reconciler.processMembersUpdate({delta: {added: [member]}});
    };

    // Replaces a member in the collection (Locus recreates it) and stamps it as an update.
    const updateMember = (member) => {
      membersCollection.set(member.id, member);
      reconciler.processMembersUpdate({delta: {updated: [member]}});
    };

    beforeEach(() => {
      membersCollection = new MembersCollection();
      reportMembersUpdated = sinon.stub();
      reconciler = new MemberMLSReconciler({membersCollection, reportMembersUpdated});
    });

    afterEach(() => {
      sinon.restore();
    });

    it('applies per-device verification matched by device url', () => {
      const member = makeMember('m1', ['device-a', 'device-b']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a'), unverifiedRosterMember('device-b')]);

      assert.equal(
        member.getE2eeDeviceVerification('device-a').validationResult,
        E2eeValidationResult.Success
      );
      assert.equal(
        member.getE2eeDeviceVerification('device-b').validationResult,
        E2eeValidationResult.Failure
      );
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.PartiallyVerified);
      assert.calledOnceWithExactly(reportMembersUpdated, [member]);
    });

    it('copies certificate information from the MLS roster onto the matching device', () => {
      const member = makeMember('m1', ['device-a']);
      const identityResults = [
        {
          result: E2eeValidationResult.Success,
          certificateChain: [{primaryName: 'alice@example.com', der: new Uint8Array([1, 2, 3])}],
        },
      ];
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a', {identityResults})]);

      assert.deepEqual(
        member.getE2eeDeviceVerification('device-a').identityResults,
        identityResults
      );
      assert.deepEqual(
        reconciler.getDeviceVerification('device-a').identityResults,
        identityResults
      );
    });

    it("leaves a member 'unknown' (and reports nothing) when none of its devices are in the roster", () => {
      const member = makeMember('m1', ['device-x']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a')]);

      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      assert.deepEqual(member.getE2eeDeviceVerifications(), []);
      assert.notCalled(reportMembersUpdated);
    });

    it("aggregates to 'verified' when all of a member's devices are verified", () => {
      const member = makeMember('m1', ['device-a', 'device-b']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a'), rosterMember('device-b')]);

      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Verified);
    });

    it('stamps verification (no report) for a roster entry that arrived before the member', () => {
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      const member = makeMember('m1', ['device-a']);
      addMember(member);

      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Verified);
      // Member-driven: verification is stamped in place; Members emits the members:update, not us.
      assert.notCalled(reportMembersUpdated);
    });

    it('reports a member when its roster entry arrives after it (roster-driven)', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      reportMembersUpdated.resetHistory();

      reconciler.applyRosterAdded([rosterMember('device-a')]);

      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Verified);
      assert.calledOnceWithExactly(reportMembersUpdated, [member]);
    });

    it('clears and reports a member when its device is removed from the roster', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      reconciler.applyRosterRemoved(['device-a']);

      assert.isUndefined(member.getE2eeDeviceVerification('device-a'));
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      assert.calledOnceWithExactly(reportMembersUpdated, [member]);
    });

    it('reset() clears the roster and reports members that were verified', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      reconciler.reset();

      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      assert.calledOnceWithExactly(reportMembersUpdated, [member]);
    });

    it('getDeviceVerification returns the mapped verification or undefined', () => {
      reconciler.applyRosterAdded([rosterMember('device-a'), unverifiedRosterMember('device-b')]);

      assert.deepEqual(reconciler.getDeviceVerification('device-a'), {
        deviceUrl: 'device-a',
        validationResult: E2eeValidationResult.Success,
        displayName: 'Alice',
        deviceType: 'WEB',
        identityResults: VERIFIED_IDENTITY_RESULTS,
      });
      assert.equal(
        reconciler.getDeviceVerification('device-b').validationResult,
        E2eeValidationResult.Failure
      );
      assert.isUndefined(reconciler.getDeviceVerification('device-missing'));
    });

    it('reports only when a roster change actually alters a member verification', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a')]); // change -> report
      reconciler.applyRosterRemoved(['device-x']); // device not owned -> silent
      reconciler.applyRosterAdded([rosterMember('device-a')]); // same value -> silent
      reconciler.applyRosterRemoved(['device-a']); // change -> report

      assert.equal(reportMembersUpdated.callCount, 2);
    });

    it('does not report when a member update leaves verification unchanged', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      // A members update recreates the member without changing anything verification-relevant.
      const recreated = makeMember('m1', ['device-a']);
      updateMember(recreated);

      assert.equal(recreated.e2eeVerificationState, E2eeMemberVerificationState.Verified);
      assert.notCalled(reportMembersUpdated);
    });

    it('ignores roster changes for members removed from the collection', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      membersCollection.remove('m1'); // member leaves -> collection drops it from the index

      reconciler.applyRosterRemoved(['device-a']);

      assert.notCalled(reportMembersUpdated);
    });

    it('restamps an updated member from the roster when its devices change', () => {
      addMember(makeMember('m1', ['device-a']));
      reconciler.applyRosterAdded([rosterMember('device-a'), rosterMember('device-b')]);
      reportMembersUpdated.resetHistory();

      const recreated = makeMember('m1', ['device-b']);
      updateMember(recreated);

      assert.isUndefined(recreated.getE2eeDeviceVerification('device-a'));
      assert.equal(recreated.getE2eeDeviceVerification('device-b').deviceUrl, 'device-b');
      assert.equal(recreated.e2eeVerificationState, E2eeMemberVerificationState.Verified);
      assert.notCalled(reportMembersUpdated);

      reconciler.applyRosterRemoved(['device-a']); // no longer owned by the member -> silent
      assert.notCalled(reportMembersUpdated);

      reconciler.applyRosterRemoved(['device-b']);
      assert.calledOnceWithExactly(reportMembersUpdated, [recreated]);
    });

    it('reports a member when the roster entry for its device changes', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reportMembersUpdated.resetHistory();

      reconciler.applyRosterAdded([unverifiedRosterMember('device-a')]);

      assert.equal(
        member.getE2eeDeviceVerification('device-a').validationResult,
        E2eeValidationResult.Failure
      );
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unverified);
      assert.calledOnceWithExactly(reportMembersUpdated, [member]);
    });

    it('reports all members affected by one roster batch in a single report', () => {
      const member1 = makeMember('m1', ['device-a']);
      const member2 = makeMember('m2', ['device-b']);
      addMember(member1);
      addMember(member2);

      reconciler.applyRosterAdded([rosterMember('device-a'), rosterMember('device-b')]);

      assert.calledOnceWithExactly(reportMembersUpdated, [member1, member2]);
    });

    it('omits identityResults when the roster entry has none', () => {
      const member = makeMember('m1', ['device-a']);
      const expected = {
        deviceUrl: 'device-a',
        validationResult: E2eeValidationResult.Success,
        displayName: 'Alice',
        deviceType: 'WEB',
      };
      addMember(member);

      reconciler.applyRosterAdded([
        {
          deviceUrl: 'device-a',
          displayName: 'Alice',
          deviceType: 'WEB',
          validationResult: E2eeValidationResult.Success,
        },
      ]);

      assert.deepEqual(reconciler.getDeviceVerification('device-a'), expected);
      assert.deepEqual(member.getE2eeDeviceVerification('device-a'), expected);
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
    });

    it('does not stamp a member whose roster entry was removed before it arrived', () => {
      reconciler.applyRosterAdded([rosterMember('device-a')]);
      reconciler.applyRosterRemoved(['device-a']);

      const member = makeMember('m1', ['device-a']);
      addMember(member);

      assert.isUndefined(reconciler.getDeviceVerification('device-a'));
      assert.deepEqual(member.getE2eeDeviceVerifications(), []);
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      assert.notCalled(reportMembersUpdated);
    });

    it('reset() does not report when no member owns a roster device', () => {
      reconciler.applyRosterAdded([rosterMember('device-a')]);

      reconciler.reset();

      assert.notCalled(reportMembersUpdated);
    });

    it('stops stamping members from the roster after reset()', () => {
      reconciler.applyRosterAdded([rosterMember('device-a')]);

      reconciler.reset();
      const member = makeMember('m1', ['device-a']);
      addMember(member);

      assert.isUndefined(reconciler.getDeviceVerification('device-a'));
      assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      assert.notCalled(reportMembersUpdated);
    });

    [
      {name: 'no payload', payload: undefined},
      {name: 'a payload without delta', payload: {}},
      {name: 'an empty delta', payload: {delta: {}}},
    ].forEach(({name, payload}) => {
      it(`ignores a members update with ${name}`, () => {
        reconciler.applyRosterAdded([rosterMember('device-a')]);

        reconciler.processMembersUpdate(payload);

        assert.notCalled(reportMembersUpdated);
      });
    });

    [
      {name: 'no devices', createMember: () => new Member({id: 'm1', controls: {}, status: {}})},
      {
        name: 'a device without a url',
        createMember: () => new Member({id: 'm1', controls: {}, status: {}, devices: [{}]}),
      },
    ].forEach(({name, createMember}) => {
      it(`leaves a member with ${name} in the 'unknown' state`, () => {
        const member = createMember();
        reconciler.applyRosterAdded([rosterMember('device-a')]);

        addMember(member);

        assert.deepEqual(member.getE2eeDeviceVerifications(), []);
        assert.equal(member.e2eeVerificationState, E2eeMemberVerificationState.Unknown);
      });
    });
  });
});
