import {assert} from '@webex/test-helper-chai';
import MemberUtil from '@webex/plugin-meetings/src/member/util';
import {ServerRoles} from '../../../../src/member/types';
import {_SEND_RECEIVE_, _RECEIVE_ONLY_} from '../../../../src/constants';

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

  describe('MemberUtil.canReclaimHost', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.canReclaimHost();
      }, 'canReclaimHostRole could not be processed, participant is undefined.');
    });

    it('returns true when canReclaimHostRole is true', () => {
      const participant = {
        canReclaimHostRole: true,
      };

      assert.isTrue(MemberUtil.canReclaimHost(participant));
    });

    it('returns false when canReclaimHostRole is false', () => {
      const participant = {
        canReclaimHostRole: false,
      };

      assert.isFalse(MemberUtil.canReclaimHost(participant));
    });

    it('returns false when canReclaimHostRole is falsy', () => {
      const participant = {
        canReclaimHostRole: undefined,
      };

      assert.isFalse(MemberUtil.canReclaimHost(participant));
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
            ],
          },
        },
      };

      assert.deepEqual(MemberUtil.extractControlRoles(participant), {
        cohost: true,
        moderator: true,
        presenter: true,
      });
    });
  });

  describe('MemberUtil.getControlsRoles', () => {
    it('getControlsRoles', () => {
      const participant = {
        controls: {
          role: {
            roles: [{type: 'PRESENTER', hasRole: true}],
          },
        },
      };

      assert.deepEqual(MemberUtil.getControlsRoles(participant), [
        {type: 'PRESENTER', hasRole: true},
      ]);
    });
  });

  describe('MemberUtil.hasRole', () => {
    describe('PRESENTER', () => {
      it('getControlsRoles PRESENTER true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'PRESENTER', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'PRESENTER', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Presenter));
      });
    });

    describe('MODERATOR', () => {
      it('getControlsRoles MODERATOR true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'MODERATOR', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });

      it('getControlsRoles MODERATOR false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'MODERATOR', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });

      it('getControlsRoles MODERATOR undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Moderator));
      });
    });

    describe('COHOST', () => {
      it('getControlsRoles COHOST true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'COHOST', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });

      it('getControlsRoles COHOST false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'COHOST', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });

      it('getControlsRoles COHOST undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasRole(participant, ServerRoles.Cohost));
      });
    });
  });

  describe('MemberUtil.is<Role>', () => {
    describe('PRESENTER', () => {
      it('getControlsRoles PRESENTER true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'PRESENTER', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasPresenter(participant, ServerRoles.Presenter));
      });

      it('getControlsRoles PRESENTER false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'PRESENTER', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasPresenter(participant));
      });

      it('getControlsRoles PRESENTER undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasPresenter(participant));
      });
    });

    describe('MODERATOR', () => {
      it('getControlsRoles MODERATOR true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'MODERATOR', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasModerator(participant));
      });

      it('getControlsRoles MODERATOR false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'MODERATOR', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasModerator(participant));
      });

      it('getControlsRoles MODERATOR undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasModerator(participant));
      });
    });

    describe('COHOST', () => {
      it('getControlsRoles COHOST true', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'COHOST', hasRole: true}],
            },
          },
        };

        assert.isTrue(MemberUtil.hasCohost(participant));
      });

      it('getControlsRoles COHOST false', () => {
        const participant = {
          controls: {
            role: {
              roles: [{type: 'COHOST', hasRole: false}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasCohost(participant));
      });

      it('getControlsRoles COHOST undefined', () => {
        const participant = {
          controls: {
            role: {
              roles: [{}],
            },
          },
        };

        assert.isFalse(MemberUtil.hasCohost(participant));
      });
    });
  });

  describe('MemberUtil.isBreakoutsSupported', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isBreakoutsSupported();
      }, 'Breakout support could not be processed, participant is undefined.');
    });

    it('returns true when hand breakouts are supported', () => {
      const participant = {
        doesNotSupportBreakouts: false,
      };

      assert.isTrue(MemberUtil.isBreakoutsSupported(participant));
    });

    it('returns false when hand breakouts are not supported', () => {
      const participant = {
        doesNotSupportBreakouts: true,
      };

      assert.isFalse(MemberUtil.isBreakoutsSupported(participant));
    });
  });

  describe('MemberUtil.isLiveAnnotationSupported', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isLiveAnnotationSupported();
      }, 'LiveAnnotation support could not be processed, participant is undefined.');
    });

    it('returns true when hand live annotation are supported', () => {
      const participant = {
        annotatorAssignmentNotAllowed: false,
      };

      assert.isTrue(MemberUtil.isLiveAnnotationSupported(participant));
    });

    it('returns false when hand live annotation are not supported', () => {
      const participant = {
        annotatorAssignmentNotAllowed: true,
      };

      assert.isFalse(MemberUtil.isLiveAnnotationSupported(participant));
    });
  });

  describe('MemberUtil.isInterpretationSupported', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isInterpretationSupported();
      }, 'Interpretation support could not be processed, participant is undefined.');
    });

    it('returns true when hand SiInterpreter are supported', () => {
      const participant = {
        doesNotSupportSiInterpreter: false,
      };

      assert.isTrue(MemberUtil.isInterpretationSupported(participant));
    });

    it('returns false when hand SiInterpreter are not supported', () => {
      const participant = {
        doesNotSupportSiInterpreter: true,
      };

      assert.isFalse(MemberUtil.isInterpretationSupported(participant));
    });
  });

  const getMuteStatus = (muted) => {
    if (muted === undefined) {
      return undefined;
    }
    return muted ? _RECEIVE_ONLY_ : _SEND_RECEIVE_;
  };

  describe('MemberUtil.isAudioMuted', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isAudioMuted();
      }, 'Audio could not be processed, participant is undefined.');
    });

    // NOTE: participant.controls.audio.muted represents remote video mute
    //       participant.status.audioStatus represents local video mute

    const testResult = (remoteMuted, localMuted, expected) => {
      const participant = {
        controls: {audio: {muted: remoteMuted}},
        status: {audioStatus: getMuteStatus(localMuted)},
      };

      assert.equal(MemberUtil.isAudioMuted(participant), expected);
    };

    it('returns true when remote is muted and local is not', () => {
      testResult(true, false, true);
    });

    it('returns true when remote is not muted and local is muted', () => {
      testResult(false, true, true);
    });

    it('returns false when both are not muted', () => {
      testResult(false, false, false);
    });

    it('returns undefined when both are undefined', () => {
      testResult(undefined, undefined, undefined);
    });

    it('returns defined status when the other is undefined', () => {
      testResult(undefined, true, true);
      testResult(undefined, false, false);
      testResult(true, undefined, true);
      testResult(false, undefined, false);
    });
  });

  describe('MemberUtil.isVideoMuted', () => {
    it('throws error when there is no participant', () => {
      assert.throws(() => {
        MemberUtil.isVideoMuted();
      }, 'Video could not be processed, participant is undefined.');
    });

    // NOTE: participant.controls.video.muted represents remote video mute
    //       participant.status.videoStatus represents local video mute

    const testResult = (remoteMuted, localMuted, expected) => {
      const participant = {
        controls: {video: {muted: remoteMuted}},
        status: {videoStatus: getMuteStatus(localMuted)},
      };

      assert.equal(MemberUtil.isVideoMuted(participant), expected);
    };

    it('returns true when remote is muted and local is not', () => {
      testResult(true, false, true);
    });

    it('returns true when remote is not muted and local is muted', () => {
      testResult(false, true, true);
    });

    it('returns false when both are not muted', () => {
      testResult(false, false, false);
    });

    it('returns undefined when both are undefined', () => {
      testResult(undefined, undefined, undefined);
    });

    it('returns defined status when the other is undefined', () => {
      testResult(undefined, true, true);
      testResult(undefined, false, false);
      testResult(true, undefined, true);
      testResult(false, undefined, false);
    });
  });
});

describe('extractMediaStatus', () => {
  it('throws error when there is no participant', () => {
    assert.throws(() => {
      MemberUtil.extractMediaStatus()
    }, 'Media status could not be extracted, participant is undefined.');
  });

  it('returns undefined media status when participant audio/video status is not present', () => {
    const participant = {
      status: {}
    };
    
    const mediaStatus = MemberUtil.extractMediaStatus(participant)

    assert.deepEqual(mediaStatus, {audio: undefined, video: undefined});
  });

  it('returns correct media status when participant audio/video status is present', () => {
    const participant = {
      status: {
        audioStatus: 'RECVONLY',
        videoStatus: 'SENDRECV'
      }
    };
    
    const mediaStatus = MemberUtil.extractMediaStatus(participant)

    assert.deepEqual(mediaStatus, {audio: 'RECVONLY', video: 'SENDRECV'});
  });
});
