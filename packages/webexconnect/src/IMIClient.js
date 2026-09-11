const JS_SDK_VERSION = "1.9.0.001";
if (typeof Function.prototype.bind === "undefined") {
  Function.prototype.bind = function (thisArg) {
    var fn = this,
      slice = Array.prototype.slice,
      args = slice.call(arguments, 1);
    return function () {
      return fn.apply(thisArg, args.concat(slice.call(arguments)));
    };
  };
}

Date.prototype.toUTCArray = function () {
  var D = this;
  return [
    D.getUTCFullYear(),
    D.getUTCMonth(),
    D.getUTCDate(),
    D.getUTCHours(),
    D.getUTCMinutes(),
    D.getUTCSeconds(),
  ];
};

Date.prototype.toISO = function () {
  var tem,
    A = this.toUTCArray(),
    i = 0;
  A[1] += 1;
  while (i++ < 7) {
    tem = A[i];
    if (tem < 10) A[i] = "0" + tem;
  }
  return A.splice(0, 3).join("-") + "T" + A.join(":");
};

function IMIClientStorage(namespace) {
  "use strict";
  var _db = {
    namespace: namespace,
    _get: function (key) {
      return localStorage.getItem(namespace + key);
    },
    get: function (key) {
      var obj = null;
      var raw = this._get(key);
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        IMI.log("caught exception in _db.get(" + key + "): " + e);
      }
      return obj;
    },
    _set: function (key, value) {
      localStorage.setItem(namespace + key, value);
    },
    set: function (key, value) {
      try {
        var stringified = JSON.stringify(value);
        this._set(key, stringified);
      } catch (e) {
        IMI.log("caught exception in _db.set(" + key + "): " + e);
      }
    },
    remove: function (key) {
      localStorage.removeItem(namespace + key);
      if (this.encryptDB) {
        localStorage.removeItem(namespace + key + "_hash");
      }
    },
    /* Remove a list of values from local storage.
     */
    removeAll: function (keys) {
      var self = this;
      if (keys) {
        $.each(keys, function (index, key) {
          self.remove(key);
          if (self.encryptDB) {
            self.remove(key + "_hash");
          }
        });
      }
    },
    generateMessageId: function (msg) {
      return [msg.getType(), msg.getDeviceId(), msg.getTransactionId()].join(
        "_"
      );
    },
    _transIdsKey: function () {
      var _ic = IMI.IMIconnect;
      var prefix = (_ic && _ic.appName) ? _ic.appName + "." : "";
      return prefix + "transIds";
    },
    setTransId: function (msg) {
      try {
        var transId = this.generateMessageId(msg);
        var key = this._transIdsKey();
        var transIds = sessionStorage.getItem(key);
        if (transIds) {
          transIds = JSON.parse(transIds);
          if (transIds.length >= 500) {
            transIds.shift();
          }
        } else {
          transIds = [];
        }
        if (transIds.indexOf(transId) === -1) {
          transIds.push(transId);
          sessionStorage.setItem(key, JSON.stringify(transIds));
        }
      } catch (error) { }
    },
    getTransIds: function () {
      var transIds = [];
      try {
        var key = this._transIdsKey();
        transIds = sessionStorage.getItem(key);
        if (transIds) {
          transIds = JSON.parse(transIds);
        } else {
          transIds = [];
        }
      } catch (error) { }
      return transIds;
    },
    isDuplicateMessage: function (msg) {
      var transIds = this.getTransIds();
      var messageTransId = _db.generateMessageId(msg);
      return transIds.indexOf(messageTransId) !== -1;
    },
  };
  return _db;
}

var isLogEnabled = false;

