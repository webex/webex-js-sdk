/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MemberMLSReconciler from '@webex/plugin-meetings/src/e2ee/MemberMLSReconciler';
import MembersCollection from '@webex/plugin-meetings/src/members/collection';
import Member from '@webex/plugin-meetings/src/member';

describe('plugin-meetings', () => {
  describe('MemberMLSReconciler', () => {
    let membersCollection;
    let reportMembersUpdated;
    let reconciler;

    const makeMember = (id, deviceUrls) =>
      new Member({id, controls: {}, status: {}, devices: deviceUrls.map((url) => ({url}))});

    const rosterMember = (url, validationResult, identityResults = [
      {
        result: validationResult === 1 ? 2 : validationResult,
        certificateChain: validationResult === 0 ? [{identityType: 2}] : [],
      },
    ]) => ({
      url,
      displayName: 'Alice',
      deviceType: 'WEB',
      validationResult,
      identityResults,
    });

    // Adds a member to the collection and stamps it via the Members processor path.
    const addMember = (member) => {
      membersCollection.set(member.id, member);
      reconciler.processMembersUpdate({delta: {added: [member]}});
    };

    beforeEach(() => {
      membersCollection = new MembersCollection();
      reportMembersUpdated = sinon.stub();
      reconciler = new MemberMLSReconciler({membersCollection, reportMembersUpdated});
    });

    afterEach(() => {
      sinon.restore();
    });

    it('applies per-device verification matched by device url (validationResult === 0 verified)', () => {
      const member = makeMember('m1', ['device-a', 'device-b']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a', 0), rosterMember('device-b', 1)]);

      assert.equal(member.getE2eeDeviceVerification('device-a').validationResult, 0);
      assert.equal(member.getE2eeDeviceVerification('device-b').validationResult, 1);
      assert.equal(member.e2eeVerificationState, 'partiallyVerified');
      assert.calledWith(reportMembersUpdated, [member]);
    });

    it('copies certificate information from the MLS roster onto the matching device', () => {
      const member = makeMember('m1', ['device-a']);
      const identityResults = [
        {
          result: 0,
          certificateChain: [{primaryName: 'alice@example.com', der: new Uint8Array([1, 2, 3])}],
        },
      ];
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a', 0, identityResults)]);

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

      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);

      assert.equal(member.e2eeVerificationState, 'unknown');
      assert.deepEqual(member.getE2eeDeviceVerifications(), []);
      assert.notCalled(reportMembersUpdated);
    });

    it("aggregates to 'verified' when all of a member's devices are verified", () => {
      const member = makeMember('m1', ['device-a', 'device-b']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a', 0), rosterMember('device-b', 0)]);

      assert.equal(member.e2eeVerificationState, 'verified');
    });

    it('stamps verification (no report) for a roster entry that arrived before the member', () => {
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);
      reportMembersUpdated.resetHistory();

      const member = makeMember('m1', ['device-a']);
      membersCollection.set('m1', member);
      reconciler.processMembersUpdate({delta: {added: [member]}});

      assert.equal(member.e2eeVerificationState, 'verified');
      // Member-driven: verification is stamped in place; Members emits the members:update, not us.
      assert.notCalled(reportMembersUpdated);
    });

    it('reports a member when its roster entry arrives after it (roster-driven)', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      assert.equal(member.e2eeVerificationState, 'unknown');
      reportMembersUpdated.resetHistory();

      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);

      assert.equal(member.e2eeVerificationState, 'verified');
      assert.calledWith(reportMembersUpdated, [member]);
    });

    it('clears and reports a member when its device is removed from the roster', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);
      reportMembersUpdated.resetHistory();

      reconciler.applyRosterRemoved(['device-a']);

      assert.isUndefined(member.getE2eeDeviceVerification('device-a'));
      assert.equal(member.e2eeVerificationState, 'unknown');
      assert.calledWith(reportMembersUpdated, [member]);
    });

    it('reset() clears the roster and reports members that were verified', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);
      reportMembersUpdated.resetHistory();

      reconciler.reset();

      assert.equal(member.e2eeVerificationState, 'unknown');
      assert.calledWith(reportMembersUpdated, [member]);
    });

    it('getDeviceVerification returns the mapped verification or undefined', () => {
      reconciler.applyRosterAdded([rosterMember('device-a', 0), rosterMember('device-b', 5)]);

      assert.deepEqual(reconciler.getDeviceVerification('device-a'), {
        deviceUrl: 'device-a',
        validationResult: 0,
        displayName: 'Alice',
        deviceType: 'WEB',
        identityResults: [{result: 0, certificateChain: [{identityType: 2}]}],
      });
      assert.equal(reconciler.getDeviceVerification('device-b').validationResult, 5);
      assert.isUndefined(reconciler.getDeviceVerification('device-missing'));
    });

    it('reports only when a roster change actually alters a member verification', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);

      reconciler.applyRosterAdded([rosterMember('device-a', 0)]); // change -> report
      reconciler.applyRosterRemoved(['device-x']); // device not owned -> silent
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]); // same value -> silent
      reconciler.applyRosterRemoved(['device-a']); // change -> report

      assert.equal(reportMembersUpdated.callCount, 2);
    });

    it('does not report when a member update leaves verification unchanged', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);
      reportMembersUpdated.resetHistory();

      // A members update recreates the member without changing anything verification-relevant.
      const recreated = makeMember('m1', ['device-a']);
      membersCollection.set('m1', recreated);
      reconciler.processMembersUpdate({delta: {updated: [recreated]}});

      assert.equal(recreated.e2eeVerificationState, 'verified');
      assert.notCalled(reportMembersUpdated);
    });

    it('ignores roster changes for members removed from the collection', () => {
      const member = makeMember('m1', ['device-a']);
      addMember(member);
      reconciler.applyRosterAdded([rosterMember('device-a', 0)]);
      reportMembersUpdated.resetHistory();

      membersCollection.remove('m1'); // member leaves -> collection drops it from the index

      reconciler.applyRosterRemoved(['device-a']);

      assert.notCalled(reportMembersUpdated);
    });
  });
});
