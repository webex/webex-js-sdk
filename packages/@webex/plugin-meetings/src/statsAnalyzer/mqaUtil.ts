/* eslint-disable no-param-reassign, prefer-destructuring */

import {mean, max} from 'lodash';

import {MQA_INTERVAL, NOISE_REDUCTION_EFFECT_STATS, STATS, VIRTUAL_BACKGROUND_EFFECT_STATS} from '../constants';

/**
 * Get the totals of a certain value from a certain media type.
 *
 * @param {object} stats - The large stats object.
 * @param {string} sendrecvType - "send" or "recv".
 * @param {string} baseMediaType - audio or video _and_ share or non-share.
 * @param {string} value - The value we want to get the totals of.
 * @returns {number}
 */
const getTotalValueFromBaseType = (
  stats: object,
  sendrecvType: string,
  baseMediaType: string,
  value: string
): number =>
  Object.keys(stats)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc + (stats[mt]?.[sendrecvType]?.[value] || 0), 0);

export const getAudioReceiverMqa = ({
  audioReceiver,
  statsResults,
  lastMqaDataSent,
  baseMediaType,
  isMultistream,
}) => {
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  const getLastTotalValue = (value: string) =>
    getTotalValueFromBaseType(lastMqaDataSent, sendrecvType, baseMediaType, value);
  const getTotalValue = (value: string) =>
    getTotalValueFromBaseType(statsResults, sendrecvType, baseMediaType, value);

  const lastPacketsReceived = getLastTotalValue('totalPacketsReceived');
  const lastPacketsLost = getLastTotalValue('totalPacketsLost');
  const lastBytesReceived = getLastTotalValue('totalBytesReceived');
  const lastFecPacketsReceived = getLastTotalValue('fecPacketsReceived');
  const lastFecPacketsDiscarded = getLastTotalValue('fecPacketsDiscarded');

  const totalPacketsReceived = getTotalValue('totalPacketsReceived');
  const packetsLost = getTotalValue('totalPacketsLost');
  const totalBytesReceived = getTotalValue('totalBytesReceived');
  const totalFecPacketsReceived = getTotalValue('fecPacketsReceived');
  const totalFecPacketsDiscarded = getTotalValue('fecPacketsDiscarded');

  audioReceiver.common.common.direction =
    statsResults[Object.keys(statsResults).find((mediaType) => mediaType.includes(baseMediaType))]
      ?.direction || 'inactive';
  audioReceiver.common.common.isMain = !baseMediaType.includes('-share');
  audioReceiver.common.common.multistreamEnabled = isMultistream;
  audioReceiver.common.transportType = statsResults.connectionType.local.transport;

  // add rtpPacket info inside common as also for call analyzer
  audioReceiver.common.rtpPackets = totalPacketsReceived - lastPacketsReceived;

  // Hop by hop are numbers and not percentage so we compare on what we sent the last min
  // collect the packets received for the last min
  const totalPacketsLost = packetsLost - lastPacketsLost;
  audioReceiver.common.mediaHopByHopLost = totalPacketsLost;
  audioReceiver.common.rtpHopByHopLost = totalPacketsLost;

  const fecRecovered =
    totalFecPacketsReceived -
    lastFecPacketsReceived -
    (totalFecPacketsDiscarded - lastFecPacketsDiscarded);
  audioReceiver.common.fecPackets = totalFecPacketsReceived - lastFecPacketsReceived;

  audioReceiver.common.rtpRecovered = fecRecovered;

  audioReceiver.common.rtpBitrate = ((totalBytesReceived - lastBytesReceived) * 8) / 60 || 0;
};

