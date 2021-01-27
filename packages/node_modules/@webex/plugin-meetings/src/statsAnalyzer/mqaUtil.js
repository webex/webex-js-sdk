
import {mean, max} from 'lodash';

import {STATS} from '../constants';

export const getAudioReceiverMqa = ({audioReceiver, statsResults, lastMqaDataSent}) => {
  const mediaType = STATS.AUDIO_CORRELATE;
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  audioReceiver.common.common.direction = statsResults[mediaType].direction;
  audioReceiver.common.transportType = statsResults.connectionType.remote.transport[0];
  // add rtpPacket info inside common as also for call analyzer
  audioReceiver.common.rtpPackets = statsResults[mediaType][sendrecvType].totalPacketsReceived - lastMqaDataSent[mediaType][sendrecvType].totalPacketsReceived || 0;
  // Hop by hop are numbers and not percentage so we compare on what we sent the last min
  // collect the packets received for the last min
  audioReceiver.streams[0].common.rtpPackets = audioReceiver.common.rtpPackets;
  audioReceiver.common.mediaHopByHopLost = (statsResults[mediaType][sendrecvType].totalPacketsLost - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLost) || 0;
  audioReceiver.common.rtpHopByHopLost = statsResults[mediaType][sendrecvType].totalPacketsLost - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLost || 0;

  audioReceiver.streams[0].common.maxRtpJitter = max(statsResults[mediaType][sendrecvType].meanRtpJitter) * 1000 || 0;
  audioReceiver.streams[0].common.meanRtpJitter = mean(statsResults[mediaType][sendrecvType].meanRtpJitter) * 1000 || 0;
  audioReceiver.streams[0].common.rtpJitter = audioReceiver.streams[0].common.maxRtpJitter;

  // Fec packets do come in as part of the FEC only for audio
  const fecRecovered = (statsResults[mediaType][sendrecvType].fecPacketsReceived - lastMqaDataSent[mediaType][sendrecvType].fecPacketsReceived) - (statsResults[mediaType][sendrecvType].fecPacketsDiscarded - lastMqaDataSent[mediaType][sendrecvType].fecPacketsDiscarded);

  audioReceiver.streams[0].common.rtpEndToEndLost = (statsResults[mediaType][sendrecvType].totalPacketsLost - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLost) - fecRecovered || 0;

  audioReceiver.streams[0].common.framesDropped = statsResults[mediaType][sendrecvType].totalSamplesDecoded - lastMqaDataSent[mediaType][sendrecvType].totalSamplesDecoded || 0;
  audioReceiver.streams[0].common.renderedFrameRate = audioReceiver.streams[0].common.framesDropped * 100 / 60 || 0;
  audioReceiver.streams[0].common.framesReceived = statsResults[mediaType][sendrecvType].totalSamplesReceived - lastMqaDataSent[mediaType][sendrecvType].totalSamplesReceived || 0;
  audioReceiver.streams[0].common.concealedFrames = statsResults[mediaType][sendrecvType].concealedSamples - lastMqaDataSent[mediaType][sendrecvType].concealedSamples || 0;
  audioReceiver.streams[0].common.receivedBitrate = (statsResults[mediaType][sendrecvType].totalBytesReceived - lastMqaDataSent[mediaType][sendrecvType].totalBytesReceived) * 8 / 60 || 0;

  audioReceiver.common.rtpBitrate = audioReceiver.streams[0].common.receivedBitrate;
};


