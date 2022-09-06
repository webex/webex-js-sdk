/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-conversation'; // decrypt mercury activities
import '@webex/internal-plugin-mercury';

import {registerPlugin} from '@webex/webex-core';

import AttachmentActions from './attachmentActions';

registerPlugin('attachmentActions', AttachmentActions);

export default AttachmentActions;
