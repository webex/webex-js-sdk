import {assert} from '@webex/test-helper-chai';
import MemberUtil from '@webex/plugin-meetings/src/member/util';
import { ServerRoles } from '../../../../src/member/types';

describe('plugin-meetings', () => {
  describe('isHandRaised', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isHandRaised();
      }, 'Raise hand could not be processed, participant is undefined.');
    });
  
    it('returns false when controls is not there', () => {
      const participant = {};
  
      assert.isFalse(MemberUtil.isHandRaised(participant));
    });
  
    it('returns false when hand is not there in controls', () => {
      const participant = {
        controls: {},
      };
  
      assert.isFalse(MemberUtil.isHandRaised(participant));
    });
  
    it('returns true when hand raised is true', () => {
      const participant = {
        controls: {
          hand: {
            raised: true,
          },
        },
      };
  
      assert.isTrue(MemberUtil.isHandRaised(participant));
    });
  
    it('returns false when hand raised is false', () => {
      const participant = {
        controls: {
          hand: {
            raised: false,
          },
        },
      };
  
      assert.isFalse(MemberUtil.isHandRaised(participant));
    });
  });

  describe('MemberUtil.extractControlRoles', () => {
    it('happy path extract control roles', () => {
      const participant = {
        controls: {
          role: {
            roles: [
              {type: 'PRESENTER', hasRole: true},
              {type: 'COHOST', hasRole: true},
              {type: 'MODERATOR', hasRole: true},
            ]
          }
        }
      }

      assert.deepEqual(MemberUtil.extractControlRoles(participant), {cohost: true, moderator: true, presenter: true});
    });
  });

  describe('MemberUtil.getControlsRoles', () => {
    it('getControlsRoles', () => {
      const participant = {
        controls: {
          role: {
            roles: [
              {type: 'PRESENTER', hasRole: true},
            ]
          }
        }
      }

      assert.deepEqual(MemberUtil.getControlsRoles(participant), [{type: 'PRESENTER', hasRole: true}]);
    });
  });

  describe('MemberUtil.hasRole', () => {
    describe('PRESENTER', () => {
      it('getControlsRoles PRESENTER true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });
    })

    describe('MODERATOR', () => {
      it('getControlsRoles MODERATOR true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'MODERATOR', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });

      it('getControlsRoles MODERATOR false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'MODERATOR', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });

      it('getControlsRoles MODERATOR undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });
    })

    describe('COHOST', () => {
      it('getControlsRoles COHOST true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'COHOST', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });

      it('getControlsRoles COHOST false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'COHOST', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });

      it('getControlsRoles COHOST undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });
    })
  });

  describe('MemberUtil.is<Role>', () => {
    describe('PRESENTER', () => {
      it('getControlsRoles PRESENTER true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasPresenter(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasPresenter(participant));
      });

      it('getControlsRoles PRESENTER undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasPresenter(participant));
      });
    })

    describe('MODERATOR', () => {
      it('getControlsRoles MODERATOR true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'MODERATOR', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasModerator(participant));
      });

      it('getControlsRoles MODERATOR false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'MODERATOR', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasModerator(participant));
      });

      it('getControlsRoles MODERATOR undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasModerator(participant));
      });
    })

    describe('COHOST', () => {
      it('getControlsRoles COHOST true', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'COHOST', hasRole: true},
              ]
            }
          }
        }
  
        assert.isTrue(MemberUtil.hasCohost(participant));
      });

      it('getControlsRoles COHOST false', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {type: 'COHOST', hasRole: false},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasCohost(participant));
      });

      it('getControlsRoles COHOST undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [
                {},
              ]
            }
          }
        }
  
        assert.isFalse(MemberUtil.hasCohost(participant));
      });
    })
  });

  describe('MemberUtil.isBreakoutsSupported', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isBreakoutsSupported();
      }, 'Breakout support could not be processed, participant is undefined.');
    });

    it('returns true when hand breakouts are supported', () => {
      const participant = {
        doesNotSupportBreakouts: false
      };

      assert.isTrue(MemberUtil.isBreakoutsSupported(participant));
    });

    it('returns false when hand breakouts are not supported', () => {
      const participant = {
        doesNotSupportBreakouts: true
      };

      assert.isFalse(MemberUtil.isBreakoutsSupported(participant));
    });
  });
});
