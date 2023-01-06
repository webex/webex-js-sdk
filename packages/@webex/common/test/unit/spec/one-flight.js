/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import AmpState from 'ampersand-state';
import {makeStateDataType, oneFlight} from '@webex/common';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

describe('common', () => {
  describe('@oneFlight', () => {
    it('returns new promise on different function with undefined keyFactory', () => {
      const C = AmpState.extend({
        @oneFlight({keyFactory: (param1) => param1})
        funcC1(param1) {
          return new Promise((resolve) => {
            process.nextTick(() => {
              this.spy();
              resolve(param1);
            });
          });
        },

        @oneFlight({keyFactory: (param2) => param2})
        funcC2(param2) {
          return new Promise((resolve) => {
            this.spy();
            resolve(param2);
          });
        },

        spy() {
          return true;
        },
      });

      const c = new C();

      sinon.spy(c, 'spy');

      return Promise.all([c.funcC1(), c.funcC2()]).then(() => {
        assert.calledTwice(c.spy);
      });
    });

    it('returns existing promise on a function called twice with undefined keyFactory', () => {
      const C = AmpState.extend({
        @oneFlight({keyFactory: (param1) => param1})
        funcC1(param1) {
          return new Promise((resolve) => {
            process.nextTick(() => {
              this.spy();
              resolve(param1);
            });
          });
        },

        spy() {
          return true;
        },
      });

      const c = new C();

      sinon.spy(c, 'spy');

      return Promise.all([c.funcC1(), c.funcC1()]).then(() => {
        assert.calledOnce(c.spy);
      });
    });

    it('ensures a given function may only be invoked once until completion', () => {
      const C = AmpState.extend({
        @oneFlight
        funcC() {
          return new Promise((resolve) => {
            process.nextTick(() => {
              this.spy();
              resolve();
            });
          });
        },

        spy: sinon.spy(),
      });

      const c = new C();

      return Promise.all([c.funcC(), c.funcC()]).then(() => assert.calledOnce(c.spy));
    });

    it('handles complex event scenarios', () => {
      // This is an attempt to simulate a bug encountered by the webex web
      // client that has been, so far, difficult to reproduce in a controlled
      // environment

      // supertoken
      const D = AmpState.extend({
        props: {
          d1: 'number',
        },

        funcD() {
          return new Promise((resolve) => {
            process.nextTick(() => {
              resolve(new D());
            });
          });
        },
      });

      // authorization
      const C = AmpState.extend({
        dataTypes: {
          d: makeStateDataType(D, 'd').dataType,
        },

        props: {
          d: makeStateDataType(D, 'd').prop,
        },

        @oneFlight
        funcC() {
          return new Promise((resolve) => {
            const {d} = this;

            this.unset(['d1', 'd2', 'd3']);
            this.spy();
            resolve(
              d
                .funcD()
                .then((dd) => {
                  this.set('d1', dd);

                  return Promise.all([dd.funcD(), dd.funcD()]);
                })
                .then(([dd2, dd3]) => {
                  this.set({
                    d2: dd2,
                    d3: dd3,
                  });
                })
            );
          });
        },

        spy: sinon.spy(),
      });

      // credentials
      const B = AmpState.extend({
        dataTypes: {
          c: makeStateDataType(C, 'c').dataType,
        },

        props: {
          c: makeStateDataType(C, 'c').prop,
        },

        @oneFlight
        funcB1() {
          return new Promise((resolve) => {
            process.nextTick(() => resolve(this.funcB2()));
          });
        },

        @oneFlight
        funcB2() {
          return new Promise((resolve) => {
            process.nextTick(() => resolve(this.c.funcC()));
          });
        },
      });

      // webex
      const A = AmpState.extend({
        dataTypes: {
          b: makeStateDataType(B, 'b').dataType,
        },

        props: {
          b: makeStateDataType(B, 'b').prop,
        },

        @oneFlight
        funcA() {
          return this.b.funcB1();
        },
      });

      const d = new D();
      const c = new C({d});
      const b = new B({c});
      const a = new A({b});

      // propagate change events
      a.listenTo(a.b, 'change', (name, ...args) => {
        args.unshift('change:b');
        Reflect.apply(a.trigger, a, args);
      });

      a.listenTo(a, 'change:b', () => a.b.funcB1());
      a.funcA();
      a.b.c.d.d1 = 2;

      return new Promise((resolve) => {
        setTimeout(resolve, 500);
      }).then(() => assert.calledOnce(a.b.c.spy));
    });
  });
});