export const getAudioReceiverStreamMqa = ({
  audioReceiverStream,
  statsResults,
  lastMqaDataSent,
  mediaType,
}) => {
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  const lastPacketsDecoded = lastMqaDataSent[mediaType]?.[sendrecvType].totalSamplesDecoded || 0;
  const lastSamplesReceived = lastMqaDataSent[mediaType]?.[sendrecvType].totalSamplesReceived || 0;
  const lastConcealedSamples = lastMqaDataSent[mediaType]?.[sendrecvType].concealedSamples || 0;
  const lastBytesReceived = lastMqaDataSent[mediaType]?.[sendrecvType].totalBytesReceived || 0;
  const lastFecPacketsReceived = lastMqaDataSent[mediaType]?.[sendrecvType].fecPacketsReceived || 0;
  const lastFecPacketsDiscarded =
    lastMqaDataSent[mediaType]?.[sendrecvType].fecPacketsDiscarded || 0;
  const lastPacketsReceived = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsReceived || 0;
  const lastPacketsLost = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsLost || 0;

  const {csi} = statsResults[mediaType];
  if (csi && !audioReceiverStream.common.csi.includes(csi)) {
    audioReceiverStream.common.csi.push(csi);
  }

  audioReceiverStream.common.rtpPackets =
    statsResults[mediaType][sendrecvType].totalPacketsReceived - lastPacketsReceived || 0;

  audioReceiverStream.common.maxRtpJitter =
    // @ts-ignore
    max(statsResults[mediaType][sendrecvType].meanRtpJitter) * 1000 || 0;
  audioReceiverStream.common.meanRtpJitter =
    mean(statsResults[mediaType][sendrecvType].meanRtpJitter) * 1000 || 0;
  audioReceiverStream.common.rtpJitter = audioReceiverStream.common.maxRtpJitter;

  // Fec packets do come in as part of the FEC only for audio
  const fecRecovered =
    statsResults[mediaType][sendrecvType].fecPacketsReceived -
    lastFecPacketsReceived -
    (statsResults[mediaType][sendrecvType].fecPacketsDiscarded - lastFecPacketsDiscarded);

  audioReceiverStream.common.rtpEndToEndLost =
    statsResults[mediaType][sendrecvType].totalPacketsLost - lastPacketsLost - fecRecovered || 0;

  audioReceiverStream.common.framesDropped =
    statsResults[mediaType][sendrecvType].totalSamplesDecoded - lastPacketsDecoded || 0;
  audioReceiverStream.common.renderedFrameRate =
    (audioReceiverStream.common.framesDropped * 100) / 60 || 0;

  audioReceiverStream.common.framesReceived =
    statsResults[mediaType][sendrecvType].totalSamplesReceived - lastSamplesReceived || 0;
  audioReceiverStream.common.concealedFrames =
    statsResults[mediaType][sendrecvType].concealedSamples - lastConcealedSamples || 0;
  audioReceiverStream.common.receivedBitrate =
    ((statsResults[mediaType][sendrecvType].totalBytesReceived - lastBytesReceived) * 8) / 60 || 0;
};

