var IMIApi = {};
var env = imiEnvironments[imiEnvironments.target];

IMIApi.getDefaultDeviceId = function () {
    var deviceID = IMI.ICDeviceProfile.getDefaultDeviceId();
    console.log("getDetaultDeviceId", deviceID);
    return deviceID;
};
IMIApi.getDeviceProfile = function () {
    var dp = IMI.IMIconnect.getDeviceProfile();
    return dp;
};
IMIApi.createDeviceProfile = function (userId) {
    return new IMI.ICDeviceProfile(IMIApi.getDefaultDeviceId(), userId);
};
IMIApi.sendTypingStart = function (threadId) {
    IMIApi.sendTypingAlert(threadId, "typingStart");
};
IMIApi.sendTypingStop = function (threadId) {
    IMIApi.sendTypingAlert(threadId, "typingStop");
};

IMIApi.sendTypingAlert = function (threadId, status, text) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendTypingAlert: ", threadId, status);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);

    var raw = {
        notifyurl:
            "https://requestinspector.com/inspect/01ewbbv3891q6b445e045zq0g3",
        channels: {
            appmessaging: {
                thread_id: threadId,
                type: status,
                message: {
                    text: text || "Typing....",
                },
            },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    };

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(raw),
        redirect: "follow",
    };

    fetch(env.apiMT, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};

IMIApi.sendCOTTypingAlert = function (threadId, status, text) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendTypingAlert: ", threadId, status);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);

    var raw = {
        notifyurl:
            "https://requestinspector.com/inspect/01ewbbv3891q6b445e045zq0g3",
        channels: {
            appmessaging: {
                thread_id: threadId,
                type: status,
                message: {
                    text: text || "Typing Alert",
                    "extras": {
                        "customtags": {
                            "type": "chainOfThoughts"
                        }
                    }
                },
            },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    };

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(raw),
        redirect: "follow",
    };

    fetch(env.apiMT, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};
IMIApi.sendCOTMT = function (messageText, threadId) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendMT:", messageText, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify({
        notifyurl:
            "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
        channels: {
            appmessaging: {
                thread_id: threadId, message: {
                    text: messageText,
                    "extras": {
                        "customtags": {
                            "type": "chainOfThoughts"
                        }
                    }
                }
            },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
}

IMIApi.sendThreadAlert = function (threadId, text) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendThreadAlert: ", threadId, text);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);

    var raw = {
        notifyurl:
            "https://requestinspector.com/inspect/01ewbbv3891q6b445e045zq0g3",
        channels: {
            appmessaging: {
                thread_id: threadId,
                type: "threadAlert",
                message: {
                    text: text,
                },
            },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    };

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(raw),
        redirect: "follow",
    };

    fetch(env.apiMT, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};
IMIApi.createCustomerProfile = function () {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("createCustomerProfile: ");
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);

    var raw = {
        appid: env.asset.appId,
        "Records": [
            {
                "customerId": "Monica2",
                "Attributes": {
                    "email": "monica.c2@imimobile.com"
                }
            }

        ],
    };

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(raw),
        redirect: "follow",
    };

    let api = `https://${env.apiMT}/resources/v1/customerprofile`;
    fetch(api, requestOptions)
        .then((response) => response.text())
        .then((result) => console.log("createCustomerProfile Success", result))
        .catch((error) => console.log("createCustomerProfile error", error));
}

IMIApi.sendFCMPush = function (to) {
    var key = env.fcmServerKey;
    var data = {
        'title': 'sendFCMPush',
        'body': 'This message was sent from localhost'
    }
    var notification = {
        'title': 'sendFCMPush',
        'body': 'This message was sent from localhost',
        'icon': 'firebase-logo.png',
        'click_action': 'http://localhost:5501'
    };

    fetch('https://fcm.googleapis.com/fcm/send', {
        'method': 'POST',
        'headers': {
            'Authorization': 'key=' + key,
            'Content-Type': 'application/json'
        },
        'body': JSON.stringify({
            'notification': notification,
            'to': to
        })
    }).then(function (response) {
        console.log(response);
    }).catch(function (error) {
        console.error(error);
    })
}
IMIApi.sendMessagingAPIPushToToken = function (title, pushToken) {
    if (!env || !env.serviceKey) {
        throw ("Required properties missing in selected environment: serviceKey");
        return;
    }
    var myHeaders = new Headers();
    myHeaders.append("key", env.serviceKey);
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({
        "notifyurl": env.notifyUrl,
        "appid": env.asset.appId,
        "deliverychannel": "push",
        "channels": {
            "push": {
                "web": {
                    "platform_types": [
                        "chrome",
                        "firefox"

                    ],
                    "title": title,
                    "text": "Monica ",
                    "url": "https://images.91wheels.com/assets/c_images/gallery/mahindra/thar/mahindra-thar-3-1600169020.jpeg",
                    "extras": {}
                }
            }
        },
        "destination": [
            {
                "chrome_pushid": [
                    pushToken
                ]
            }
        ]
    });

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    fetch(env.apiMT, requestOptions)
        .then(response => response.text())
        .then(result => console.log(result))
        .catch(error => console.log('error', error));
}
IMIApi.sendMessagingAPIPushToUserId = function (title, userID) {
    if (!env || !env.serviceKey) {
        throw ("Required properties missing in selected environment: serviceKey");
        return;
    }
    var myHeaders = new Headers();
    myHeaders.append("key", env.serviceKey);
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify({
        "notifyurl": env.notifyUrl,
        "appid": env.asset.appId,
        "deliverychannel": "push",
        "channels": {
            "push": {
                "web": {
                    "platform_types": [
                        "chrome",
                        "firefox"

                    ],
                    "title": title,
                    "text": "userID=" + userID,
                    "url": "http://127.0.0.1:5501/qa-demo-app/api-demo.html",
                }
            }
        },
        "destination": [
            {
                "userid": [
                    userID
                ]
            }
        ]
    });

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };

    fetch(env.apiMT, requestOptions)
        .then(response => response.text())
        .then(result => console.log(result))
        .catch(error => console.log('error', error));
}

