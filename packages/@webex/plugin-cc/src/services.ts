/**
 * @module Services
 * @packageDocumentation
 */

import TaskManager from './services/task/TaskManager';
import {ITask, AgentContact} from './services/task/types';
import AgentConfigService from './services/config';
import WebCallingService from './services/WebCallingService';
import CCPlugin from './cc';
import routingAgent from './services/agent';
import * as AgentTypes from './services/agent/types';

/** @category Services */
export {
  /** Contact Center Plugin main class */
  CCPlugin,
  /** Task Manager Service */
  TaskManager,
  /** Agent Configuration Service */
  AgentConfigService,
  /** Web Calling Service */
  WebCallingService,
  /**
   * Task Interface
   * @interface
   */
  type ITask,
  /**
   * Agent Contact Type
   * @interface
   */
  type AgentContact,
  /**
   * Agent Service
   * @public
   */
  routingAgent,
  /**
   * Agent Types
   * @public
   */
  AgentTypes,
};