export const getAudioSenderMqa = ({
  audioSender,
  statsResults,
  lastMqaDataSent,
  baseMediaType,
  isMultistream,
}) => {
  const sendrecvType = STATS.SEND_DIRECTION;

  const getLastTotalValue = (value: string) =>
    getTotalValueFromBaseType(lastMqaDataSent, sendrecvType, baseMediaType, value);
  const getTotalValue = (value: string) =>
    getTotalValueFromBaseType(statsResults, sendrecvType, baseMediaType, value);

  const lastPacketsSent = getLastTotalValue('totalPacketsSent');
  const lastPacketsLostTotal = getLastTotalValue('totalPacketsLostOnReceiver');

  const totalPacketsLostOnReceiver = getTotalValue('totalPacketsLostOnReceiver');
  const totalPacketsSent = getTotalValue('totalPacketsSent');

  const meanRemoteJitter = Object.keys(statsResults)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc.concat(statsResults[mt][sendrecvType].meanRemoteJitter), []);
  const meanRoundTripTime = Object.keys(statsResults)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc.concat(statsResults[mt][sendrecvType].meanRoundTripTime), []);

  audioSender.common.common.direction =
    statsResults[Object.keys(statsResults).find((mediaType) => mediaType.includes(baseMediaType))]
      ?.direction || 'inactive';
  audioSender.common.common.isMain = !baseMediaType.includes('-share');
  audioSender.common.common.multistreamEnabled = isMultistream;
  audioSender.common.transportType = statsResults.connectionType.local.transport;

  audioSender.common.maxRemoteJitter = max(meanRemoteJitter) * 1000 || 0;
  audioSender.common.meanRemoteJitter = mean(meanRemoteJitter) * 1000 || 0;

  audioSender.common.rtpPackets = totalPacketsSent - lastPacketsSent || 0;
  // audioSender.streams[0].common.rtpPackets = audioSender.common.rtpPackets;
  // From candidate-pair
  audioSender.common.availableBitrate = getTotalValueFromBaseType(
    statsResults,
    sendrecvType,
    baseMediaType,
    'availableOutgoingBitrate'
  );

  // Calculate based on how much packets lost of received compated to how to the client sent
  const totalPacketsLostForaMin = totalPacketsLostOnReceiver - lastPacketsLostTotal;
  audioSender.common.maxRemoteLossRate =
    totalPacketsSent - lastPacketsSent > 0
      ? (totalPacketsLostForaMin * 100) / (totalPacketsSent - lastPacketsSent)
      : 0; // This is the packets sent with in last min

  audioSender.common.maxRoundTripTime = max(meanRoundTripTime) * 1000 || 0;
  audioSender.common.meanRoundTripTime = mean(meanRoundTripTime) * 1000 || 0;
  audioSender.common.roundTripTime = audioSender.common.maxRoundTripTime;

  // Calculate the outgoing bitrate
  const totalBytesSentInaMin =
    getTotalValueFromBaseType(statsResults, sendrecvType, baseMediaType, 'totalBytesSent') -
    getTotalValueFromBaseType(lastMqaDataSent, sendrecvType, baseMediaType, 'totalBytesSent');

  audioSender.common.rtpBitrate = totalBytesSentInaMin ? (totalBytesSentInaMin * 8) / 60 : 0;
};

export const getAudioSenderStreamMqa = ({
  audioSenderStream,
  statsResults,
  lastMqaDataSent,
  mediaType,
}) => {
  const sendrecvType = STATS.SEND_DIRECTION;

  const lastBytesSent = lastMqaDataSent[mediaType]?.[sendrecvType].totalBytesSent || 0;
  const lastFramesEncoded = lastMqaDataSent[mediaType]?.[sendrecvType].totalKeyFramesEncoded || 0;
  const lastFirCount = lastMqaDataSent[mediaType]?.[sendrecvType].totalFirCount || 0;
  const lastPacketsSent = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsSent || 0;

  const {csi} = statsResults[mediaType];
  if (csi && !audioSenderStream.common.csi.includes(csi)) {
    audioSenderStream.common.csi.push(csi);
  }

  audioSenderStream.common.rtpPackets =
    statsResults[mediaType][sendrecvType].totalPacketsSent - lastPacketsSent || 0;

  const totalBytesSentInaMin = statsResults[mediaType][sendrecvType].totalBytesSent - lastBytesSent;
  audioSenderStream.common.transmittedBitrate = totalBytesSentInaMin
    ? (totalBytesSentInaMin * 8) / 60
    : 0;

  audioSenderStream.transmittedKeyFrames =
    statsResults[mediaType][sendrecvType].totalKeyFramesEncoded - lastFramesEncoded || 0;
  audioSenderStream.requestedKeyFrames =
    statsResults[mediaType][sendrecvType].totalFirCount - lastFirCount || 0;

  audioSenderStream.requestedBitrate = statsResults[mediaType][sendrecvType].requestedBitrate || 0;

  // Get last used effect in this interval
  const lastUsedEffect = statsResults[mediaType][sendrecvType]?.effect;
  let mode = NOISE_REDUCTION_EFFECT_STATS.NONE;
  if (lastUsedEffect?.mode in NOISE_REDUCTION_EFFECT_STATS) {
    mode = NOISE_REDUCTION_EFFECT_STATS[lastUsedEffect.mode];
  }
  audioSenderStream.backgroundNoiseReductionMode = mode;
};

