/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';

import {TASK_REGISTERED, TASK_UNREGISTERED} from './constants';

import EncryptHelper from './helpers/encrypt.helper';
import DecryptHelper from './helpers/decrypt.helper';

const Task = WebexPlugin.extend({
  namespace: 'Task',

  /**
   * registered value indicating events registration is successful
   * @instance
   * @type {Boolean}
   * @memberof Task
   */
  registered: false,

  /**
   * WebexPlugin initialize method. This triggers once Webex has completed its
   * initialization workflow.
   *
   * If the plugin is meant to perform startup actions, place them in this
   * `initialize()` method instead of the `constructor()` method.
   * @returns {void}
   */
  initialize() {
    // Used to perform actions after webex is fully qualified and ready for
    // operation.
  },

  /**
   * Explicitly sets up the Task plugin by registering
   * the device, connecting to mercury, and listening for events.
   * @returns {Promise}
   * @public
   * @memberof Task
   */
  register() {
    if (!this.webex.canAuthorize) {
      this.logger.error('Task->register#ERROR, Unable to register, SDK cannot authorize');

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      this.logger.info('Task->register#INFO, task plugin already registered');

      return Promise.resolve();
    }

    return this.webex.internal.device
      .register()
      .then(() => this.webex.internal.mercury.connect())
      .then(() => {
        this.listenForEvents();
        this.trigger(TASK_REGISTERED);
        this.registered = true;
      })
      .catch((error) => {
        this.logger.error(`Task->register#ERROR, Unable to register, ${error.message}`);

        return Promise.reject(error);
      });
  },

  /**
   * Explicitly tears down the task plugin by stops listening to task events
   *
   * @returns {Promise}
   * @public
   * @memberof Task
   */
  unregister() {
    if (!this.registered) {
      this.logger.info('Task->unregister#INFO, task plugin already unregistered');

      return Promise.resolve();
    }

    this.stopListeningForEvents();
    this.trigger(TASK_UNREGISTERED);
    this.registered = false;

    return Promise.resolve();
  },

  /**
   * registers for task events through mercury
   * @returns {undefined}
   * @private
   */
  listenForEvents() {},

  /**
   * unregisteres all the task events from mercury
   * @returns {undefined}
   * @private
   */
  stopListeningForEvents() {},

  /**
   * Retrieves a collection of tasks based on the request parameters
   * @param {Object} options
   * @param {String} options.orderBy
   * @param {Number} options.offset
   * @param {Number} options.limit
   * @returns {Promise} Resolves with an array of tasks
   */
  listMyTasks(options) {
    options = options || {};

    return this.webex
      .request({
        method: 'GET',
        service: 'raindrop',
        resource: 'tasks',
        qs: options || {},
      })
      .then((response) => {
        return DecryptHelper.decryptTasksResponse(this, response.body).then(() => response);
      });
  },

  /**
   * Retrieves a task based on the request parameters
   * @param {String} id Task ID
   * @returns {Promise} Resolves with an array of tasks
   */
  getTask(id) {
    return this.request({
      method: 'GET',
      service: 'raindrop',
      resource: `tasks/${id}`,
    }).then((response) => {
      return DecryptHelper.decryptTaskResponse(this, response.body).then(() => response);
    });
  },

  /**
   * Create task
   * @param {object} [data] task payload data
   * @returns {Promise} Resolves with creating task response
   * */
  createTask(data) {
    return EncryptHelper.encryptTaskRequest(this, data).then(() =>
      this.request({
        method: 'POST',
        service: 'raindrop',
        body: data,
        resource: 'tasks',
      }).then((response) => {
        return DecryptHelper.decryptTaskResponse(this, response.body).then(() => response);
      })
    );
  },

  /**
   * Update task
   * @param {string} [id] task id
   * @param {object} [data] task payload data
   * @returns {Promise} Resolves with updating task response
   * */
  updateTask(id, data) {
    return EncryptHelper.encryptTaskRequest(this, data).then(() =>
      this.request({
        method: 'PATCH',
        service: 'raindrop',
        body: data,
        resource: `tasks/${id}`,
      }).then((response) => {
        return DecryptHelper.decryptTaskResponse(this, response.body).then(() => response);
      })
    );
  },

  /**
   * Delete task
   * @param {string} [id] task id
   * @returns {Promise} Resolves with deleting task response
   * */
  deleteTask(id) {
    return this.request({
      method: 'DELETE',
      service: 'raindrop',
      resource: `tasks/${id}`,
    });
  },

  /**
   * Accept task
   * @param {string} [id] task id
   * @returns {Promise} Resolves with accepting task response
   * */
  acceptTask(id) {
    return this.request({
      method: 'POST',
      service: 'raindrop',
      resource: `tasks/${id}/accept`,
    }).then((response) => {
      return DecryptHelper.decryptTaskResponse(this, response.body).then(() => response);
    });
  },

  /**
   * Reject task
   * @param {string} [id] task id
   * @returns {Promise} Resolves with rejecting task response
   * */
  rejectTask(id) {
    return this.request({
      method: 'POST',
      service: 'raindrop',
      resource: `tasks/${id}/reject`,
    }).then((response) => {
      return DecryptHelper.decryptTaskResponse(this, response.body).then(() => response);
    });
  },
});

export default Task;
