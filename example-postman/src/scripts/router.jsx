/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint react/react-in-jsx-scope: [0] */

import createBrowserHistory from 'history/lib/createBrowserHistory';
import {render} from 'react-dom';
import {Router, Route} from 'react-router';
import SparkApp from './app.jsx';

render((
  <Router history={createBrowserHistory()}>
    <Route component={SparkApp} path="/" />
  </Router>
), document.getElementById('main'));