export const getVideoReceiverMqa = ({
  videoReceiver,
  statsResults,
  lastMqaDataSent,
  baseMediaType,
  isMultistream,
}) => {
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  const getLastTotalValue = (value: string) =>
    getTotalValueFromBaseType(lastMqaDataSent, sendrecvType, baseMediaType, value);
  const getTotalValue = (value: string) =>
    getTotalValueFromBaseType(statsResults, sendrecvType, baseMediaType, value);

  const lastPacketsReceived = getLastTotalValue('totalPacketsReceived');
  const lastPacketsLost = getLastTotalValue('totalPacketsLost');
  const lastBytesReceived = getLastTotalValue('totalBytesReceived');

  const lastRtxPacketsReceived = getLastTotalValue('totalRtxPacketsReceived');
  const lastRtxBytesReceived = getLastTotalValue('totalRtxBytesReceived');

  const packetsLost = getTotalValue('totalPacketsLost');
  const totalPacketsReceived = getTotalValue('totalPacketsReceived');
  const totalBytesReceived = getTotalValue('totalBytesReceived');

  const totalRtxPacketsReceived = getTotalValue('totalRtxPacketsReceived');
  const totalRtxBytesReceived = getTotalValue('totalRtxBytesReceived');

  const meanRemoteJitter = Object.keys(statsResults)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc.concat(statsResults[mt][sendrecvType].meanRemoteJitter), []);

  videoReceiver.common.common.direction =
    statsResults[Object.keys(statsResults).find((mediaType) => mediaType.includes(baseMediaType))]
      ?.direction || 'inactive';
  videoReceiver.common.common.multistreamEnabled = isMultistream;
  videoReceiver.common.common.isMain = !baseMediaType.includes('-share');
  videoReceiver.common.transportType = statsResults.connectionType.local.transport;

  // collect the packets received for the last min
  videoReceiver.common.rtpPackets = totalPacketsReceived - lastPacketsReceived || 0;

  // Hop by hop are numbers and not percentage so we compare on what we sent the last min
  // this is including packet lost
  const totalPacketsLost = packetsLost - lastPacketsLost;
  videoReceiver.common.mediaHopByHopLost = totalPacketsLost;
  videoReceiver.common.rtpHopByHopLost = totalPacketsLost;

  // calculate this values
  videoReceiver.common.maxRemoteJitter = max(meanRemoteJitter) * 1000 || 0;
  videoReceiver.common.meanRemoteJitter = mean(meanRemoteJitter) * 1000 || 0;

  // Calculate the outgoing bitrate
  const totalBytesReceivedInaMin = totalBytesReceived - lastBytesReceived;
  const totalRtxBytesReceivedInaMin = totalRtxBytesReceived - lastRtxBytesReceived;

  videoReceiver.common.rtpBitrate = totalBytesReceivedInaMin
    ? (totalBytesReceivedInaMin * 8) / 60
    : 0;
  videoReceiver.common.rtxPackets = totalRtxPacketsReceived - lastRtxPacketsReceived;
  videoReceiver.common.rtxBitrate = totalRtxBytesReceivedInaMin
    ? (totalRtxBytesReceivedInaMin * 8) / 60
    : 0;
};