var IMI = IMI || {
  extend: function (parent, child) {
    var i;
    child = child || {};
    for (i in parent) {
      if (parent.hasOwnProperty(i)) {
        child[i] = parent[i];
      }
    }
    return child;
  },
  namespace: function (ns_string) {
    var parts = ns_string.split("."),
      parent = IMI,
      i;
    // strip redundant leading global
    if (parts[0] === "IMI") {
      parts = parts.slice(1);
    }

    for (i = 0; i < parts.length; i += 1) {
      // create a property if it doesn't exist
      if (typeof parent[parts[i]] === "undefined") {
        parent[parts[i]] = {};
      }
      parent = parent[parts[i]];
    }

    return parent;
  },
  isString: function (s) {
    return typeof s === "string";
  },
  isObject: function (obj) {
    return typeof obj === "object";
  },
  isArray: function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  },
  isNumber: function (n) {
    return typeof n === "number";
  },
  defined: function (obj) {
    return typeof obj !== "undefined" && obj !== null && obj !== "";
  },
  isFunction: function (fun) {
    return fun && typeof fun === "function";
  },
  parseDate: function (dateObj) {
    var dateStr = "";
    try {
      if (dateObj instanceof String) {
        return dateObj;
      }
      dateStr = dateObj.toJSON();
    } catch (ex) {
      IMI.log(ex);
    }
    return dateStr;
  },
  getDate: function (strDate) {
    var dateStr = "";
    try {
      dateStr = new Date(strDate);
    } catch (ex) {
      IMI.log(ex);
    }
    return dateStr;
  },
  Post: function (url, reqdata, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "POST", reqdata, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  Put: function (url, reqdata, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "PUT", reqdata, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  Get: function (url, queryParam, headers, callback) {
    var self = this;
    try {
      self.callMethod(url, "GET", queryParam, headers, callback);
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  callMethod: function (url, method, data, headers, callback) {
    var self = this;
    try {
      var cbck = {};
      callback = callback || {};
      if (typeof callback === "function") {
        cbck.onSuccess = callback;
        cbck.onFailure = callback;
      } else {
        cbck.onSuccess =
          callback.onSuccess ||
          function (data) {
            IMI.log("onSuccess", data);
          };
        cbck.onFailure =
          callback.onFailure ||
          function (data) {
            IMI.log("onFailure", data);
          };
      }
      self.HttpAjaxCall(
        url,
        method,
        data,
        headers,
        cbck.onSuccess,
        cbck.onFailure
      );
    } catch (errr) {
      IMI.log("error", errr);
    }
  },
  HttpAjaxCall: function (url, method, data, callerHeaders, successCallback, errback) {
    function _doAjax(retryAttempt, alreadyPreFlighted) {
      var imi = (typeof IMI !== "undefined" && IMI.IMIconnect)
        || _imiconnect;
      var headers;
      try {
        var base = (imi
          && typeof imi._getAjaxHeader === "function")
          ? imi._getAjaxHeader()
          : {};
        headers = Object.assign({}, base, callerHeaders || {});
      } catch (e) {
        headers = callerHeaders || {};
      }

      if (!retryAttempt
          && !alreadyPreFlighted
          && imi
          && imi.icConfig
          && imi.icConfig.enableAuthTokenExchange
          && IMI._authTokenManager
          && typeof IMI._authTokenManager.refreshToken === "function"
          && !headers.Authorization
          && imi.securityToken                // we have a JWT to mint from
          && imi.iCDeviceProfile) {           // and a profile (post-register)
        IMI._authTokenManager.refreshToken().then(
          function () { _doAjax(retryAttempt, true); },
          function (refreshErr) {
            var ne = IMI._authTokenManager._normalizeError(refreshErr);
            successCallback(ne);
          }
        );
        return;
      }

      $.ajax({
        url: url,
        type: method,
        headers: headers,
        data: data,
        success: function (resrmsg) {
          try {
            if (!retryAttempt
                && resrmsg
                && imi
                && imi.icConfig
                && imi.icConfig.enableAuthTokenExchange
                && IMI._authTokenManager
                && typeof IMI._authTokenManager.refreshToken === "function"
                && typeof imi._getErrorCode === "function") {
              var errorCode = imi._getErrorCode(resrmsg.code);
              var isTokenError = (
                errorCode === IMI.ICErrorCodes.TokenExpired
                || errorCode === IMI.ICErrorCodes.TokenRequired
                || errorCode === IMI.ICErrorCodes.InvalidToken
              );
              if (isTokenError) {
                IMI._authTokenManager.refreshToken().then(
                  function (token) {
                    if (token) {
                      _doAjax(true);
                    } else {
                      successCallback(resrmsg);
                    }
                  },
                  function (refreshErr) {
                    var ne = IMI._authTokenManager._normalizeError(refreshErr);
                    successCallback(ne);
                  }
                );
                return;
              }
            }
          } catch (interceptorErr) {
            IMI.log("HttpAjaxCall interceptor error: " + interceptorErr);
          }

          successCallback(resrmsg);
        },
        error: function (responseData, textStatus, errorThrown) {
          errback(responseData);
          IMI.log(errorThrown);
        },
      });
    }

    _doAjax(false);
  },
  getBrowserName: function () {
    try {
      var ua = navigator.userAgent,
        tem,
        M =
          ua.match(
            /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
          ) || [],
        isiOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var browser = navigator.appName;
      var nameOffset, verOffset;
      if (ua.indexOf("Opera") !== -1) {
        browser = "Opera";
      }
      if (ua.indexOf("CriOS") !== -1) {
        browser = "chrome";
      } else if (ua.indexOf("FxiOS") !== -1) {
        // Firefox on iOS uses the "FxiOS" token (not "Firefox") and its UA still
        // contains "Safari/..." like every WebKit-based iOS browser, so without
        // this it would fall through to the Safari branch.
        browser = "firefox";
      } else if (ua.indexOf("OPR") !== -1) {
        // Opera Next
        browser = "Opera";
      }
      // Edge
      else if (ua.indexOf("Edge") !== -1) {
        browser = "MicrosoftEdge";
      }
      // MSIE
      else if (ua.indexOf("MSIE") !== -1) {
        browser = "IE";
      }
      // Chrome
      else if (ua.indexOf("Chrome") !== -1) {
        browser = "Chrome";
      }
      // Safari
      else if (ua.indexOf("Safari") !== -1) {
        browser = "Safari";
      }
      // Firefox
      else if (ua.indexOf("Firefox") !== -1) {
        browser = "Firefox";
      }
      // MSIE 11+
      else if (ua.indexOf("Trident/") !== -1) {
        browser = "IE";
      } else if (
        (nameOffset = ua.lastIndexOf(" ") + 1) <
        (verOffset = ua.lastIndexOf("/"))
      ) {
        browser = ua.substring(nameOffset, verOffset);
        if (browser.toLowerCase() == browser.toUpperCase()) {
          browser = navigator.appName;
        }
      }
      return browser.toLowerCase();
    } catch (ex) {
      IMI.log(ex);
    }
  },
  // Best-effort synchronous FCM support check. firebase-messaging compat v9+ returns
  // a Promise from isSupported(), so we only trust an explicit synchronous boolean;
  // anything else is treated as "unknown" and left for downstream try/catch + the
  // async check in initFCM to resolve.
  _isFcmSupported: function () {
    try {
      if (
        typeof firebase !== "undefined" &&
        firebase.messaging &&
        typeof firebase.messaging.isSupported === "function"
      ) {
        var supported = firebase.messaging.isSupported();
        if (typeof supported === "boolean") {
          return supported;
        }
      }
    } catch (e) {
      IMI.log("firebase.messaging.isSupported() threw; treating FCM as unsupported", e);
      return false;
    }
    return true; // unknown -> let downstream guards decide
  },
  // Async FCM support resolver that works whether isSupported() returns a boolean
  // (compat v8) or a Promise<boolean> (compat v9+).
  _isFcmSupportedAsync: function () {
    try {
      if (
        typeof firebase !== "undefined" &&
        firebase.messaging &&
        typeof firebase.messaging.isSupported === "function"
      ) {
        return Promise.resolve(firebase.messaging.isSupported());
      }
    } catch (e) {
      IMI.log("firebase.messaging.isSupported() threw; treating FCM as unsupported", e);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  },
  // Capability-based iOS/iPadOS web detection. Covers classic iOS UA, every iOS
  // browser engine (CriOS/FxiOS/EdgiOS all report the iOS UA), and iPadOS 13+
  // "desktop mode" which reports a Macintosh UA but is a touch device.
  _isIOSWeb: function () {
    var ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    var maxTouchPoints = (typeof navigator !== "undefined" && navigator.maxTouchPoints) || 0;
    if (typeof window !== "undefined" && window.MSStream) return false;
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    if (/Macintosh/.test(ua) && maxTouchPoints > 1) return true;
    return false;
  },
  // Returns "fcm" | "safari" | "none" for the given normalized browser name.
  _resolvePushPath: function (browserName) {
    if (IMI._isIOSWeb()) return "none";
    if (browserName === "chrome" || browserName === "firefox") {
      return IMI._isFcmSupported() === false ? "none" : "fcm";
    }
    if (browserName === "safari") {
      var safariPushAvailable =
        typeof window !== "undefined" && !!window.safari && !!window.safari.pushNotification;
      return safariPushAvailable ? "safari" : "none";
    }
    return "none";
  },
  getbrowserVersion: function () {
    try {
      var ua = navigator.userAgent,
        tem,
        M =
          ua.match(
            /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
          ) || [],
        isiOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var verOffset;
      var version = "" + parseFloat(navigator.appVersion),
        nameOffset,
        ix;

      if ((verOffset = ua.indexOf("Opera")) !== -1) {
        version = ua.substring(verOffset + 6);
        if ((verOffset = ua.indexOf("Version")) !== -1) {
          version = ua.substring(verOffset + 8);
        }
      }
      //CriOS chrome in iphone
      if ((verOffset = ua.indexOf("CriOS")) !== -1) {
        version = ua.substring(verOffset + 6);
      }
      // FxiOS firefox in iphone ("FxiOS/" is 6 chars, matching the CriOS offset)
      else if ((verOffset = ua.indexOf("FxiOS")) !== -1) {
        version = ua.substring(verOffset + 6);
      }
      // Opera Next
      else if ((verOffset = ua.indexOf("OPR")) !== -1) {
        version = ua.substring(verOffset + 4);
      }
      // Edge
      else if ((verOffset = ua.indexOf("Edge")) !== -1) {
        version = ua.substring(verOffset + 5);
      }
      // MSIE
      else if ((verOffset = ua.indexOf("MSIE")) !== -1) {
        version = ua.substring(verOffset + 5);
      }
      // Chrome
      else if ((verOffset = ua.indexOf("Chrome")) !== -1) {
        version = ua.substring(verOffset + 7);
      }
      // Safari
      else if ((verOffset = ua.indexOf("Safari")) !== -1) {
        version = ua.substring(verOffset + 7);
        if ((verOffset = ua.indexOf("Version")) !== -1) {
          version = ua.substring(verOffset + 8);
        }
      }
      // Firefox
      else if ((verOffset = ua.indexOf("Firefox")) != -1) {
        version = ua.substring(verOffset + 8);
      }
      // MSIE 11+
      else if (ua.indexOf("Trident/") != -1) {
        version = ua.substring(ua.indexOf("rv:") + 3);
      }
      // Other browsers
      else if (
        (nameOffset = ua.lastIndexOf(" ") + 1) <
        (verOffset = ua.lastIndexOf("/"))
      ) {
        version = ua.substring(verOffset + 1);
      }
      if ((ix = version.indexOf(";")) != -1) version = version.substring(0, ix);
      if ((ix = version.indexOf(" ")) != -1) version = version.substring(0, ix);
      if ((ix = version.indexOf(")")) != -1) version = version.substring(0, ix);

      return version;
    } catch (ex) {
      IMI.log(ex);
    }
  },
  getSDKVersion: function () {
    var version = JS_SDK_VERSION.split(".");
    version.pop();
    return version.join(".");
  },
  log: function (msg) {
    if (isLogEnabled) {
      if (arguments.callee.caller.name) {
        console.log(arguments.callee.caller.name + ":", msg);
      } else {
        console.log(msg);
      }
    }
  },
};

var protocol = location.protocol;
var webprefix = "v2_web_";
var isSSL = false;
if (protocol === "https:") {
  isSSL = true;
}

var port = 1884;
if (isSSL) {
  port = 8884;
}

var reconnectTimeoutConfig = { default: 1000, max: 30000 };//in milliseconds
var reconnectTimeout = reconnectTimeoutConfig.default;
var keepAliveInterval = 10; //keep alive 10 seocnds
var policyTimeInterval = 1800000; //evry 30 minutes
var timeStampInterval = 30000; //in milliseconds

(function (IMI) {
  var _util = {
    formatDate: function (milli) {
      var date = new Date(milli);
      date.setMilliseconds(0);
      return date.toISOString();
    },
    setCookie: function (cname, cvalue, exminutes) {
      var d = new Date();
      d.setTime(d.getTime() + exminutes * 60 * 1000);
      var expires = "expires=" + d.toUTCString();
      document.cookie = cname + "=" + cvalue + "; " + expires;
    },
    getCookie: function (cname) {
      var name = cname + "=";
      var ca = document.cookie.split(";");
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === " ") c = c.substring(1);
        if (c.indexOf(name) !== -1) return c.substring(name.length, c.length);
      }
      return null;
    },
    // Create a "guid"
    uuid: function () {
      var u = "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

      return u;
    },
    randomUUID: function (max) {
      var u = "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx";
      if (u.length < max) {
        var strLen = u.length;
        for (var i = strLen; i < max; i++) {
          u = u.concat("x");
        }
      }
      u = u.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      if (u.length >= max) {
        return u.substring(0, max - 1);
      }

      return u;
    },
    // Get users current location
    getLocation: function (callback) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (position) {
            if ($.isFunction(callback)) {
              callback(position);
            }
          },
          function (error) {
            if ($.isFunction(callback)) {
              callback(null, error);
            }
          }
        );
      } else {
        if ($.isFunction(callback)) {
          callback(null, "GEO Location not enabled");
        }
      }
    },
    des: function (key, message, encrypt, mode, iv, padding) {
      //encryption
      var self = this;
      //declaring this locally speeds things up a bit
      var spfunction1 = new Array(
        0x1010400,
        0,
        0x10000,
        0x1010404,
        0x1010004,
        0x10404,
        0x4,
        0x10000,
        0x400,
        0x1010400,
        0x1010404,
        0x400,
        0x1000404,
        0x1010004,
        0x1000000,
        0x4,
        0x404,
        0x1000400,
        0x1000400,
        0x10400,
        0x10400,
        0x1010000,
        0x1010000,
        0x1000404,
        0x10004,
        0x1000004,
        0x1000004,
        0x10004,
        0,
        0x404,
        0x10404,
        0x1000000,
        0x10000,
        0x1010404,
        0x4,
        0x1010000,
        0x1010400,
        0x1000000,
        0x1000000,
        0x400,
        0x1010004,
        0x10000,
        0x10400,
        0x1000004,
        0x400,
        0x4,
        0x1000404,
        0x10404,
        0x1010404,
        0x10004,
        0x1010000,
        0x1000404,
        0x1000004,
        0x404,
        0x10404,
        0x1010400,
        0x404,
        0x1000400,
        0x1000400,
        0,
        0x10004,
        0x10400,
        0,
        0x1010004
      );
      var spfunction2 = new Array(
        -0x7fef7fe0,
        -0x7fff8000,
        0x8000,
        0x108020,
        0x100000,
        0x20,
        -0x7fefffe0,
        -0x7fff7fe0,
        -0x7fffffe0,
        -0x7fef7fe0,
        -0x7fef8000,
        -0x80000000,
        -0x7fff8000,
        0x100000,
        0x20,
        -0x7fefffe0,
        0x108000,
        0x100020,
        -0x7fff7fe0,
        0,
        -0x80000000,
        0x8000,
        0x108020,
        -0x7ff00000,
        0x100020,
        -0x7fffffe0,
        0,
        0x108000,
        0x8020,
        -0x7fef8000,
        -0x7ff00000,
        0x8020,
        0,
        0x108020,
        -0x7fefffe0,
        0x100000,
        -0x7fff7fe0,
        -0x7ff00000,
        -0x7fef8000,
        0x8000,
        -0x7ff00000,
        -0x7fff8000,
        0x20,
        -0x7fef7fe0,
        0x108020,
        0x20,
        0x8000,
        -0x80000000,
        0x8020,
        -0x7fef8000,
        0x100000,
        -0x7fffffe0,
        0x100020,
        -0x7fff7fe0,
        -0x7fffffe0,
        0x100020,
        0x108000,
        0,
        -0x7fff8000,
        0x8020,
        -0x80000000,
        -0x7fefffe0,
        -0x7fef7fe0,
        0x108000
      );
      var spfunction3 = new Array(
        0x208,
        0x8020200,
        0,
        0x8020008,
        0x8000200,
        0,
        0x20208,
        0x8000200,
        0x20008,
        0x8000008,
        0x8000008,
        0x20000,
        0x8020208,
        0x20008,
        0x8020000,
        0x208,
        0x8000000,
        0x8,
        0x8020200,
        0x200,
        0x20200,
        0x8020000,
        0x8020008,
        0x20208,
        0x8000208,
        0x20200,
        0x20000,
        0x8000208,
        0x8,
        0x8020208,
        0x200,
        0x8000000,
        0x8020200,
        0x8000000,
        0x20008,
        0x208,
        0x20000,
        0x8020200,
        0x8000200,
        0,
        0x200,
        0x20008,
        0x8020208,
        0x8000200,
        0x8000008,
        0x200,
        0,
        0x8020008,
        0x8000208,
        0x20000,
        0x8000000,
        0x8020208,
        0x8,
        0x20208,
        0x20200,
        0x8000008,
        0x8020000,
        0x8000208,
        0x208,
        0x8020000,
        0x20208,
        0x8,
        0x8020008,
        0x20200
      );
      var spfunction4 = new Array(
        0x802001,
        0x2081,
        0x2081,
        0x80,
        0x802080,
        0x800081,
        0x800001,
        0x2001,
        0,
        0x802000,
        0x802000,
        0x802081,
        0x81,
        0,
        0x800080,
        0x800001,
        0x1,
        0x2000,
        0x800000,
        0x802001,
        0x80,
        0x800000,
        0x2001,
        0x2080,
        0x800081,
        0x1,
        0x2080,
        0x800080,
        0x2000,
        0x802080,
        0x802081,
        0x81,
        0x800080,
        0x800001,
        0x802000,
        0x802081,
        0x81,
        0,
        0,
        0x802000,
        0x2080,
        0x800080,
        0x800081,
        0x1,
        0x802001,
        0x2081,
        0x2081,
        0x80,
        0x802081,
        0x81,
        0x1,
        0x2000,
        0x800001,
        0x2001,
        0x802080,
        0x800081,
        0x2001,
        0x2080,
        0x800000,
        0x802001,
        0x80,
        0x800000,
        0x2000,
        0x802080
      );
      var spfunction5 = new Array(
        0x100,
        0x2080100,
        0x2080000,
        0x42000100,
        0x80000,
        0x100,
        0x40000000,
        0x2080000,
        0x40080100,
        0x80000,
        0x2000100,
        0x40080100,
        0x42000100,
        0x42080000,
        0x80100,
        0x40000000,
        0x2000000,
        0x40080000,
        0x40080000,
        0,
        0x40000100,
        0x42080100,
        0x42080100,
        0x2000100,
        0x42080000,
        0x40000100,
        0,
        0x42000000,
        0x2080100,
        0x2000000,
        0x42000000,
        0x80100,
        0x80000,
        0x42000100,
        0x100,
        0x2000000,
        0x40000000,
        0x2080000,
        0x42000100,
        0x40080100,
        0x2000100,
        0x40000000,
        0x42080000,
        0x2080100,
        0x40080100,
        0x100,
        0x2000000,
        0x42080000,
        0x42080100,
        0x80100,
        0x42000000,
        0x42080100,
        0x2080000,
        0,
        0x40080000,
        0x42000000,
        0x80100,
        0x2000100,
        0x40000100,
        0x80000,
        0,
        0x40080000,
        0x2080100,
        0x40000100
      );
      var spfunction6 = new Array(
        0x20000010,
        0x20400000,
        0x4000,
        0x20404010,
        0x20400000,
        0x10,
        0x20404010,
        0x400000,
        0x20004000,
        0x404010,
        0x400000,
        0x20000010,
        0x400010,
        0x20004000,
        0x20000000,
        0x4010,
        0,
        0x400010,
        0x20004010,
        0x4000,
        0x404000,
        0x20004010,
        0x10,
        0x20400010,
        0x20400010,
        0,
        0x404010,
        0x20404000,
        0x4010,
        0x404000,
        0x20404000,
        0x20000000,
        0x20004000,
        0x10,
        0x20400010,
        0x404000,
        0x20404010,
        0x400000,
        0x4010,
        0x20000010,
        0x400000,
        0x20004000,
        0x20000000,
        0x4010,
        0x20000010,
        0x20404010,
        0x404000,
        0x20400000,
        0x404010,
        0x20404000,
        0,
        0x20400010,
        0x10,
        0x4000,
        0x20400000,
        0x404010,
        0x4000,
        0x400010,
        0x20004010,
        0,
        0x20404000,
        0x20000000,
        0x400010,
        0x20004010
      );
      var spfunction7 = new Array(
        0x200000,
        0x4200002,
        0x4000802,
        0,
        0x800,
        0x4000802,
        0x200802,
        0x4200800,
        0x4200802,
        0x200000,
        0,
        0x4000002,
        0x2,
        0x4000000,
        0x4200002,
        0x802,
        0x4000800,
        0x200802,
        0x200002,
        0x4000800,
        0x4000002,
        0x4200000,
        0x4200800,
        0x200002,
        0x4200000,
        0x800,
        0x802,
        0x4200802,
        0x200800,
        0x2,
        0x4000000,
        0x200800,
        0x4000000,
        0x200800,
        0x200000,
        0x4000802,
        0x4000802,
        0x4200002,
        0x4200002,
        0x2,
        0x200002,
        0x4000000,
        0x4000800,
        0x200000,
        0x4200800,
        0x802,
        0x200802,
        0x4200800,
        0x802,
        0x4000002,
        0x4200802,
        0x4200000,
        0x200800,
        0,
        0x2,
        0x4200802,
        0,
        0x200802,
        0x4200000,
        0x800,
        0x4000002,
        0x4000800,
        0x800,
        0x200002
      );
      var spfunction8 = new Array(
        0x10001040,
        0x1000,
        0x40000,
        0x10041040,
        0x10000000,
        0x10001040,
        0x40,
        0x10000000,
        0x40040,
        0x10040000,
        0x10041040,
        0x41000,
        0x10041000,
        0x41040,
        0x1000,
        0x40,
        0x10040000,
        0x10000040,
        0x10001000,
        0x1040,
        0x41000,
        0x40040,
        0x10040040,
        0x10041000,
        0x1040,
        0,
        0,
        0x10040040,
        0x10000040,
        0x10001000,
        0x41040,
        0x40000,
        0x41040,
        0x40000,
        0x10041000,
        0x1000,
        0x40,
        0x10040040,
        0x1000,
        0x41040,
        0x10001000,
        0x40,
        0x10000040,
        0x10040000,
        0x10040040,
        0x10000000,
        0x40000,
        0x10001040,
        0,
        0x10041040,
        0x40040,
        0x10000040,
        0x10040000,
        0x10001000,
        0x10001040,
        0,
        0x10041040,
        0x41000,
        0x41000,
        0x1040,
        0x1040,
        0x40040,
        0x10000000,
        0x10041000
      );

      //create the 16 or 48 subkeys we will need
      var keys = self.des_createKeys(key);
      var m = 0,
        i,
        j,
        temp,
        right1,
        right2,
        left,
        right,
        looping;
      var cbcleft, cbcleft2, cbcright, cbcright2;
      var endloop, loopinc;
      var len = message.length;
      var chunk = 0;
      //set up the loops for single and triple des
      var iterations = keys.length == 32 ? 3 : 9; //single or triple des
      if (iterations == 3) {
        looping = encrypt ? new Array(0, 32, 2) : new Array(30, -2, -2);
      } else {
        looping = encrypt
          ? new Array(0, 32, 2, 62, 30, -2, 64, 96, 2)
          : new Array(94, 62, -2, 32, 64, 2, 30, -2, -2);
      }

      //pad the message depending on the padding parameter
      if (padding == 2) message += "        ";
      //pad the message with spaces
      else if (padding == 1) {
        temp = 8 - (len % 8);
        message += String.fromCharCode(
          temp,
          temp,
          temp,
          temp,
          temp,
          temp,
          temp,
          temp
        );
        if (temp == 8) len += 8;
      } //PKCS7 padding
      else if (!padding) message += "\0\0\0\0\0\0\0\0"; //pad the message out with null bytes

      result = "";
      tempresult = "";

      if (mode == 1) {
        //CBC mode
        cbcleft =
          (iv.charCodeAt(m++) << 24) |
          (iv.charCodeAt(m++) << 16) |
          (iv.charCodeAt(m++) << 8) |
          iv.charCodeAt(m++);
        cbcright =
          (iv.charCodeAt(m++) << 24) |
          (iv.charCodeAt(m++) << 16) |
          (iv.charCodeAt(m++) << 8) |
          iv.charCodeAt(m++);
        m = 0;
      }
      //loop through each 64 bit chunk of the message
      while (m < len) {
        left =
          (message.charCodeAt(m++) << 24) |
          (message.charCodeAt(m++) << 16) |
          (message.charCodeAt(m++) << 8) |
          message.charCodeAt(m++);
        right =
          (message.charCodeAt(m++) << 24) |
          (message.charCodeAt(m++) << 16) |
          (message.charCodeAt(m++) << 8) |
          message.charCodeAt(m++);

        //for Cipher Block Chaining mode, xor the message with the previous result
        if (mode == 1) {
          if (encrypt) {
            left ^= cbcleft;
            right ^= cbcright;
          } else {
            cbcleft2 = cbcleft;
            cbcright2 = cbcright;
            cbcleft = left;
            cbcright = right;
          }
        }

        //first each 64 but chunk of the message must be permuted according to IP
        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;
        temp = ((left >>> 16) ^ right) & 0x0000ffff;
        right ^= temp;
        left ^= temp << 16;
        temp = ((right >>> 2) ^ left) & 0x33333333;
        left ^= temp;
        right ^= temp << 2;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;

        left = (left << 1) | (left >>> 31);
        right = (right << 1) | (right >>> 31);

        //do this either 1 or 3 times for each chunk of the message
        for (j = 0; j < iterations; j += 3) {
          endloop = looping[j + 1];
          loopinc = looping[j + 2];
          //now go through and perform the encryption or decryption
          for (i = looping[j]; i != endloop; i += loopinc) {
            //for efficiency
            right1 = right ^ keys[i];
            right2 = ((right >>> 4) | (right << 28)) ^ keys[i + 1];
            //the result is attained by passing these bytes through the S selection functions
            temp = left;
            left = right;
            right =
              temp ^
              (spfunction2[(right1 >>> 24) & 0x3f] |
                spfunction4[(right1 >>> 16) & 0x3f] |
                spfunction6[(right1 >>> 8) & 0x3f] |
                spfunction8[right1 & 0x3f] |
                spfunction1[(right2 >>> 24) & 0x3f] |
                spfunction3[(right2 >>> 16) & 0x3f] |
                spfunction5[(right2 >>> 8) & 0x3f] |
                spfunction7[right2 & 0x3f]);
          }
          temp = left;
          left = right;
          right = temp; //unreverse left and right
        } //for either 1 or 3 iterations

        //move then each one bit to the right
        left = (left >>> 1) | (left << 31);
        right = (right >>> 1) | (right << 31);

        //now perform IP-1, which is IP in the opposite direction
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((right >>> 2) ^ left) & 0x33333333;
        left ^= temp;
        right ^= temp << 2;
        temp = ((left >>> 16) ^ right) & 0x0000ffff;
        right ^= temp;
        left ^= temp << 16;
        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;

        //for Cipher Block Chaining mode, xor the message with the previous result
        if (mode == 1) {
          if (encrypt) {
            cbcleft = left;
            cbcright = right;
          } else {
            left ^= cbcleft2;
            right ^= cbcright2;
          }
        }
        tempresult += String.fromCharCode(
          left >>> 24,
          (left >>> 16) & 0xff,
          (left >>> 8) & 0xff,
          left & 0xff,
          right >>> 24,
          (right >>> 16) & 0xff,
          (right >>> 8) & 0xff,
          right & 0xff
        );

        chunk += 8;
        if (chunk == 512) {
          result += tempresult;
          tempresult = "";
          chunk = 0;
        }
      } //for every 8 characters, or 64 bits in the message
      return result + tempresult;
    }, //end of des
    des_createKeys: function (key) {
      //declaring this locally speeds things up a bit
      pc2bytes0 = new Array(
        0,
        0x4,
        0x20000000,
        0x20000004,
        0x10000,
        0x10004,
        0x20010000,
        0x20010004,
        0x200,
        0x204,
        0x20000200,
        0x20000204,
        0x10200,
        0x10204,
        0x20010200,
        0x20010204
      );
      pc2bytes1 = new Array(
        0,
        0x1,
        0x100000,
        0x100001,
        0x4000000,
        0x4000001,
        0x4100000,
        0x4100001,
        0x100,
        0x101,
        0x100100,
        0x100101,
        0x4000100,
        0x4000101,
        0x4100100,
        0x4100101
      );
      pc2bytes2 = new Array(
        0,
        0x8,
        0x800,
        0x808,
        0x1000000,
        0x1000008,
        0x1000800,
        0x1000808,
        0,
        0x8,
        0x800,
        0x808,
        0x1000000,
        0x1000008,
        0x1000800,
        0x1000808
      );
      pc2bytes3 = new Array(
        0,
        0x200000,
        0x8000000,
        0x8200000,
        0x2000,
        0x202000,
        0x8002000,
        0x8202000,
        0x20000,
        0x220000,
        0x8020000,
        0x8220000,
        0x22000,
        0x222000,
        0x8022000,
        0x8222000
      );
      pc2bytes4 = new Array(
        0,
        0x40000,
        0x10,
        0x40010,
        0,
        0x40000,
        0x10,
        0x40010,
        0x1000,
        0x41000,
        0x1010,
        0x41010,
        0x1000,
        0x41000,
        0x1010,
        0x41010
      );
      pc2bytes5 = new Array(
        0,
        0x400,
        0x20,
        0x420,
        0,
        0x400,
        0x20,
        0x420,
        0x2000000,
        0x2000400,
        0x2000020,
        0x2000420,
        0x2000000,
        0x2000400,
        0x2000020,
        0x2000420
      );
      pc2bytes6 = new Array(
        0,
        0x10000000,
        0x80000,
        0x10080000,
        0x2,
        0x10000002,
        0x80002,
        0x10080002,
        0,
        0x10000000,
        0x80000,
        0x10080000,
        0x2,
        0x10000002,
        0x80002,
        0x10080002
      );
      pc2bytes7 = new Array(
        0,
        0x10000,
        0x800,
        0x10800,
        0x20000000,
        0x20010000,
        0x20000800,
        0x20010800,
        0x20000,
        0x30000,
        0x20800,
        0x30800,
        0x20020000,
        0x20030000,
        0x20020800,
        0x20030800
      );
      pc2bytes8 = new Array(
        0,
        0x40000,
        0,
        0x40000,
        0x2,
        0x40002,
        0x2,
        0x40002,
        0x2000000,
        0x2040000,
        0x2000000,
        0x2040000,
        0x2000002,
        0x2040002,
        0x2000002,
        0x2040002
      );
      pc2bytes9 = new Array(
        0,
        0x10000000,
        0x8,
        0x10000008,
        0,
        0x10000000,
        0x8,
        0x10000008,
        0x400,
        0x10000400,
        0x408,
        0x10000408,
        0x400,
        0x10000400,
        0x408,
        0x10000408
      );
      pc2bytes10 = new Array(
        0,
        0x20,
        0,
        0x20,
        0x100000,
        0x100020,
        0x100000,
        0x100020,
        0x2000,
        0x2020,
        0x2000,
        0x2020,
        0x102000,
        0x102020,
        0x102000,
        0x102020
      );
      pc2bytes11 = new Array(
        0,
        0x1000000,
        0x200,
        0x1000200,
        0x200000,
        0x1200000,
        0x200200,
        0x1200200,
        0x4000000,
        0x5000000,
        0x4000200,
        0x5000200,
        0x4200000,
        0x5200000,
        0x4200200,
        0x5200200
      );
      pc2bytes12 = new Array(
        0,
        0x1000,
        0x8000000,
        0x8001000,
        0x80000,
        0x81000,
        0x8080000,
        0x8081000,
        0x10,
        0x1010,
        0x8000010,
        0x8001010,
        0x80010,
        0x81010,
        0x8080010,
        0x8081010
      );
      pc2bytes13 = new Array(
        0,
        0x4,
        0x100,
        0x104,
        0,
        0x4,
        0x100,
        0x104,
        0x1,
        0x5,
        0x101,
        0x105,
        0x1,
        0x5,
        0x101,
        0x105
      );

      var iterations = 1;
      //stores the return keys
      var keys = new Array(32 * iterations);
      //now define the left shifts which need to be done
      var shifts = new Array(0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0);
      //other variables
      var lefttemp,
        righttemp,
        m = 0,
        n = 0,
        temp;

      for (var j = 0; j < iterations; j++) {
        //either 1 or 3 iterations
        left =
          (key.charCodeAt(m++) << 24) |
          (key.charCodeAt(m++) << 16) |
          (key.charCodeAt(m++) << 8) |
          key.charCodeAt(m++);
        right =
          (key.charCodeAt(m++) << 24) |
          (key.charCodeAt(m++) << 16) |
          (key.charCodeAt(m++) << 8) |
          key.charCodeAt(m++);

        temp = ((left >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= temp;
        left ^= temp << 4;
        temp = ((right >>> -16) ^ left) & 0x0000ffff;
        left ^= temp;
        right ^= temp << -16;
        temp = ((left >>> 2) ^ right) & 0x33333333;
        right ^= temp;
        left ^= temp << 2;
        temp = ((right >>> -16) ^ left) & 0x0000ffff;
        left ^= temp;
        right ^= temp << -16;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;
        temp = ((right >>> 8) ^ left) & 0x00ff00ff;
        left ^= temp;
        right ^= temp << 8;
        temp = ((left >>> 1) ^ right) & 0x55555555;
        right ^= temp;
        left ^= temp << 1;

        //the right side needs to be shifted and to get the last four bits of the left side
        temp = (left << 8) | ((right >>> 20) & 0x000000f0);
        //left needs to be put upside down
        left =
          (right << 24) |
          ((right << 8) & 0xff0000) |
          ((right >>> 8) & 0xff00) |
          ((right >>> 24) & 0xf0);
        right = temp;

        //now go through and perform these shifts on the left and right keys
        for (var i = 0; i < shifts.length; i++) {
          //shift the keys either one or two bits to the left
          if (shifts[i]) {
            left = (left << 2) | (left >>> 26);
            right = (right << 2) | (right >>> 26);
          } else {
            left = (left << 1) | (left >>> 27);
            right = (right << 1) | (right >>> 27);
          }
          left &= -0xf;
          right &= -0xf;

          lefttemp =
            pc2bytes0[left >>> 28] |
            pc2bytes1[(left >>> 24) & 0xf] |
            pc2bytes2[(left >>> 20) & 0xf] |
            pc2bytes3[(left >>> 16) & 0xf] |
            pc2bytes4[(left >>> 12) & 0xf] |
            pc2bytes5[(left >>> 8) & 0xf] |
            pc2bytes6[(left >>> 4) & 0xf];
          righttemp =
            pc2bytes7[right >>> 28] |
            pc2bytes8[(right >>> 24) & 0xf] |
            pc2bytes9[(right >>> 20) & 0xf] |
            pc2bytes10[(right >>> 16) & 0xf] |
            pc2bytes11[(right >>> 12) & 0xf] |
            pc2bytes12[(right >>> 8) & 0xf] |
            pc2bytes13[(right >>> 4) & 0xf];
          temp = ((righttemp >>> 16) ^ lefttemp) & 0x0000ffff;
          keys[n++] = lefttemp ^ temp;
          keys[n++] = righttemp ^ (temp << 16);
        }
      } //for each iterations
      return keys;
    }, //end of des_createKeys

    decodeBase64: function (s) {
      var self = this;
      var _PADCHAR = "=";
      var pads = 0,
        i,
        b10,
        imax = s.length,
        x = [];

      s = String(s);
      if (imax === 0) return s;

      if (imax % 4 !== 0) {
        throw "Cannot decode base64";
      }
      if (s.charAt(imax - 1) === _PADCHAR) {
        pads = 1;

        if (s.charAt(imax - 2) === _PADCHAR) {
          pads = 2;
        }
        // either way, we want to ignore this last block
        imax -= 4;
      }

      for (i = 0; i < imax; i += 4) {
        b10 =
          (self._getbyte64(s, i) << 18) |
          (self._getbyte64(s, i + 1) << 12) |
          (self._getbyte64(s, i + 2) << 6) |
          self._getbyte64(s, i + 3);
        x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff, b10 & 0xff));
      }

      switch (pads) {
        case 1:
          b10 =
            (self._getbyte64(s, i) << 18) |
            (self._getbyte64(s, i + 1) << 12) |
            (self._getbyte64(s, i + 2) << 6);
          x.push(String.fromCharCode(b10 >> 16, (b10 >> 8) & 0xff));
          break;
        case 2:
          b10 =
            (self._getbyte64(s, i) << 18) | (self._getbyte64(s, i + 1) << 12);
          x.push(String.fromCharCode(b10 >> 16));
          break;
      }

      return x.join("");
    },
    _getbyte64: function (s, i) {
      var _ALPHA =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      var idx = _ALPHA.indexOf(s.charAt(i));
      if (idx === -1) {
        throw "Cannot decode base64";
      }
      return idx;
    },
    aes: function (message, key, type) {
      try {
        var secret_key = CryptoJS.enc.Base64.parse(key);
        if (type === 0) {
          //encrypt
          var iv = CryptoJS.lib.WordArray.random(16);
          var body = CryptoJS.AES.encrypt(message, secret_key, { iv: iv });
          var header = CryptoJS.enc.Utf8.parse("");
          header.concat(iv);
          header.concat(body.ciphertext);
          message = CryptoJS.enc.Base64.stringify(header);
        } else {
          //decrypt

          var packet = CryptoJS.enc.Base64.parse(message);
          //alert(secret_key)
          var iv = CryptoJS.lib.WordArray.random(16);
          var start = iv.words.length;
          var end = packet.words.length;
          var ciphertext = CryptoJS.lib.WordArray.create(
            packet.words.slice(start, end)
          );
          var parsed_iv = CryptoJS.lib.WordArray.create(
            packet.words.slice(0, iv.words.length + 1)
          );
          ciphertext = CryptoJS.enc.Base64.stringify(ciphertext);
          //decrypting
          var decrypted = CryptoJS.AES.decrypt(ciphertext, secret_key, {
            iv: parsed_iv,
          });
          //converting into string
          message = CryptoJS.enc.Utf8.stringify(decrypted);
        }
      } catch (ex) {
        IMI.log("failed to enc/dec ,please add aes library", ex);
      }
      return message;
    },
    getQueryString: function (url) {
      var temp = url
        .split("?")[1]
        .split("&")
        .map((bi) => bi.split("="));
      return Object.fromEntries(temp);
    },
  };
  var _db,
    _deviceId,
    _imiconnect,
    _messagingInstance,
    _isConnected,
    _traceEnabled = false,
    _connRandomUUID,
    _tabId;
  //IMIconnect
  var _dbKeys = {
    APP_REGISTERED: "appregistered",
    CURRENT_SDK_VERSION: "current_sdk_version",
    HEARTBEAT_SENT_AT: "heartbeatSentAt"
  };
  IMI.namespace("IMI.RegistrationState");
  IMI.RegistrationState = { NONE: 0, REGISTERING: 1, UNREGISTERING: 2 };
  IMI.namespace("IMI.IMIconnect");
  IMI.IMIconnect = (function IMIconnect() {
    var obj;
    obj = {
      isRegister: false,
      subscriptions: [],
      isDisconnected: false,
      isRTEnabled: false,
      isLocationEnabled: false,
      isEncryptionEnabled: false,
      isPushEnabled: false,
      isMultiProfileEnabled: false,
      webpush: undefined,
      icConfig: undefined,
      userId: undefined,
      iCDeviceProfile: undefined,
      clientId: undefined,
      encryptionType: "DES",
      encryptionKey: "",
      refreshToken: "",
      accessToken: "",
      serverInboxVersion: null,
      registrationState: IMI.RegistrationState.NONE,
      sdkAPILevel: 1,
      startupLogger: function () {
        isLogEnabled = true;
      },
      startServiceWorkerMessageListener: function () {
        if (_imiconnect._swVersionCheckHandler) return;
        _imiconnect._swVersionCheckHandler = (event) => {
          if (event.data.message == 'processUnsupportedSDKVersion')
            IMI.IMIconnect._processUnsupportedSDKVersion(event.data.resp);
        };
        navigator.serviceWorker.addEventListener('message', _imiconnect._swVersionCheckHandler);
      },
      _registerClientWithServiceWorkers: function (appId, scope) {
        try {
          if (!appId) return;
          if (!('serviceWorker' in navigator)) return;
          var msg = { type: IMI.EventType.RegisterAppClient, appId: appId };
          var sw = navigator.serviceWorker.controller;
          if (sw) {
            sw.postMessage(msg);
            return;
          }
          if (!scope) return;
          navigator.serviceWorker.getRegistration(scope).then(function (reg) {
            if (!reg) return;
            var fallbackSw = reg.active || reg.installing || reg.waiting;
            if (fallbackSw) fallbackSw.postMessage(msg);
          }).catch(function (e) { IMI.log(e); });
        } catch (e) { IMI.log(e); }
      },
      _deregisterClientFromServiceWorkers: function (scope) {
        try {
          if (!('serviceWorker' in navigator)) return;
          var msg = { type: IMI.EventType.DeregisterAppClient };
          var sw = navigator.serviceWorker.controller;
          if (sw) {
            sw.postMessage(msg);
            return;
          }
          if (!scope) return;
          navigator.serviceWorker.getRegistration(scope).then(function (reg) {
            if (!reg) return;
            var fallbackSw = reg.active || reg.installing || reg.waiting;
            if (fallbackSw) fallbackSw.postMessage(msg);
          }).catch(function (e) { IMI.log(e); });
        } catch (e) { IMI.log(e); }
      },
      startup: function (callback, inputConfig) {
        _imiconnect = this;
        var env;
        var config;

        if (inputConfig && typeof inputConfig === "object") {
          env = inputConfig;
          config = new IMI.ICConfig(env);
        } else {
          var resolvedTarget =  imiEnvironments.target;
          if (window.imiEnvironments && imiEnvironments[resolvedTarget]) {
            env = imiEnvironments[resolvedTarget];
            config = new IMI.ICConfig(env);
          }
        }
        if (
          config === null ||
          config === undefined ||
          !config instanceof IMI.ICConfig ||
          config.getAppID() === undefined ||
          config.getClientKey() === undefined
        ) {
          throw _imiconnect._getErrorWithDescription(IMI.ICErrorCodes.InvalidParameterValue,
            "Missing AppID/ClientKey in target environment. Please check imi-environment.js file");
        }
        _imiconnect.icConfig = config;

        if (_imiconnect.icConfig.apis) {
          Object.assign(window, _imiconnect.icConfig.apis);
          var domains = {
            apiProtocol: authdomain.split("://")[0],
            rtmsAPIURL: authdomain + "/api/v3",
            rtmsAPIURLV4: authdomain + "/api/v4",
            SERVER_INBOX_VERSION_TAG_FOR_V4: "server_inbox_version",
          };
          Object.assign(window, domains);
          var elbZeroRatingURLs = {
            elbZeroRatingURLTemplate:
              apiProtocol + "://$(domain)/rtmsAPI/api/v3",
            elbZeroRatingURLUploadFile:
              apiProtocol + "://$(domain)/rtmsAPI/api/v1",
            elbZeroRatingURL: rtmsAPIURL,
            elbZeroRatingURLV4: rtmsAPIURLV4,
            elbZeroRatingUploadURL: authdomain + "/api/v1",
          };
          Object.assign(window, elbZeroRatingURLs);
        }

        var appid = (_imiconnect.appName = config.getAppID());
        _imiconnect.appSecret = config.getClientKey();
        _imiconnect.isRegister = false;

        _imiconnect.isTokenValid = false;
        _imiconnect.accessToken = "";
        _imiconnect.refreshToken = "";
        _imiconnect.registerListenerObjs = [];
        _db = new IMIClientStorage("IMI.Core." + appid + ".");
        _readReceiptDB = new IMISessionDB(appid + ".read_receipts");
        var _tabIdKey = appid + "._tabId";
        try {
          _tabId = sessionStorage.getItem(_tabIdKey);
          if (!_tabId) {
            _tabId = _util.uuid();
            sessionStorage.setItem(_tabIdKey, _tabId);
          }
        } catch (err) { }

        //handle the events  for handling refresh/reload page
        IMI.ICMessaging.getInstance().handleEvents();
        _imiconnect.iCDeviceProfile = _imiconnect.loadDeviceProfiles();
        if (_imiconnect.iCDeviceProfile) {
          _imiconnect.clientId =
            appid +
            "/" +
            _imiconnect.iCDeviceProfile.userId +
            "/" +
            webprefix +
            _imiconnect.iCDeviceProfile.deviceId;
        }

        let backgroundServiceCallback = {
          onSuccess: function (res) {
            if (_imiconnect.iCDeviceProfile) {
              _imiconnect.backgroundService.postMessage(IMI.EventType.StartMessageDeliveryStatusRetry);
              if (!_imiconnect._swMessageHandler) {
                _imiconnect._swMessageHandler = (ev) => _imiconnect._onServiceWorkerMessageHandler(ev);
              }
              document.addEventListener(IMI.BackgroundServiceEventType.MessageFromServiceWorker, _imiconnect._swMessageHandler);
              _imiconnect._registerClientWithServiceWorkers(appid, _imiconnect.backgroundService && _imiconnect.backgroundService.swScope);
            }
          },
          onFailure: function (err) {
            IMI.log('Startup: backgroundServiceCallback: onFailure: err', err);
          }
        }
        _imiconnect.backgroundService = IMI.BackgroundServiceManager.getInstance(appid, backgroundServiceCallback);
        //migration
        var userCurrentSDKVersion = _db.get(_dbKeys.CURRENT_SDK_VERSION);
        switch (userCurrentSDKVersion) {
          case null:
            _imiconnect._migrateTov130();
            break;
          case "1.3.0":
            break;
          default:
            break;
        }
        //check if firebase config is present for push notification
        if (env.imiclient.config && Object.keys(env.imiclient.config).length > 0) {
          _imiconnect.isFirebaseConfigAvailable = true;
          _imiconnect.webpush = new IMI.WebPushClient(this);
        }
        else
          _imiconnect.isFirebaseConfigAvailable = false;

        _imiconnect._updatePolicyCheck(callback);
        var policyUpdateJSON = _db.get("policyUpdate");
        if (_imiconnect.iCDeviceProfile && policyUpdateJSON && policyUpdateJSON.status === "Success") {
          _imiconnect._changePolicyDetails(policyUpdateJSON);
          _imiconnect._checkTTLAndSendHeartBeat();
          //isFirebaseConfigAvailable is additionally required as verifypolicy + registerResponse both are returning policy.basicPush as true (='1')
          if (_imiconnect.isPushEnabled && _imiconnect.webpush && _imiconnect.isFirebaseConfigAvailable) {
            _imiconnect.webpush.setPushNotificationDisplay(true);
            _imiconnect.webpush.init(appid, _imiconnect.iCDeviceProfile.userId);
          }

          _imiconnect.startServiceWorkerMessageListener();
        }
      },
      _onServiceWorkerMessageHandler: function (ev) {
        if (ev.detail.type) {
          switch (ev.detail.type) {
            case IMI.EventType.SendDeliveryReceipt:
              let payloadString = ev.detail.data.payloadString;
              var payLoadStr = _imiconnect._decryptMsg(payloadString);
              payLoadStr = JSON.parse(payLoadStr);
              var msgObj = IMI.ICMessage.fromJSON(payLoadStr);
              if (msgObj.getType() === IMI.ICMessageType.Message || msgObj.getType() === IMI.ICMessageType.Alert) {
                var messagingObj = IMI.ICMessaging.getInstance()
                messagingObj.sendDRMessage(msgObj.getTransactionId(), {
                  onFailure: function (error) {
                    IMI.log("sendDRMessage onFailure:", error);
                    _imiconnect._invokeSecurityTokenListeners(error);
                  },
                });
              }
              break;
            case IMI.EventType.DeviceRegistered:
              _imiconnect.iCDeviceProfile = _imiconnect.loadDeviceProfiles();
              _imiconnect.saveDeviceProfile();
              break;
            case IMI.EventType.DeviceUnregistered:
              _imiconnect.iCDeviceProfile = _imiconnect.loadDeviceProfiles();
              _imiconnect.saveDeviceProfile();
              try {
                var _miUnreg = IMI.ICMessaging.getInstance();
                if (_miUnreg) {
                  _miUnreg.isDisconnected = true;
                  if (typeof _miUnreg._stopSwPing === "function") {
                    _miUnreg._stopSwPing();
                  }
                  if (_miUnreg.connectionStatus !== IMI.ICConnectionStatus.Refused
                      && _miUnreg.connectionStatus !== IMI.ICConnectionStatus.Closed) {
                    _miUnreg.connectionStatus = IMI.ICConnectionStatus.Refused;
                    if (_miUnreg.messagecallback
                        && IMI.isFunction(_miUnreg.messagecallback.onConnectionStatusChanged)) {
                      _miUnreg.messagecallback.onConnectionStatusChanged(IMI.ICConnectionStatus.Refused);
                    }
                  }
                }
              } catch (ex) {
                IMI.log(ex);
              }
              break;
            case IMI.EventType.SwPong:
              IMI.ICMessaging.getInstance()._onSwPong(ev.detail.data);
              break;
            default:
              var messagingObj = IMI.ICMessaging.getInstance();
              messagingObj._onBroadcastReceived(ev);
              break;
          }
        }
      },
      loadDeviceProfiles: function () {
        var deviceId = _db.get("deviceId");
        var userId = _db.get("userId");
        var customerId = _db.get("customerId");
        var isSystemGenerated = _db.get("isSystemGenerated") || false;
        if (!IMI.defined(deviceId) || !IMI.defined(userId)) {
          return null;
        }
        return new IMI.ICDeviceProfile(
          deviceId,
          userId,
          customerId,
          isSystemGenerated
        );
      },
      shutdown: function () {
        try {
          try {
            if (_messagingInstance && _messagingInstance.isConnected()) {
              _messagingInstance.disconnect();
            }
          } catch (ex) {
            IMI.log(ex);
          }
          if (_db) {
            _db.remove("policyUpdate");
            _db.remove("isConnectionOpened");
          }
        } catch (ex) {
          IMI.log(ex);
          throw ex;
        }
      },
      uninit: function () {
        var _appNameToRemove = _imiconnect && _imiconnect.appName;

        try {
          if (IMI._authTokenManager
              && typeof IMI._authTokenManager.clearToken === "function") {
            IMI._authTokenManager.clearToken();
          }
        } catch (ex) {
          IMI.log(ex);
        }
       
        _imiconnect._pendingPushReplay = null;

        try {
          var _mi = IMI.ICMessaging.getInstance();
          if (_mi && _mi._stopSwPing) _mi._stopSwPing();
        } catch (ex) {
          IMI.log(ex);
        }

        try {
          if (_imiconnect._swMessageHandler) {
            document.removeEventListener(IMI.BackgroundServiceEventType.MessageFromServiceWorker, _imiconnect._swMessageHandler);
            _imiconnect._swMessageHandler = null;
          }
        } catch (ex) {
          IMI.log(ex);
        }


        try {
          if (_imiconnect._swVersionCheckHandler) {
            navigator.serviceWorker.removeEventListener('message', _imiconnect._swVersionCheckHandler);
            _imiconnect._swVersionCheckHandler = null;
          }
        } catch (ex) {
          IMI.log(ex);
        }

        var _swScopeForDereg = _imiconnect.backgroundService
          ? _imiconnect.backgroundService.swScope
          : null;

        try {
          if (_imiconnect.webpush) {
            _imiconnect.webpush.shouldDisplayNotification = false;
            if (_imiconnect.webpush._unsubscribeOnMessage) {
              try { _imiconnect.webpush._unsubscribeOnMessage(); } catch (e) { IMI.log(e); }
              _imiconnect.webpush._unsubscribeOnMessage = null;
            }
          }
          if (typeof window !== "undefined" && typeof window._unsubscribeOnMessage === "function") {
            try { window._unsubscribeOnMessage(); } catch (e) { IMI.log(e); }
            window._unsubscribeOnMessage = null;
          }
        } catch (ex) {
          IMI.log(ex);
        }

        try {
          _imiconnect._deregisterClientFromServiceWorkers(_swScopeForDereg);
        } catch (ex) {
          IMI.log(ex);
        }


        var _firebaseDeletePromise = Promise.resolve();
        try {
          if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            _firebaseDeletePromise = firebase.app().delete();
          }
        } catch (ex) {
          IMI.log(ex);
        }

        try {
          if (_appNameToRemove && IMI.BackgroundServiceManager && IMI.BackgroundServiceManager.removeInstance) {
            IMI.BackgroundServiceManager.removeInstance(_appNameToRemove);
          }
        } catch (ex) {
          IMI.log(ex);
        }

        messaging = undefined;

        _messagingInstance = null;

        IMI._swScope = null;

        if (_imiconnect) {
          _imiconnect.webpush = null;
          _imiconnect.backgroundService = null;
          _imiconnect.icConfig = null;
          _imiconnect.iCDeviceProfile = null;
          _imiconnect.isRTEnabled = false;
          _imiconnect.isLocationEnabled = false;
          _imiconnect.isEncryptionEnabled = false;
          _imiconnect.isPushEnabled = false;
          _imiconnect.isMultiProfileEnabled = false;
          _imiconnect.isFirebaseConfigAvailable = false;
          _imiconnect.enableAuthTokenExchange = false;
          _imiconnect.appName = null;
          _imiconnect.appSecret = null;
          _imiconnect.clientId = null;
          _imiconnect.accessToken = "";
          _imiconnect.refreshToken = "";
          _imiconnect.securityToken = null;
          _imiconnect.serverInboxVersion = null;
          _imiconnect.encryptionType = null;
          _imiconnect.encryptionKey = null;
          _imiconnect.encriptionKey = null;
          _imiconnect.appDomain = null;
          _imiconnect.profileTTL = null;
        }

   
        return _firebaseDeletePromise.catch(function (e) { IMI.log(e); });
      },
      isRegistered: function () {
        var appregistered = _db.get("appregistered");
        if (appregistered !== null && appregistered === true) {
          return true;
        }
        return false;
      },
      register: function (deviceProfile, callback) {
        try {
          var self = this;
          self._isInitialized();
          self._assertAlreadyProcessing();
          self.registrationState = IMI.RegistrationState.REGISTERING;
          self.assertProfile(deviceProfile);
          var shouldUnregister = false;
          var cachedDeviceProfile = self.getDeviceProfile();
          if (_imiconnect.isMultiProfileEnabled) {
            if (_imiconnect.isRegistered() && cachedDeviceProfile) {
              if (deviceProfile.userId == cachedDeviceProfile.userId) {
                throw IMI.ICErrorCodes.DeviceIdAlreadyRegistered;
              }
              shouldUnregister = true
            }
          } else {
            if (_imiconnect.isRegistered()) {
              throw IMI.ICErrorCodes.DeviceIdAlreadyRegistered;
            }
          }
          if (shouldUnregister) {
            self._clearUserData();
          }
          _imiconnect.registerWithServer(deviceProfile, callback);

        }
        catch (ex) {
          if (self.registrationState == IMI.RegistrationState.REGISTERING && self.isRegistered())
            self.registrationState = IMI.RegistrationState.NONE;

          IMI.log(ex);
          if (callback && IMI.isFunction(callback.onFailure)) {
            callback.onFailure(ex);
          } else {
            throw ex;
          }
        }
      },
      _clearUserData: function (callback) {
        try {
          if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange
              && IMI._authTokenManager
              && typeof IMI._authTokenManager.clearToken === "function") {
            IMI._authTokenManager.clearToken();
          }
        } catch (ex) {
          IMI.log(ex);
        }


        _imiconnect.securityToken = null;
        _imiconnect.isTokenValid = false;


        _imiconnect._pendingPushReplay = null;

        _imiconnect.backgroundService.postMessage(IMI.EventType.DeviceUnregistered);
        
        if (_messagingInstance && _messagingInstance.isConnected()) {
          _messagingInstance.disconnect();
        }

        if (_imiconnect.isPushEnabled && _imiconnect.webpush) {
          _imiconnect.webpush.setPushNotificationDisplay(false);
          _db.remove("pushRegistered");
        }
        _db.remove("appName");
        _db.remove("appSecret");
        _db.remove("userId");
        _db.remove("deviceId");
        _db.remove("policyUpdate");
        _db.remove("appregistered");
        _db.remove("regiterResp");
        _db.remove(_dbKeys.HEARTBEAT_SENT_AT);
        _imiconnect.iCDeviceProfile = null;
        _imiconnect.isRTEnabled = false;
        _imiconnect.isLocationEnabled = false;
        _imiconnect.isEncryptionEnabled = false;
        _imiconnect.isPushEnabled = false;
        _imiconnect.isMultiProfileEnabled = false;

        try {
          var _tabIdKeyDereg = (_imiconnect.appName || "") + "._tabId";
          var _tabId = sessionStorage.getItem(_tabIdKeyDereg);
          _db.set(
            "deRegisterEvent",
            _tabId + "_deregister_" + new Date().getTime()
          );
        } catch (err) { }
        if (
          callback &&
          callback.onSuccess &&
          IMI.isFunction(callback.onSuccess)
        ) {
          callback.onSuccess();
        }
      },
      registerWithServer: function (deviceProfile, callback) {
        var self = this;
        _deviceId = deviceProfile.deviceId;
        _db.set("deviceId", _deviceId);
        var appId = _imiconnect.icConfig.getAppID();
        var clientKey = _imiconnect.icConfig.getClientKey();
        //registering user
        var userId = deviceProfile.userId || "";
        var registerURL = rtmsAPIURL + "/" + appId + "/register";
        var data = {
          tenant: "1",
          userId: userId,
          channel: "rt",
          channelType: "web",
          deviceId: _deviceId,
          profileVersion: 2,
          data: {
            update: {
              useragent: navigator.userAgent,
              os: IMI.getBrowserName(),
              osversion: IMI.getbrowserVersion(),
              language: navigator.language,
            },
          },
        };
        var requestData = JSON.stringify(data);

        var _retryContext = { hasRetried: false, retryFn: null };

        function _proceedWithRegister() {
          var headers = _imiconnect._getAjaxHeader();
          $.ajax({
            url: registerURL,
            type: "POST",
            headers: headers,
            data: requestData,
            success: function (respObj) {
            _db.set("policyUpdate", respObj);
            _db.set(_dbKeys.CURRENT_SDK_VERSION, JS_SDK_VERSION);
            _imiconnect.registrationState = IMI.RegistrationState.NONE;
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              var isSystemGenerated = false;
              if (userId === "" || userId === undefined || userId === null) {
                isSystemGenerated = true;
                userId = respObj.userId;
              }
              _imiconnect.iCDeviceProfile = new IMI.ICDeviceProfile(
                _deviceId,
                userId,
                null,
                isSystemGenerated
              );
              _db.set("isSystemGenerated", isSystemGenerated);
              _db.set("userId", userId);
              _db.set("appName", appId);
              _db.set("appSecret", clientKey);
              _db.set("appregistered", true);
              _db.set("regiterResp", respObj);
              _db.set(_dbKeys.HEARTBEAT_SENT_AT, Date.now());
              self._changePolicyDetails(respObj);

              _imiconnect.clientId = appId + "/" + userId + "/" + webprefix + _imiconnect.iCDeviceProfile.deviceId;
              let backgroundServiceCallback = {
                onSuccess: function (res) {
                  if (!_imiconnect._swMessageHandler) {
                    _imiconnect._swMessageHandler = (ev) => _imiconnect._onServiceWorkerMessageHandler(ev);
                  }
                  document.addEventListener(IMI.BackgroundServiceEventType.MessageFromServiceWorker, _imiconnect._swMessageHandler);
                  _imiconnect.backgroundService.postMessage(IMI.EventType.DeviceRegistered, { "userId": userId, "headers": _imiconnect._getAjaxHeader() });
                  _imiconnect._registerClientWithServiceWorkers(appId, _imiconnect.backgroundService && _imiconnect.backgroundService.swScope);
                  if (_imiconnect.isPushEnabled && _imiconnect.webpush && _imiconnect.isFirebaseConfigAvailable) {
                    try {
                      _imiconnect.webpush.setPushNotificationDisplay(true);
                      _imiconnect.webpush.init(appId, userId);
                    } catch (ex) {
                      IMI.log(ex);
                    }
                  }
                },
                onFailure: function (err) {
                  IMI.log('Register: backgroundServiceCallback: onFailure: err', err);
                }
              }
              if (_imiconnect.backgroundService)
                backgroundServiceCallback.onSuccess();
              else {
                _imiconnect.backgroundService = IMI.BackgroundServiceManager.getInstance(_imiconnect.appName, backgroundServiceCallback);
              }

              if (callback && callback.onSuccess) {
                callback.onSuccess({ userId: userId });
              }
            } else if (
              respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj, _retryContext);
            } else {
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(respObj.status);
              }

              _db.set("appregistered", false);
            }

          },
          error: function (responseData, textStatus, errorThrown) {
            _imiconnect.registrationState = IMI.RegistrationState.NONE;
            if (callback && IMI.isFunction(callback.onFailure)) {
              callback.onFailure(errorThrown);
            }
          }
          });
        }

        _retryContext.retryFn = _proceedWithRegister;


        if (_imiconnect.icConfig
            && _imiconnect.icConfig.enableAuthTokenExchange
            && IMI._authTokenManager) {
          if (!_imiconnect.securityToken) {
            _imiconnect.registrationState = IMI.RegistrationState.NONE;
            if (callback && IMI.isFunction(callback.onFailure)) {
              callback.onFailure(IMI.ICErrorCodes.TokenRequired);
            }
            return;
          }
          IMI._authTokenManager.generateToken(_deviceId, userId)
            .then(function (token) {
              if (!token) {
                _imiconnect.registrationState = IMI.RegistrationState.NONE;
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure(IMI.ICErrorCodes.RestFailure);
                }
                return;
              }
              _proceedWithRegister();
            })
            .catch(function (e) {
              var normalized = IMI._authTokenManager._normalizeError(e);
              IMI.log("Pre-registration token generation failed: "
                + normalized.code + " " + normalized.description);
              _imiconnect.registrationState = IMI.RegistrationState.NONE;
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(normalized);
              }
            });
        } else {
          _proceedWithRegister();
        }
      },
      _migrateTov130: function () {
        _db.set(_dbKeys.APP_REGISTERED, false);
      },

      _isInitialized: function () {
        if (
          _imiconnect.icConfig == null ||
          _imiconnect.icConfig == undefined ||
          !(_imiconnect.icConfig instanceof IMI.ICConfig)
        ) {
          throw IMI.ICErrorCodes.NotInitialized;
        }
        return true;
      },
      updateProfileData: function (deviceParam, value, callback) {
        var self = this;
        self._isInitialized();
        self.isDeviceRegistered();
        if (!IMI.defined(value)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Please provide the valid value");
        }
        if (deviceParam === IMI.ICDeviceProfileParam.UserId) {
          //update user Id
          self.updateUserId(value, callback);
        } else if (deviceParam === IMI.ICDeviceProfileParam.CustomerId) {
          //CustomerId
          self.updateCustomerId(value, callback);
        }
      },
      removeProfileData: function (deviceParam, callback) {
        var self = this;
        self._isInitialized();
        self.isDeviceRegistered();
        if (deviceParam === IMI.ICDeviceProfileParam.UserId) {
          //update user Id
          self.removeUserId(callback);
        } else if (deviceParam === IMI.ICDeviceProfileParam.CustomerId) {
          //CustomerId
          self.removeCustomerId(callback);
        }
      },
      updateUserId: function (userId, callback) {
        var self = this;
        var setUserIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/setUserId";
        var userUpdateJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
          userId: userId,
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(userUpdateJSON)
        );
        var headers = _imiconnect._getAjaxHeader();
        var apiCallback = {
          onSuccess: function (respObj) {
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
              userId = userId || respObj.userId;
              //unscribe,disc,connect
              self.updateAppUser(userId, false);
              self._updateAccessToken(respObj);
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          error: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          }
        }
        IMI.Post(setUserIdURL, requestData, headers, apiCallback);
      },
      _updateAccessToken: function (respObj) {
        if (respObj) {
          var registerResp = _db.get("regiterResp");
          if (respObj.accessToken) {
            _imiconnect.refreshToken = respObj.refreshToken;
            _imiconnect.accessToken = respObj.accessToken;
            _imiconnect.encryptionKey = respObj.encryptionKey;
            if (registerResp) {
              _imiconnect.encryptionType = registerResp.encryptionType || "DES";
              if (_imiconnect.encryptionType === "AES") {
                registerResp.encryptionKey = respObj.encryptionKey;
              } else {
                registerResp.encryptionKey =
                  _imiconnect.icConfig.getAppID().substring(0, 3) +
                  _imiconnect.icConfig.getClientKey();
              }

              registerResp.refreshToken = respObj.refreshToken;
              registerResp.accessToken = respObj.accessToken;
              _db.set("regiterResp", registerResp);
              _imiconnect.backgroundService.postMessage(IMI.EventType.UpdateAjaxHeaders, { "headers": _imiconnect._getAjaxHeader() });
            }
          }
        }
      },
      updateCustomerId: function (customerId, callback) {
        var self = this;
        var setCustomerIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/setCustomerId";
        var customerUpdateJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
          customerId: customerId,
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(customerUpdateJSON)
        );
        var headers = _imiconnect._getAjaxHeader();
        var apiCallback = {
          onSuccess: function (respObj) {
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              //actions after update customerId
              _imiconnect.iCDeviceProfile.customerId = customerId;
              _db.set("customerId", customerId);
              //actions  need to do after customer id change
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          onFailure: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        }
        IMI.Post(setCustomerIdURL, requestData, headers, apiCallback);
      },
      removeUserId: function (callback) {
        var self = this;
        var removeUserIdURL =
          elbZeroRatingURL + "/" + _imiconnect.appName + "/removeUserId";
        var removeUserIdJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var requestData = _messagingInstance._getPayLoadMsg(
          JSON.stringify(removeUserIdJSON)
        );
        var headers = _imiconnect._getAjaxHeader();
        var apiCallback = {
          onSuccess: function (respObj) {
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              //actions after update customerId
              var userId = respObj.userId;
              //actions  need to do after removing userId
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
              //unscribe,disc,connect
              self.updateAppUser(userId, true);
              self._updateAccessToken(respObj);
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          onFailure: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        };
        IMI.Post(removeUserIdURL, requestData, headers, apiCallback);
      },
      removeCustomerId: function (callback) {
        var self = this;
        var removeCustomerIdURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/removeCustomerId";
        var removeCustJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var reqbody = _messagingInstance._getPayLoadMsg(JSON.stringify(removeCustJSON));
        var headers = _imiconnect._getAjaxHeader();
        var apiCallback = {
          onSuccess: function (respObj) {
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              //actions after update customerId
              //actions  need to do after removing customerId
              if (callback && callback.onSuccess) {
                callback.onSuccess(respObj);
              }
            } else if (respObj && respObj.code != "0") {
              _imiconnect._invokeFailureCallBack(callback, respObj);
            } else {
              if (callback && callback.onFailure) {
                callback.onFailure(respObj.status);
              }
            }
          },
          onFailure: function (responseData, textStatus, errorThrown) {
            if (callback && callback.onFailure) {
              callback.onFailure(errorThrown);
            }
          },
        }
        IMI.Post(removeCustomerIdURL, reqbody, headers, apiCallback);
      },
      updateAppUser: function (newUserId, isSystemGenerated) {
        var self = this;
        try {
          var oldUserId = _imiconnect.iCDeviceProfile.userId;
          var isStarted = IMI.ICMessaging.isStarted();
          if (oldUserId !== null && oldUserId === newUserId) return;
          if (isStarted) {
            var messagingObj = IMI.ICMessaging.getInstance();
            isConnected = messagingObj.isConnected();

            if (isStarted && isConnected) {
              messagingObj.disconnect();
            }
          }
          _imiconnect.iCDeviceProfile._setUserId(newUserId, isSystemGenerated);
          _imiconnect.backgroundService.postMessage(IMI.EventType.UserIdUpdated, { "userId": newUserId, "headers": _imiconnect._getAjaxHeader() });
          self.saveDeviceProfile();
          try {
            var _tabIdKeyUpdate = (_imiconnect.appName || "") + "._tabId";
            var _tabId = sessionStorage.getItem(_tabIdKeyUpdate);
            _db.set(
              "updateUserEvent",
              _tabId + "_updateuser_" + new Date().getTime()
            );
          } catch (err) { }
          var messagingObj = IMI.ICMessaging.getInstance();

          if (isStarted && isConnected) {
            messagingObj.isDisconnected = false;
            messagingObj.connect();
          }
        } catch (ex) {
          IMI.log(ex);
        }
      },
      setSecurityToken: function (token) {
        var self = this;
        self._isInitialized();

        // Capture the previous JWT so we can detect a real change vs. the
        // first set after startup. `null` is the post-startup() initial value
        // (line ~1793); `undefined` covers any caller that may have deleted it.
        var oldJwt = _imiconnect.securityToken;

        // 1. Update SDK state first so refreshToken() sees the new JWT when
        //    it reads _imiconnect.securityToken.
        if (token) {
          _imiconnect.isTokenValid = true;
          _imiconnect.securityToken = "Bearer " + token;
          _imiconnect._shouldNotifySecurityTokenListener = true;
        }
        else {
          delete _imiconnect.securityToken;
        }

        // 2. Exchange-mode side effects with the NEW JWT in place.
        if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange
            && IMI._authTokenManager) {
          var newJwt = token ? "Bearer " + token : null;
          var jwtChanged = newJwt !== oldJwt;

          // Skip clearToken+refreshToken on the very first set after
          // startup(). startup() unconditionally sets securityToken to null,
          // so this is the customer's first feed of the JWT — there's no
          // stale OAuth to wipe. The first business call's 38/39/40 retry
          // path mints the access token on demand.
          var isFirstSetAfterStartup = (oldJwt === null || oldJwt === undefined);

          if (jwtChanged && !isFirstSetAfterStartup) {
            IMI._authTokenManager.clearToken();

            if (token && _imiconnect.iCDeviceProfile) {
              IMI._authTokenManager.refreshToken().catch(function (e) {
                var ne = IMI._authTokenManager._normalizeError(e);
                IMI.log("Refresh after JWT change failed: " + (ne.description || ""));
                if (typeof _imiconnect._invokeSecurityTokenListeners === "function") {
                  var errorCode = _imiconnect._getErrorCode(ne.code);
                  if (errorCode === IMI.ICErrorCodes.TokenExpired
                      || errorCode === IMI.ICErrorCodes.TokenRequired
                      || errorCode === IMI.ICErrorCodes.InvalidToken) {
                    _imiconnect._invokeSecurityTokenListeners(errorCode);
                  }
                }
              });
            }
          }
        }

        try {
          if (_imiconnect.backgroundService
              && typeof _imiconnect.backgroundService.postMessage === "function") {
            _imiconnect.backgroundService.postMessage(IMI.EventType.UpdateAjaxHeaders, {
              "headers": _imiconnect._getAjaxHeader()
              , isTokenValid: _imiconnect.isTokenValid
            });
          }
        } catch (ex) {
          IMI.log(ex);
        }
      },
      registerListener: function (callback) {
        var self = this;
        self._isInitialized();
        if (!callback || !IMI.isObject(callback)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must not be undefined");
        }
        if (typeof callback.onFailure != 'function')
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must contain an onFailure handler");

        var isDupicateListener = false;
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var meth = _imiconnect.registerListenerObjs[i];
          if (meth === callback) {
            isDupicateListener = true;
          }
        }
        if (isDupicateListener) {
          throw IMI.ICErrorCodes.DuplicateRegisterListener;
        } else {
          _imiconnect.registerListenerObjs.push(callback);
        }
      },
      registerSecurityTokenListener: function (callback) {
        var self = this;
        self._isInitialized();
        if (!callback || !IMI.isObject(callback)) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must not be undefined");
        }
        if (typeof callback.onFailure != 'function')
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "callback must contain an onFailure handler");

        var isDupicateListener = false;
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var meth = _imiconnect.registerListenerObjs[i];
          if (meth === callback) {
            isDupicateListener = true;
          }
        }
        if (isDupicateListener) {
          throw IMI.ICErrorCodes.DuplicateRegisterListener;
        } else {
          _imiconnect.registerListenerObjs.push(callback);
        }
      },
      unregisterListener: function (unRegObj) {
        var self = this;
        self._isInitialized();
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var listenerObj = _imiconnect.registerListenerObjs[i];
          if (listenerObj == unRegObj) {
            _imiconnect.registerListenerObjs.splice(i, 1);
            break;
          }
        }
      },
      unregisterSecurityTokenListener: function (unRegObj) {
        var self = this;
        self._isInitialized();
        for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
          var listenerObj = _imiconnect.registerListenerObjs[i];
          if (listenerObj == unRegObj) {
            _imiconnect.registerListenerObjs.splice(i, 1);
            break;
          }
        }
      },
      _invokeSecurityTokenListeners: function (errorCode) {
        if (_imiconnect.icConfig
            && _imiconnect.icConfig.enableAuthTokenExchange
            && _imiconnect._shouldNotifySecurityTokenListener === false) return;
        _imiconnect._shouldNotifySecurityTokenListener = false;
        _imiconnect.isTokenValid = false;
 
          try {
            if (_imiconnect.backgroundService
                && typeof _imiconnect.backgroundService.postMessage === "function") {
              _imiconnect.backgroundService.postMessage(IMI.EventType.UpdateAjaxHeaders, {
                "headers": _imiconnect._getAjaxHeader()
                , isTokenValid: _imiconnect.isTokenValid
              });
            }
          } catch (ex) {
            IMI.log(ex);
          }
        
        try {
          if (errorCode) {
            for (var i = 0; i < _imiconnect.registerListenerObjs.length; i++) {
              var listenerObj = _imiconnect.registerListenerObjs[i];
              if (listenerObj.onFailure) {
                listenerObj.onFailure(errorCode);
              }
            }
          }
        } catch (err) {
          IMI.log(err);
        }
      },
      _getErrorCode: function (code) {
        var errorCode;
        if (code === 38 || code === 6027) {
          errorCode = IMI.ICErrorCodes.InvalidToken;
        } else if (code === 39 || code === 6030) {
          errorCode = IMI.ICErrorCodes.TokenRequired;
        } else if (code === 40 || code === 6029) {
          errorCode = IMI.ICErrorCodes.TokenExpired;
        } else if (code === 6100) {
          errorCode = IMI.ICErrorCodes.RestFailure;
        } else if (code === 36) {
          errorCode = IMI.ICErrorCodes.InvalidContentType;
        } else if (code === 3) {
          errorCode = IMI.ICErrorCodes.InvalidParameterValue;
        } else if (code === 62) {
          errorCode = IMI.ICErrorCodes.FeatureNotSupported;
        } else if (code === 84) {
          errorCode = IMI.ICErrorCodes.SDKVersionNotSupported;
        } else {
          errorCode = IMI.ICErrorCodes.Unknown;
        }
        return errorCode;
      },
      _getErrorWithDescription: function (icErrorCode, detailedDescription) {
        let ex = new Object();
        Object.assign(ex, icErrorCode);
        ex.description = detailedDescription;
        return ex;
      },
      _updatePolicyCheck: function (callback) {
        try {
          var policyUpdateURL = rtmsAPIURL + "/" + _imiconnect.appName + "/verifyPolicy?os=" + IMI.getBrowserName();
          $.ajax({
            url: policyUpdateURL,
            headers: _imiconnect._getAjaxHeader(),
            type: "GET",
            success: function (resrmsg) {
              _imiconnect._processUnsupportedSDKVersion(resrmsg);
              _db.set("policyUpdate", resrmsg);
              _imiconnect._changePolicyDetails(resrmsg);
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                callback.onSuccess();
              }
            },
            error: function (responseData, textStatus, errorThrown) {
              IMI.log("retriving policy failed", responseData);
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure();
              }
            },
          });
        } catch (err) {
          IMI.log(err);
          throw err;
        }
      },
      deRegisterDeviceProfile: function (callback) {
        var deRegisterURL = rtmsAPIURL + "/" + _imiconnect.appName + "/unregister";
        var deRegisterJSON = {
          clientId: _imiconnect.clientId,
          channel: "rt",
          channelType: "web",
        };
        var unRegDevProfReq = _messagingInstance._getPayLoadMsg(
          JSON.stringify(deRegisterJSON)
        );
        var headers = _imiconnect._getAjaxHeader();
        var apiCallback = {
          onSuccess: function (respObj) {
            _imiconnect._processUnsupportedSDKVersion(respObj);
            if (respObj.status === "Success") {
              //actions need to take after degister
              _db.set("appregistered", false);
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                callback.onSuccess();
              }
            } else if (respObj && respObj.code != "0") {

              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(respObj);
              }
            }
          },
          onFailure: function (responseData, textStatus, errorThrown) {
            IMI.log("retriving policy failed");
            if (
              callback &&
              callback.onFailure &&
              IMI.isFunction(callback.onFailure)
            ) {
              callback.onFailure();
            }
          }
        }
        IMI.Post(deRegisterURL, unRegDevProfReq, headers, apiCallback);
      },
      _invokeFailureCallBack: function (callback, respObj, _retryContext) {
        if (
          !callback ||
          !callback.onFailure ||
          !IMI.isFunction(callback.onFailure) ||
          !respObj
        ) {
          return;
        }

        var errorCode = _imiconnect._getErrorCode(respObj.code);

        // `_getErrorCode` collapses any server code it doesn't explicitly
        // recognize into the generic ICErrorCodes.Unknown (6999), which throws
        // away the real code/description the server sent and makes failures
        // undiagnosable ("Unknown error"). When that happens, deliver an error
        // that carries the server's actual code and message instead. Known
        // codes (token errors, etc.) keep their mapped ICErrorCodes reference
        // so the retry/token-refresh comparisons below are unaffected.
        var deliveredError = errorCode;
        if (
          errorCode === IMI.ICErrorCodes.Unknown &&
          ((respObj.code !== undefined && respObj.code !== null) ||
            respObj.description ||
            respObj.message)
        ) {
          deliveredError = {
            code:
              respObj.code !== undefined && respObj.code !== null
                ? respObj.code
                : IMI.ICErrorCodes.Unknown.code,
            description:
              respObj.description ||
              respObj.message ||
              respObj.reason ||
              IMI.ICErrorCodes.Unknown.description,
          };
          IMI.log("API failure with unmapped server code:", respObj);
        }

        if (_imiconnect.icConfig
            && _imiconnect.icConfig.enableAuthTokenExchange
            && _retryContext
            && IMI._authTokenManager) {
          var decision = IMI._authTokenManager.decideOnTokenError(errorCode, _retryContext);
          var RetryDecision = IMI._authTokenManager.RetryDecision;

          if (decision.kind === RetryDecision.RetryWithFreshAuth) {
            _retryContext.hasRetried = true;
            IMI._authTokenManager.refreshToken().then(
              function (token) {
                if (!token) {
                  callback.onFailure(errorCode);
                  return;
                }
                if (typeof _retryContext.retryFn === "function") {
                  _retryContext.retryFn();
                } else {
                  callback.onFailure(errorCode);
                }
              },
              function (refreshErr) {
                var ne = IMI._authTokenManager._normalizeError(refreshErr);
                IMI.log("refreshToken failed during retry: " + (ne.description || ""));
                var refreshCode = _imiconnect._getErrorCode(ne.code);
                callback.onFailure(refreshCode);
              }
            );
            return;            // retry in flight — don't deliver yet
          }

          // decision.kind === Proceed
          if (decision.notifyListener) {
            _imiconnect._invokeSecurityTokenListeners(errorCode);
          }
          callback.onFailure(deliveredError);
          return;
        }
        // ---- END NEW ----

        if (errorCode == IMI.ICErrorCodes.TokenExpired
          || errorCode == IMI.ICErrorCodes.TokenRequired
          || errorCode == IMI.ICErrorCodes.InvalidToken) {
          _imiconnect._invokeSecurityTokenListeners(errorCode);
        }
        callback.onFailure(deliveredError);
      },
      _getRtmsDomainUrl: function () {
        if (_imiconnect.serverInboxVersion) return elbZeroRatingURLV4;
        else return elbZeroRatingURL;
      },
      _changePolicyDetails: function (updatedData) {
        try {
          var policy = updatedData.policy || {};
          var features = policy.features || {};
          var broker = updatedData.broker || {};
          var appType = updatedData.appType || "";
          _imiconnect.appType = appType;
          //checking rt
          if (features.realtimemessaging === undefined) {
            features.realtimemessaging = "1";
            if (protocol === "https:") {
              isSSL = true;
              features.securedconnection = "1";
            }
          }
          if (features.realtimemessaging === "1") {
            _imiconnect.isRTEnabled = true;
          } else {
            //disable rt
            if (
              _imiconnect.isRTEnabled &&
              _messagingInstance &&
              _messagingInstance.isConnected()
            ) {
              try {
                _messagingInstance.disconnect();
              } catch (err) {
                IMI.log(err);
              }
            }
            _imiconnect.isRTEnabled = false;
          }
          //verify push
          if (features.basicpush === "1") {
            _imiconnect.isPushEnabled = true;
          } else {
            if (_imiconnect.isPushEnabled && _imiconnect.webpush) {
              try {
                _imiconnect.webpush.unsubscribe({
                  onSuccess: function (res) {
                    IMI.log('Unsubscribe push result:', res);
                  }
                });
              } catch (err) {
                IMI.log(err);
              }
            }
            _imiconnect.isPushEnabled = false;
          }
          _imiconnect.isEncryptionEnabled = features.encryption === "1";
          isSSL = features.securedconnection === "1";
          //check broker details
          if (isSSL) {
            port = broker.wss ? parseInt(broker.wss) : 8884;
          } else {
            port = broker.ws ? parseInt(broker.ws) : 1884;
          }
          rtmsdomain = broker.ip || rtmsdomain;
          var registerResp = _db.get("regiterResp");
          if (registerResp) {
            _imiconnect.encryptionType = registerResp.encryptionType || "DES";
            if (_imiconnect.encryptionType === "AES") {
              _imiconnect.encryptionKey = registerResp.encryptionKey;
            } else {
              _imiconnect.encriptionKey =
                _imiconnect.icConfig.getAppID().substring(0, 3) +
                _imiconnect.icConfig.getClientKey();
            }
            _imiconnect.refreshToken = registerResp.refreshToken;
            _imiconnect.accessToken = registerResp.accessToken;
            _imiconnect.appDomain = registerResp.appDomain;
            if (_imiconnect.appDomain) {
              elbZeroRatingURL = elbZeroRatingURLTemplate.replace(
                "$(domain)",
                _imiconnect.appDomain
              );
              elbZeroRatingUploadURL = elbZeroRatingURLUploadFile.replace(
                "$(domain)",
                _imiconnect.appDomain
              );
            }
            _imiconnect.serverInboxVersion =
              registerResp[SERVER_INBOX_VERSION_TAG_FOR_V4];
            _imiconnect.isMultiProfileEnabled = registerResp["multiProfileEnabled"];
            if (registerResp.profileTTL)
              _imiconnect.profileTTL = registerResp.profileTTL;
          } else {
            _imiconnect.encriptionKey =
              _imiconnect.icConfig.getAppID().substring(0, 3) +
              _imiconnect.icConfig.getClientKey();
          }
        } catch (ex) {
          IMI.log(ex);
        }
      },
      _assertAlreadyProcessing: function () {
        if (_imiconnect.registrationState == IMI.RegistrationState.UNREGISTERING) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.AlreadyProcessing,
            "SDK unregister already processing , you must wait for unregister to complete");
        }
        if (_imiconnect.registrationState == IMI.RegistrationState.REGISTERING) {
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.AlreadyProcessing,
            "SDK registration already processing , you must wait for registration to complete");
        }
      },
      unregister: function (callback) {
        try {
          _imiconnect._isInitialized();
          _imiconnect.isDeviceRegistered();
          _imiconnect._assertAlreadyProcessing();
          //removing profile
          _imiconnect.registrationState = IMI.RegistrationState.UNREGISTERING;
          _imiconnect.deRegisterDeviceProfile({
            onSuccess: function () {
              _imiconnect.registrationState = IMI.RegistrationState.NONE;
              _imiconnect._clearUserData(callback)
            },
            onFailure: function (resp) {
              _imiconnect.registrationState = IMI.RegistrationState.NONE;
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(resp);
              }
            },
          });
        } catch (ex) {
          IMI.log(ex);
          throw ex;
        }
      },
      getPushDetails: function (callbackfun) {
        if (_imiconnect.webpush) {
          _imiconnect.webpush.getWebSubscriptionDetials(callbackfun);
        } else {
          var Obj = {};
          Obj.status = "1";
          Obj.description = "app is not registered, please register";
          callbackfun(Obj);
        }
      },
      _encryptMsg: function (messagePaylod) {
        try {
          if (_imiconnect.isEncryptionEnabled) {
            if (_imiconnect.encryptionType === "DES") {
              messagePaylod = _util.des(
                _imiconnect.encriptionKey,
                messagePaylod,
                1,
                0,
                null,
                1
              );
              messagePaylod = btoa(messagePaylod);
            } else if (_imiconnect.encryptionType === "AES") {
              messagePaylod = _util.aes(
                messagePaylod,
                _imiconnect.encryptionKey,
                0
              );
            }
          }
        } catch (err) {
          IMI.log(err);
        }

        return messagePaylod;
      },
      _decryptMsg: function (messagePaylod) {
        try {
          if (_imiconnect.isEncryptionEnabled) {
            if (_imiconnect.encryptionType === "DES") {
              var text = atob(messagePaylod);
              messagePaylod = _util.des(
                _imiconnect.encriptionKey,
                text,
                0,
                0,
                null,
                1
              );
              messagePaylod = messagePaylod.substr(
                0,
                messagePaylod.lastIndexOf("}") + 1
              );
            } else if (_imiconnect.encryptionType === "AES") {
              messagePaylod = _util.aes(
                messagePaylod,
                _imiconnect.encryptionKey,
                1
              );
            }
          }
        } catch (err) {
          try {
            if (_imiconnect.isEncryptionEnabled) {
              if (_imiconnect.encryptionType === "DES") {
                messagePaylod = messagePaylod.replace(/\n/g, "");
                var text = _util.decodeBase64(messagePaylod);
                messagePaylod = _util.des(
                  _imiconnect.encriptionKey,
                  text,
                  0,
                  0,
                  null,
                  1
                );
                messagePaylod = messagePaylod.substr(
                  0,
                  messagePaylod.lastIndexOf("}") + 1
                );
              } else if (_imiconnect.encryptionType === "AES") {
                messagePaylod = _util.aes(
                  messagePaylod,
                  _imiconnect.encryptionKey,
                  1
                );
              }
            }
          } catch (err) {
            IMI.log(err);
          }
        }
        return messagePaylod;
      },
      saveDeviceProfile: function () {
        if (
          _imiconnect.iCDeviceProfile === null ||
          _imiconnect.iCDeviceProfile === undefined
        )
          return;
        _deviceId = _imiconnect.iCDeviceProfile.deviceId;
        var userId = _imiconnect.iCDeviceProfile.userId || "";
        var customerId = _imiconnect.iCDeviceProfile.customerId;
        var appId = _imiconnect.icConfig.getAppID();
        _imiconnect.clientId =
          appId +
          "/" +
          userId +
          "/" +
          webprefix +
          _imiconnect.iCDeviceProfile.deviceId;
        var appId = _imiconnect.appName;
        _db.set("deviceId", _deviceId);
        _db.set("customerId", customerId);
        _db.set("userId", userId);
        _db.set("uniqueClientId", appId + "/" + userId);
        _db.set("clientId", appId + "/" + userId + "/" + webprefix + _deviceId);
      },
      getDeviceProfile: function () {
        return _imiconnect.iCDeviceProfile;
      },
      assertProfile: function (deviceprofile) {
        if (deviceprofile === null || !(deviceprofile instanceof IMI.ICDeviceProfile))
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Profile parameter must not be undefined"
          );
        if (!IMI.defined(deviceprofile.getDeviceId()))
          throw _imiconnect._getErrorWithDescription(
            IMI.ICErrorCodes.InvalidParameterValue,
            "Profile must contain a valid deviceId");
      },
      isDeviceRegistered: function () {
        var self = this;
        var deviceProfile = self.getDeviceProfile();
        if (
          deviceProfile === null ||
          deviceProfile === undefined ||
          deviceProfile.deviceId === undefined ||
          deviceProfile.deviceId === null ||
          deviceProfile.deviceId === ""
        ) {
          throw IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered;
        }
      },
      _checkTTLAndSendHeartBeat: function () {
        let lastSentHeartBeatString = _db.get(_dbKeys.HEARTBEAT_SENT_AT);
        let hearbeat_sent_at = new Date(_db.get(_dbKeys.HEARTBEAT_SENT_AT));
        const diffTime = Math.abs(new Date() - hearbeat_sent_at);
        const daysSinceLastHeartBeatSent = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const MINIMUM_HEARTBEAT_INTERVAL = 15;//days
        if (_imiconnect.profileTTL) {
          if (lastSentHeartBeatString == null) {
            _imiconnect._sendHeartBeatEvent();
            return;
          }
          if (daysSinceLastHeartBeatSent >= _imiconnect.profileTTL) {
            _imiconnect._clearUserData();
            return;
          }
          if (daysSinceLastHeartBeatSent > MINIMUM_HEARTBEAT_INTERVAL) {
            _imiconnect._sendHeartBeatEvent();
            return;
          }
        }
        else
          IMI.log('profileTTL not available');
      },
      _sendHeartBeatEvent: function () {
        var profileUpdateAPIURL = `${elbZeroRatingURL}/${_imiconnect.appName}/profileupdate`;
        var data = {
          clientId: _imiconnect.clientId,
          data: {
            update: {
              sdkheartbeat: 1,
              sdkversion: IMI.getSDKVersion()
            },
          },
          state: "PROFILEUPDATE",
          event: "ProfileUpdate"
        };
        var reqdata = _messagingInstance._getPayLoadMsg(JSON.stringify(data));
        var headers = _imiconnect._getAjaxHeader();
        var callback = {
          onSuccess: function (resp) {
            if (resp.code == "0" || resp.code == 0) {
              _db.set(_dbKeys.HEARTBEAT_SENT_AT, Date.now());
              _imiconnect._processUnsupportedSDKVersion(resp);
            }
          },
          onFailure: function (err) {
            _imiconnect._invokeSecurityTokenListeners(err);
          },
        };
        IMI.Post(profileUpdateAPIURL, reqdata, headers, callback);
      },
      _getAjaxHeader: function () {
        var headers = {
          "Content-Type": "application/json",
          secretKey: _imiconnect.appSecret,
          sdkversion: IMI.getSDKVersion(),
          apilevel: _imiconnect.sdkAPILevel
        };

        if (_imiconnect.icConfig
            && _imiconnect.icConfig.enableAuthTokenExchange
            && IMI._authTokenManager) {
          var cachedToken = IMI._authTokenManager.getCachedToken();
          if (cachedToken && IMI._authTokenManager.isTokenValid(cachedToken)) {
            headers.Authorization = IMI._authTokenManager.toAuthorizationHeader(cachedToken);
          }
        } else if (_imiconnect.securityToken) {
          // Legacy mode: ship the customer JWT verbatim.
          headers.Authorization = _imiconnect.securityToken;
        }

        // The legacy session `accessToken` header is unrelated to the OAuth
        // access token and stays put
        // in both modes.
        if (_imiconnect.accessToken) {
          headers.accessToken = _imiconnect.accessToken;
        }

        if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange) {

          var deviceIdForHeader =
            (_imiconnect.iCDeviceProfile && _imiconnect.iCDeviceProfile.deviceId)
            || _deviceId;
          if (deviceIdForHeader) {
            headers["WX-Device-Id"] = deviceIdForHeader;
          }
        }

        return headers;
      },
      _processUnsupportedSDKVersion: function (respObj) {
        if (respObj.code == IMI.ICErrorCodes.SDKVersionNotSupported.code) {
          _imiconnect._clearUserData();
        }
      }
    };
    return obj;
  })();

  //ICConfig  setting appid and clientkey
  IMI.namespace("IMI.ICConfig");
  IMI.ICConfig = (function () {
    var ICConfig;
    ICConfig = function (env) {
      var self = this;
      self.appid = env.asset.appId;
      self.clientKey = env.asset.appSecret;
      self.assetPath = window.location.origin + "/assets";
      pathConfig = env.asset.pathConfig;
      if (
        pathConfig &&
        pathConfig.assetPath &&
        pathConfig.assetPath.length > 0
      ) {
        self.assetPath = pathConfig.assetPath;
      }
      self.root = "/";
      if (pathConfig && pathConfig.root && pathConfig.root.length > 0) {
        self.root = pathConfig.root;
      }
      self.apis = env.imiclient;
      self.sw = env.sw;
      if (env.imiclient.shouldRequestNotificationPermission != null)
        self.shouldRequestNotificationPermission = env.imiclient.shouldRequestNotificationPermission;
      else
        self.shouldRequestNotificationPermission = true;

      self.enableAuthTokenExchange = env.enableAuthTokenExchange === true;
    };
    ICConfig.prototype = {
      getAppID: function () {
        return this.appid;
      },
      getClientKey: function () {
        return this.clientKey;
      },
      getApis: function () {
        return this.apis;
      },
      getAssetPath: function () {
        return this.assetPath;
      },
      setAssetPath: function (path) {
        self.assetPath = path;
      },
      setRoot: function (folder) {
        self.root = folder;
      },
      getRoot: function () {
        return this.root;
      },
      setShouldRequestNotificationPermission: function (permission) {
        self.shouldRequestNotificationPermission = permission;
      },
      getShouldRequestNotificationPermission: function () {
        return this.shouldRequestNotificationPermission;
      },
    };
    return ICConfig;
  })();

  //ICMessaging
  IMI.namespace("IMI.ICMessaging");
  IMI.ICMessaging = (function ICMessaging() {
    function init() {
      var messagingInstanceObj = {
        //define public methods and variable..
        messagecallback: new IMI.ICMessagingReceiver(),
        isDisconnected: false,
        _unloaded: false,
        _typingState: {},
        connectionStatus: IMI.ICConnectionStatus.None,//current connection status
        _swPingTimer: null,
        _swPongTimeout: null,
        _swPingBaseMs: 15000,
        _swPingJitterMs: 2000,
        _swPongTimeoutMs: 5000,
        _onBroadcastReceived: function (ev) {
          var self = this;
          switch (ev.detail.type) {
            case IMI.EventType.ConnectionEstablished:
              reconnectTimeout = reconnectTimeoutConfig.default;
              self.connectionStatus = IMI.ICConnectionStatus.Connected;
              self.messagecallback.onConnectionStatusChanged(
                IMI.ICConnectionStatus.Connected
              );
              _db.set("isConnectionOpened", true);
              _isConnected = true;
              self.isDisconnected = false;
              self._scheduleSwPing();
              break;
            case IMI.EventType.ConnectionLost:
              self.connectionStatus = IMI.ICConnectionStatus.Refused;
              self.messagecallback.onConnectionStatusChanged(
                IMI.ICConnectionStatus.Refused
              );
              self.scheduleReconnect();
              break;
            case IMI.EventType.ConnectionFailure:
              self.connectionStatus = IMI.ICConnectionStatus.Error;
              self.messagecallback.onConnectionStatusChanged(
                IMI.ICConnectionStatus.Error
              );
              self.scheduleReconnect(); //retry connection after set time interval.
              break;
            case IMI.EventType.MessageArrived:
              self.messagearrived(ev.detail.data);
              break;
            case IMI.EventType.LocalMessageRepublished:
              if (
                self.messagecallback &&
                self.messagecallback.onMessageReceived &&
                IMI.isFunction(self.messagecallback.onMessageReceived)
              ) {
                self.messagecallback.onMessageReceived(IMI.ICMessage.fromJSON(ev.detail.message));
              }
              break;
            default:
              break;
          }
        },
        scheduleReconnect: function () {
          var self = this;
          if (!self.isDisconnected) {
            setTimeout(function () {
              reconnectTimeout = Math.min(reconnectTimeout * 2, reconnectTimeoutConfig.max);
              self._connect.call(self);
            }, reconnectTimeout);
          }
        },
        _scheduleSwPing: function () {
          var self = this;
          if (self._swPingTimer) {
            clearTimeout(self._swPingTimer);
            self._swPingTimer = null;
          }
          if (self.isDisconnected) {
            return;
          }
          var delay = self._swPingBaseMs + Math.floor(Math.random() * self._swPingJitterMs);
          self._swPingTimer = setTimeout(function () {
            self._sendSwPing();
          }, delay);
        },
        _sendSwPing: function () {
          var self = this;
          if (self.isDisconnected) {
            return;
          }
          try {
            _imiconnect.backgroundService.postMessage(IMI.EventType.SwPing);
          } catch (e) {
            IMI.log(e);
          }
          if (self._swPongTimeout) clearTimeout(self._swPongTimeout);
          self._swPongTimeout = setTimeout(function () {
            self._swPongTimeout = null;
            try { self._connect.call(self); } catch (e) { IMI.log(e); }
            self._scheduleSwPing();
          }, self._swPongTimeoutMs);
        },
        _onSwPong: function (data) {
          var self = this;
          if (self._swPongTimeout) {
            clearTimeout(self._swPongTimeout);
            self._swPongTimeout = null;
          }
          var swConnected = !!(data && data.isConnected);
          if (!swConnected) {
            try { self._connect.call(self); } catch (e) { IMI.log(e); }
          }
          self._scheduleSwPing();
        },
        _stopSwPing: function () {
          var self = this;
          if (self._swPingTimer) {
            clearTimeout(self._swPingTimer);
            self._swPingTimer = null;
          }
          if (self._swPongTimeout) {
            clearTimeout(self._swPongTimeout);
            self._swPongTimeout = null;
          }
        },
        connect: function () {
          var self = this;
          try {
            if (!_imiconnect) {
              throw IMI.ICErrorCodes.NotInitialized;
            }
            //verifying whether initilized or not
            _imiconnect._isInitialized();
            //isRegistered
            _imiconnect.isDeviceRegistered();
            //checking connected/connecting
            if (
              self.isConnected() ||
              self.connectionStatus === IMI.ICConnectionStatus.Connecting
            ) {
              IMI.log(IMI.ICErrorCodes.ConnectionAlreadyExists);
              return;
            }
            //connecting to server
            self._connect();
          } catch (ex) {
            IMI.log("connect", ex);
            throw ex;
          }
        },
        _connect: function () {
          var self = this;
          try {
            if (!_imiconnect.isRTEnabled) {
              throw IMI.ICErrorCodes.FeatureNotSupported;
            }
            self.connectionStatus = IMI.ICConnectionStatus.Connecting;
            self.messagecallback.onConnectionStatusChanged(
              IMI.ICConnectionStatus.Connecting
            );

            var icConfig = _imiconnect.icConfig;
            let connectionData = {
              appName: icConfig.getAppID(),
              rtmsdomain: rtmsdomain,
              port: port,
              isSSL: isSSL,
              password: icConfig.getClientKey(),
              userId: _imiconnect.iCDeviceProfile.userId || _db.get("userId"),
              uniqueClientId: `${icConfig.getAppID()}/${_imiconnect.iCDeviceProfile.userId || _db.get("userId")}`,
            };
            connectionData.connClientId = `${connectionData.uniqueClientId}/${webprefix}${_imiconnect.iCDeviceProfile.deviceId}`;
            if (_imiconnect.accessToken) {
              connectionData.connClientId = `${connectionData.connClientId}/at_${_imiconnect.accessToken}`;
            }
            connectionData.topic = "Updates/" + IMI.getBrowserName();
            _imiconnect._registerClientWithServiceWorkers(_imiconnect.appName, _imiconnect.backgroundService && _imiconnect.backgroundService.swScope);
            _imiconnect.backgroundService.postMessage(IMI.EventType.RequestConnection, connectionData);
          } catch (ex) {
            IMI.log("_connect", ex);
            throw ex;
          }
        },
        _reconnect: function () {
          var self = this;
          if (self.isConnected()) {
            _imiconnect._registerClientWithServiceWorkers(_imiconnect.appName, _imiconnect.backgroundService && _imiconnect.backgroundService.swScope);
            _imiconnect.backgroundService.postMessage(IMI.EventType.Reconnect);
          }
        },
        messagearrived: function (message) {
          var self = this;
          try {
            //decrypt message if encription enabled
            var payLoadStr = _imiconnect._decryptMsg(message.payloadString);
            payLoadStr = JSON.parse(payLoadStr);
            var msgObj = IMI.ICMessage.fromJSON(payLoadStr);
            if (
              msgObj &&
              msgObj.getTopic() &&
              msgObj.getTopic().indexOf("Updates/" + IMI.getBrowserName()) !==
              -1
            ) {
              //verify policy
              if (_imiconnect) {
                try {
                  _imiconnect._updatePolicyCheck();
                } catch (er) {
                  IMI.log(er);
                }
              }
            } else {
              var shouldSkipMessage =
                _imiconnect.appName === msgObj.getAppId() &&
                _imiconnect.iCDeviceProfile.userId === msgObj.getUserId() &&
                _imiconnect.iCDeviceProfile.deviceId == msgObj.getDeviceId() &&
                (msgObj.getType() === IMI.ICMessageType.Republish
                  || msgObj.getType() === IMI.ICMessageType.ClickedReceipt
                  || msgObj.getType() === IMI.ICMessageType.MessageDeleted
                  || msgObj.getType() === IMI.ICMessageType.ReadReceipt

                );
              if (shouldSkipMessage || _db.isDuplicateMessage(msgObj)) {
                return;
              } else {
                _db.setTransId(msgObj);
              }

              let isThreadUpdate = msgObj.getType().toLowerCase() === IMI.ICMessageType.CloseThread.toLowerCase()
                || msgObj.getType().toLowerCase() === IMI.ICMessageType.ReopenThread.toLowerCase()
                || msgObj.getType().toLowerCase() === IMI.ICMessageType.UpdateThread.toLowerCase();
              if (isThreadUpdate) {
                self._publishThreadUpdateACK(payLoadStr, {
                  onFailure: function (error) {
                    _imiconnect._invokeSecurityTokenListeners(error);
                  },
                });
              }
              if (
                self.messagecallback &&
                self.messagecallback.onMessageReceived &&
                IMI.isFunction(self.messagecallback.onMessageReceived)
              ) {
                self.messagecallback.onMessageReceived(msgObj);
              }
            }
          } catch (err) {
            IMI.log(err);
          }
        },
        disconnect: function () {
          var self = this;
          self._stopSwPing();
          try {
            _db.remove("isConnectionOpened");
            if (self.isConnected()) {
              _imiconnect.backgroundService.postMessage(IMI.EventType.RequestDisconnection);
              self.isDisconnected = true;
              self.connectionStatus = IMI.ICConnectionStatus.Refused;
              self.messagecallback.onConnectionStatusChanged(
                self.connectionStatus
              );
            }
          } catch (er) {
            IMI.log("disconnect", er);
            throw er;
          }
        },
        fetchTopics: function (start, callback) {
          if (arguments.length === 1) {
            callback = start;
          }
          if (!IMI.isNumber(start)) {
            start = 0;
          }
          var user = _imiconnect.iCDeviceProfile.userId || "";
          var query = "start=" + start + "&subscribed=both";
          var topicsurl =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            user +
            "/topics";
          var headers = _imiconnect._getAjaxHeader();

          try {
            var mycallback = {
              onSuccess: function (topcisdata) {
                _imiconnect._processUnsupportedSDKVersion(topcisdata);
                if (topcisdata && topcisdata.code == 0) {
                  if (
                    callback &&
                    callback.onSuccess &&
                    IMI.isFunction(callback.onSuccess)
                  ) {
                    //convert topics list
                    var topicsList = [];
                    try {
                      if (topcisdata && topcisdata.topics) {
                        var topics = topcisdata.topics;
                        for (var itm = 0; itm < topics.length; itm++) {
                          var topic = topics[itm];
                          topicsList.push(IMI.ICTopic.fromJSON(topic));
                        }
                      }
                      callback.onSuccess(topicsList);
                    } catch (ex) {
                      if (
                        callback &&
                        callback.onFailure &&
                        IMI.isFunction(callback.onFailure)
                      ) {
                        callback.onFailure(IMI.ICErrorCodes.Unknown);
                      }
                    }
                  }
                } else if (topcisdata && topcisdata.code != 0) {
                  _imiconnect._invokeFailureCallBack(callback, topcisdata);
                } else {
                  if (
                    callback &&
                    callback.onFailure &&
                    IMI.isFunction(callback.onFailure)
                  ) {
                    callback.onFailure(IMI.ICErrorCodes.Unknown);
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(IMI.ICErrorCodes.Unknown);
                }
              },
            };
            IMI.Get(topicsurl, query, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        createThread: function (thread, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must not be undefined");
          }
          if (!(thread instanceof IMI.ICThread)) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must be an instance of IMI.ICThread");
          }

          var createThreadUrl =
            elbZeroRatingURL + "/apps/" + _imiconnect.appName + "/threads";
          if (thread.getType()) {
            thread.setType(IMI.ICThreadType.Conversation);
          }

          var createThread = JSON.stringify(thread.toJSON());

          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (createdThreadResp) {
                _imiconnect._processUnsupportedSDKVersion(createdThreadResp);
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (createdThreadResp && createdThreadResp.thread) {
                    var threadResp = IMI.ICThread.fromJSON(
                      createdThreadResp.thread
                    );
                    thread.setCreatedAt(IMI.getDate(threadResp.createdAt));
                    thread.setId(threadResp.id);
                    callback.onSuccess(thread);
                  } else if (createdThreadResp) {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      createdThreadResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Post(createThreadUrl, createThread, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        updateThread: function (thread, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must not be undefined");
          }
          if (!(thread instanceof IMI.ICThread)) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "thread must be an instance of IMI.ICThread");
          }
          if (thread.getId() === undefined) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "threadId parameter cannot be empty");
          }

          var user = _imiconnect.iCDeviceProfile.userId || "";
          var updateThreadUrl =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            user +
            "/threads/" +
            thread.getId();

          var updateThread = JSON.stringify(thread.toJSON());
          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (updateThreadResp) {
                _imiconnect._processUnsupportedSDKVersion(updateThreadResp)
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (updateThreadResp && updateThreadResp.thread) {
                    var threadResp = IMI.ICThread.fromJSON(
                      updateThreadResp.thread
                    );
                    callback.onSuccess(threadResp);
                  } else if (updateThreadResp) {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      updateThreadResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Put(updateThreadUrl, updateThread, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        closeThread: function (icThreadObj, callback) {
          icThreadObj.setStatus(IMI.ICThreadStatus.Closed);
          IMI.ICMessaging.getInstance().updateThread(icThreadObj, callback);
        },
        _reopenThread: function (icThreadObj, callback) {
          icThreadObj.setStatus(IMI.ICThreadStatus.Active);
          IMI.ICMessaging.getInstance().updateThread(icThreadObj, callback);
        },
        fetchUnreadThreadCount: function (callback) {
          var fetchUnreadThreadsCountURL =
            elbZeroRatingURLV4 +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/unreadthreads";

          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (fetchUnreadThreadsCountResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchUnreadThreadsCountResp &&
                    fetchUnreadThreadsCountResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchUnreadThreadsCountResp = JSON.parse(
                      _imiconnect._decryptMsg(
                        fetchUnreadThreadsCountResp.encrypted
                      )
                    );
                  }
                  if (fetchUnreadThreadsCountResp) {
                    _imiconnect._processUnsupportedSDKVersion(fetchUnreadThreadsCountResp);
                    if (fetchUnreadThreadsCountResp.code == "0") {
                      callback.onSuccess(
                        fetchUnreadThreadsCountResp.unread_thread_count
                      );
                    } else if (fetchUnreadThreadsCountResp.code == "1") {
                      callback.onSuccess("0");
                    } else {
                      _imiconnect._invokeFailureCallBack(
                        callback,
                        fetchUnreadThreadsCountResp
                      );
                    }
                  } else {
                    if (
                      callback &&
                      callback.onFailure &&
                      IMI.isFunction(callback.onFailure)
                    ) {
                      callback.onFailure(IMI.ICErrorCodes.Unknown);
                    }
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchUnreadThreadsCountURL, undefined, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        fetchThread: function (threadId, callback) {
          if (arguments.length < 2) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters are missing");
          }
          if (threadId.trim().length == 0) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameter missing: threadId");
          }
          var fetchThreadAPIUrl = `${_imiconnect._getRtmsDomainUrl()}/apps/${_imiconnect.appName}/user/${_imiconnect.iCDeviceProfile.userId}/threads/${threadId}`;
          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (fetchThreadResponse) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  if (
                    fetchThreadResponse &&
                    fetchThreadResponse.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchThreadResponse = JSON.parse(
                      _imiconnect._decryptMsg(fetchThreadResponse.encrypted)
                    );
                  }
                  if (fetchThreadResponse) {
                    _imiconnect._processUnsupportedSDKVersion(fetchThreadResponse);
                    if (fetchThreadResponse.code == "0") {
                      var threadsJson = fetchThreadResponse.threads;
                      if (threadsJson) {
                        let thread = IMI.ICThread.fromJSON(threadsJson[0]);
                        callback.onSuccess(thread);
                      }
                      else {
                        callback.onSuccess(null);
                      }
                    } else {
                      _imiconnect._invokeFailureCallBack(
                        callback,
                        fetchThreadResponse
                      );
                    }
                  } else {
                    if (
                      callback &&
                      callback.onFailure &&
                      IMI.isFunction(callback.onFailure)
                    ) {
                      callback.onFailure(IMI.ICErrorCodes.Unknown);
                    }
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchThreadAPIUrl, undefined, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        fetchThreads: function (offset, limit, callback) {
          if (!IMI.isNumber(offset)) {
            offset = 0;
          }
          //fetching user threads
          var fetchThreadsURL =
            _imiconnect._getRtmsDomainUrl() +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/threads?start=" +
            offset +
            "&limit=" +
            limit;

          fetchUnreadCount = true; //Defaulting to true
          if (_imiconnect.serverInboxVersion)
            fetchThreadsURL += "&fetchunreadcount=" + true;

          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (fetchThredResp) {
                if (!_imiconnect || !_imiconnect.iCDeviceProfile) return;
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchThredResp &&
                    fetchThredResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchThredResp = JSON.parse(
                      _imiconnect._decryptMsg(fetchThredResp.encrypted)
                    );
                  }
                  if (fetchThredResp) {
                    _imiconnect._processUnsupportedSDKVersion(fetchThredResp);
                    if (fetchThredResp.code == "0") {
                      var threadsJson = fetchThredResp.threads;
                      if (threadsJson) {
                        var threadArrayRsp = [];
                        for (var itm = 0; itm < threadsJson.length; itm++) {
                          var thread = threadsJson[itm];
                          threadArrayRsp.push(IMI.ICThread.fromJSON(thread));
                        }
                        //Disabled as part of 1.2.0
                        var count = fetchThredResp.count || 0;
                        var total = fetchThredResp.total || 0;
                        var hashmore = total > count + offset;
                        callback.onSuccess(threadArrayRsp, hashmore);
                      } else {
                        callback.onSuccess([], 0);
                      }
                    } else if (fetchThredResp.code == "1") {
                      callback.onSuccess([], 0);
                    } else {
                      _imiconnect._invokeFailureCallBack(
                        callback,
                        fetchThredResp
                      );
                    }
                  } else {
                    if (
                      callback &&
                      callback.onFailure &&
                      IMI.isFunction(callback.onFailure)
                    ) {
                      callback.onFailure(IMI.ICErrorCodes.Unknown);
                    }
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchThreadsURL, undefined, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        fetchMessages: function (threadId, sinceDate, limit, callback) {
          if (arguments.length < 4) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters are missing");
          }
          if (threadId) {
            threadId = encodeURIComponent(threadId);
          }

          if (sinceDate && sinceDate instanceof Date) {
            sinceDate = IMI.parseDate(sinceDate);
          } else {
            sinceDate = "";
          }
          if (!limit || limit < 1)
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Please provide valid limit value");

          var fetchMessagesURL = _imiconnect._getRtmsDomainUrl() +
            "/apps/" +
            _imiconnect.appName +
            "/user/" +
            _imiconnect.iCDeviceProfile.userId +
            "/threads/" +
            threadId +
            "/messages?from=" +
            sinceDate +
            "&limit=" +
            limit;
          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          try {
            var mycallback = {
              onSuccess: function (fetchMessagesResp) {
                if (!_imiconnect || !_imiconnect.iCDeviceProfile) return;
                _imiconnect._processUnsupportedSDKVersion(fetchMessagesResp);
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (
                    fetchMessagesResp &&
                    fetchMessagesResp.encrypted &&
                    _imiconnect.isEncryptionEnabled
                  ) {
                    fetchMessagesResp = JSON.parse(
                      _imiconnect._decryptMsg(fetchMessagesResp.encrypted)
                    );
                  }
                  if (fetchMessagesResp && fetchMessagesResp.code == "0") {
                    var messagesJson = fetchMessagesResp.messages;
                    var messagesArrayRsp = [];
                    if (messagesJson) {
                      for (var itm = 0; itm < messagesJson.length; itm++) {
                        var message = messagesJson[itm];
                        messagesArrayRsp.push(IMI.ICMessage.fromJSON(message));
                      }
                      callback.onSuccess(
                        messagesArrayRsp,
                        fetchMessagesResp.total
                      );
                    } else {
                      callback.onSuccess(
                        messagesArrayRsp,
                        fetchMessagesResp.total
                      );
                    }
                  } else {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      fetchMessagesResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(fetchMessagesURL, undefined, {}, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        getConnectionStatus: function () {
          return this.connectionStatus;
        },
        isConnected: function () {
          var self = this;
          return self.connectionStatus === IMI.ICConnectionStatus.Connected;
        },
        deleteMessage: function (tid, callback) {
          var deleteMessageUrl =
            elbZeroRatingURL + "/" + _imiconnect.appName + "/message";
          var postData = JSON.stringify({
            tid: tid,
            clientId: _imiconnect.clientId,
          });
          // 38/39/40 retry lives in the centralized HttpAjaxCall
          // interceptor; per-method _retryContext wiring is intentionally
          // absent here.
          var mycallback = {
            onSuccess: function (response) {
              _imiconnect._processUnsupportedSDKVersion(response);
              if (
                callback &&
                callback.onSuccess &&
                IMI.isFunction(callback.onSuccess)
              ) {
                //passing data back
                if (response.code === 0) {
                  callback.onSuccess(tid);
                } else {
                  _imiconnect._invokeFailureCallBack(callback, response);
                }
              }
            },
            onFailure: function (falureresp) {
              if (
                callback &&
                callback.onFailure &&
                IMI.isFunction(callback.onFailure)
              ) {
                callback.onFailure(falureresp);
              }
            },
          };
          IMI.Post(deleteMessageUrl, postData, {}, mycallback);
        },
        publishMessage: function (message, callback) {
          var self = this;
          try {
            //checking is registered
            var isRegEn = _imiconnect.isRegistered();
            if (!isRegEn) {
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(
                  IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered
                );
              }
              return;
            }
            //verifying instance
            if (!(message instanceof IMI.ICMessage)) {
              throw IMI.ICErrorCodes.PublishFailed;
            }
            if (!(message.getThread() && message.getThread() instanceof IMI.ICThread)) {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "message.getThread() must be an instance of ICThread");
            }
            if (!message.getThread() || !message.getThread().getId()) {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "thread.getId() property cannot be empty");
            }
            if (message.getThread().getType() === undefined) {
              message.getThread().setType(IMI.ICThreadType.Conversation);
            }
            var _retryContext = { hasRetried: false, retryFn: null };
            var _failPublish = function (errorCode) {
              if (errorCode === IMI.ICErrorCodes.TokenExpired
                  || errorCode === IMI.ICErrorCodes.TokenRequired
                  || errorCode === IMI.ICErrorCodes.InvalidToken) {
                _imiconnect._invokeSecurityTokenListeners(errorCode);
              }
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(errorCode, message);
              }
            };
            var publishToBackend = function () {
              message.setStatus(IMI.ICMessageStatus.NotSent);
              message.channel = "rt";
              message.setClientId(_imiconnect.clientId);
              let jsonMessage = message.toJSON();
              if (message.getType() == IMI.ICMessageType.TypingStart) {
                jsonMessage.payload_type = "typingStart";
                delete jsonMessage['type'];
              }
              else if (message.getType() == IMI.ICMessageType.TypingStop) {
                jsonMessage.payload_type = "typingStop";
                delete jsonMessage['type'];
              }

              //encrypt payload
              var messagePaylod = self._getPayLoadMsg(
                JSON.stringify(jsonMessage)
              );
              var moURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/mo";

              var _sendMO = function () {
                var headers = _imiconnect._getAjaxHeader();
                $.ajax({
                  url: moURL,
                  type: "POST",
                  headers: headers,
                  data: messagePaylod,
                  success: function (publishResp) {
                    _imiconnect._processUnsupportedSDKVersion(publishResp);
                    if (publishResp && publishResp.code == "0") {
                      if (callback && typeof callback.onSuccess === "function") {
                        message.setStatus(IMI.ICMessageStatus.Sent);
                        message.setOutgoing(true);
                        message.setTransactionId(publishResp.tid);
                        message.setSubmittedAt(IMI.getDate(publishResp.created_on));//required for republishing locally
                        self._republishLocally(message);
                        callback.onSuccess(message, null);
                      }
                    } else {
                      if (message.getTemporaryId() == undefined) {
                        message.setTemporaryId(`TMP_${_util.uuid()}`);
                        self._republishLocally(message); //only republishLocally when publishMessage fails for the first time.
                      }
                      var failOriginal = function (refreshError) {
                        var errorCode = refreshError
                          ? _imiconnect._getErrorCode(refreshError.code)
                          : _imiconnect._getErrorCode(publishResp.code);
                        _failPublish(errorCode);
                      };

                      _retryContext.retry        = publishToBackend;
                      _retryContext.failOriginal = failOriginal;

                      if (!IMI._authTokenManager
                          || typeof IMI._authTokenManager.handleAuthRetry !== "function"
                          || !IMI._authTokenManager.handleAuthRetry(publishResp, _retryContext)) {
                        failOriginal();
                      }
                    }
                  },
                  error: function (responseData, textStatus, errorThrown) {
                    if (message.getTemporaryId() == undefined) {
                      message.setTemporaryId(`TMP_${_util.uuid()}`);
                      self._republishLocally(message); //only republishLocally when publishMessage fails for the first time.
                    }
                    if (callback && IMI.isFunction(callback.onFailure)) {
                      callback.onFailure(IMI.ICErrorCodes.PublishFailed, message);
                    }
                  },
                });
              };

              if (IMI._authTokenManager
                  && typeof IMI._authTokenManager.preflightAuth === "function") {
                IMI._authTokenManager.preflightAuth(_imiconnect._getAjaxHeader()).then(
                  function () { _sendMO(); },
                  function (refreshErr) {
                    if (message.getTemporaryId() == undefined) {
                      message.setTemporaryId(`TMP_${_util.uuid()}`);
                      self._republishLocally(message);
                    }
                    var ne = IMI._authTokenManager._normalizeError(refreshErr);
                    _failPublish(_imiconnect._getErrorCode(ne.code));
                  }
                );
              } else {
                _sendMO();
              }
            };
            _retryContext.retryFn = publishToBackend;
            if (message.getThread().getStatus() === IMI.ICThreadStatus.Closed) {
              var updateThreadCallback = {
                onSuccess: (res) => {
                  publishToBackend();
                },
                onFailure: (err) => IMI.log("onThreadUpdateFailure:", err),
              };
              IMI.ICMessaging.getInstance()._reopenThread(
                message.getThread(),
                updateThreadCallback
              );
            } else publishToBackend();
          } catch (ex) {
            IMI.log(ex);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
            throw ex;
          }
        },
        _republishLocally: function (message) {
          //only republish MOs locally
          if (message.getType() == undefined || message.getType() == IMI.ICMessageType.Republish) {
            message.setType(IMI.ICMessageType.Republish);
            message.setOutgoing(true);
            _imiconnect.backgroundService.postMessage(IMI.EventType.RepublishLocally,
              { message: message.toJSON() });
          }
        },
        _publishThreadUpdateACK: function (jsonObject, callback) {
          var self = this;
          try {
            let thread = IMI.ICThread.fromJSON(jsonObject.thread);
            var payload = {
              "appId": _imiconnect.appName,
              "event": "UpdateThreadACK",
              "tid": jsonObject.tid,
              "clientId": _imiconnect.clientId,
              "thread": thread.toJSON()
            };
            let notifyUrl = jsonObject.thread.notifyUrl ? jsonObject.thread.notifyUrl : "";
            if (notifyUrl)
              payload.thread.notifyUrl = notifyUrl;

            var moURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/mo";
            var headers = _imiconnect._getAjaxHeader();
            var messagePayload = self._getPayLoadMsg(
              JSON.stringify(payload)
            );
            var apiCallback = {
              onSuccess: function (publishResp) {
                _imiconnect._processUnsupportedSDKVersion(publishResp);
                if (publishResp && publishResp.code != "0") {
                  _imiconnect._invokeFailureCallBack(callback, publishResp);
                }
              },
              onFailure: function (responseData, textStatus, errorThrown) {
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure(IMI.ICErrorCodes.PublishFailed);
                }
              },
            }
            IMI.Post(moURL, messagePayload, headers, apiCallback);
          } catch (ex) {
            IMI.log(ex);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
            throw ex;
          }
        },
        sendClickedEvent: function (messageTransactionId, icButton, callback) {
          var self = this;
          let icInteractiveData = new IMI.ICInteractiveData();
          icInteractiveData.setType(icButton.getType());
          icInteractiveData.setIdentifier(icButton.getIdentifier());
          icInteractiveData.setTitle(icButton.getTitle());
          icInteractiveData.setActionURL(icButton.getActionURL());
          icInteractiveData.setPayload(icButton.getPayload());

          let payload = {
            "tid": messageTransactionId,
            "status": 4,
            "clientId": _imiconnect.clientId,
            "interactiveData": icInteractiveData.toJSON()
          }

          try {
            //calling api update
            messagePaylod = JSON.stringify(payload);
            var deliveryUpdateURL =
              elbZeroRatingURL + "/" + _imiconnect.appName + "/deliveryupdate";

            var headers = _imiconnect._getAjaxHeader();

            $.ajax({
              url: deliveryUpdateURL,
              type: "POST",
              headers: headers,
              data: messagePaylod,
              success: function (respObj) {
                _imiconnect._processUnsupportedSDKVersion(respObj);
                if (respObj && respObj.code == "0") {
                  if (callback && typeof callback.onSuccess === "function") {
                    callback.onSuccess(icButton);
                  }
                } else if (respObj && respObj.code != "0") {
                  _imiconnect._invokeFailureCallBack(callback, respObj);
                } else {
                  if (callback && IMI.isFunction(callback.onFailure)) {
                    callback.onFailure(IMI.MessageStatus.messagefailed);
                  }
                }
              },
              error: function (responseData, textStatus, errorThrown) {
                if (callback && IMI.isFunction(callback.onFailure)) {
                  callback.onFailure(IMI.MessageStatus.messagefailed);
                }
              },
            });
          } catch (error) {
            IMI.log(error);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
          }
        },
        _getPayLoadMsg: function (payLoad) {
          if (_imiconnect.isEncryptionEnabled) {
            try {
              var encData = _imiconnect._encryptMsg(payLoad);
              payLoad = '{"encrypted":"' + encData + '"}';
            } catch (ex) {
              IMI.log(ex);
            }
          }
          return payLoad;
        },
        //subscribe topic
        subscribeTopic: function (topicId, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters missing");
          }
          if (topicId) {
            topicId = encodeURIComponent(topicId);
          }
          var body =
            "['" +
            (_imiconnect.iCDeviceProfile
              ? _imiconnect.iCDeviceProfile.userId
              : _imiconnect.userId) +
            "']";
          var subscribeTopicURL =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/topics/" +
            topicId +
            "/users";
          var headers = _imiconnect._getAjaxHeader();
          try {
            var mycallback = {
              onSuccess: function (subTopicResp) {
                _imiconnect._processUnsupportedSDKVersion(subTopicResp);
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  //passing data back
                  if (subTopicResp.code === 0) {
                    callback.onSuccess();
                  } else {
                    _imiconnect._invokeFailureCallBack(callback, subTopicResp);
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Post(subscribeTopicURL, body, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        //subscribe topic
        unsubscribeTopic: function (topicId, callback) {
          if (arguments.length < 1) {
            throw _imiconnect._getErrorWithDescription(
              IMI.ICErrorCodes.InvalidParameterValue,
              "Mandatory parameters missing");
          }
          if (topicId) {
            topicId = encodeURIComponent(topicId);
          }
          var userId = _imiconnect.iCDeviceProfile
            ? _imiconnect.iCDeviceProfile.userId
            : _imiconnect.userId;
          //fetching user threads
          var unsubscribeTopicURL =
            elbZeroRatingURL +
            "/apps/" +
            _imiconnect.appName +
            "/topics/" +
            topicId +
            "/users/" +
            userId;
          var headers = _imiconnect._getAjaxHeader();
          try {
            var mycallback = {
              onSuccess: function (unSubTopicResp) {
                if (
                  callback &&
                  callback.onSuccess &&
                  IMI.isFunction(callback.onSuccess)
                ) {
                  _imiconnect._processUnsupportedSDKVersion(unSubTopicResp);
                  //passing data back
                  if (unSubTopicResp.code === 0) {
                    callback.onSuccess();
                  } else {
                    _imiconnect._invokeFailureCallBack(
                      callback,
                      unSubTopicResp
                    );
                  }
                }
              },
              onFailure: function (falureresp) {
                if (
                  callback &&
                  callback.onFailure &&
                  IMI.isFunction(callback.onFailure)
                ) {
                  callback.onFailure(falureresp);
                }
              },
            };
            IMI.Get(unsubscribeTopicURL, undefined, headers, mycallback);
          } catch (err) {
            IMI.log(err);
            throw err;
          }
        },
        setMessageAsRead: function (transId, callback) {
          var self = this;
          try {
            if (transId) {
              self.setMessagesAsRead(transId, callback);
            }
            else
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "transId parameter cannot be undefined");
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        setMessagesAsRead: function (transactionIds, callback) {
          //might be single transid or multiple array
          var self = this;
          try {
            if (transactionIds) {
              if (!IMI.isArray(transactionIds))
                transactionIds = [transactionIds];
              transactionIds = [...new Set(transactionIds)];
              let transIdsNotSubmittedInThisSession = transactionIds.filter(id => !_readReceiptDB.exists(id));
              if (transIdsNotSubmittedInThisSession && transIdsNotSubmittedInThisSession.length == 0) {
                if (callback && callback.onFailure)
                  callback.onFailure("Duplicate transactionIds have been submitted");
                return;
              }

              var msg = {};
              msg.tids = transIdsNotSubmittedInThisSession;
              _readReceiptDB.add(transIdsNotSubmittedInThisSession);
              msg.status = 3;
              msg.channel = "rt";
              msg.clientId = _imiconnect.clientId;
              var wrappedCallback = {
                onSuccess: callback && callback.onSuccess,
                onFailure: function (err, ctx) {
                  _readReceiptDB.remove(transIdsNotSubmittedInThisSession);
                  if (callback && IMI.isFunction(callback.onFailure))
                    callback.onFailure(err, ctx);
                }
              };
              self._setStatus(msg, wrappedCallback);
            } else {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "transactionIds parameter cannot be undefined");
            }
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        sendDRMessage: function (transactionId, callback) {
          var self = this;
          try {
            if (transactionId) {
              var msg = {};
              msg.status = 2;
              //msg.topic = "DeliveryStatus";
              msg.channel = "rt";
              msg.clientId = _imiconnect.clientId;
              msg.tid = transactionId;
              let retryCallbackWrapper = {};
              retryCallbackWrapper.onFailure = function (result, req) {
                if (req) {
                  let { url, data, type } = req;
                  _imiconnect.backgroundService.postMessage(IMI.EventType.AddRetryRequest,
                    { "request": { url: url, data: data, type: type }, "useAjaxHeader": true });
                }

                if (callback.onFailure) callback.onFailure(result);
                if (callback.onSuccess) retryCallbackWrapper.onSuccess = callback.onSuccess;
              }
              self._setStatus(msg, retryCallbackWrapper);
            } else {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "TransactionId parameter cannot be empty");
            }
          } catch (ex) {
            IMI.log(ex);
            throw ex;
          }
        },
        //for setting the callback, to recieve message and connection status change
        setICMessagingReceiver: function (icMsgReceiverCallback) {
          var self = this;
          self.messagecallback = icMsgReceiverCallback;
        },
        _setStatus: function (messagePayload, callback) {
          try {
            var self = this;
            var deliveryUpdateURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/deliveryupdate";
            var payload = JSON.stringify(messagePayload);
            payload = self._getPayLoadMsg(payload);
            if (messagePayload.status == 3) { //i.e read_receipts
              deliveryUpdateURL += "?rr=" + messagePayload.tids.toString();
            }
            var _retryContext = { hasRetried: false, retryFn: null };
            var _failStatus = function (errorCode, ctx) {
              if (errorCode === IMI.ICErrorCodes.TokenExpired
                  || errorCode === IMI.ICErrorCodes.TokenRequired
                  || errorCode === IMI.ICErrorCodes.InvalidToken) {
                _imiconnect._invokeSecurityTokenListeners(errorCode);
              }
              if (callback && IMI.isFunction(callback.onFailure)) {
                callback.onFailure(IMI.MessageStatus.messagefailed, ctx);
              }
            };
            function _doSetStatus() {
              var _sendStatus = function () {
                var headers = _imiconnect._getAjaxHeader();
                $.ajax({
                  url: deliveryUpdateURL,
                  type: "POST",
                  headers: headers,
                  data: payload,
                  success: function (respObj) {
                    _imiconnect._processUnsupportedSDKVersion(respObj);
                    if (respObj && respObj.code == "0") {
                      if (callback && typeof callback.onSuccess === "function") {
                        callback.onSuccess(IMI.MessageStatus.messagesuccess);
                      }
                    } else if (respObj && respObj.code != "0") {
                      var failureCtx = this;
                      var failOriginal = function (refreshError) {
                        var errorCode = refreshError
                          ? _imiconnect._getErrorCode(refreshError.code)
                          : _imiconnect._getErrorCode(respObj.code);
                        _failStatus(errorCode, failureCtx);
                      };

                      _retryContext.retry        = _doSetStatus;
                      _retryContext.failOriginal = failOriginal;

                      if (!IMI._authTokenManager
                          || typeof IMI._authTokenManager.handleAuthRetry !== "function"
                          || !IMI._authTokenManager.handleAuthRetry(respObj, _retryContext)) {
                        failOriginal();
                      }
                    } else {
                      if (callback && IMI.isFunction(callback.onFailure)) {
                        callback.onFailure(IMI.MessageStatus.messagefailed, this);
                      }
                    }
                  },
                  error: function (responseData, textStatus, errorThrown) {
                    if (callback && IMI.isFunction(callback.onFailure)) {
                      callback.onFailure(IMI.MessageStatus.messagefailed, this);
                    }
                  },
                });
              };

              if (IMI._authTokenManager
                  && typeof IMI._authTokenManager.preflightAuth === "function") {
                IMI._authTokenManager.preflightAuth(_imiconnect._getAjaxHeader()).then(
                  function () { _sendStatus(); },
                  function (refreshErr) {
                    var ne = IMI._authTokenManager._normalizeError(refreshErr);
                    _failStatus(_imiconnect._getErrorCode(ne.code), null);
                  }
                );
              } else {
                _sendStatus();
              }
            }
            _retryContext.retryFn = _doSetStatus;
            _doSetStatus();
          } catch (error) {
            IMI.log(error);
            if (callback) {
              if (typeof callback.onFailure === "function") {
                callback.onFailure(IMI.MessageStatus.messagefailed);
              }
            }
          }
        },
        createPostbackMessage: function (icMessage, icButton) {
          let postbackMO = new IMI.ICMessage();
          postbackMO.setRelatedTransactionId(icMessage.getTransactionId());
          postbackMO.setThread(icMessage.getThread());
          postbackMO.setMessage(icButton.getTitle());

          let icInteractiveData = new IMI.ICInteractiveData();
          icInteractiveData.setType(icButton.getType());
          icInteractiveData.setIdentifier(icButton.getIdentifier());
          icInteractiveData.setTitle(icButton.getTitle());
          icInteractiveData.setPayload(icButton.getPayload());
          let reference;
          switch (icButton.getType()) {
            case IMI.ICInteractiveDataType.TemplatePostback:
              if (icMessage.getAttachments() != null && icMessage.getAttachments().length > 0) {
                let genericTemplateAttachment = icMessage.getAttachments()[0];
                reference = genericTemplateAttachment.getReference();
              }
              break;
            case IMI.ICInteractiveDataType.QuickReplyPostback:
              reference = icMessage.getQuickReplyData().getReference();
              break;
          }
          icInteractiveData.setReference(reference);
          postbackMO.setInteractiveData(icInteractiveData)
          return postbackMO;
        },
        handleEvents: function () {
          var self = this;
          var onWindowGone = function (ev) {
            if (!self._unloaded) {
              self.removeWindow();
            }
          };
          window.addEventListener("beforeunload", onWindowGone);
          // Use `pagehide` instead of the legacy `unload` event: `unload` is
          // deprecated, blocked by Permissions Policy in modern browsers (it
          // logs a violation), and disables the back/forward cache. `pagehide`
          // fires reliably on navigation/tab close and is bfcache-friendly.
          window.addEventListener("pagehide", onWindowGone);
        },
        removeWindow: function () {
          var self = this;
          //update flag
          if (_isConnected && _messagingInstance) {
            _messagingInstance.disconnect();
          }
          if (_db) {
            _db.remove("isConnectionOpened");
          }
          self._unloaded = true;
        },
        publishTypingIndicator: function (icThread, started, callback) {
          var self = this;
          try {
            if (started == null && typeof (started) != 'boolean')
              throw _imiconnect._getErrorWithDescription(IMI.ICErrorCodes.InvalidParameterValue,
                "started must either be true or false");

            if (!(icThread && icThread instanceof IMI.ICThread)) {
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "icThread must be an instance of ICThread");
            }

            if (!icThread.getStatus())
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "Required value missing for icThread.getStatus()");

            if (icThread.getStatus() == IMI.ICThreadStatus.Closed)
              throw _imiconnect._getErrorWithDescription(
                IMI.ICErrorCodes.InvalidParameterValue,
                "Cannot send TypingAlert for Closed Thread");

            const TYPING_INDICATOR_INTERVAL_MILLISECONDS = 5000;
            // Clean up old entries in the typing state map.
            // Remove entries where typing is not in progress and the lastSent time
            // exceeds the TYPING_INDICATOR_INTERVAL_MILLISECONDS threshold.
            // This prevents the map from growing indefinitely with stale entries.
            let now = Date.now();
            for (const key in self._typingState) {
              let state = self._typingState[key];
              if (!state.inProgress && ((now - state.lastSent) > TYPING_INDICATOR_INTERVAL_MILLISECONDS)) {
                // If typing is not in progress and the last sent time exceeds the threshold,
                // remove the entry from the typing state map.
                delete self._typingState[key];
              }
            }
            let state = self._typingState[icThread.getId()];
            if (state == undefined) {
              self._typingState[icThread.getId()] = state = { started: started, lastSent: 0, inProgress: false };
            }
            // Suppress if any status was sent for the Thread within the last [TYPING_INDICATOR_INTERVAL_MILLISECONDS] seconds
            if ((now - state.lastSent) < TYPING_INDICATOR_INTERVAL_MILLISECONDS) {
              let ERROR_PUBLISH_FAILED_MESSAGE = "Publishing typing indicator rate limited, please try again later";
              IMI.log(ERROR_PUBLISH_FAILED_MESSAGE);
              throw IMI.ICErrorCodes.PublishFailed;
            }
            // Suppress if a publish is already in progress for any status
            if (state.inProgress) {
              let ERROR_PUBLISH_FAILED_MESSAGE = "Publishing typing indicator is already in progress";
              IMI.log(ERROR_PUBLISH_FAILED_MESSAGE);
              throw IMI.ICErrorCodes.AlreadyProcessing;
            }
            state.inProgress = true;
            state.started = started;
            let typingIndicatorPublishMessageCallback = {
              onSuccess: function (res) {
                state.inProgress = false;
                state.lastSent = Date.now();
                if (callback && IMI.isFunction(callback.onSuccess)) {
                  callback.onSuccess(res);
                }
              },
              onFailure: function (err) {
                state.inProgress = false;
                if (callback && IMI.isFunction(callback.onFailure)) callback.onFailure(err);
              }
            }
            let icMessage = new IMI.ICMessage();
            icMessage.setThread(icThread);
            icMessage.setType(started ? IMI.ICMessageType.TypingStart : IMI.ICMessageType.TypingStop);
            self.publishMessage(icMessage, typingIndicatorPublishMessageCallback);
          } catch (error) {
            if (callback) callback.onFailure(error);
          }
        },
        //Requests the browser's notification permission prompt to enable notifications display. If permission is 'granted', firebase token is sent to server
        requestPushPermission: function (callback) {
          navigator.serviceWorker.getRegistration(IMI.getSwScope()).then(function (swRegistration) {
            if (swRegistration) _imiconnect.webpush._requestPushPermission(swRegistration, callback);
          });
        }
      };
      return messagingInstanceObj;
    }
    return {
      getInstance: function () {
        if (!_messagingInstance) {
          _messagingInstance = init();
        }
        return _messagingInstance;
      },
      isStarted: function () {
        return _messagingInstance !== null && _messagingInstance !== undefined;
      },
    };

  })();
  //message receiver object
  IMI.namespace("IMI.ICMessagingReceiver");
  IMI.ICMessagingReceiver = (function () {
    var Constr;
    Constr = function () {
      this.onConnectionStatusChanged = function (statuscode) {
      };
      this.onMessageReceived = function (message) {
        IMI.log(message);
      };
    };
    return Constr;
  })();

  //ICTopic
  IMI.namespace("IMI.ICTopic");
  IMI.ICTopic = (function () {
    function toTopicObj(jsonObject) {
      var topicObj = new IMI.ICTopic(jsonObject);
      if (!jsonObject) {
        return null;
      }
      topicObj.name = jsonObject.name;
      topicObj.subscribed = jsonObject.subscribed || false;
      topicObj.id = jsonObject.id;
      topicObj.title = jsonObject.ref;
      topicObj.group = jsonObject.topic_group;
      topicObj.description = jsonObject.description;
      if (jsonObject.created_on) {
        topicObj.createdDate = IMI.getDate(jsonObject.created_on);
      }
      return topicObj;
    }

    var ICTopic = function () {
      var self = this;
      self.name = undefined;
      self.subscribed = undefined;
      self.accessLevel = undefined;
      self.createdBy = undefined;
      self.createdDate = undefined;
      self.updatedDate = undefined;
      self.group = undefined;
      self.title = undefined;
      self.id = undefined;
      self.description = undefined;
    };
    ICTopic.fromJSON = function (jsonObject) {
      return toTopicObj(jsonObject);
    };
    ICTopic.prototype = {
      getName: function () {
        return this.name;
      },
      isSubscribed: function () {
        return this.subscribed;
      },
      getCreatedDate: function () {
        return this.createdDate;
      },
      getTitle: function () {
        return this.title;
      },
      getDescription: function () {
        return this.description;
      },
      getId: function () {
        return this.id;
      },
      getGroup: function () {
        return this.group;
      },
    };
    return ICTopic;
  })();
  //ICAttachment
  IMI.namespace("IMI.ICAttachment");
  IMI.ICAttachment = (function () {
    function AttachmentCon(jsonObject) {
      var attachObj = new IMI.ICAttachment();
      try {
        attachObj.setContentType(jsonObject.contentType);
        attachObj.setDuration(jsonObject.duration);
        attachObj.setLatitude(jsonObject.latitude);
        attachObj.setLongitude(jsonObject.longitude);
        attachObj.setSize(jsonObject.size);
        attachObj.setPreview(jsonObject.preview);
        attachObj.setURL(jsonObject.file);
        attachObj.setMediaId(jsonObject.mediaId || jsonObject.id);
      } catch (error) {
        IMI.log(error);
      }
      return attachObj;
    }

    var ICAttachment = function () {
      var self = this;
      self.contentType;
      self.duration;
      self.latitude;
      self.longitude;
      self.preview;
      self.size;
      self.url;
      self.mediaId;
    };

    ICAttachment.prototype = {
      getContentType: function () {
        return this.contentType;
      },
      setContentType: function (contentType) {
        this.contentType = contentType;
      },
      getDuration: function () {
        return this.duration;
      },
      setDuration: function (duration) {
        this.duration = duration;
      },
      getLatitude: function () {
        return this.latitude;
      },
      setLatitude: function (latitude) {
        this.latitude = latitude;
      },
      getLongitude: function () {
        return this.longitude;
      },
      setLongitude: function (longitude) {
        this.longitude = longitude;
      },
      getPreview: function () {
        return this.preview;
      },
      setPreview: function (preview) {
        this.preview = preview;
      },
      getSize: function () {
        return this.size;
      },
      setSize: function (size) {
        this.size = size;
      },
      getURL: function () {
        return this.url;
      },
      setURL: function (url) {
        this.url = url;
      },
      getMediaId: function () {
        return this.mediaId;
      },
      setMediaId: function (mediaId) {
        this.mediaId = mediaId;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.getContentType()) {
          jsonObject.contentType = self.getContentType();
        }
        if (self.getDuration()) {
          jsonObject.duration = self.getDuration();
        }
        if (self.getLatitude()) {
          jsonObject.latitude = self.getLatitude();
        }
        if (self.getLongitude()) {
          jsonObject.longitude = self.getLongitude();
        }
        if (self.getSize()) {
          jsonObject.size = self.getSize();
        }
        if (self.getPreview()) {
          jsonObject.preview = self.getPreview();
        }
        if (self.getURL()) {
          jsonObject.file = self.getURL();
        }
        if (self.getMediaId()) {
          jsonObject.id = self.getMediaId();
        }
        return jsonObject;
      },
    };
    ICAttachment.fromJSON = function (jsonObject) {
      return AttachmentCon(jsonObject);
    };
    return ICAttachment;
  })();
  IMI.namespace("IMI.ICMediaFile");
  IMI.ICMediaFile = function () { };
  IMI.ICMediaFile.prototype = new IMI.ICAttachment();

  //ICMessage
  IMI.namespace("IMI.ICMessage");
  IMI.ICMessage = (function () {
    var ICMessage;
    ICMessage = function () {
      var self = this;
      self.category = undefined;
      self.channel = undefined; //ICMessageChannel
      self.extras = undefined;
      self.media = self.attachments = undefined; //ICAttachment
      self.message = undefined;
      self.replyTo = undefined;
      self.conversationId = undefined;
      self.topic = undefined;
      self.transactionId = undefined;
      self.type = undefined; //ICMessageType
      self.userId = undefined;
      self.customTags = undefined;
      self.appId = undefined;
      self.deviceId = undefined;
      self.clientId = undefined;
      //new propeties
      self.deliveredAt = undefined;
      self.readAt = undefined;
      self.submittedAt = undefined;
      self.priority = undefined;
      self.thread = undefined;
      self.status = IMI.ICMessageStatus.None;
      self.temporaryId = undefined; //used for locally republishing messages
      //added in 1.1.0
      self.outgoing = true;

      //added in 1.3.2
      self.relatedTid;
      self.interactiveData;
      self.quickReplyData;
    };
    ICMessage.prototype = {
      getAppId: function () {
        return this.appId;
      },
      setAppId: function (appId) {
        this.appId = appId;
      },
      getCategory: function () {
        return this.category;
      },
      setCategory: function (category) {
        this.category = category;
      },
      getChannel: function () {
        return this.channel;
      },
      setChannel: function (channel) {
        this.channel = channel;
      },
      getCustomTags: function () {
        return this.customTags;
      },
      setCustomTags: function (customTags) {
        this.customTags = customTags;
      },
      getExtras: function () {
        return this.extras;
      },
      setExtras: function (extras) {
        this.extras = extras;
      },
      getMedia: function () {
        return this.attachments;
      },
      setMedia: function (media) {
        this.media = this.attachments = media;
      },
      getAttachments: function () {
        return this.attachments;
      },
      setAttachments: function (attachments) {
        this.media = this.attachments = attachments;
      },
      getMessage: function () {
        return this.message;
      },
      setMessage: function (message) {
        this.message = message;
      },
      getReplyTo: function () {
        return this.replyTo;
      },
      setReplyTo: function (replyTo) {
        this.replyTo = replyTo;
      },
      getConversationId: function () {
        return this.conversationId;
      },
      setConversationId: function (conversationId) {
        this.conversationId = conversationId;
      },
      getTopic: function () {
        return this.topic;
      },
      setTopic: function (topic) {
        this.topic = topic;
      },
      getPriority: function () {
        return this.priority;
      },
      setPriority: function (priority) {
        this.priority = priority;
      },
      getTransactionId: function () {
        return this.transactionId;
      },
      setTransactionId: function (transactionId) {
        this.transactionId = transactionId;
      },
      getType: function () {
        return this.type;
      },
      setType: function (type) {
        this.type = type;
      },
      getUserId: function () {
        return this.userId;
      },
      setUserId: function (userId) {
        this.userId = userId;
      },
      getDeviceId: function () {
        return this.deviceId;
      },
      setDeviceId: function (deviceId) {
        this.deviceId = deviceId;
      },
      getClientId: function () {
        return this.clientId;
      },
      setClientId: function (clientId) {
        this.clientId = clientId;
      },
      getSubmittedAt: function () {
        return this.submittedAt;
      },
      setSubmittedAt: function (submittedAt) {
        this.submittedAt = submittedAt;
      },
      getReadAt: function () {
        return this.readAt;
      },
      setReadAt: function (readAt) {
        this.readAt = readAt;
      },
      getDeliveredAt: function () {
        return this.deliveredAt;
      },
      setDeliveredAt: function (deliveredAt) {
        this.deliveredAt = deliveredAt;
      },
      getThread: function () {
        return this.thread;
      },
      setThread: function (thread) {
        this.thread = thread;
      },
      getStatus: function () {
        return this.status;
      },
      setStatus: function (status) {
        this.status = status;
      },
      setOutgoing: function (outgoing) {
        this.outgoing = outgoing;
      },
      getOutgoing: function () {
        return this.outgoing;
      },
      setRelatedTransactionId: function (val) {
        this.relatedTid = val;
      },
      getRelatedTransactionId: function () {
        return this.relatedTid;
      },
      setInteractiveData: function (val) {
        this.interactiveData = val;
      },
      getInteractiveData: function () {
        return this.interactiveData;
      },
      setQuickReplyData: function (val) {
        this.quickReplyData = val;
      },
      getQuickReplyData: function () {
        return this.quickReplyData;
      },
      getTemporaryId: function () {
        return this.temporaryId;
      },
      setTemporaryId: function (id) {
        this.temporaryId = id;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        jsonObject.appId = self.getAppId();
        jsonObject.deviceId = self.getDeviceId();
        jsonObject.clientId = self.getClientId();
        jsonObject.topic = self.getTopic();
        jsonObject.message = self.getMessage();
        if (self.getUserId()) {
          jsonObject.userId = self.getUserId();
        }
        if (self.getConversationId()) {
          jsonObject.senderId = self.getConversationId();
        }
        if (self.getTransactionId()) {
          jsonObject.tid = self.getTransactionId();
        }
        if (self.getType()) {
          jsonObject.type = self.getType();
        }
        if (self.getTopic()) {
          jsonObject.topic = self.getTopic();
        }
        if (self.getChannel()) {
          jsonObject.channel = self.getChannel();
        }
        if (self.getCategory()) {
          jsonObject.category = self.getCategory();
        }
        if (self.getThread()) {
          jsonObject.thread = self.getThread().toJSON();
        }
        var ex = {};
        if (self.getExtras()) {
          ex = self.getExtras();
        }
        if (self.getCustomTags()) {
          ex.customtags = self.getCustomTags();
        }
        jsonObject.extras = ex;

        if (self.getAttachments() && IMI.isArray(self.getAttachments())) {
          var attchArray = [];
          var attchs = self.getAttachments();
          for (var m = 0; m < attchs.length; m++) {
            var attch = attchs[m];
            attchArray.push(attch.toJSON());
          }
          jsonObject.media = attchArray;
        }
        if (self.getMedia() && IMI.isArray(self.getMedia())) {
          var attchArray = [];
          var attchs = self.getMedia();
          for (var m = 0; m < attchs.length; m++) {
            var attch = attchs[m];
            attchArray.push(attch.toJSON());
          }
          jsonObject.media = attchArray;
        }
        jsonObject.outgoing = self.getOutgoing();
        //added 1.3.2
        jsonObject.relatedTid = self.getRelatedTransactionId();
        if (self.interactiveData)
          jsonObject.interactiveData = self.interactiveData.toJSON();
        if (self.getQuickReplyData()) {
          jsonObject.quickReplies = self.getQuickReplyData().toJSON();
        }
        jsonObject.temporaryId = self.getTemporaryId();
        if (self.getSubmittedAt())
          jsonObject.created_on = IMI.parseDate(self.getSubmittedAt());
        jsonObject.status = self.getStatus();
        return jsonObject;
      },
    };
    ICMessage.fromJSON = function (jsonObject) {
      var msgObj = new IMI.ICMessage();
      msgObj.setCategory(jsonObject.category);
      msgObj.setChannel(jsonObject.channel); //rt //need to change
      msgObj.setMessage(jsonObject.message);
      msgObj.setReplyTo(jsonObject.replyTo);
      msgObj.setConversationId(jsonObject.senderId);
      msgObj.setTopic(jsonObject.topic);
      msgObj.setTransactionId(jsonObject.tid);
      msgObj.setDeviceId(jsonObject.deviceId || _imiconnect.getDeviceProfile().getDeviceId());
      msgObj.setAppId(jsonObject.appId || _imiconnect.icConfig.appid);
      msgObj.setUserId(jsonObject.userId || _imiconnect.getDeviceProfile().getUserId());
      msgObj.setClientId(jsonObject.clientId || _imiconnect.clientId);
      if (jsonObject.status != undefined) {
        msgObj.setStatus(jsonObject.status);
      }
      if (jsonObject.created_on || jsonObject.ts) {
        var createdOn = jsonObject.created_on || jsonObject.ts;
        msgObj.setSubmittedAt(IMI.getDate(createdOn));
        msgObj.setStatus(IMI.ICMessageStatus.Sent);
      }
      if (jsonObject.delivered_at) {
        msgObj.setDeliveredAt(IMI.getDate(jsonObject.delivered_at));
        msgObj.setStatus(IMI.ICMessageStatus.Delivered);
      }
      if (jsonObject.read_at) {
        msgObj.setReadAt(IMI.getDate(jsonObject.read_at));
        msgObj.setStatus(IMI.ICMessageStatus.Read);
      }
      if (jsonObject.interactiveData && jsonObject.interactiveData.submitted_at && jsonObject.interactiveData.submitted_at != "") {
        msgObj.setStatus(IMI.ICMessageStatus.Clicked);
      }

      //set Thread object
      if (jsonObject.thread) {
        var icThread = IMI.ICThread.fromJSON(jsonObject.thread);
        msgObj.setThread(icThread);
      }

      var type = IMI.ICMessageType.Message;
      var payloadType = jsonObject.payload_type;
      if (payloadType === "sentByUser") {
        type = IMI.ICMessageType.Republish;
      } else if (payloadType === "messageRead") {
        type = IMI.ICMessageType.ReadReceipt;
      } else if (payloadType === "messageDelivered") {
        type = IMI.ICMessageType.MessageDelivered;
      } else if (payloadType === "reopenThread") {
        type = IMI.ICMessageType.ReopenThread;
      } else if (payloadType === "closeThread") {
        type = IMI.ICMessageType.CloseThread;
      } else if (payloadType === "updateThread") {
        type = IMI.ICMessageType.UpdateThread;
      } else if (payloadType == "threadAlert") {
        type = IMI.ICMessageType.Alert;
      } else if (payloadType === "typingStart") {
        type = IMI.ICMessageType.TypingStart;
      } else if (payloadType === "typingStop") {
        type = IMI.ICMessageType.TypingStop;
      } else if (payloadType === "messageDeleted") {
        type = IMI.ICMessageType.MessageDeleted;
      } else if (payloadType === "messageClicked") {
        type = IMI.ICMessageType.ClickedReceipt;
      }
      msgObj.setType(type);

      // This republish is for locally broadcasted republishes
      if (jsonObject.type == IMI.ICMessageType.Republish) {
        msgObj.setType(IMI.ICMessageType.Republish);
      }

      if (jsonObject.relatedTid)
        msgObj.setRelatedTransactionId(jsonObject.relatedTid);
      if (jsonObject.interactiveData)
        msgObj.setInteractiveData(
          IMI.ICInteractiveData.fromJSON(jsonObject.interactiveData)
        );

      msgObj.setUserId(jsonObject.userId || _imiconnect.iCDeviceProfile.userId);
      if (jsonObject.outgoing) msgObj.setOutgoing(jsonObject.outgoing);
      else msgObj.setOutgoing(msgObj.getType() == IMI.ICMessageType.Republish);

      if (
        jsonObject.media &&
        IMI.isArray(jsonObject.media) &&
        jsonObject.media.length > 0
      ) {
        var mediaArray = [];
        for (var m = 0; m < jsonObject.media.length; m++) {
          const media = jsonObject.media[m];
          if (media.contentType == IMI.ICContentType.Template) {
            switch (media.templateType) {
              case IMI.ICTemplateType.Form:
                mediaArray.push(IMI.ICFormTemplateAttachment.fromJSON(media));
                break;
              case IMI.ICTemplateType.Generic:
                mediaArray.push(new IMI.ICGenericTemplateAttachment(media));
                break;
            }
          }
          else mediaArray.push(IMI.ICAttachment.fromJSON(media));
          msgObj.setAttachments(mediaArray);
        }
      }

      if (jsonObject.extras) {
        var extras = jsonObject.extras;
        if (extras && extras.customtags) {
          msgObj.setCustomTags(extras.customtags);
          delete jsonObject.extras.customtags;
        }
        msgObj.setExtras(extras);
      }

      if (jsonObject.quickReplies) {
        msgObj.setQuickReplyData(new IMI.ICQuickReplyData(jsonObject.quickReplies));
      }

      if (jsonObject.temporaryId)
        msgObj.temporaryId = jsonObject.temporaryId;

      return msgObj;
    };
    return ICMessage;
  })();

  IMI.ICGenericTemplateAttachment = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#contentType = jsonObject.contentType;
        this.#templateType = jsonObject.templateType;
        if (jsonObject.payload) this.#reference = jsonObject.payload.reference;
        this.#elements = [];
        jsonObject.payload.elements.forEach(ele => {
          this.#elements.push(new IMI.ICGenericTemplateElement(ele));
        });

      }
    }
    #contentType;
    #templateType;
    #elements;
    #reference;
    setReference(val) { this.#reference = val; };
    getReference() {
      return this.#reference;
    }
    getContentType() {
      return this.#contentType;
    }
    getTemplateType() {
      return this.#templateType;
    }
    getElements() {
      return this.#elements;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.contentType = this.#contentType;
      jsonObject.templateType = this.#templateType;
      jsonObject.payload = { "elements": [] };
      jsonObject.payload.reference = this.#reference;
      this.#elements.forEach(el => jsonObject.payload.elements.push(el.toJSON()));
      return jsonObject;
    }
  }

  IMI.ICGenericTemplateElement = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#title = jsonObject.title;
        this.#subtitle = jsonObject.subtitle;
        this.#imageURLs = jsonObject.imageUrls;
        this.#buttons = [];
        jsonObject.buttons.forEach(jsonButton => {
          this.#buttons.push(new IMI.ICButton(jsonButton))
        });
      }
    }
    #title;
    #subtitle;
    #imageURLs;
    #buttons;

    getTitle() {
      return this.#title;
    }
    getSubtitle() {
      return this.#subtitle;
    }
    getImageURLs() {
      return this.#imageURLs;
    }
    getButtons() {
      return this.#buttons;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.title = this.#title;
      jsonObject.subtitle = this.#subtitle;
      jsonObject.imageUrls = this.#imageURLs;
      jsonObject.buttons = [];
      this.#buttons.forEach(btn => {
        jsonObject.buttons.push(btn.toJSON())
      });
      return jsonObject;
    }
  }
  IMI.ICButton = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#identifier = jsonObject.identifier;
        this.#actionURL = jsonObject.url;
        this.#imageURL = jsonObject.imageUrl;
        this.#title = jsonObject.title;
        this.#payload = jsonObject.payload;
        this.#type = jsonObject.type;
        switch (jsonObject.type) {
          case IMI.ICInteractiveDataType.FormResponse:
            this.#type = IMI.ICInteractiveDataType.FormResponse;
            break;
          case IMI.ICInteractiveDataType.WebURL:
            this.#type = IMI.ICInteractiveDataType.WebURL;
            break;
          case IMI.ICInteractiveDataType.TemplatePostback:
            this.#type = IMI.ICInteractiveDataType.TemplatePostback;
            break;
          case IMI.ICInteractiveDataType.QuickReplyPostback:
            this.#type = IMI.ICInteractiveDataType.QuickReplyPostback;
            break;
        }

      }
    }
    #type;
    #identifier;
    #actionURL;
    #imageURL;
    #title;
    #payload;
    getType() {
      return this.#type;
    }
    getIdentifier() {
      return this.#identifier;
    }
    getImageURL() {
      return this.#imageURL;
    }
    getActionURL() {
      return this.#actionURL;
    }
    getTitle() {
      return this.#title;
    }
    getPayload() {
      return this.#payload;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.type = this.#type;
      jsonObject.identifier = this.#identifier;
      jsonObject.url = this.#actionURL;
      jsonObject.imageUrl = this.#imageURL;
      jsonObject.title = this.#title;
      jsonObject.payload = this.#payload;
      return jsonObject;
    }
  }

  IMI.ICQuickReplyData = class {
    constructor(jsonObject) {
      if (jsonObject) {
        this.#reference = jsonObject.reference;
        this.#buttons = [];
        if (jsonObject.options)
          jsonObject.options.forEach(btn => {
            this.#buttons.push(new IMI.ICButton(btn));
          });
      }
    }
    #reference;
    #buttons;
    setReference(val) { this.#reference = val; };
    getReference() {
      return this.#reference;
    }
    setButtons(val) { this.#buttons = val; };
    getButtons() {
      return this.#buttons;
    }
    toJSON() {
      var jsonObject = {};
      jsonObject.reference = this.#reference;
      jsonObject.options = [];
      this.#buttons.forEach(btn => jsonObject.options.push(btn));
      return jsonObject;
    }
  }

  //ICMessageStatus object
  IMI.namespace("IMI.ICMessageStatus");
  IMI.ICMessageStatus = {
    None: 0,
    NotSent: 1,
    Sent: 2,
    Delivered: 3,
    Read: 4,
    Clicked: 5

  };
  IMI.namespace("IMI.ICFormFieldType");
  IMI.ICFormFieldType = {
    Text: "text",
    Name: "name",
    Email: "email",
    Integer: "integer",
    Decimal: "decimal",
    Date: "date",
    Dropdown: "dropdown",
    MultiSelectDropdown: "multiSelectDropdown"
  };

  IMI.namespace("IMI.ICFormField");
  IMI.ICFormField = (function () {
    var ICFormField = function () {
      var self = this;
      self.name;
      self.type;
      self.label;
      self.options;
      self.value;
      self.values;
      self.description;
      self.mandatory;
    };
    ICFormField.prototype = {
      getName: function () {
        return this.name;
      },
      setName: function (val) {
        this.name = val;
      },
      setType: function (val) {
        this.type = val;
      },
      getType: function () {
        return this.type;
      },
      getValue: function () {
        return this.value;
      },
      setValue: function (val) {
        this.value = val;
      },
      getValues: function () {
        return this.values;
      },
      setValues: function (val) {
        this.values = val;
      },
      getLabel: function () {
        return this.label;
      },
      setLabel: function (val) {
        this.label = val;
      },
      getOptions: function () {
        return this.options;
      },
      setOptions: function (val) {
        this.options = val;
      },
      setDescription: function (val) {
        this.description = val;
      },
      getDescription: function () {
        return this.description;
      },
      getMandatory: function () {
        return this.mandatory;
      },
      setMandatory: function (val) {
        this.mandatory = val;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        jsonObject.name = self.name;
        jsonObject.type = self.type;
        if (self.getType() == IMI.ICFormFieldType.Date && self.value)
          jsonObject.value = IMI.parseDate(new Date(self.value));
        else jsonObject.value = self.value;

        if (self.getType() == IMI.ICFormFieldType.MultiSelectDropdown)
          jsonObject.value = self.values;

        jsonObject.label = self.label;
        jsonObject.options = self.options;
        jsonObject.description = self.description;
        jsonObject.mandatory = self.mandatory;
        return jsonObject;
      },
    };
    ICFormField.fromJSON = function (jsonObject) {
      var formField = new IMI.ICFormField();
      formField.name = jsonObject.name;
      formField.type = jsonObject.type;
      formField.value = jsonObject.value;
      if (jsonObject.type == IMI.ICFormFieldType.MultiSelectDropdown)
        formField.values = jsonObject.value;
      formField.label = jsonObject.label;
      formField.options = jsonObject.options;
      formField.description = jsonObject.description;
      formField.mandatory = jsonObject.mandatory;
      return formField;
    };
    return ICFormField;
  })();
  IMI.namespace("IMI.ICInteractiveData");
  IMI.ICInteractiveData = (function () {
    var ICInteractiveData = function () {
      var self = this;
      self.submittedAt;
      self.type;
      self.tid;
      self.relatedTransactionId;
      self.payload;
      self.identifier;
      self.title;
      self.reference;
      self.actionURL;

    };
    ICInteractiveData.prototype = {
      getSubmittedAt: function () {
        return this.submittedAt;
      },
      setSubmittedAt: function (val) {
        this.submittedAt = val;
      },
      setType: function (val) {
        this.type = val;
      },
      getType: function () {
        return this.type;
      },
      setTid: function (val) {
        this.tid = val;
      },
      getTid: function () {
        return this.tid;
      },
      setIdentifier: function (val) {
        this.identifier = val;
      },
      getIdentifier: function () {
        return this.identifier;
      },
      setRelatedTransactionId: function (val) {
        this.relatedTransactionId = val;
      },
      getRelatedTransactionId: function () {
        return this.relatedTransactionId;
      },
      getPayload: function () {
        return this.payload;
      },
      setPayload: function (val) {
        this.payload = val;
      },
      getTitle: function () {
        return this.title;
      },
      setTitle: function (val) {
        this.title = val;
      },
      getReference: function () {
        return this.reference;
      },
      setReference: function (val) {
        this.reference = val;
      },
      getActionURL: function () {
        return this.actionURL;
      },
      setActionURL: function (val) {
        this.actionURL = val;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.submittedAt) jsonObject.submitted_at = self.submittedAt;
        if (self.type) jsonObject.type = self.type;
        if (self.relatedTransactionId) jsonObject.tid = self.relatedTransactionId;
        else if (self.tid) jsonObject.tid = self.tid;
        if (self.identifier) jsonObject.identifier = self.identifier;
        jsonObject.payload = self.payload ? self.payload : {};
        if (self.title) jsonObject.title = self.title;
        if (self.reference) jsonObject.reference = self.reference;
        jsonObject.url = self.actionURL || "";
        return jsonObject;
      },
    };
    ICInteractiveData.fromJSON = function (jsonObject) {
      var data = new IMI.ICInteractiveData();
      data.submittedAt = jsonObject.submitted_at;
      data.type = jsonObject.type;
      data.tid = jsonObject.tid;
      data.relatedTransactionId = jsonObject.tid;
      data.identifier = jsonObject.identifier;
      data.title = jsonObject.title;
      data.reference = jsonObject.reference;
      data.actionURL = jsonObject.url;
      if (jsonObject.payload) data.payload = jsonObject.payload;
      return data;
    };
    return ICInteractiveData;
  })();

  IMI.namespace("IMI.ICInteractiveDataType");
  IMI.ICInteractiveDataType = {
    FormResponse: "formResponse",
    WebURL: "webUrl",
    TemplatePostback: "templatePostback",
    QuickReplyPostback: "quickReplyPostback"

  };
  IMI.namespace("IMI.ICTemplateType");
  IMI.ICTemplateType = {
    Form: "form",
    Generic: "generic"
  };
  IMI.namespace("IMI.ICFormTemplateAttachment");
  IMI.ICFormTemplateAttachment = (function () {
    var ICFormTemplateAttachment = function () {
      var self = this;
      self.contentType;
      self.templateType;
      self.templateId;
      self.title;
      self.fields;
      self.reference;
    };
    ICFormTemplateAttachment.prototype = {
      getTitle: function () {
        return this.title;
      },
      setTitle: function (val) {
        this.title = val;
      },
      getFields: function () {
        return this.fields;
      },
      setFields: function (fields) {
        this.fields = fields;
      },
      getContentType: function () {
        return this.contentType;
      },
      setContentType: function (val) {
        this.contentType = val;
      },
      getTemplateType: function () {
        return this.templateType;
      },
      setTemplateType: function (val) {
        this.templateType = val;
      },
      getTemplateId: function () {
        return this.templateId;
      },
      setTemplateId: function (val) {
        this.templateId = val;
      },
      getReference: function () {
        return this.reference;
      },
      setReference: function (val) {
        this.reference = val;
      },

      toJSON: function () {
        var jsonObject = {};
        jsonObject.contentType = this.contentType;
        jsonObject.templateType = this.templateType;
        jsonObject.templateId = this.templateId;
        jsonObject.payload = {};
        jsonObject.payload.title = this.title;
        jsonObject.payload.reference = this.reference;
        if (this.fields && this.fields.length > 0) {
          jsonObject.payload.fields = [];
          for (let index = 0; index < this.fields.length; index++) {
            const field = this.fields[index];
            jsonObject.payload.fields.push(field.toJSON());
          }
        }
        return jsonObject;
      },
    };
    ICFormTemplateAttachment.fromJSON = function (jsonObject) {
      var formTemplateAttachment = new IMI.ICFormTemplateAttachment();
      formTemplateAttachment.contentType = jsonObject.contentType;
      formTemplateAttachment.templateType = jsonObject.templateType;
      formTemplateAttachment.templateId = jsonObject.templateId;
      formTemplateAttachment.reference = jsonObject.payload.reference;
      formTemplateAttachment.title = jsonObject.payload.title;
      if (jsonObject.payload.fields && jsonObject.payload.fields.length > 0) {
        var formFields = [];
        for (let index = 0; index < jsonObject.payload.fields.length; index++) {
          formFields.push(
            IMI.ICFormField.fromJSON(jsonObject.payload.fields[index])
          );
        }
        formTemplateAttachment.fields = formFields;
      }
      return formTemplateAttachment;
    };
    return ICFormTemplateAttachment;
  })();

  IMI.namespace("IMI.ICContentType");
  IMI.ICContentType = {
    Audio: "audio",
    File: "file",
    Video: "video",
    Image: "image",
    Url: "url",
    Template: "template",
  };
  //ICDeviceProfile
  IMI.namespace("IMI.ICDeviceProfile");
  IMI.ICDeviceProfile = (function () {
    var ICDeviceProfile;
    //end user will set  deviceId and userId
    ICDeviceProfile = function (
      deviceId,
      userId,
      customerId,
      mIsAppUserSystemGenerated
    ) {
      var self = this;
      self.deviceId = deviceId;
      self.userId = userId;
      self.customerId = customerId;
      self.mIsAppUserSystemGenerated = mIsAppUserSystemGenerated || false;
    };
    ICDeviceProfile.prototype = {
      isAppUserSystemGenerated: function () {
        return this.mIsAppUserSystemGenerated;
      },
      getUserId: function () {
        return this.userId;
      },
      getDeviceId: function () {
        return this.deviceId;
      },
      _setDeviceId: function (deviceId) {
        this.deviceId = deviceId;
      },
      _setCustomerId: function (customerId) {
        this.customerId = customerId;
      },
      _setUserId: function (userId, mIsAppUserSystemGenerated) {
        this.userId = userId;
        this.mIsAppUserSystemGenerated = mIsAppUserSystemGenerated;
      },
    };
    //static method which gives default device ID
    ICDeviceProfile.getDefaultDeviceId = function () {
      var uuid = _util.uuid();
      if (_db) {
        var defDeviceId = _db.get("defDeviceId");
        if (IMI.defined(defDeviceId)) {
          uuid = defDeviceId;
        } else {
          _db.set("defDeviceId", uuid);
        }
      }

      return uuid;
    };

    return ICDeviceProfile;
  })();
  //ICThread obj

  IMI.namespace("IMI.ICThread");
  IMI.ICThread = (function () {
    function ThreadCon(jsonObject) {
      var threadObj = new IMI.ICThread();
      try {
        threadObj.setId(jsonObject.id);
        threadObj.setTitle(jsonObject.title);
        if (jsonObject.created_on) {
          threadObj.setCreatedAt(IMI.getDate(jsonObject.created_on));
        }
        if (jsonObject.updated_on) {
          threadObj.setUpdatedAt(IMI.getDate(jsonObject.updated_on));
        }
        if (jsonObject.stream_name) {
          threadObj.setStreamName(jsonObject.stream_name);
        }
        if (jsonObject.extras) {
          threadObj.setExtras(jsonObject.extras);
        }
        if (jsonObject.externalid) {
          threadObj.setExternalid(jsonObject.externalid);
        }
        if (jsonObject.type) {
          threadObj.setType(IMI.ICThreadType.getType(jsonObject.type));
        }
        if (jsonObject.unread_msg_count)
          threadObj.setUnreadMessageCount(jsonObject.unread_msg_count);

        if (jsonObject.status)
          threadObj.setStatus(
            IMI.ICThreadStatus.getThreadStatus(jsonObject.status)
          );

        if (jsonObject.reasonForStatusChange)
          threadObj.setReasonForStatusChange(jsonObject.reasonForStatusChange);
      } catch (error) {
        IMI.log(error);
      }
      return threadObj;
    }

    var ICThread = function () {
      var self = this;
      self.title;
      self.id;
      self.externalid;
      self.createdAt;
      self.updatedAt;
      self.type;
      self.category;
      self.extras;
      self.streamName;
      self.unreadMessageCount;
      self.status;
      self.reasonForStatusChange;
    };

    ICThread.prototype = {
      getId: function () {
        return this.id;
      },
      setId: function (id) {
        this.id = id;
      },
      getCreatedAt: function () {
        return this.createdAt;
      },
      setCreatedAt: function (createdAt) {
        this.createdAt = createdAt;
      },
      getUpdatedAt: function () {
        return this.updatedAt;
      },
      setUpdatedAt: function (updatedAt) {
        this.updatedAt = updatedAt;
      },
      getTitle: function () {
        return this.title;
      },
      setTitle: function (title) {
        this.title = title;
      },
      getExtras: function () {
        return this.extras;
      },
      setExtras: function (extras) {
        this.extras = extras;
      },
      getExternalid: function () {
        return this.externalid;
      },
      setExternalid: function (externalid) {
        this.externalid = externalid;
      },
      getType: function () {
        return this.type;
      },
      setType: function (type) {
        this.type = type;
      },
      getStreamName: function () {
        return this.streamName;
      },
      setStreamName: function (streamName) {
        this.streamName = streamName;
      },
      getCategory: function () {
        return this.category;
      },
      setCategory: function (category) {
        this.category = category;
      },
      setUnreadMessageCount: function (count) {
        this.unread_msg_count = count;
      },
      getUnreadMessageCount: function () {
        return this.unread_msg_count;
      },
      getStatus: function () {
        return this.status;
      },
      setStatus: function (status) {
        this.status = status;
      },
      setReasonForStatusChange: function (val) {
        this.reasonForStatusChange = val;
      },
      getReasonForStatusChange: function () {
        return this.reasonForStatusChange;
      },
      toJSON: function () {
        var self = this;
        var jsonObject = {};
        if (self.getId()) {
          jsonObject.id = self.getId();
        }
        if (self.getTitle()) {
          jsonObject.title = self.getTitle();
        }
        if (self.getCreatedAt()) {
          jsonObject.createdAt = IMI.parseDate(self.getCreatedAt());
        }
        if (self.getUpdatedAt()) {
          jsonObject.updatedAt = IMI.parseDate(self.getUpdatedAt());
        }
        if (self.getStreamName()) {
          jsonObject.stream_name = self.getStreamName();
        }

        if (self.getExtras()) {
          jsonObject.extras = self.getExtras();
        }
        if (self.getExternalid()) {
          jsonObject.externalid = self.getExternalid();
        }
        if (self.getType()) {
          jsonObject.type = self.getType();
        }
        if (self.getStatus()) {
          jsonObject.status = self.getStatus();
        }
        if (self.getReasonForStatusChange())
          jsonObject.reasonForStatusChange = self.getReasonForStatusChange();
        return jsonObject;
      },
    };
    ICThread.fromJSON = function (jsonObject) {
      return ThreadCon(jsonObject);
    };
    return ICThread;
  })();

  //IMI.ICThreadType
  IMI.namespace("IMI.ICThreadType");
  IMI.ICThreadType = {
    Conversation: "Conversation",
    Announcement: "Announcement",
    getType: function (type) {
      if (type === "Conversation") {
        return this.Conversation;
      } else if (type === "Announcement") {
        return this.Announcement;
      }
    },
  };

  //ICThreadStatus object
  IMI.namespace("IMI.ICThreadStatus");
  IMI.ICThreadStatus = {
    Active: "Active",
    Closed: "Closed",
    getThreadStatus: function (status) {
      if (status === "Active") {
        return this.Active;
      } else if (status === "Closed") {
        return this.Closed;
      }
    },
  };

  //ICConnectionStatus object
  IMI.namespace("IMI.ICConnectionStatus");
  IMI.ICConnectionStatus = {
    None: 0,
    Connecting: 1,
    Connected: 2,
    Refused: 3,
    Closed: 4,
    Error: 6,
  };
  //MessageStatus object
  IMI.namespace("IMI.MessageStatus");
  IMI.MessageStatus = {
    messagesuccess: 0,
    messagefailed: 1,
  };
  //ICMessageType object
  IMI.namespace("IMI.ICMessageType");
  IMI.ICMessageType = {
    Message: "Message",
    MessageNotification: "MessageNotification",
    ReadReceipt: "ReadReceipt",
    MessageDelivered: "MessageDelivered",
    Republish: "Republish",
    CloseThread: "CloseThread",
    ReopenThread: "ReopenThread",
    UpdateThread: "UpdateThread",
    Alert: "ThreadAlert",
    TypingStart: "TypingStart",
    TypingStop: "TypingStop",
    MessageDeleted: "MessageDeleted",
    ClickedReceipt: "ClickedReceipt"
  };
  //access level
  IMI.namespace("IMI.ICAccessLevel");
  IMI.ICAccessLevel = {
    ReadWrite: 0,
    Read: 1,
    Write: 2,
    getAccessLevel: function (level) {
      if (level == 0) {
        return this.ReadWrite;
      } else if (level == 1) {
        return this.Read;
      } else if (level == 2) {
        return this.Write;
      }
    },
  };
  IMI.namespace("IMI.ICErrorCodes");
  IMI.ICErrorCodes = {
    NotInitialized: { code: 6000, description: "Not initialized" },
    AlreadyInitialized: { code: 6001, description: "Aleady initialized" },
    NotRegistered: { code: 6002, description: "Not registered" },
    FeatureNotSupported: { code: 6003, description: "Feature not supported" },
    InvalidParameterValue: {
      code: 6004,
      description: "Invalid parameter value",
    },
    PermissionNotGranted: { code: 6005, description: "Permission not granted" },
    DeviceIdCurrentlyNotRegistered: {
      code: 6006,
      description: "DeviceId currently not registered",
    },
    AlreadyProcessing: {
      code: 6007,
      description: "AlreadyProcessing"
    },
    NotConnected: { code: 6200, description: "Not connected" },
    ConnectionFailure: { code: 6201, description: "Connection failure" },
    PublishFailed: { code: 6202, description: "Publish failed" },
    SubscribeFailed: { code: 6203, description: "Subscription failed" },
    UnsubscribeFailed: { code: 6204, description: "Unsubscription failed" },
    ConnectionAlreadyExists: {
      code: 6205,
      description: "Connection is already exists",
    },
    DuplicateRegisterListener: {
      code: 6026,
      description: "Duplicate register listener",
    },
    InvalidToken: { code: 6027, description: "Invalid token" },
    InvalidAuthorizationRequest: {
      code: 6028,
      description: "Invalid authorization request",
    },
    TokenExpired: { code: 6029, description: "Token is expired" },
    TokenRequired: { code: 6030, description: "Token is required" },
    InvalidContentType: { code: 6031, description: "Invalid content type" },
    InternalError: { code: 6032, description: "Internal error" },
    DeviceIdAlreadyRegistered: {
      code: 6033,
      description: "DeviceId already registered",
    },
    Unknown: { code: 6999, description: "Unknown error" },
    SDKVersionNotSupported: { code: '84', description: "SDK version discontinued" },
    RestFailure: { code: 6100, description: "Token fetch failed" }
  };
  //access filter
  IMI.namespace("IMI.ICAccessLevelFilter");
  IMI.ICAccessLevelFilter = {
    ReadWrite: 0,
    Read: 1,
    Write: 2,
    All: 3,
    getAccessLevel: function (level) {
      if (level == 0) {
        return this.ReadWrite;
      } else if (level == 1) {
        return this.Read;
      } else if (level == 2) {
        return this.Write;
      } else if (level == 3) {
        return this.All;
      }
    },
  };
  //device profile enum
  IMI.namespace("IMI.ICDeviceProfileParam");
  IMI.ICDeviceProfileParam = {
    UserId: 0,
    CustomerId: 1,
  };

  IMI.namespace("IMI.ICMediaFileManager");
  IMI.ICMediaFileManager = (function () {
    var Constr = function () { };
    Constr.uploadFile = function (file, mimeType, callback) {
      var isRegEn = _imiconnect.isRegistered();
      if (!isRegEn) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered);
        }
        return;
      }
      if (arguments.length === 2) {
        if (IMI.isObject(mimeType)) {
          callback = mimeType;
        }
      }
      if (!(file instanceof File)) {
        //checking given value is File or not
        if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
          //checking Callback is there or not
          callback.onFileUploadComplete(
            file,
            "",
            IMI.ICErrorCodes.InvalidParameterValue
          );
        }
      } else {
        if (!IMI.defined(mimeType) || !IMI.isString(mimeType)) {
          mimeType = file.type;
        }
        var fileUploadURL =
          elbZeroRatingUploadURL +
          "/media/" +
          _imiconnect.appName +
          "/upload?previewRequired=true&fileUrlRequired=true";

        var _retryContext = { hasRetried: false };

        function _doUpload() {
          var headers = _imiconnect._getAjaxHeader();
          if (headers["Content-Type"] == "application/json")
            delete headers["Content-Type"];
          if (mimeType) {
            headers["media-type"] = mimeType;
          }
          var formData = new FormData();
          formData.append("media", file);

          $.ajax({
            url: fileUploadURL,
            type: "POST",
            data: formData,
            contentType: false,
            cache: false,
            processData: false,
            headers: headers,
            xhr: function () {
              //upload Progress
              var xhr = $.ajaxSettings.xhr();
              if (xhr.upload) {
                xhr.upload.addEventListener(
                  "progress",
                  function (event) {
                    var position = event.loaded || event.position;
                    var total = event.total;
                    if (
                      callback &&
                      IMI.isFunction(callback.onFileUploadProgress)
                    ) {
                      callback.onFileUploadProgress(file, position, total);
                    }
                  },
                  true
                );
              }
              return xhr;
            },
            success: function (resp) {
              _imiconnect._processUnsupportedSDKVersion(resp);
              if (resp && resp.code === 36) {
                // Not a token error — InvalidContentType. Don't route
                // through handleAuthRetry; deliver verbatim.
                if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                  callback.onFileUploadComplete(
                    file,
                    "",
                    IMI.ICErrorCodes.InvalidContentType
                  );
                }
              } else if (resp.mediaId) {
                if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                  callback.onFileUploadComplete(file, resp.mediaId, null, resp);
                }
              }
              else {
                var failOriginal = function () {
                  if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                    if (resp.code && resp.code == IMI.ICErrorCodes.SDKVersionNotSupported.code) {
                      callback.onFileUploadComplete(
                        file,
                        "",
                        IMI.ICErrorCodes.SDKVersionNotSupported
                      );
                    }
                    else
                      callback.onFileUploadComplete(
                        file,
                        "",
                        IMI.ICErrorCodes.InternalError
                      );
                  }
                };

                _retryContext.retry = _doUpload;
                _retryContext.failOriginal = failOriginal;

                if (!IMI._authTokenManager
                    || typeof IMI._authTokenManager.handleAuthRetry !== "function"
                    || !IMI._authTokenManager.handleAuthRetry(resp, _retryContext)) {
                  failOriginal();
                }
              }
            },
            error: function (responseData, textStatus, errorThrown) {
              // Transport-layer failure (network drop / 4xx / 5xx). Per
              //  we intentionally DO NOT retry uploads here —
              // POST /upload is non-idempotent (could create duplicate
              // media). Token-error retry (38/39/40) is handled in the
              // success branch above.
              if (callback && IMI.isFunction(callback.onFileUploadComplete)) {
                callback.onFileUploadComplete(
                  file,
                  "",
                  IMI.ICErrorCodes.InternalError
                );
              }
            },
          });
        }
        _doUpload();
      }
    }

    Constr.regenerateMediaURL = function (mediaUrl, callback) {
      var isRegEn = _imiconnect.isRegistered();
      if (!isRegEn) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.DeviceIdCurrentlyNotRegistered);
        }
        return;
      }
      if (mediaUrl.trim().length == 0) {
        if (callback && IMI.isFunction(callback.onFailure)) {
          callback.onFailure(IMI.ICErrorCodes.InvalidParameterValue);
        }
      }
      var qs = _util.getQueryString(mediaUrl);
      if (qs.exp) {
        let now = new Date().getTime();
        if (now < parseInt(qs.exp)) {
          if (callback && typeof callback.onSuccess == "function")
            callback.onSuccess(mediaUrl);
          return;
        }
      }

      var headers = _imiconnect._getAjaxHeader();
      var postData = { url: mediaUrl };
      var generateMediaApi = `${elbZeroRatingURL}/${_imiconnect.appName}/user/${_imiconnect.iCDeviceProfile.userId}/generatemedia`;
      var options = {
        url: generateMediaApi,
        type: "POST",
        data: JSON.stringify(postData),
        headers: headers,
        success: function (resp) {
          _imiconnect._processUnsupportedSDKVersion(resp);
          if (resp && resp.code == "0") {
            if (callback && typeof callback.onSuccess == "function")
              callback.onSuccess(resp.url);
            else _imiconnect._invokeFailureCallBack(callback, resp);
          } else if (resp && resp.code == "1") {
            if (callback && typeof callback.onFailure == "function")
              callback.onFailure(resp.status);
          } else _imiconnect._invokeFailureCallBack(callback, resp);
        },
        error: function (responseData, textStatus, errorThrown) {
          if (callback && IMI.isFunction(callback.onFailure)) {
            callback.onFailure(errorThrown);
          }
        },
      };
      $.ajax(options);
    };
    return Constr;
  })();

  IMI.namespace("IMI.ICFileUploadCallback");
  IMI.ICFileUploadCallback = (function () {
    var Constr;
    Constr = function () {
      this.onFileUploadComplete = function (file, mediaId, error) {
      };
      this.onFileUploadProgress = function (file, bytesUploaded, bytesTotal) {
      };
    };
    return Constr;
  })();

  //All service worker related activity is managed by BackgroundService
  IMI.namespace("IMI.BackgroundService");
  IMI.EventType = {
    DeviceRegistered: "deviceRegistered",
    DeviceUnregistered: "deviceUnregistered",
    UserIdUpdated: "userIdUpdated",
    StartMessageDeliveryStatusRetry: "startMessageDeliveryStatusRetry",
    ShouldDisplayNotification: 'shouldDisplayNotification',
    UpdateAjaxHeaders: "updateAjaxHeaders",
    AddRetryRequest: "addRetryRequest",
    Startup: "startup",
    Shutdown: "shutdown",
    RequestConnection: "requestConnection",
    RequestDisconnection: "requestDisconnection",
    ConnectionEstablished: "connectionEstablished",
    ConnectionLost: "connectionLost",
    ConnectionFailure: "connectionFailure",
    MessageArrived: "messageArrived",
    RepublishLocally: "republishLocally",
    LocalMessageRepublished: "localMessageRepublished",
    SendDeliveryReceipt: "sendDeliveryReceipt",
    Reconnect: "reconnect",
    RegisterAppClient: "REGISTER_APP_CLIENT",
    DeregisterAppClient: "DEREGISTER_APP_CLIENT",
    SwPing: "SW_PING",
    SwPong: "SW_PONG",
  }
  IMI.EventDetail = (function () {
    var EventDetail = function (eventType, data) {
      var self = this;
      self.type = eventType;
      if (data)
        self.detail = data;
      return self;
    };
    return EventDetail;
  })();
  IMI.BackgroundServiceEventType = { MessageFromServiceWorker: "messageReceivedFromServiceWorker" };
  IMI._swScope = null;
  IMI.getSwScope = function () {
    return IMI._swScope;
  };
  IMI.BackgroundServiceManager = (function () {
    var _instances = {};
    var _activeAppId = null;
    var _listenerRegistered = false;

    function _initMessageListener() {
      if (_listenerRegistered) return;
      _listenerRegistered = true;

      navigator.serviceWorker.addEventListener("message", function (event) {
        var targetId = event.data && event.data.targetId;
        if (targetId && _instances[targetId]) {
          _instances[targetId].handleMessage(event.data);
        } else if (!targetId && _activeAppId && _instances[_activeAppId]) {
          _instances[_activeAppId].handleMessage(event.data);
        }
      });
    }

    return {
      getInstance: function (appId, callback) {
        _initMessageListener();
        if (!_instances[appId]) {
          _instances[appId] = new IMI.BackgroundService(callback, appId);
        }
        _activeAppId = appId;
        return _instances[appId];
      },

      getActive: function () {
        return _instances[_activeAppId];
      },

      postMessage: function (appId, eventType, detail) {
        var instance = _instances[appId];
        if (instance) {
          instance.postMessage(eventType, detail);
        }
      },

      getScope: function (appId) {
        return _imiconnect.icConfig.getRoot() + 'sw/' + appId + '/';
      },

      removeInstance: function (appId) {
        var instance = _instances[appId];
        if (instance) {
          delete _instances[appId];
        }
      }
    };
  })();
  IMI.BackgroundService = (function () {
    var BackgroundService = function (callback, appId) {
      var self = this;
      self.isInitialized = false;
      self.callback = callback;
      self.appId = appId || null;
      self._readyPromise = null;
      self.init();
    }
    BackgroundService.prototype = {
      init: async function () {
        var self = this;
        if (!self.isInitialized) {
          self._readyPromise = self.registerServiceWorker();
          await self._readyPromise;
        }
        else {
          self.callback.onSuccess("Service worker registered successfully");
        }
      },
      handleMessage: function (data) {
        var customEvent = new CustomEvent(
          IMI.BackgroundServiceEventType.MessageFromServiceWorker,
          { detail: data }
        );
        document.dispatchEvent(customEvent);
      },
      postMessage: function (eventType, detail) {
        var self = this;
        detail = detail || {};
        var targetAppId = (_imiconnect && _imiconnect.icConfig && _imiconnect.icConfig.appId)
          ? _imiconnect.icConfig.appid
          : self.appId;
        detail.targetId = targetAppId;
        const data = new IMI.EventDetail(eventType, detail);

        // Capture scope synchronously. uninit() nulls IMI._swScope before
        // microtasks run, so reading it inside sendMsg would return null and
        // silently drop messages (notably Shutdown). self.swScope is set in
        // registerServiceWorker and survives uninit's nullification of globals.
        var capturedScope = self.swScope || IMI.getSwScope();

        var sendMsg = function () {
          navigator.serviceWorker.getRegistration(capturedScope).then(function (swRegistration) {
            if (!swRegistration) return;
            var sw = swRegistration.installing || swRegistration.waiting || swRegistration.active;
            if (sw) sw.postMessage(data);
          });
        };

        if (self._readyPromise) {
          self._readyPromise.then(sendMsg);
        } else {
          sendMsg();
        }
      },
      registerServiceWorker: async function () {
        var self = this;
        if (!("serviceWorker" in navigator)) {
          if (self.callback && self.callback.onFailure && IMI.isFunction(self.callback.onFailure))
            self.callback.onFailure("Feature not supported: Service Worker");
          return;
        }

        var root = _imiconnect.icConfig.getRoot();
        var swScope;

        if (self.appId) {
          swScope = root + 'sw/' + self.appId + '/';
        }

        IMI._swScope = swScope;
        self.swScope = swScope;

        var swCfgPayload = {
          appId: self.appId,
          serverUrl: (_imiconnect.icConfig.sw && _imiconnect.icConfig.sw.config)
            ? _imiconnect.icConfig.sw.config.serverUrl
            : null,
          firebaseConfig: (_imiconnect.icConfig.apis && _imiconnect.icConfig.apis.config)
            ? _imiconnect.icConfig.apis.config
            : {}
        };
        var swCfgEncoded = encodeURIComponent(btoa(JSON.stringify(swCfgPayload)));
        // The service worker filename must match the SDK build in use: the
        // minified build ships sw.min.js, while running from source (dev) only
        // serves sw.js (sw.min.js is produced by the locked release build).
        // Real integrations use the minified build, so default to sw.min.js;
        // the demo app sets window.IMI_SW_FILENAME from app.config.json's
        // sourceCodeType so dev/source mode registers sw.js instead.
        // NOTE: read the global scope explicitly (not `self`) because `self` is
        // shadowed by `var self = this;` above and refers to the instance here.
        var _globalScope = (typeof window !== 'undefined')
          ? window
          : (typeof globalThis !== 'undefined' ? globalThis : null);
        var swFileName = (_globalScope && _globalScope.IMI_SW_FILENAME)
          ? _globalScope.IMI_SW_FILENAME
          : 'sw.min.js';
        var swUrl = window.location.origin + root + swFileName + '?cfg=' + swCfgEncoded;

        var swRegistration = await navigator.serviceWorker.register(swUrl, {
          scope: swScope,
          updateViaCache: 'none'
        });

        var serviceWorker = swRegistration.installing || swRegistration.waiting || swRegistration.active;
        if (!serviceWorker && self.callback && self.callback.onFailure && IMI.isFunction(self.callback.onFailure)) {
          self.callback.onFailure("Unable to register service worker");
          return;
        }
        else {
          self.isInitialized = true;
          if (self.callback && self.callback.onSuccess && IMI.isFunction(self.callback.onSuccess))
            self.callback.onSuccess("Service worker registered successfully");
        }

        if (swRegistration) {
          swRegistration.addEventListener('updatefound', function () {
            var newWorker = swRegistration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function () {
                if (newWorker.state === 'activated') {
                  IMI.ICMessaging.getInstance()._reconnect();
                }
              });
            }
          });
        }
      }
    }
    return BackgroundService;
  })();
  //web push logic
  IMI.namespace("IMI.WebPushClient");
  IMI.WebPushClient = (function () {
    // Resolves with the SW registration once its worker reaches state "activated".
    // Required because PushManager.subscribe (called by Firebase getToken) throws
    // "Subscription failed - no active Service Worker" when registration.active is null,
    // which is the case on the very first install of the SW.
    function _awaitSwActive(reg) {
      if (!reg) return Promise.resolve(null);
      if (reg.active) return Promise.resolve(reg);
      var sw = reg.installing || reg.waiting;
      if (!sw) return Promise.resolve(reg);
      return new Promise(function (resolve) {
        function onChange() {
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', onChange);
            resolve(reg);
          }
        }
        sw.addEventListener('statechange', onChange);
      });
    }

    var WebPushClient = function () {
      var self = this;
      self.isRegister = false;
      self.headers = { secretKey: _imiconnect.appSecret };
      var browserName = (self.browserName = IMI.getBrowserName());

      if (browserName === "chrome" || browserName === "firefox") {
        // CriOS/FxiOS report as chrome/firefox but run on iOS/iPadOS WebKit where
        // Firebase messaging is unsupported. Skip init so we never call
        // firebase.messaging() there (it would throw and leave `messaging` undefined).
        if (IMI._isIOSWeb()) {
          IMI.log("iOS/iPadOS web browser detected; Firebase messaging unavailable, skipping FCM init");
        } else if (!IMI._isFcmSupported()) {
          IMI.log("firebase.messaging.isSupported() returned false; skipping FCM init");
        } else try {
          if (firebase.apps.length > 0) {
            var existingApp = firebase.app();
            var existingOpts = existingApp && existingApp.options;
            var sameProject = existingOpts
              && existingOpts.projectId === config.projectId
              && existingOpts.appId === config.appId;
            if (sameProject) {
              messaging = firebase.messaging();
            } else {
              IMI.log("Firebase already initialized with a different config (projectId/appId mismatch). Call uninit() before initializing a different app.");
            }
          } else {
            firebase.initializeApp(config);
            messaging = firebase.messaging();
          }
        } catch (error) {
          IMI.log("please add firebase related resources ", error);
        }
      }
    };

    WebPushClient.prototype = {
      init: function (appid, userId, callback) {
        var self = this;
        self.appid = appid;
        self.userId = userId;
        self.deviceId = _imiconnect.iCDeviceProfile.deviceId;
        self.regcallback = callback;
        var browserName = (self.browserName = IMI.getBrowserName());
        // Centralized, capability-based routing. Handles CriOS/FxiOS and iPadOS
        // desktop mode (Macintosh UA + touch) by resolving them to "none".
        var pushPath = IMI._resolvePushPath(browserName);
        if (pushPath === "fcm") {
          self.initFCM();
        } else if (pushPath === "safari") {
          self.initSafari();
        } else {
          IMI.log("Web push unsupported for this browser/platform; skipping registration. browser=" + browserName);
        }
      },
      initFCM: function () {
        var self = this;
        try {
          if (Notification.permission === "denied") {
            return false;
          }
          // Check if push messaging is supported
          if (!("PushManager" in window)) {
            return false;
          }
          // Verify Firebase messaging is actually supported before continuing.
          // isSupported() may return a boolean (compat v8) or a Promise (compat v9+),
          // so normalize via _isFcmSupportedAsync(). Skip if unsupported or if
          // `messaging` never got initialized, otherwise a later getToken() would fail.
          IMI._isFcmSupportedAsync().then(function (supported) {
            if (!supported) {
              IMI.log("Firebase messaging not supported; skipping FCM registration");
              return;
            }
            if (!messaging) {
              IMI.log("Firebase messaging not initialized; skipping FCM registration");
              return;
            }
            //add manifest file in header
            var head = document.head;
            var noManifest = true;
            // Walk through the head to check if a manifest already exists
            for (var i = 0; i < head.childNodes.length; i++) {
              if (head.childNodes[i].rel === "manifest") {
                noManifest = false;
                break;
              }
            }
            if (noManifest) {
              var manifest = document.createElement("link");
              manifest.href = _imiconnect.icConfig.getAssetPath() + "manifest/manifest.json";
              manifest.rel = "manifest";
              document.head.appendChild(manifest);
            }
            self.FCMRegistration();
          });
        } catch (ex) {
          IMI.log("exception in chrome init :: ", ex);
        }
      },
      _onTokenReceived: function (currentToken) {
        var self = this;
        if (!currentToken) {
          IMI.log("Unable to get token");
          return;
        }
        if (!_imiconnect || !_imiconnect.backgroundService) {
          return;
        }
        IMI.log('currentToken: ', currentToken);
        self.setPushNotificationDisplay(true);
        var profileUpdateAPIURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/profileupdate";
        _db.set("pushRegistered", "true");

        // _pendingPushReplay: if the /profileupdate call below fails (token expired
        // or network error), we queue a retry closure here. After the user supplies
        // a fresh JWT and refreshToken() succeeds, it executes this closure to
        // re-attempt the push registration. Only used when enableAuthTokenExchange is ON.
        _imiconnect._pendingPushReplay = null;

        var data = {
          tenant: "1",
          event: "ProfileUpdate",
          channel: "rt",
          channelType: "web",
          clientId: _imiconnect.clientId,
          data: {
            update: {
              pushId: currentToken,
              useragent: navigator.userAgent,
              os: IMI.getBrowserName(),
              osversion: IMI.getbrowserVersion(),
              language: navigator.language,
            },
          },
          state: "PROFILEUPDATE",
        };

        var reqdata = _messagingInstance._getPayLoadMsg(
          JSON.stringify(data)
        );
        var headers = _imiconnect._getAjaxHeader();
        var callback = {
          onSuccess: function (resp) {
            _imiconnect._processUnsupportedSDKVersion(resp);
            if (resp && resp.isTokenError) {
              var errorCode = _imiconnect._getErrorCode(resp.code);
              _imiconnect._invokeSecurityTokenListeners(errorCode);
            }
            if (resp && (resp.code == "0" || resp.code == 0)) {
              _imiconnect._pendingPushReplay = null;
            } else if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange) {
              // Queue retry: refreshToken() will replay this after a new token is obtained.
              _imiconnect._pendingPushReplay = function () {
                if (_imiconnect.webpush
                    && typeof _imiconnect.webpush._onTokenReceived === "function") {
                  _imiconnect.webpush._onTokenReceived(currentToken);
                }
              };
            }
          },
          onFailure: function (error) {
            if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange) {
              _imiconnect._pendingPushReplay = function () {
                if (_imiconnect.webpush
                    && typeof _imiconnect.webpush._onTokenReceived === "function") {
                  _imiconnect.webpush._onTokenReceived(currentToken);
                }
              };
            }
            _imiconnect._invokeSecurityTokenListeners(error);
          },
        };
        IMI.Post(profileUpdateAPIURL, reqdata, headers, callback);
        self.returnCallBack({ pushId: currentToken });
        self.onMessageHandler();
      },
      FCMRegistration: function () {
        var self = this;
        try {
          navigator.serviceWorker.getRegistration(IMI.getSwScope())
            .then(_awaitSwActive)
            .then(function (swRegistration) {
              if (swRegistration && _imiconnect.icConfig.shouldRequestNotificationPermission) {
                self._requestPushPermission(swRegistration);
              }
            });
        }
        catch (err) {
          IMI.log('Error occurred while registering Push', err);
        }
      },
      _requestPushPermission: function (swRegistration, pushPermissionCallback) {
        if (!IMI.IMIconnect.isRegistered()) {
          IMI.log('User not registered');
          return;
        }
        if (!swRegistration || !swRegistration.active) {
          IMI.log('Skipping push permission: SW registration is not active yet');
          if (pushPermissionCallback && pushPermissionCallback.onFailure)
            pushPermissionCallback.onFailure('sw-not-active');
          return;
        }
        var self = this;
        Notification.requestPermission().then((permission) => {
          if (pushPermissionCallback && pushPermissionCallback.onSuccess)
            pushPermissionCallback.onSuccess(permission);
          if (permission != 'granted') {
            IMI.log("Grant permission to notify");
            return;
          }
          IMI.log('Notification permission granted.');
          if (!messaging) {
            IMI.log('Firebase messaging not initialized; cannot request push token');
            if (pushPermissionCallback && pushPermissionCallback.onFailure)
              pushPermissionCallback.onFailure('messaging-unavailable');
            return;
          }
          messaging.getToken({ serviceWorkerRegistration: swRegistration })
            .then((token) => self._onTokenReceived(token))
            .catch((err) => {
              // getToken() rejects (e.g. AbortError "Registration failed - push
              // service not available") when the browser cannot reach the FCM/GCM
              // push service. This is environmental (unsupported browser build,
              // blocked network, or a transient push-service outage), so we log
              // it and notify the caller instead of leaking an uncaught rejection.
              IMI.log('Failed to obtain push token; push service unavailable', err);
              if (pushPermissionCallback && pushPermissionCallback.onFailure)
                pushPermissionCallback.onFailure(err);
            });
        })
        .catch((err) => {
          // Guard the outer requestPermission()/getToken() chain so a rejected
          // permission prompt or token request never becomes an uncaught rejection.
          IMI.log('Push permission/token request failed', err);
          if (pushPermissionCallback && pushPermissionCallback.onFailure)
            pushPermissionCallback.onFailure(err);
        })
      },
      shouldDisplayNotification: false,
      setPushNotificationDisplay: function (active) {
        var self = this;
        self.shouldDisplayNotification = active;
        if (!_imiconnect || !_imiconnect.backgroundService) return;
        _imiconnect.backgroundService.postMessage(IMI.EventType.ShouldDisplayNotification, { "shouldDisplayNotification": active })
      }
      , onMessageHandler: function () {
        var self = this;
        if (messaging) {
          if (self._unsubscribeOnMessage) {
            try { self._unsubscribeOnMessage(); } catch (e) { IMI.log(e); }
            self._unsubscribeOnMessage = null;
          }
          let onPushMessageReceived = function (payload) {
            if (!self.shouldDisplayNotification) {
              return;
            }
            IMI.log("Local Message received. ", payload);
            var dataObj = payload.data || {};
            var title = dataObj.title || "";
            var body = dataObj.alert || "";
            var extras = {};
            if (dataObj.extras) {
              extras = JSON.parse(dataObj.extras);
            }
            var icon = extras.iconurl;
            var tag = payload.collapse_key || dataObj.tid;
            var pushextras = {};
            var appId = dataObj.appId;
            pushextras.appId = appId;
            pushextras.tid = dataObj.tid;
            pushextras.url = extras.url;
            var notificationOptions = {
              body: body,
              icon: icon,
              tag: tag,
              requireInteration: true,
              data: pushextras,
            };
            var trackDeliveryURL = elbZeroRatingURL + "/" + _imiconnect.appName + "/trackDeliveryRequest" + "?tid=" + dataObj.tid + "&appId=" + _imiconnect.appName;

            //sendig DR
            fetch(trackDeliveryURL, { headers: { apilevel: _imiconnect.sdkAPILevel } }).then((resp) => {
              _imiconnect._processUnsupportedSDKVersion(resp);
              //showing local notification
              if ("PushManager" in window) {
                navigator.serviceWorker.getRegistration(IMI.getSwScope()).then(function (
                  serviceWorkerRegistration
                ) {
                  if (serviceWorkerRegistration && serviceWorkerRegistration.active) {
                    return serviceWorkerRegistration.showNotification(
                      title,
                      notificationOptions
                    );
                  }
                });
              }
            }).catch(function (err) {
              _imiconnect.backgroundService.postMessage(IMI.EventType.AddRetryRequest,
                {
                  "request": { url: trackDeliveryURL, headers: { apilevel: _imiconnect.sdkAPILevel } }
                });
              IMI.log(err);
            });

          };
          self._unsubscribeOnMessage = messaging.onMessage(onPushMessageReceived);
        }
      },
      returnCallBack: function (obj) {
        var self = this;
        obj = obj || {};
        obj.appId = self.appid;
        obj.userId = self.userId;
        if (self.regcallback) {
          if (IMI.isFunction(self.regcallback)) {
            self.regcallback(obj);
          } else if (
            self.regcallback.onSuccess &&
            IMI.isFunction(self.regcallback.onSuccess)
          ) {
            self.regcallback.onSuccess(obj);
          }
        } else {
          IMI.log("callback is not set ", obj);
        }
      },
      initSafari: function () {
        safariself = this;
        // Use truthy checks: `"pushNotification" in window.safari` would throw if
        // window.safari exists but is null/undefined.
        if (!window.safari || !window.safari.pushNotification) {
          IMI.log("Safari push API unavailable; skipping initSafari");
          return;
        }
        var permissionData = window.safari.pushNotification.permission(
          imipush.safariWebPushId
        );
        safariself.checkRemotePermission(permissionData);
      },
      checkRemotePermission: function (permissionData) {
        var self = this;
        if (permissionData.permission === "default") {
          // This is a new web service URL and its validity is unknown.
          window.safari.pushNotification.requestPermission(
            safariRegisterURL, // The web service URL.//
            imipush.safariWebPushId, // The Website Push ID.
            {}, // Data used to help you identify the user.
            self.checkRemotePermission // The callback function.
          );
        } else if (permissionData.permission === "denied") {
          // The user said no. Talk to your UX expert to see what you can do to entice your
          // users to subscribe to push notifications.
        } else if (permissionData.permission === "granted") {
          var profileUpdateAPIURL =
            elbZeroRatingURL + "/" + _imiconnect.appName + "/profileupdate";
          _db.set("pushRegistered", "true");

          _imiconnect._pendingPushReplay = null;

          var data = {
            tenant: "1",
            event: "ProfileUpdate",
            clientId: _imiconnect.clientId,
            channel: "rt",
            channelType: "web",
            data: {
              update: {
                pushId: permissionData.deviceToken,
                useragent: navigator.userAgent,
                os: IMI.getBrowserName(),
                osversion: IMI.getbrowserVersion(),
                language: navigator.language,
              },
            },
            state: "PROFILEUPDATE",
          };
          var headers = _imiconnect._getAjaxHeader();

          var reqdata = _messagingInstance._getPayLoadMsg(JSON.stringify(data));

          var callback = {
            onSuccess: function (res) {
              _imiconnect._processUnsupportedSDKVersion(res);
              if (res && (res.code == "0" || res.code == 0)) {
                _imiconnect._pendingPushReplay = null;
              } else if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange) {
                _imiconnect._pendingPushReplay = function () {
                  if (_imiconnect.webpush
                      && typeof _imiconnect.webpush.checkRemotePermission === "function") {
                    _imiconnect.webpush.checkRemotePermission(permissionData);
                  }
                };
              }
            },
            onFailure: function (error) {
              if (_imiconnect.icConfig && _imiconnect.icConfig.enableAuthTokenExchange) {
                _imiconnect._pendingPushReplay = function () {
                  if (_imiconnect.webpush
                      && typeof _imiconnect.webpush.checkRemotePermission === "function") {
                    _imiconnect.webpush.checkRemotePermission(permissionData);
                  }
                };
              }
              _imiconnect._invokeSecurityTokenListeners(error);
            },
          };
          IMI.Post(profileUpdateAPIURL, reqdata, headers, callback);
          safariself.returnCallBack({ pushId: permissionData.deviceToken });
        }
      },
      unsubscribe: function (callback) {
        var self = this;
        _imiconnect._deregisterClientFromServiceWorkers(_imiconnect.backgroundService && _imiconnect.backgroundService.swScope);
        try {
          if (!self.browserName) return;
          self.browserName = IMI.getBrowserName();
          var browserName = self.browserName;
          if (browserName === "chrome" || (browserName === "firefox" && navigator.serviceWorker)) {
            navigator.serviceWorker.getRegistration(IMI.getSwScope()).then(function (swRegistration) {
              if (!swRegistration) return;
              if (!messaging) {
                IMI.log("Firebase messaging not initialized; nothing to unsubscribe");
                return;
              }
              messaging.getToken({ serviceWorkerRegistration: swRegistration })
                .then((currentToken) => {
                  if (currentToken) {
                    messaging.deleteToken(currentToken)
                      .then(function () {
                        _db.remove("pushRegistered");
                        if (callback && callback.onSuccess && IMI.isFunction(callback.onSuccess)) {
                          var Obj = {};
                          Obj.status = "0";
                          Obj.description =
                            "Webpush  successsfully unsubscribed";
                          callback.onSuccess(Obj);
                        }
                      })
                      .catch(function (err) {
                        IMI.log("Unable to delete token. ", err);
                      });
                  } else {
                    if (callback && callback.onFailure && IMI.isFunction(callback.onFailure)) {
                      var Obj = {};
                      Obj.status = "1";
                      Obj.description = "Not yet registered!";
                      callback.onFailure(Obj);
                    }
                  }
                })
                .catch(function (err) {
                  IMI.log("Error retrieving Instance ID token. ", err);
                });
            });
          }
        } catch (ex) { }
      },
      getWebSubscriptionDetials: function (callback) {
        var self = this;
        if (!self.browserName) {
          self.browserName = IMI.getBrowserName();
        }
        var browserName = self.browserName;
        if (!IMI.isFunction(callback)) {
          callback = function (obj) {
            IMI.log("callback function not sent :: pushdetails", obj);
          };
        }
        if (browserName === "chrome" || browserName === "firefox") {
          self.getSubscriptionDetails(callback);
        } else if (browserName === "safari") {
          self.getSafariSubscriptionDetails(callback);
        } else {
          IMI.log("other browser... browserName ::", browserName);
        }
      },
      getSubscriptionDetails: function (callback) {
        var self = this;
        try {
          navigator.serviceWorker.getRegistration(IMI.getSwScope()).then(function (
            serviceWorkerRegistration
          ) {
            if (!serviceWorkerRegistration) return;
            if (!messaging) {
              IMI.log("Firebase messaging not initialized; no subscription details available");
              var noMsgObj = {};
              noMsgObj.status = "1";
              noMsgObj.description = "app is not registered, please register";
              callback(noMsgObj);
              return;
            }
            messaging
              .getToken()
              .then(function (pushId) {
                if (!pushId) {
                  var Obj = {};
                  Obj.status = "1";
                  Obj.description = "app is not registered, please register";
                  callback(Obj);
                }

                var Obj = {};
                Obj.status = "0";
                if (
                  self.browserName === "chrome" ||
                  self.browserName === "firefox"
                ) {
                  Obj.pushId = pushId;
                }
                callback(Obj);
              })
              .catch(function (err) {
                var Obj = {};
                Obj.status = "1";
                Obj.description = "app is not registered, please register";
                callback(Obj);
              });
          });
        } catch (ex) {
          var Obj = {};
          Obj.status = "1";
          Obj.description = "app is not registered, please register";
          callback(Obj);
        }
      },
      getSafariSubscriptionDetails: function (callback) {
        if ("safari" in window && "pushNotification" in window.safari) {
          var permissionData = window.safari.pushNotification.permission(
            imipush.safariWebPushId
          );
          if (permissionData && permissionData.permission === "granted") {
            var Obj = {};
            Obj.status = "0";
            Obj.pushId = permissionData.deviceToken;
            callback(Obj);
            return true;
          }
        }
        var Obj = {};
        Obj.status = "1";
        Obj.description = "app is not registered, please register";
        callback(Obj);
        return true;
      },
    };
    return WebPushClient;
  })();
  class IMISessionDB {
    constructor(prefix) {
      if (!prefix) {
        throw "Please provide a unique prefix";
        return;
      }
      this.prefix = prefix;
      window.sessionStorage.setItem(this.prefix, JSON.stringify(this.getStore()));
    }
    add(v) {
      let temp = this.getStore();
      if (v instanceof Array)
        v.forEach(vi => temp.push(vi));
      else temp.push(v);

      window.sessionStorage.setItem(this.prefix, JSON.stringify(temp));
    }
    getStore() {
      let temp = window.sessionStorage.getItem(this.prefix);
      return temp ? JSON.parse(temp) : [];
    }
    exists(k) {
      return this.getStore().includes(k);
    }
    remove(ids) {
      let temp = this.getStore();
      if (!(ids instanceof Array)) ids = [ids];
      temp = temp.filter(item => !ids.includes(item));
      window.sessionStorage.setItem(this.prefix, JSON.stringify(temp));
    }
    prefix;
  }

  // JWT Auth Token Manager

  IMI.namespace("IMI._authTokenManager");
  IMI._authTokenManager = (function () {

    // 
    function _createToken(token, tokenType, expiresAt) {
      return {
        token:     token     || "",
        tokenType: tokenType || "Bearer",
        expiresAt: expiresAt || 0    // unix seconds
      };
    }

    function _isTokenValid(authToken) {
      return !!(authToken && authToken.token)
        && (Math.floor(Date.now() / 1000) < authToken.expiresAt);
    }

    function _toAuthorizationHeader(authToken) {
      if (!authToken || !authToken.token) return "";
      return (authToken.tokenType || "Bearer") + " " + authToken.token;
    }

    //Internal state 
    var _inMemoryToken    = _createToken();   // empty token
    var _inFlightPromise  = null;             // single-flight coalescing
    var _proactiveTimerId = null;             // setTimeout handle
    var _generation       = 0;                // bumped by clearToken()

    // OAuth retry policy 
    var OAUTH_TIMEOUT_MS         = 10000;
    var OAUTH_MAX_ATTEMPTS       = 3;
    var OAUTH_BACKOFF_MULTIPLIER = 1.1;

    // ---- Local helpers ----
    function _log(msg, err) {
      // IMI.log() only renders one arg; flatten errors into a single string.
      if (err === undefined) {
        IMI.log("[authTokenManager] " + msg);
      } else {
        var ne = _normalizeError(err);
        IMI.log("[authTokenManager] " + msg
          + " — code=" + ne.code + ", " + ne.description);
      }
    }



    // RetryDecision enum
    var RetryDecision = {
      RetryWithFreshAuth: "RetryWithFreshAuth",
      Proceed:            "Proceed"
    };


    function _normalizeError(raw) {
      var code        = IMI.ICErrorCodes.RestFailure.code;
      var description = IMI.ICErrorCodes.RestFailure.description;

      if (raw && typeof raw === "object") {
        if (raw.code !== undefined && raw.code !== null) code = raw.code;
        description = raw.description || raw.message || description;
      } else if (typeof raw === "string") {
        description = raw;
      } 

      description = String(description).replace(
        /Bearer\s+[\w.\-+/=]+/g, "Bearer ***"
      );

      var _ic = (typeof IMI !== "undefined") && IMI.IMIconnect;
      var errorObj = (_ic && typeof _ic._getErrorCode === "function")
        ? _ic._getErrorCode(code)
        : null;
      var isTokenError = (
        errorObj === IMI.ICErrorCodes.TokenExpired
        || errorObj === IMI.ICErrorCodes.TokenRequired
        || errorObj === IMI.ICErrorCodes.InvalidToken
      );

      return { code: code, description: description, isTokenError: isTokenError };
    }

    // decideOnTokenError ----
    function decideOnTokenError(errorCode, retryContext) {
      var isTokenError = (
        errorCode === IMI.ICErrorCodes.TokenExpired
        || errorCode === IMI.ICErrorCodes.TokenRequired
        || errorCode === IMI.ICErrorCodes.InvalidToken
      );

      if (!isTokenError) {
        return { kind: RetryDecision.Proceed, notifyListener: false };
      }

      var _ic = IMI.IMIconnect;
      if (_ic && _ic.icConfig
          && _ic.icConfig.enableAuthTokenExchange
          && retryContext
          && !retryContext.hasRetried) {
        return { kind: RetryDecision.RetryWithFreshAuth };
      }

      // Legacy mode, no retryContext, or already retried → escalate.
      return { kind: RetryDecision.Proceed, notifyListener: true };
    }

    function _validateParams(jwt, appId, userId, deviceId) {
      if (!appId) {
        throw { code: IMI.ICErrorCodes.InvalidParameterValue.code, description: "appId is blank" };
      }
      if (!userId) {
        throw { code: IMI.ICErrorCodes.InvalidParameterValue.code, description: "userId is blank" };
      }
      if (!deviceId) {
        throw { code: IMI.ICErrorCodes.InvalidParameterValue.code, description: "deviceId is blank" };
      }
      if (!jwt) {
        try {
          var _ic = IMI.IMIconnect;
          if (_ic && typeof _ic._invokeSecurityTokenListeners === "function") {
            _ic._invokeSecurityTokenListeners(IMI.ICErrorCodes.TokenRequired);
          }
        } catch (notifyErr) {
          _log("_invokeSecurityTokenListeners threw during validation", notifyErr);
        }
        throw IMI.ICErrorCodes.TokenRequired;
      }
    }

    // ---- Update the SW's headers, so the failed requests in retry queue can be attempted ----
    function _safePostUpdatedHeaders() {
      try {
        var _ic = IMI.IMIconnect;
        if (_ic && _ic.backgroundService
            && typeof _ic.backgroundService.postMessage === "function") {
          _ic.backgroundService.postMessage(IMI.EventType.UpdateAjaxHeaders, {
            headers: _ic._getAjaxHeader(),
            isTokenValid: true
          });
        }
      } catch (e) {
        _log("postMessage to SW failed (no SW registered yet?)", e);
      }
    }

    // ---- Refresh Token before Expiriy ----
    function _scheduleProactiveRefresh(token) {
      if (_proactiveTimerId) {
        clearTimeout(_proactiveTimerId);
        _proactiveTimerId = null;
      }
      // Don't arm a proactive refresh until the device profile is ready.
      // refreshToken() derives userId/deviceId from iCDeviceProfile, which is
      // null during the pre-register generateToken() mint (and on reload before
      // re-register). Scheduling here would fire refreshToken() with a blank
      // userId → 6004 "userId is blank". The post-register flow schedules the
      // proactive refresh again once the profile exists, so nothing is lost.
      var _icProfile = IMI.IMIconnect && IMI.IMIconnect.iCDeviceProfile;
      if (!_icProfile || !_icProfile.userId || !_icProfile.deviceId) return;
      var nowSec   = Math.floor(Date.now() / 1000);
      var delaySec = (token.expiresAt - 60) - nowSec;
      if (delaySec <= 0) return;        // failure-path retry will cover it
      _proactiveTimerId = setTimeout(function () {
        refreshToken().catch(function (e) {
          _log("Proactive token refresh failed", e);
          var _ic = IMI.IMIconnect;
          if (_ic && typeof _ic._invokeSecurityTokenListeners === "function") {
            var ne = _normalizeError(e);
            var errorCode = _ic._getErrorCode(ne.code);
            if (errorCode === IMI.ICErrorCodes.TokenExpired
                || errorCode === IMI.ICErrorCodes.TokenRequired
                || errorCode === IMI.ICErrorCodes.InvalidToken) {
              _ic._invokeSecurityTokenListeners(errorCode);
            }
          }
        });
      }, delaySec * 1000);
    }

    
    function _buildOAuthUrl(appId, userId) {
      var base = (typeof window !== "undefined" && window.authdomain) || "";
      return base
        + "/api/v1/apps/" + encodeURIComponent(appId)
        + "/user/" + encodeURIComponent(userId)
        + "/oauth/token";
    }

    async function _getToken(jwt, appId, userId, deviceId) {
      var url       = _buildOAuthUrl(appId, userId);
      var lastError = null;
      var delayMs   = OAUTH_TIMEOUT_MS;

      for (var attempt = 0; attempt < OAUTH_MAX_ATTEMPTS; attempt++) {
        var controller = new AbortController();
        var timeoutId  = setTimeout(function () { controller.abort(); }, OAUTH_TIMEOUT_MS);

        try {
          var resp = await fetch(url, {
            method: "GET",
            headers: {
              "Authorization": "Bearer " + jwt,
              "WX-Device-Id": deviceId
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);


          if (!resp.ok) {
            // Transient (5xx, network blip surfacing as non-ok) — fall through to retry.
            var errBody = await resp.json().catch(function () { return {}; });
            lastError = _normalizeError({
              code: errBody.code || IMI.ICErrorCodes.RestFailure.code,
              description: errBody.description || IMI.ICErrorCodes.RestFailure.description,
            });
          } else {
            var body = await resp.json();
            if (!body.access_token) { 
              throw _normalizeError({
                code: body.code || IMI.ICErrorCodes.RestFailure.code,
                description: body.description || IMI.ICErrorCodes.RestFailure.description,
              });
            }
            if (!body.expires_in || body.expires_in <= 0) {
              throw _normalizeError({
                code: IMI.ICErrorCodes.RestFailure.code,
                description: IMI.ICErrorCodes.RestFailure.description,
              });
            }
            var expiresAt = body.expires_in;
            return _createToken(body.access_token, body.token_type || "Bearer", expiresAt);
          }
        } catch (e) {
          clearTimeout(timeoutId);
          if (e && e.isTokenError) throw e;
          lastError = _normalizeError(e && e.name === "AbortError"
            ? { code: IMI.ICErrorCodes.RestFailure.code, description: IMI.ICErrorCodes.RestFailure.description }
            : e);
        }

        // Backoff before next attempt (skip after last attempt).
        if (attempt < OAUTH_MAX_ATTEMPTS - 1) {
          await new Promise(function (r) { setTimeout(r, delayMs); });
          delayMs = Math.floor(delayMs * OAUTH_BACKOFF_MULTIPLIER);
        }
      }

      throw lastError || _normalizeError({
        code: IMI.ICErrorCodes.RestFailure.code,
        description: IMI.ICErrorCodes.RestFailure.description,
      });
    }

    async function _fetchAndCache(jwt, appId, userId, deviceId) {
      var thisGen = _generation;
      var token   = await _getToken(jwt, appId, userId, deviceId);

      if (thisGen !== _generation) {
        return null;
      }

      _inMemoryToken = token;
      _scheduleProactiveRefresh(token);
      _safePostUpdatedHeaders();

      try {
        var _ic = IMI.IMIconnect;
        if (_ic && typeof _ic._pendingPushReplay === "function") {
          var replay = _ic._pendingPushReplay;
          _ic._pendingPushReplay = null;
          _log("replaying lost push registration after token refresh");
          replay();
        }
      } catch (e) {
        _log("post-refresh push replay threw", e);
      }

      return token;
    }

    
    async function generateToken(deviceId, userId) {
      var _ic = IMI.IMIconnect;
      var jwt = _ic && _ic.securityToken;
      if (jwt && jwt.indexOf("Bearer ") === 0) jwt = jwt.substring(7);

      var appId = _ic && _ic.appName;

      _validateParams(jwt, appId, userId, deviceId);

      return _fetchAndCache(jwt, appId, userId, deviceId);
    }

    async function refreshToken() {
      if (_inFlightPromise) return _inFlightPromise;
      IMI.IMIconnect._shouldNotifySecurityTokenListener = true;

      var p = (async function () {
        var _ic = IMI.IMIconnect;
        var jwt = _ic && _ic.securityToken;
        if (jwt && jwt.indexOf("Bearer ") === 0) jwt = jwt.substring(7);

        var appId    = _ic && _ic.appName;
        var profile  = _ic && _ic.iCDeviceProfile;
        var userId   = profile && profile.userId;
        var deviceId = profile && profile.deviceId;

        _validateParams(jwt, appId, userId, deviceId);

        return await _fetchAndCache(jwt, appId, userId, deviceId);
      })();

      _inFlightPromise = p;

      var _clear = function () {
        if (_inFlightPromise === p) _inFlightPromise = null;
      };
      p.finally(_clear);

      return p;
    }

    function clearToken() {
      _generation++;

      if (_proactiveTimerId) {
        clearTimeout(_proactiveTimerId);
        _proactiveTimerId = null;
      }
      _inMemoryToken = _createToken();
    }

   
    function getCachedToken() {
      return _inMemoryToken;
    }

    function preflightAuth(headers) {
      var _ic = IMI.IMIconnect;
      var needsPreflight = !!(_ic && _ic.icConfig
        && _ic.icConfig.enableAuthTokenExchange
        && headers && !headers.Authorization
        && _ic.securityToken
        && _ic.iCDeviceProfile);
      if (!needsPreflight) return Promise.resolve(false);
      return refreshToken().then(function () { return true; });
    }

    // handleAuthRetry (for direct $.ajax sites) 
    function handleAuthRetry(respObj, retryContext) {
      var _ic = IMI.IMIconnect;
      if (!_ic || !_ic.icConfig
          || !_ic.icConfig.enableAuthTokenExchange) return false;
      if (!retryContext || retryContext.hasRetried) return false;

      var errorObj = _ic._getErrorCode(respObj && respObj.code);
      var decision  = decideOnTokenError(errorObj, retryContext);
      if (decision.kind !== RetryDecision.RetryWithFreshAuth) return false;

      retryContext.hasRetried = true;
      refreshToken().then(
        function (token) {
          if (!token) {
            if (typeof retryContext.failOriginal === "function") {
              retryContext.failOriginal();
            }
            return;
          }
          if (typeof retryContext.retry === "function") retryContext.retry();
        },
        function (e) {
          _log("handleAuthRetry refresh failed", e);
          if (typeof retryContext.failOriginal === "function") {
            retryContext.failOriginal(_normalizeError(e));
          }
        }
      );
      return true;
    }

   
    return {
      getCachedToken:        getCachedToken,
      isTokenValid:          _isTokenValid,
      toAuthorizationHeader: _toAuthorizationHeader,
      generateToken:         generateToken,
      refreshToken:          refreshToken,
      clearToken:            clearToken,
      _normalizeError:       _normalizeError,
      decideOnTokenError:    decideOnTokenError,
      handleAuthRetry:       handleAuthRetry,
      preflightAuth:         preflightAuth,
      RetryDecision:         RetryDecision
    };
  })();
})(window.IMI = IMI || {});
