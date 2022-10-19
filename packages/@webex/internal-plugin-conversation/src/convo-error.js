/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Exception} from '@webex/common';

/**
 * General conversation error
 */
export class ConversationError extends Exception {}

/**
 * InvalidUserCreation thrown when failed to create conversation with invalid user
 */
export class InvalidUserCreation extends ConversationError {}