export const getVideoReceiverStreamMqa = ({
  videoReceiverStream,
  statsResults,
  lastMqaDataSent,
  mediaType,
}) => {
  const sendrecvType = STATS.RECEIVE_DIRECTION;

  const lastPacketsReceived = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsReceived || 0;
  const lastPacketsLost = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsLost || 0;
  const lastBytesReceived = lastMqaDataSent[mediaType]?.[sendrecvType].totalBytesReceived || 0;
  const lastFramesReceived = lastMqaDataSent[mediaType]?.[sendrecvType].framesReceived || 0;
  const lastFramesDecoded = lastMqaDataSent[mediaType]?.[sendrecvType].framesDecoded || 0;
  const lastFramesDropped = lastMqaDataSent[mediaType]?.[sendrecvType].framesDropped || 0;
  const lastKeyFramesDecoded = lastMqaDataSent[mediaType]?.[sendrecvType].keyFramesDecoded || 0;
  const lastPliCount = lastMqaDataSent[mediaType]?.[sendrecvType].totalPliCount || 0;

  const {csi} = statsResults[mediaType];
  if (csi && !videoReceiverStream.common.csi.includes(csi)) {
    videoReceiverStream.common.csi.push(csi);
  }

  videoReceiverStream.common.rtpPackets =
    statsResults[mediaType][sendrecvType].totalPacketsReceived - lastPacketsReceived || 0;

  const totalPacketLoss =
    statsResults[mediaType][sendrecvType].totalPacketsLost - lastPacketsLost || 0;

  // End to end packetloss is after recovery
  videoReceiverStream.common.rtpEndToEndLost = totalPacketLoss;

  videoReceiverStream.common.rtpJitter =
    // @ts-ignore
    max(statsResults[mediaType][sendrecvType].meanRemoteJitter) * 1000 || 0;

  const totalBytesReceivedInaMin =
    statsResults[mediaType][sendrecvType].totalBytesReceived - lastBytesReceived;
  videoReceiverStream.common.receivedBitrate = totalBytesReceivedInaMin
    ? (totalBytesReceivedInaMin * 8) / 60
    : 0;

  const totalFrameReceivedInaMin =
    statsResults[mediaType][sendrecvType].framesReceived - lastFramesReceived;
  const totalFrameDecodedInaMin =
    statsResults[mediaType][sendrecvType].framesDecoded - lastFramesDecoded;

  videoReceiverStream.common.receivedFrameRate = Math.round(
    totalFrameReceivedInaMin ? totalFrameReceivedInaMin / 60 : 0
  );
  videoReceiverStream.common.renderedFrameRate = Math.round(
    totalFrameDecodedInaMin ? totalFrameDecodedInaMin / 60 : 0
  );

  videoReceiverStream.common.framesDropped =
    statsResults[mediaType][sendrecvType].framesDropped - lastFramesDropped || 0;
  videoReceiverStream.receivedHeight = statsResults[mediaType][sendrecvType].height || 0;
  videoReceiverStream.receivedWidth = statsResults[mediaType][sendrecvType].width || 0;
  videoReceiverStream.receivedFrameSize =
    (videoReceiverStream.receivedHeight * videoReceiverStream.receivedWidth) / 256;

  videoReceiverStream.receivedKeyFrames =
    statsResults[mediaType][sendrecvType].keyFramesDecoded - lastKeyFramesDecoded || 0;
  videoReceiverStream.requestedKeyFrames =
    statsResults[mediaType][sendrecvType].totalPliCount - lastPliCount || 0;

  videoReceiverStream.isActiveSpeaker =
    statsResults[mediaType][sendrecvType].isActiveSpeaker ||
    ((statsResults[mediaType][sendrecvType].lastActiveSpeakerTimestamp ?? 0) > 0 &&
      performance.now() +
        performance.timeOrigin -
        (statsResults[mediaType][sendrecvType].lastActiveSpeakerTimestamp ?? 0) <
        MQA_INTERVAL);
};

