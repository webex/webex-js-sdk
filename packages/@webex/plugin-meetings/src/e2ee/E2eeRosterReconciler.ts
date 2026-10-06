/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';
import type MembersCollection from '../members/collection';
import type {E2eeDeviceVerification, E2eeRosterMember} from './types';

/** The member changes the reconciler consumes from the Members pre-emit processor. */
interface MembersUpdatePayload {
  delta?: {
    added?: any[];
    updated?: any[];
  };
}

/**
 * Reconciles the MLS roster (keyed by device URL) against the meeting's `Members`, stamping a
 * per-device verification onto each `Member` and deriving an aggregate verification state.
 *
 * It holds only the MLS roster; the device-URL -> member lookup lives in `MembersCollection`, and
 * verification lives on each `Member`. Every path iterates its argument exactly once:
 *  - Member changes are fed in via `processMembersUpdate` (from the Members pre-emit processor),
 *    which stamps the (recreated) members' verification before `members:update` is emitted.
 *  - Roster changes update only the members owning the affected device URLs (via the collection's
 *    reverse index); members whose verification actually changed are handed to
 *    `reportMembersUpdated` so Members emits a `members:update` for them.
 */
export default class E2eeRosterReconciler {
  private readonly membersCollection: MembersCollection;

  private readonly reportMembersUpdated: (updatedMembers: any[]) => void;

  private readonly rosterByDeviceUrl = new Map<string, E2eeRosterMember>();

  /**
   * @param {Object} deps
   * @param {MembersCollection} deps.membersCollection - The meeting's members collection.
   * @param {Function} deps.reportMembersUpdated - Asks Members to emit `members:update` for the
   *   given members (used for roster-driven verification changes that have no Locus update).
   */
  constructor({
    membersCollection,
    reportMembersUpdated,
  }: {
    membersCollection: MembersCollection;
    reportMembersUpdated: (updatedMembers: any[]) => void;
  }) {
    this.membersCollection = membersCollection;
    this.reportMembersUpdated = reportMembersUpdated;
  }

  /**
   * Stamps verification onto the members changed by a Locus update, before `members:update` is
   * emitted. Does not itself emit — Members emits the (single) event.
   * @param {MembersUpdatePayload} payload
   * @returns {void}
   */
  processMembersUpdate(payload: MembersUpdatePayload): void {
    const {added = [], updated = []} = payload?.delta ?? {};

    [...added, ...updated].forEach((member) => this.stampMember(member));
  }

  /**
   * Adds/updates MLS roster members, updating the owning member's per-device verification and
   * reporting the members whose verification changed.
   * @param {E2eeRosterMember[]} added
   * @returns {void}
   */
  applyRosterAdded(added: E2eeRosterMember[]): void {
    const changed = new Set<any>();

    added.forEach((entry) => {
      this.rosterByDeviceUrl.set(entry.url, entry);

      const member = this.membersCollection.getMemberByDeviceUrl(entry.url);

      if (
        member?.setE2eeDeviceVerification?.(
          entry.url,
          E2eeRosterReconciler.toDeviceVerification(entry)
        )
      ) {
        changed.add(member);
      }
    });

    LoggerProxy.logger.info(
      `e2ee: E2eeRosterReconciler#applyRosterAdded --> ${added.length} added (roster size ${this.rosterByDeviceUrl.size})`
    );
    this.report(changed);
  }

  /**
   * Removes MLS roster members by device URL, clearing the owning member's per-device verification
   * and reporting the members whose verification changed.
   * @param {string[]} urls
   * @returns {void}
   */
  applyRosterRemoved(urls: string[]): void {
    const changed = new Set<any>();

    urls.forEach((url) => {
      this.rosterByDeviceUrl.delete(url);

      const member = this.membersCollection.getMemberByDeviceUrl(url);

      if (member?.removeE2eeDeviceVerification?.(url)) {
        changed.add(member);
      }
    });

    LoggerProxy.logger.info(
      `e2ee: E2eeRosterReconciler#applyRosterRemoved --> ${urls.length} removed (roster size ${this.rosterByDeviceUrl.size})`
    );
    this.report(changed);
  }

  /**
   * @param {string} deviceUrl
   * @returns {E2eeDeviceVerification | undefined} the verification for a single device URL.
   */
  getDeviceVerification(deviceUrl: string): E2eeDeviceVerification | undefined {
    const rosterEntry = this.rosterByDeviceUrl.get(deviceUrl);

    return rosterEntry ? E2eeRosterReconciler.toDeviceVerification(rosterEntry) : undefined;
  }

  /**
   * Clears the roster and the verification it had applied, reporting the affected members.
   * @returns {void}
   */
  reset(): void {
    const changed = new Set<any>();

    this.rosterByDeviceUrl.forEach((_entry, url) => {
      const member = this.membersCollection.getMemberByDeviceUrl(url);

      if (member?.removeE2eeDeviceVerification?.(url)) {
        changed.add(member);
      }
    });

    this.rosterByDeviceUrl.clear();
    this.report(changed);
  }

  /**
   * Replaces a member's verification from the current roster (for a recreated member). No report.
   * @param {any} member
   * @returns {void}
   */
  private stampMember(member: any): void {
    const verifications: E2eeDeviceVerification[] = [];

    (member?.participant?.devices ?? []).forEach((device) => {
      const rosterEntry = device?.url ? this.rosterByDeviceUrl.get(device.url) : undefined;

      if (rosterEntry) {
        verifications.push(E2eeRosterReconciler.toDeviceVerification(rosterEntry));
      }
    });

    member.setE2eeDeviceVerifications?.(verifications);
  }

  /**
   * @param {Set} changed
   * @returns {void}
   */
  private report(changed: Set<any>): void {
    if (changed.size) {
      this.reportMembersUpdated([...changed]);
    }
  }

  /**
   * @param {E2eeRosterMember} rosterEntry
   * @returns {E2eeDeviceVerification}
   */
  private static toDeviceVerification(rosterEntry: E2eeRosterMember): E2eeDeviceVerification {
    return {
      deviceUrl: rosterEntry.url,
      validationResult: rosterEntry.validationResult,
      displayName: rosterEntry.displayName,
      deviceType: rosterEntry.deviceType,
    };
  }
}
