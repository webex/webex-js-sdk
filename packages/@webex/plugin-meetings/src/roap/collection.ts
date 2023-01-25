import RoapStateMachine from './state';

/* eslint-disable */
const RoapCollection = {
  sessions: {},

  getSession(id) {
    if (!this.sessions[id]) {
      this.sessions[id] = {
        activeSequences: 0,
      };
    }
    return this.sessions[id];
  },

  deleteSession(id) {
    if (this.getSession(id)) {
      delete this.sessions[id];
    }
  },

  getSessionSequence(id, seqId) {
    const session = this.getSession(id);
    if (!session[seqId]) {
      session[seqId] = {
        state: RoapStateMachine.createState(),
        finished: false,
      };
      session.activeSequences += 1;
    }
    return session[seqId];
  },

  deleteSessionSequence(id, seqId) {
    const seq = this.getSessionSequence(id, seqId);
    if (seq) {
      if (!seq.finished) {
        // @ts-ignore
        session.activeSequences -= 1;
      }
      delete this.sessions[id][seqId];
    }
  },

  isBusy(id) {
    const session = this.getSession(id);
    if (!session) return false;

    return session.activeSequences > 0;
  },

  onSessionSequenceFinish(id, seqId) {
    const session = this.getSession(id);
    const seq = session[seqId];
    if (seq && !seq.finished) {
      seq.finished = true;
      session.activeSequences -= 1;
    }
  },
};

export default RoapCollection;