export const getVideoSenderMqa = ({
  videoSender,
  statsResults,
  lastMqaDataSent,
  baseMediaType,
  isMultistream,
}) => {
  const sendrecvType = STATS.SEND_DIRECTION;

  const getLastTotalValue = (value: string) =>
    getTotalValueFromBaseType(lastMqaDataSent, sendrecvType, baseMediaType, value);
  const getTotalValue = (value: string) =>
    getTotalValueFromBaseType(statsResults, sendrecvType, baseMediaType, value);

  const lastPacketsSent = getLastTotalValue('totalPacketsSent');
  const lastBytesSent = getLastTotalValue('totalBytesSent');
  const lastPacketsLostTotal = getLastTotalValue('totalPacketsLostOnReceiver');
  const lastRtxPacketsSent = getLastTotalValue('totalRtxPacketsSent');
  const lastRtxBytesSent = getLastTotalValue('totalRtxBytesSent');

  const totalPacketsLostOnReceiver = getTotalValue('totalPacketsLostOnReceiver');
  const totalPacketsSent = getTotalValue('totalPacketsSent');
  const totalBytesSent = getTotalValue('totalBytesSent');
  const availableOutgoingBitrate = getTotalValue('availableOutgoingBitrate');
  const totalRtxPacketsSent = getTotalValue('totalRtxPacketsSent');
  const totalRtxBytesSent = getTotalValue('totalRtxBytesSent');

  videoSender.common.common.direction =
    statsResults[Object.keys(statsResults).find((mediaType) => mediaType.includes(baseMediaType))]
      ?.direction || 'inactive';
  videoSender.common.common.multistreamEnabled = isMultistream;
  videoSender.common.common.isMain = !baseMediaType.includes('-share');
  videoSender.common.transportType = statsResults.connectionType.local.transport;

  const meanRemoteJitter = Object.keys(statsResults)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc.concat(statsResults[mt][sendrecvType].meanRemoteJitter), []);
  const meanRoundTripTime = Object.keys(statsResults)
    .filter((mt) => mt.includes(baseMediaType))
    .reduce((acc, mt) => acc.concat(statsResults[mt][sendrecvType].meanRoundTripTime), []);

  // @ts-ignore
  videoSender.common.maxRemoteJitter = max(meanRemoteJitter) * 1000 || 0;
  videoSender.common.meanRemoteJitter = mean(meanRemoteJitter) * 1000 || 0;

  videoSender.common.rtpPackets = totalPacketsSent - lastPacketsSent;
  videoSender.common.availableBitrate = availableOutgoingBitrate;

  // Calculate based on how much packets lost of received compated to how to the client sent
  const totalPacketsLostForaMin = totalPacketsLostOnReceiver - lastPacketsLostTotal;

  videoSender.common.maxRemoteLossRate =
    totalPacketsSent - lastPacketsSent > 0
      ? (totalPacketsLostForaMin * 100) / (totalPacketsSent - lastPacketsSent)
      : 0; // This is the packets sent with in last min || 0;

  videoSender.common.maxRoundTripTime = max(meanRoundTripTime) * 1000 || 0;
  videoSender.common.meanRoundTripTime = mean(meanRoundTripTime) * 1000 || 0;
  videoSender.common.roundTripTime = videoSender.common.maxRoundTripTime;

  // Calculate the outgoing bitrate
  const totalBytesSentInaMin = totalBytesSent - lastBytesSent;
  const totalRtxBytesSentInaMin = totalRtxBytesSent - lastRtxBytesSent;

  videoSender.common.rtpBitrate = totalBytesSentInaMin ? (totalBytesSentInaMin * 8) / 60 : 0;
  videoSender.common.rtxPackets = totalRtxPacketsSent - lastRtxPacketsSent;
  videoSender.common.rtxBitrate = totalRtxBytesSentInaMin ? (totalRtxBytesSentInaMin * 8) / 60 : 0;
};

