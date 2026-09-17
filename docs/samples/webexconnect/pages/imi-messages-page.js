class IMIMessagesPage extends IMIPage {
    constructor() {
        let templateUrl = "pages/imi-messages-page.html";
        super(templateUrl);

        let config = new UIPageConfig();
        config.containerSelector = "#divMessagesContainer";
        config.templateSelector = "#tmpMessage";
        config.templateNoResult = "#tmpMessageNoResult";
        config.templateCOTTypingAlert = "#tmpCOTMessage";
        config.compileParamName = "message";
        config.itemSelector = ".message";
        config.scrollObserver = ScrollObserver.bottom;
        this.setConfig(config);
        this.messageListener = (ev) => this.onMessageReceived(ev);
        document.addEventListener(IMIEvent.onMessageReceived, this.messageListener);
        document.addEventListener("visibilitychange", this.onVisibilityChangeListener);
    }
    onVisibilityChangeListener(ev) {
        if (document.visibilityState === "visible") {
            if (this.threadId)
                this.fetchThread();
        }
    }
    onAppendComplete(items) {
        this.handleUnsentItems(items)
        this.setQuickRepliesOption(items);
    }
    onPrependCompleted(items) {
        this.setQuickRepliesOption(items);
    }
    setQuickRepliesOption(items) {
        let message;
        if (items && items.length > 0) {
            message = items[0];
            if (message.isQuickReplyOptionAwaitingInput) {
                this.imiQuickReplies.setAttribute('data-icmessage', JSON.stringify(message.toJSON()));
            } else {
                this.imiQuickReplies.setAttribute('data-icmessage', null);
            }
        }
    }
    disconnectedCallback() {
        document.removeEventListener(IMIEvent.onMessageReceived, this.messageListener);
    }
    messageListener;
    threadId;
    setThreadId(threadId) {
        this.threadId = threadId;
    }
    fetchThread() {
        if (!this.threadId)
            throw "Required parameter missing: threadId";
        var messaging = IMI.ICMessaging.getInstance();
        messaging.fetchThread(this.threadId, this.fetchThreadCallback);
    }
    fetchThreadCallback = {
        onSuccess: (thread) => {
            if (thread) {
                this.thread = thread;
                this.updateThreadDisplay();
            }
            else {
                IMIToast.show("Thread not found");
            }
        },
        onFailure: (err) => {
            console.log("Error fetching thread:", err);
        },
    };
    updateThreadDisplay() {
        this.divThreadTitle.textContent = this.thread.getTitle();
        if (this.thread.getStatus() == IMI.ICThreadStatus.Closed) {
            this.divThreadClosed.style.display = 'block';
            this.divMessageFooter.style.display = 'none';
        }
        else {
            this.divThreadClosed.style.display = 'none';
            this.divMessageFooter.style.display = 'block';
        }
    }

    isLoaded = false;
    onIMIPageInitCompleted() {
        if (!IMI.IMIconnect.isRegistered())
            window.location.href = "#/login";

        if (this.isTemplateInitialized) {
            this.btnAttachment = this.querySelector('a[name=btnAttachment]');
            this.btnAttachment.onclick = (ev) => this.showFilePicker(ev);
            this.txtMessageInput = this.querySelector('input.message-input');
            this.ldrSendMessage = this.querySelector('#ldrSendMessage');
            this.btnSend = this.querySelector('#btnSend');
            this.btnSend.onclick = (ev) => this.sendMessage(ev);
            this.finAttachment = this.querySelector('#finAttachment');
            this.finAttachment.onchange = (ev) => this.onFileAttached();
            this.imiQuickReplies = this.querySelector('imi-quick-replies-view');
            this.divThreadClosed = document.querySelector('#divThreadClosed');
            this.divMessageFooter = document.querySelector('#divMessageFooter');
            this.divThreadTitle = document.querySelector('#divThreadTitle');
            this.divThreadAlert = this.querySelector('#divThreadAlert');
            this.divThreadAlertText = this.querySelector('#divThreadAlertText');
            this.btnCloseThread = this.divThreadAlert.querySelector("#btnCloseThread");
            this.btnCloseThread.onclick = (ev) => this.btnCloseThreadOnClick(ev);
            this.txtMessageInput.addEventListener('keypress', this.onKeyPressEvent.bind(this));
        }
        if (this.isLoaded) return;
        if (this.threadId) {
            this.fetchThread();
            this.fetchMessages();
            this.btnAttachment.style.visibility = 'visible';
            document.querySelector('imi-quick-replies-view').addEventListener('onquickreplyclick', (ev) => this.submitClickPostback(ev.detail.icButton, ev.detail.message));
        }
        else this.btnAttachment.style.visibility = 'hidden';
        document.addEventListener(IMIEvent.onSecurityTokenRefreshCompleteEvent, (ev) => {
            this.OnSecurityTokenRefreshComplete(ev.detail);
        }
        );
    }
    connectedCallback() {
    }
    total;
    thread;
    txtMessageInput;
    isSending = false;
    ldrSendMessage;
    btnSend;
    finAttachment;
    btnAttachment;
    sinceDate = new Date();
    imiMediaView;
    imiQuickReplies;
    divThreadClosed;
    divMessageFooter;
    divThreadTitle;
    btnRetry;
    onMessageReceived(ev) {
        let message = ev.detail;
        message = this.processMessages([message])[0];
        switch (message.getType()) {
            case IMI.ICMessageType.Message:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                this.clearCOTMessage();
                this.append(message, true);
                this.submitReadReceipts(message);
                break;
            case IMI.ICMessageType.Republish:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                //Handle unsent local republish 
                if (message.getTemporaryId() != undefined) {
                    let elTemporaryMessage = this.querySelector(`#m_${message.getTemporaryId()}`);
                    if (message.getStatus() == IMI.ICMessageStatus.Sent) {
                        if (elTemporaryMessage)
                            elTemporaryMessage.parentElement.removeChild(elTemporaryMessage);
                    }
                }
                this.append(message, true);//to append local republished messages
                break;
            case IMI.ICMessageType.MessageDelivered:
                {
                    let existingMessage = this.querySelector(`#m_${message.transactionId}`);
                    existingMessage.querySelector('.status').innerHTML = 'delivered';
                }
                break;
            case IMI.ICMessageType.ReadReceipt:
                {
                    //As message.getThread() is undefined for ReadReceipts, referring to existingMessage.
                    let existingMessage = this.querySelector(`#m_${message.transactionId}`);
                    if (existingMessage)
                        existingMessage.querySelector('.status').innerHTML = 'read';
                }
                break;
            case IMI.ICMessageType.CloseThread:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                this.thread = message.getThread();
                this.updateThreadDisplay();
                break;
            case IMI.ICMessageType.ReopenThread:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                this.thread = message.getThread();
                this.updateThreadDisplay();
                break;
            case IMI.ICMessageType.UpdateThread:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                this.thread = message.getThread();
                this.updateThreadDisplay();
                break;
            case IMI.ICMessageType.Alert:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                this.divThreadAlert.style.display = 'block';
                this.divThreadAlertText.textContent = message.getMessage();
                this.submitReadReceipts(message);
                break;
            case IMI.ICMessageType.TypingStart:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                if (message.isCOTMessage)
                    this.displayCOTMessage(message);
                else
                    this.updateTypingIndicatorOnUI(message, true);
                break;
            case IMI.ICMessageType.TypingStop:
                if (this.thread && message.getThread().getId() != this.thread.getId()) return;
                if (message.isCOTMessage)
                    this.clearCOTMessage();
                else
                    this.updateTypingIndicatorOnUI(message, false);
                break;
            case IMI.ICMessageType.MessageDeleted:
                break;
            default:
                break;
        }
    }
    divCOTMessage;
    clearCOTMessage() {
        if (this.divCOTMessage) {
            this.divCOTMessage.remove();
            this.divCOTMessage = undefined;
        }
    }
    displayCOTMessage(item) {
        if (this.divCOTMessage) {
            this.divCOTMessage.querySelector('type-writer').setAttribute("text", item.getMessage());
            this.divCOTMessage.querySelector('.timestamp').textContent = timeAgo(item.getSubmittedAt());
            this.divCOTMessage.querySelector('.status').textContent = getStatusForMessage(item);
        }
        else {
            var elContainer = this.querySelector(this.config.containerSelector);
            let elTemplateCOTTypingAlert = document.querySelector(this.config.templateCOTTypingAlert);
            var elItemDiv = document.createElement('div');
            elItemDiv.innerHTML = new Function(
                this.config.compileParamName,
                "return String.raw`" + unescapeHtml(elTemplateCOTTypingAlert.innerHTML) + "`;"
            )(item);
            elContainer.append(elItemDiv);
            this.divCOTMessage = elItemDiv;
        }
    }
    divTypingIndicator;
    updateTypingIndicatorOnUI(item, showIndicator) {
        if (this.divTypingIndicator) {
            if (showIndicator) {
                this.divTypingIndicator.querySelector('span.text').textContent = item.getMessage();
            }
            else {
                this.divTypingIndicator.remove();
                this.divTypingIndicator = undefined;
            }
        }
        else if (showIndicator) {
            var elContainer = this.querySelector(this.config.containerSelector);
            let tmpTypingIndicator = this.querySelector('#tmpTypingAlert');
            this.divTypingIndicator = document.createElement('div');
            this.divTypingIndicator.innerHTML = new Function(
                this.config.compileParamName,
                "return String.raw`" + unescapeHtml(tmpTypingIndicator.innerHTML) + "`;"
            )(item);
            elContainer.append(this.divTypingIndicator);
        }
    }
    onBeforeItemAdd(messageView) {
        messageView.querySelector('imi-message-media-view').addEventListener('onsubmit', (ev) => this.submitForm(ev.detail));
        messageView.querySelector('imi-message-media-view').addEventListener('onclickpostback', (ev) => this.submitClickPostback(ev.detail.icButton, ev.detail.message));
    }
    sendMessage() {
        if (this.isSending) return; //Required to cancel immediate double send request

        if (!this.isValidMessage()) {
            IMIToast.show("Please type a message to send");
            return;
        }
        this.showSending();

        if (!this.thread)
            this.createThread();
        else
            this.publishMessage();
    }

    isValidMessage() {
        return (this.txtMessageInput.value.trim().length > 0);
    }
    createThread(title) {
        var title = title || "Acme Utility - New Conversation";
        this.thread = new IMI.ICThread();
        this.thread.setTitle(title);
        this.thread.setStatus(IMI.ICThreadStatus.Active);
        this.thread.setType(IMI.ICThreadType.Conversation);
        this.updateThreadDisplay();
        var messaging = IMI.ICMessaging.getInstance();
        messaging.createThread(this.thread, this.createThreadCallBack);
    }
    createThreadCallBack = {
        onSuccess: (threadObj) => {
            this.thread.setId(threadObj.getId());
            this.updateThreadDisplay();
            this.publishFirstMessage();
        },
        onFailure: (err) => {
            console.log("Error creating thread:", err);
            IMIToast.show("Error creating thread: " + err.description);
        },
    };
    publishFirstMessageCallback = {
        onSuccess: (message) => {
            this.append(message);
            this.txtMessageInput.value = "";
            this.hideSending();
        },
        onFailure: (err) => {
            this.hideSending();
            IMIToast.show(err);
        },
    };
    publishFirstMessage() {
        var message = new IMI.ICMessage();
        message.setMessage(this.txtMessageInput.value);
        message.setThread(this.thread);

        var messaging = IMI.ICMessaging.getInstance();
        messaging.publishMessage(message, this.publishFirstMessageCallback);
    }
    publishMessage(mediaArr) {
        var message = new IMI.ICMessage();
        message.setMessage(this.txtMessageInput.value);
        message.setThread(this.thread);

        if (mediaArr)
            message.setAttachments([mediaArr]);

        var messaging = IMI.ICMessaging.getInstance();
        messaging.publishMessage(message, this.publishMessageCallback);
    }
    publishMessageCallback = {
        onSuccess: (message) => {
            this.append(message, true);
            this.submitReadReceipts(message);
            this.onSendingComplete();
            if (message.getInteractiveData() && message.getInteractiveData().getType() == IMI.ICInteractiveDataType.QuickReplyPostback) {
                let existingQuickReplySpace = this.querySelector(`#m_${message.getRelatedTransactionId()} div.quick-reply-space`);
                existingQuickReplySpace.remove();
            }
        },
        onFailure: (errormsg, message) => {
            this.append(message, true);
            IMIToast.show(errormsg.description);
            this.onSendingComplete();
        },
    };
    generateAttachments(mediaIDs) {
        if (!(mediaIDs instanceof Array)) mediaIDs = [mediaIDs];
        var mediaArr = [];
        if (mediaIDs.length > 0) mediaIDs.map((id) => {
            var icAttach = new IMI.ICAttachment();
            icAttach.setMediaId(id);
            mediaArr.push(icAttach);
        });
        return mediaArr;
    }
    onSendingComplete() {
        this.txtMessageInput.value = '';
        this.hideSending();
    }
    submitReadReceipts(messages) {
        if (!(messages instanceof Array))
            messages = [messages];

        let fxUnread = (m) => !m.getOutgoing() && m.getReadAt() == null;
        let unreadMessages = messages.filter(fxUnread);
        let messageIds = unreadMessages.map((m) => m.transactionId);

        if (messageIds.length > 0) {
            let callback = { onSuccess: (res) => console.log('setMessagesAsRead:Success', res), onFailure: (err) => console.log('setMessagesAsRead:Error', err) };
            var messaging = IMI.ICMessaging.getInstance();
            messaging.setMessagesAsRead(messageIds, callback);
            //NOTE: A callback is not consumed here, as the success of 'read'
            //is received at listener and should be handled from there.
        }
    }
    showFilePicker() {
        this.finAttachment.click();
    }
    onFileAttached() {
        this.uploadFile(this.finAttachment.files[0]);
    }

    uploadFileCallback = {
        onFileUploadComplete: (file, mediaId, error, resp) => {
            if (error) {
                console.log('File upload error: ', error);
                this.hideSending();
                IMIToast.show("There was an error uploading this file: " + error.description);

            } else {
                // console.log('onFileUploadComplete resp: ', resp);
                this.publishMessage(IMI.ICAttachment.fromJSON(resp));
            }
        },
        onFileUploadProgress: (file, bytesUploaded, bytesTotal) => {
            var percent = (bytesUploaded / bytesTotal).toFixed(1);
            // console.log(
            //     "FILE UPLOAD Percent:",
            //     percent,
            //     "%",
            //     "file: ",
            //     file.name,
            //     " bytesUploaded:",
            //     bytesUploaded,
            //     " bytesTotal:",
            //     bytesTotal
            // );
        }
    };
    showSending() {
        this.showActivity();
        this.isSending = true;
        this.ldrSendMessage.style.display = 'block';
        this.btnSend.style.display = 'none';
        this.btnAttachment.style.display = 'none';
    }
    hideSending() {
        this.hideActivity();
        this.isSending = false;
        this.ldrSendMessage.style.display = 'none';
        this.btnSend.style.display = 'block';
        this.btnAttachment.style.display = 'block';
    }
    uploadFile(file) {
        if (!file) {
            IMIToast.show("Please select a file");
            return;
        }
        this.showSending();
        IMI.ICMediaFileManager.uploadFile(
            file,
            file.type,
            this.uploadFileCallback
        );
    }
    fetchMessages() {
        if (!this.threadId)
            throw "Required parameter missing: threadId";
        if (this.total && this.total == 0) return;
        if (this.isFetching) return;

        this.isFetching = true;
        IMIToast.show('Fetching Messages');
        this.showActivity();
        var limit = 30;
        var messaging = IMI.ICMessaging.getInstance();
        messaging.fetchMessages(
            this.threadId,
            this.sinceDate,
            limit,
            this.fetchMessagesCallback
        );
    }
    fetchMessagesCallback = {
        onSuccess: (messages, total) => {
            this.total = total;
            this.isFetching = false;
            if (messages.length == 0 || total == 0) {
                this.cancelObserver();
                IMIToast.show('No more messages');
            }
            else {
                messages = this.processMessages(messages);
            }
            this.prepend(messages, true);
            this.hideActivity();
            this.isLoaded = true;
        },
        onFailure: (err) => {
            this.isFetching = false;
            this.isLoaded = false;
            this.hideActivity();
        },
    };
    processMessages(messages) {
        let existingQuickReplySpaces = this.querySelectorAll(`div.quick-reply-space`);
        existingQuickReplySpaces.forEach(el => el.remove());

        let latestMessage = messages[0];
        this.sinceDate = latestMessage.getSubmittedAt();

        if (latestMessage.getCustomTags() && latestMessage.getCustomTags().type && latestMessage.getCustomTags().type == "chainOfThoughts") {
            latestMessage.isCOTMessage = true;
        }
        latestMessage.isQuickReplyOptionAwaitingInput = (latestMessage.getOutgoing() == false
            && latestMessage.getQuickReplyData() != null
            && latestMessage.getQuickReplyData().getReference()
            && latestMessage.getInteractiveData() == undefined);

        return messages;
    }
    onScrolledToTopComplete() {
        if (ev[0].isIntersecting || !ev[0].isVisible)
            this.fetchMessages();
    }
    isFetching = false;
    submitForm(pendingFormMT) {
        let message = new IMI.ICMessage();
        if (message.setCreatedAt) message.setCreatedAt(new Date());
        message.setThread(pendingFormMT.thread);
        message.setAttachments(pendingFormMT.getAttachments());
        message.setRelatedTransactionId(pendingFormMT.getTransactionId());
        var messaging = IMI.ICMessaging.getInstance();
        messaging.publishMessage(message, this.publishMessageCallback);
    }
    submitClickPostback(icButton, message) {
        var messaging = IMI.ICMessaging.getInstance();
        switch (icButton.getType()) {
            case IMI.ICInteractiveDataType.WebURL:
                messaging.sendClickedEvent(message.getTransactionId(), icButton, this.submitClickPostbackCallback);
                break;
            case IMI.ICInteractiveDataType.TemplatePostback:
                let postbackMO = IMI.ICMessaging.getInstance().createPostbackMessage(message, icButton)
                messaging.publishMessage(postbackMO, this.publishMessageCallback);
                break;
            case IMI.ICInteractiveDataType.QuickReplyPostback:
                let postbackQuickReplyMO = IMI.ICMessaging.getInstance().createPostbackMessage(message, icButton)
                messaging.publishMessage(postbackQuickReplyMO, this.publishMessageCallback);
                break;
        }
    }
    submitClickPostbackCallback = {
        onSuccess: (icButton) => {
            IMIToast.show(`"${icButton.getTitle()}" clicked!`);
        },
        onFailure: (errormsg) => {
            IMIToast.show(errormsg);
        },
    };
    btnCloseThreadOnClick(ev) {
        this.divThreadAlert.style.display = 'none';
    }
    unsent = {};
    handleUnsentItems(items) {
        items.forEach(item => {
            if (item.getStatus() == IMI.ICMessageStatus.NotSent) {
                this.unsent[item.getTemporaryId()] = item;
                let selector = `#m_${item.getTemporaryId()} .retry-button`;
                let btnRetry = this.querySelector(selector);
                btnRetry.onclick = this.btnRetryOnClick.bind(this);
            }
        });
    }
    btnRetryOnClick(ev) {
        let btnRetry = ev.target;
        let temporaryId = btnRetry.getAttribute('rel');
        let message = this.unsent[temporaryId];
        if (message) {
            this.showActivity();
            let messaging = IMI.ICMessaging.getInstance();
            messaging.publishMessage(message, {
                onSuccess: (msg) => {
                    let elMessage = this.querySelector(`#m_${temporaryId}`);
                    this.hideActivity();
                    this.append(msg, true);
                    delete this.unsent[temporaryId];
                    elMessage.parentElement.removeChild(elMessage);
                },
                onFailure: (err) => {
                    this.showActivity();
                    IMIToast.show("Error resending message: " + err.description);
                }
            });
        }

    }
    TYPING_ALERT_TIMEOUT = 10000; // 10 seconds 
    typingAlertTimeoutID = undefined;
    /*
    Send Typing alert use cases:
    1. Send continuous typing alert on keypress
    2. After 10 seconds of no keypress event, send TypingStop 
    3. On key 'Shift+Enter' stop typing alert immediately and send message
    */
    onKeyPressEvent(ev) {
        if (ev && ev.key === 'Enter' && ev.shiftKey) {
            this.publishTypingAlert(false);
            this.sendMessage();
        }
        else
            this.publishTypingAlert(true);
    }
    publishTypingAlert(started) {
        if (!window.IMI || this.thread == null)
            return;

        if (started) {
            //clear existing timeout for sending TypingStop
            if (this.typingAlertTimeoutID)
                clearTimeout(this.typingAlertTimeoutID);
            //set new timeout to send TypingStop 

            this.typingAlertTimeoutID = setTimeout(() => { this.publishTypingAlert(false) }, this.TYPING_ALERT_TIMEOUT);
        }
        let callback = {
            onSuccess: (data) => console.log("sent typing indicator", data.getType()),
            onFailure: (err) => {
            },
        };
        let m = IMI.ICMessaging.getInstance();

        m.publishTypingIndicator(this.thread, started, callback);
    }
    OnSecurityTokenRefreshComplete(success) {
        if (success) {
            if (this.threadId) {
                this.fetchThread();
                this.fetchMessages();
            }
        }
    }
}
customElements.define("imi-messages-page", IMIMessagesPage);