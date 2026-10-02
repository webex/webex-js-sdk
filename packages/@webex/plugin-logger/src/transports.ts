/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import type {WebexLogRecordV1} from './log-record';

export interface LogTransport<RecordType = WebexLogRecordV1> {
  name: string;
  export(records: readonly RecordType[]): Promise<void>;
  shutdown?(): Promise<void>;
}

export type FlushResult = {
  exported: number;
  remaining: number;
};