export const getVideoSenderStreamMqa = ({
  videoSenderStream,
  statsResults,
  lastMqaDataSent,
  mediaType,
}) => {
  const sendrecvType = STATS.SEND_DIRECTION;

  const lastPacketsSent = lastMqaDataSent[mediaType]?.[sendrecvType].totalPacketsSent || 0;
  const lastBytesSent = lastMqaDataSent[mediaType]?.[sendrecvType].totalBytesSent || 0;
  const lastKeyFramesEncoded =
    lastMqaDataSent[mediaType]?.[sendrecvType].totalKeyFramesEncoded || 0;
  const lastFirCount = lastMqaDataSent[mediaType]?.[sendrecvType].totalFirCount || 0;
  const lastFramesSent = lastMqaDataSent[mediaType]?.[sendrecvType].framesSent || 0;

  const {csi} = statsResults[mediaType];
  if (csi && !videoSenderStream.common.csi.includes(csi)) {
    videoSenderStream.common.csi.push(csi);
  }

  videoSenderStream.common.rtpPackets =
    statsResults[mediaType][sendrecvType].totalPacketsSent - lastPacketsSent || 0;

  // Calculate the outgoing bitrate
  const totalBytesSentInaMin = statsResults[mediaType][sendrecvType].totalBytesSent - lastBytesSent;

  videoSenderStream.common.transmittedBitrate = totalBytesSentInaMin
    ? (totalBytesSentInaMin * 8) / 60
    : 0;

  videoSenderStream.transmittedKeyFrames =
    statsResults[mediaType][sendrecvType].totalKeyFramesEncoded - lastKeyFramesEncoded || 0;
  videoSenderStream.requestedKeyFrames =
    statsResults[mediaType][sendrecvType].totalFirCount - lastFirCount || 0;

  // From tracks //TODO: calculate a proper one
  const totalFrameSentInaMin =
    statsResults[mediaType][sendrecvType].framesSent - (lastFramesSent || 0);

  videoSenderStream.common.transmittedFrameRate = Math.round(
    totalFrameSentInaMin ? totalFrameSentInaMin / 60 : 0
  );
  videoSenderStream.transmittedHeight = statsResults[mediaType][sendrecvType].height || 0;
  videoSenderStream.transmittedWidth = statsResults[mediaType][sendrecvType].width || 0;
  videoSenderStream.transmittedFrameSize =
    (videoSenderStream.transmittedHeight * videoSenderStream.transmittedWidth) / 256;
  videoSenderStream.requestedBitrate = statsResults[mediaType][sendrecvType].requestedBitrate || 0;
  videoSenderStream.requestedFrameSize =
    statsResults[mediaType][sendrecvType].requestedFrameSize || 0;

  // Get last used effect in this interval
  const lastUsedEffect = statsResults[mediaType][sendrecvType]?.effect;
  let mode = VIRTUAL_BACKGROUND_EFFECT_STATS.NONE;
  if (lastUsedEffect?.mode in VIRTUAL_BACKGROUND_EFFECT_STATS) {
    mode = VIRTUAL_BACKGROUND_EFFECT_STATS[lastUsedEffect.mode];
  }
  videoSenderStream.backgroundNoiseReductionMode = mode;
};

/**
 * Checks if stream stats should be updated based on request status and elapsed time.
 *
 * @param {Object} statsResults - Stats results object.
 * @param {string} mediaType - Media type (e.g., 'audio', 'video').
 * @param {string} direction - Stats direction (e.g., 'send', 'receive').
 * @returns {boolean} Whether stats should be updated.
 */
export const isStreamRequested = (
  statsResults: any,
  mediaType: string,
  direction: string
): boolean => {
  const now = performance.timeOrigin + performance.now();
  const lastUpdateTimestamp = statsResults[mediaType][direction]?.lastRequestedUpdateTimestamp;
  const isRequested = statsResults[mediaType][direction]?.isRequested;

  return isRequested || (lastUpdateTimestamp && now - lastUpdateTimestamp < MQA_INTERVAL);
};