IMIApi.sendMT = function (messageText, threadId) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendMT:", messageText, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify({
        notifyurl:
            "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
        channels: {
            appmessaging: { thread_id: threadId, message: { text: messageText } },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};
IMIApi.sendQuickReplyOptions = function (messageText, threadId) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendQuickReplyOptions:", messageText, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify(
        {
            notifyurl: "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
            appid: env.asset.appId,
            deliverychannel: "appmessaging",
            channels: {
                appmessaging: {
                    thread_id: threadId,
                    message: {
                        text: messageText,
                        "quickReplies": {
                            "reference": "QR111",
                            "options": [
                                {
                                    "type": "quickReplyPostback",
                                    "identifier": "21221-323232-231212",
                                    "imageUrl": "https://images.91wheels.com//assets/c_images/gallery/mahindra/thar/mahindra-thar-3-1600169020.jpeg",
                                    "title": "Yes",
                                    "payload": {}
                                },
                                {
                                    "type": "quickReplyPostback",
                                    "identifier": "21221-323232-231213",
                                    "imageUrl": "https://images.91wheels.com//assets/c_images/gallery/mahindra/thar/mahindra-thar-14-1600169022.png",
                                    "title": "No",
                                    "payload": {}
                                }
                            ]
                        },

                    }
                }
            },
            destination: [{ userid: [IMIApi.getDeviceProfile().userId] }]
        });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
}
IMIApi.sendMTWithImage = function (threadId) {
    messageText = "This message has an image attachment";
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendMT:", messageText, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify({
        notifyurl:
            "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
        channels: {
            appmessaging: {
                thread_id: threadId, message: {
                    text: messageText,
                    attachment:
                    {
                        "file": "https://media.istockphoto.com/photos/sample-red-grunge-round-stamp-on-white-background-picture-id491520707?s=612x612",
                        "contentType": "image",
                        "size": "10"
                    }

                }
            },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};
IMIApi.sendGenericMT = function (messageText, threadId) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendMT:", messageText, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify({
        notifyurl:
            "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
        channels: {
            appmessaging: { thread_id: threadId, message: { text: messageText } },
        },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};
IMIApi.sendMTWithTemplate = function (templateId, threadId) {
    if (!env || !env.apiMT || !env.serviceKey) {
        throw ("Required properties missing in selected environment: apiMT and serviceKey");
        return;
    }
    console.log("sendMT:", templateId, threadId);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("key", env.serviceKey);
    myHeaders.append(
        "Cookie",
        "AWSALB=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U; AWSALBCORS=34N20Hk/lnt0Ud9W8KtCeepVwfuMj+F4qpWkT/WJW6+20zLMhKsqAn1ikh/OsLwPFpJC67JGJhK322qbyWYhRhiwzI1MWfY7XUZYd6LTHsyzim7sNUL1T5a5i74U"
    );

    var raw = JSON.stringify({
        notifyurl:
            "https://requestinspector.com/inspect/01dk60dt0c2h5ndvwnssc1wkgv",
        channels: {
            appmessaging: {
                thread_id: threadId,
            },
        },
        message: { template: templateId },
        deliverychannel: "appmessaging",
        appid: env.asset.appId,
        destination: [{ userid: [IMIApi.getDeviceProfile().userId] }],
    });

    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    fetch(getMessagingEndpoint(env.apiMT), requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.log("error", error));
};

IMIApi.generateJWTToken = function (userId, expiry, customerId) {
    // let url = "https://" + env.imiclient.rtmsdomain + "/jwtsimulator/api/v1/apps/" + env.asset.appId + "/jwttoken";
    let url = env.sw.config.serverUrl + "/jwtsimulator/api/v1/apps/" + env.asset.appId + "/jwttoken";
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    let postData = {
        appId: env.asset.appId,
        customerId: customerId,
        userId: userId,
        exp: expiry
    };
    var raw = JSON.stringify(postData);
    var requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
    };

    return fetch(url, requestOptions)
        .then((response) => response.json());

}

IMIApi.setHeartBeartSentAt = function (date) {
    const KEY_HEARTBEAT_SENT_AT = `IMI.Core.${env.asset.appId}.heartbeatSentAt`;
    if (!date)
        localStorage.removeItem(KEY_HEARTBEAT_SENT_AT);
    else
        localStorage[KEY_HEARTBEAT_SENT_AT] = date.getTime();
}

function getMessagingEndpoint(api) {
    var endpoint = [];
    if (env.apiMT.indexOf("http://") == -1 && api.indexOf("https://") == -1)
        endpoint.push("https://");
    endpoint.push(env.apiMT);
    if (api.indexOf("/resources/v1/messaging") == -1)
        endpoint.push("/resources/v1/messaging");
    return endpoint.join("");
}

function logCurrentBroker(appId) {
    appId = appId || env.asset.appId;
    let regiterResp = JSON.parse(localStorage[`IMI.Core.${appId}.regiterResp`]);
    console.log(`${appId}.broker:`, regiterResp.broker);


}