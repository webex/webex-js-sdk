enum Setting {
  disallowUnmute = 'DisallowUnmute',
  muteOnEntry = 'MuteOnEntry',
  muted = 'Muted',
  roles = 'Roles',
}

enum Control {
  audio = 'audio',
  raiseHand = 'raiseHand',
  reactions = 'reactions',
  shareControl = 'shareControl',
  video = 'video',
  viewTheParticipantList = 'viewTheParticipantList',
  viewTheParticipantListForWebinar = 'viewTheParticipantListForWebinar',
}

export {Control, Setting};

export default Setting;
