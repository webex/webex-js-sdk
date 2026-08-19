import type {ConsultTransferMediaType} from '../types';

const CONSULT_TRANSFER_CHANNELS: Record<ConsultTransferMediaType, string> = {
  telephony: 'TELEPHONY',
  chat: 'CHAT',
  social: 'SOCIAL_CHANNEL',
  email: 'EMAIL',
};

const isConsultTransferMediaType = (value: string): value is ConsultTransferMediaType =>
  Object.prototype.hasOwnProperty.call(CONSULT_TRANSFER_CHANNELS, value);

/**
 * Converts a public consult/transfer media type into the CMS channel token.
 * Runtime validation protects JavaScript callers before an RSQL filter is built.
 * @internal
 */
const getConsultTransferChannel = (mediaType: unknown): string => {
  const normalizedMediaType = typeof mediaType === 'string' ? mediaType.toLowerCase() : '';

  if (!isConsultTransferMediaType(normalizedMediaType)) {
    throw new TypeError('Unsupported consult/transfer media type');
  }

  return CONSULT_TRANSFER_CHANNELS[normalizedMediaType];
};

export default getConsultTransferChannel;