export const getAudioSenderMqa = ({audioSender, statsResults, lastMqaDataSent}) => {
  const mediaType = STATS.AUDIO_CORRELATE;
  const sendrecvType = STATS.SEND_DIRECTION;

  audioSender.common.common.direction = statsResults[mediaType].direction;
  audioSender.common.transportType = statsResults.connectionType.local.transport[0];

  audioSender.common.maxRemoteJitter = max(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;
  audioSender.common.meanRemoteJitter = mean(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;

  audioSender.common.rtpPackets = statsResults[mediaType][sendrecvType].totalPacketsSent - lastMqaDataSent[mediaType][sendrecvType].totalPacketsSent || 0;
  audioSender.streams[0].common.rtpPackets = audioSender.common.rtpPackets;
  // From candidate-pair
  audioSender.common.availableBitrate = statsResults[mediaType][sendrecvType].availableOutgoingBitrate || 0;
  // Calculate based on how much packets lost of received compated to how to the client sent

  const totalpacketsLostForaMin = statsResults[mediaType][sendrecvType].totalPacketsLostOnReceiver - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLostOnReceiver;

  audioSender.common.remoteLossRate = totalpacketsLostForaMin > 0 ? (totalpacketsLostForaMin * 100 / audioSender.common.rtpPackets) : 0; // This is the packets sent with in last min || 0;

  audioSender.common.maxRoundTripTime = max(statsResults[mediaType][sendrecvType].meanRoundTripTime) * 1000 || 0;
  audioSender.common.meanRoundTripTime = mean(statsResults[mediaType][sendrecvType].meanRoundTripTime) * 1000 || 0;
  audioSender.common.roundTripTime = audioSender.common.maxRoundTripTime;


  // Calculate the outgoing bitrate
  const totalBytesSentInaMin = statsResults[mediaType][sendrecvType].totalBytesSent - lastMqaDataSent[mediaType][sendrecvType].totalBytesSent;

  audioSender.streams[0].common.transmittedBitrate = totalBytesSentInaMin ? (totalBytesSentInaMin) * 8 / 60 : 0;
  audioSender.common.rtpBitrate = audioSender.streams[0].common.transmittedBitrate;


  audioSender.streams[0].transmittedKeyFrames = statsResults[mediaType][sendrecvType].totalKeyFramesEncoded - lastMqaDataSent[mediaType][sendrecvType].totalKeyFramesEncoded || 0;
  audioSender.streams[0].requestedKeyFrames = statsResults[mediaType][sendrecvType].totalFirCount - lastMqaDataSent[mediaType][sendrecvType].totalFirCount || 0;
};


export const getVideoReceiverMqa = ({
  videoReceiver, statsResults, lastMqaDataSent, isShareStream = false
}) => {
  const mediaType = isShareStream ? STATS.SHARE_CORRELATE : STATS.VIDEO_CORRELATE;
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  videoReceiver.common.common.direction = statsResults[mediaType].direction;
  videoReceiver.common.transportType = statsResults.connectionType.remote.transport[0];
  // collect the packets received for the last min
  videoReceiver.common.rtpPackets = statsResults[mediaType][sendrecvType].totalPacketsReceived - lastMqaDataSent[mediaType][sendrecvType].totalPacketsReceived || 0;
  videoReceiver.streams[0].common.rtpPackets = videoReceiver.common.rtpPackets;

  const totalPacketLoss = (statsResults[mediaType][sendrecvType].totalPacketsLost - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLost) || 0;

  // Hope by hop are numbers and not percentage so we compare on what we sent the last min
  // this is including packet lost
  videoReceiver.common.mediaHopByHopLost = totalPacketLoss;
  videoReceiver.common.rtpHopByHopLost = totalPacketLoss;

  // End to end packetloss is after recovery
  videoReceiver.streams[0].common.rtpEndToEndLost = totalPacketLoss;

  // calculate this values

  videoReceiver.common.maxRemoteJitter = max(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;
  videoReceiver.common.meanRemoteJitter = mean(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;

  videoReceiver.streams[0].common.rtpJitter = videoReceiver.common.maxRemoteJitter;
  // videoReceiver.streams[0].common.rtpJitter = (statsResults.resolutions[mediaType][sendrecvType].jitterBufferDelay - lastMqaDataSent.resolutions[mediaType][sendrecvType].jitterBufferDelay) / (statsResults.resolutions[mediaType][sendrecvType].jitterBufferEmittedCount - lastMqaDataSent.resolutions[mediaType][sendrecvType].jitterBufferEmittedCount) * 1000 || 0;

  // Calculate the outgoing bitrate
  const totalBytesReceivedInaMin = statsResults[mediaType][sendrecvType].totalBytesReceived - lastMqaDataSent[mediaType][sendrecvType].totalBytesReceived;

  videoReceiver.streams[0].common.receivedBitrate = totalBytesReceivedInaMin ? (totalBytesReceivedInaMin) * 8 / 60 : 0;
  videoReceiver.common.rtpBitrate = videoReceiver.streams[0].common.receivedBitrate;

  // From tracks //TODO: calculate a proper one
  const totalFrameReceivedInaMin = statsResults.resolutions[mediaType][sendrecvType].framesReceived - lastMqaDataSent.resolutions[mediaType][sendrecvType].framesReceived;
  const totalFrameDecodedInaMin = statsResults.resolutions[mediaType][sendrecvType].framesDecoded - lastMqaDataSent.resolutions[mediaType][sendrecvType].framesDecoded;

  videoReceiver.streams[0].common.receivedFrameRate = totalFrameReceivedInaMin ? totalFrameReceivedInaMin * 100 / 60 : 0;
  videoReceiver.streams[0].common.renderedFrameRate = totalFrameDecodedInaMin ? totalFrameDecodedInaMin * 100 / 60 : 0;

  videoReceiver.streams[0].common.framesDropped = statsResults.resolutions[mediaType][sendrecvType].framesDropped - lastMqaDataSent.resolutions[mediaType][sendrecvType].framesDropped;
  videoReceiver.streams[0].receivedHeight = statsResults.resolutions[mediaType][sendrecvType].height;
  videoReceiver.streams[0].receivedWidth = statsResults.resolutions[mediaType][sendrecvType].width;
  videoReceiver.streams[0].receivedFrameSize = statsResults.resolutions[mediaType][sendrecvType].height * statsResults.resolutions[mediaType][sendrecvType].height / 256;

  videoReceiver.streams[0].receivedKeyFrames = statsResults[mediaType][sendrecvType].keyFramesDecoded - lastMqaDataSent[mediaType][sendrecvType].keyFramesDecoded || 0;
  videoReceiver.streams[0].requestedKeyFrames = statsResults[mediaType][sendrecvType].totalPliCount - lastMqaDataSent[mediaType][sendrecvType].totalPliCount || 0;
};

export const getVideoSenderMqa = ({
  videoSender, statsResults, lastMqaDataSent, isShareStream = false
}) => {
  const mediaType = isShareStream ? STATS.SHARE_CORRELATE : STATS.VIDEO_CORRELATE;
  const sendrecvType = STATS.SEND_DIRECTION;

  videoSender.common.common.direction = statsResults[mediaType].direction;
  videoSender.common.transportType = statsResults.connectionType.local.transport[0];

  videoSender.common.maxRemoteJitter = max(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;
  videoSender.common.meanRemoteJitter = mean(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;


  videoSender.common.rtpPackets = statsResults[mediaType][sendrecvType].totalPacketsSent - lastMqaDataSent[mediaType][sendrecvType].totalPacketsSent || 0;
  videoSender.common.availableBitrate = statsResults[mediaType][sendrecvType].availableOutgoingBitrate || 0;
  // Calculate based on how much packets lost of received compated to how to the client sent

  const totalpacketsLostForaMin = statsResults[mediaType][sendrecvType].totalPacketsLostOnReceiver - lastMqaDataSent[mediaType][sendrecvType].totalPacketsLostOnReceiver;

  videoSender.common.remoteLossRate = totalpacketsLostForaMin > 0 ? (totalpacketsLostForaMin) * 100 / (videoSender.common.rtpPackets + totalpacketsLostForaMin) : 0; // This is the packets sent with in last min || 0;

  videoSender.common.maxRoundTripTime = max(statsResults[mediaType][sendrecvType].meanRoundTripTime) * 1000 || 0;
  videoSender.common.meanRoundTripTime = mean(statsResults[mediaType][sendrecvType].meanRoundTripTime) * 1000 || 0;
  videoSender.common.roundTripTime = videoSender.common.maxRoundTripTime;

  videoSender.streams[0].common.rtpPackets = statsResults[mediaType][sendrecvType].totalPacketsSent - lastMqaDataSent[mediaType][sendrecvType].totalPacketsSent || 0;

  // Calculate the outgoing bitrate
  const totalBytesSentInaMin = statsResults[mediaType][sendrecvType].totalBytesSent - lastMqaDataSent[mediaType][sendrecvType].totalBytesSent;

  videoSender.streams[0].common.transmittedBitrate = totalBytesSentInaMin ? (totalBytesSentInaMin) * 8 / 60 : 0;

  videoSender.common.rtpBitrate = videoSender.streams[0].common.transmittedBitrate;


  videoSender.streams[0].transmittedKeyFrames = statsResults[mediaType][sendrecvType].totalKeyFramesEncoded - lastMqaDataSent[mediaType][sendrecvType].totalKeyFramesEncoded || 0;
  videoSender.streams[0].requestedKeyFrames = statsResults[mediaType][sendrecvType].totalFirCount - lastMqaDataSent[mediaType][sendrecvType].totalFirCount || 0;

  // From tracks //TODO: calculate a proper one
  const totalFrameSentInaMin = statsResults.resolutions[mediaType][sendrecvType].framesSent - (lastMqaDataSent.resolutions[mediaType][sendrecvType].framesSent || 0);

  videoSender.streams[0].common.transmittedFrameRate = totalFrameSentInaMin ? totalFrameSentInaMin * 100 / 60 : 0;
  videoSender.streams[0].transmittedHeight = statsResults.resolutions[mediaType][sendrecvType].height;
  videoSender.streams[0].transmittedWidth = statsResults.resolutions[mediaType][sendrecvType].width;
  videoSender.streams[0].transmittedFrameSize = statsResults.resolutions[mediaType][sendrecvType].height * statsResults.resolutions[mediaType][sendrecvType].width / 254;
};
