class IMIThreadsPage extends IMIPage {
    constructor() {
        let templateUrl = "pages/imi-threads-page.html";
        super(templateUrl);

        let config = new UIPageConfig();
        config.containerSelector = "#divThreadsContainer";
        config.templateSelector = "#tmpThread";
        config.templateNoResult = "#tmpThreadNoResult";
        config.compileParamName = "thread";
        config.itemSelector = ".thread";
        config.scrollObserver = ScrollObserver.bottom

        this.setConfig(config);
        this.messageListener = (ev) => this.onMessageReceived(ev);
        document.addEventListener(IMIEvent.onMessageReceived, this.messageListener);
    }
    isThreadListInitialized;
    connectedCallback() {
        if (this.isTemplateInitialized && !this.isThreadListInitialized)
            this.fetchThreads();
    }
    onIMIPageInitCompleted() {
        if (!IMI.IMIconnect.isRegistered())
            window.location.href = "#/login";

        if (!this.isThreadListInitialized)
            this.fetchThreads();

        document.addEventListener(IMIEvent.onSecurityTokenRefreshCompleteEvent, (ev) => {
            this.OnSecurityTokenRefreshComplete(ev.detail);
        });

    }
    isFetching = false;
    fetchThreads(offset) {
        if (!IMI.IMIconnect.isRegistered())
            return;

        if (this.isFetching) return;
        this.showActivity();
        const limit = 20;
        var messaging = IMI.ICMessaging.getInstance();
        messaging.fetchThreads(offset || 0, limit, this.fetchThreadsCallback);
        this.isFetching = true;
    }
    fetchThreadsCallback = {
        onSuccess: (threads, hasMore) => {
            this.isThreadListInitialized = true;
            this.isFetching = false;
            threads = this.orderThreadsByLatestUpdatedFirst(threads);
            this.hideActivity();
            this.append(threads);
            if (threads.length == 0) {
                this.cancelObserver();
                IMIToast.show('No more threads');
            }
        },
        onFailure: (error) => {
            this.isFetching = false;
            this.isLoaded = false;
            this.hideActivity();
            IMIToast.show("Unable to fetch threads: " + JSON.stringify(error));

        },
    };
    onBeforeItemAdd(elDivThread, thread) {
        if (thread.message == undefined)
            this.fetchMessage(thread);
    };

    onPrependCompleted(threads) {
        if (threads && threads.length > 0) {
            if (threads[0].message) {
                let message = threads[0].message;
                let displayText = "";
                if (message.getOutgoing())
                    displayText += "You: ";
                if (message.getMessage().length > 0)
                    displayText += `${message.getMessage()}`;
                let html = `<div>${displayText}</div>`;
                if (message.getAttachments())
                    if (message.getAttachments().length == 1)
                        html += `<div>${message.getAttachments().length + ' Attachment'}</div>`;
                    else if (msg.getAttachments().length > 1)
                        html += `<div>${message.getAttachments().length + ' Attachment(s)'}</div>`;

                let elThreadMessage = document.querySelector(`#t_${threads[0].getId()} .message-text`);
                elThreadMessage.innerHTML = html;
                elThreadMessage.id = `tm_${message.getTransactionId()}`;
                this.getThreadElement(message, ThreadElementSelector.TIME_AGO).setAttribute("date", message.getSubmittedAt());
            }
        }
    }

    fetchMessage(thread) {
        let fetchMessagesCallback = (function () {
            var me = this;
            me.onSuccess = function (messages, total) {
                me.threadsPage.isFetching = false;
                me.threadsPage.hideActivity();
                if (messages && messages.length == 0) {
                    let elThreadMessage = document.querySelector(`#t_${this.thread.getId()} .message-text`);
                    if (elThreadMessage)
                        elThreadMessage.innerHTML = `Message not available at the moment`;
                    return;
                }
                if (messages && messages[0]) {
                    let displayText = "";
                    if (messages[0].getOutgoing())
                        displayText += "You: ";
                    if (messages[0].getMessage().length > 0)
                        displayText += `${messages[0].getMessage()}`;
                    let html = `<div>${displayText}</div>`;
                    if (messages[0].getAttachments())
                        if (messages[0].getAttachments().length == 1)
                            html += `<div>${messages[0].getAttachments().length + ' Attachment'}</div>`;
                        else if (msg.getAttachments().length > 1)
                            html += `<div>${messages[0].getAttachments().length + ' Attachment(s)'}</div>`;

                    let elThreadMessage = document.querySelector(`#t_${messages[0].getThread().getId()} .message-text`);
                    elThreadMessage.innerHTML = html;
                    elThreadMessage.id = `tm_${messages[0].getTransactionId()}`;
                }
            };
            me.onFailure = function (errormsg) {
                var me = this;
                me.threadsPage.isFetching = false;
                me.threadsPage.hideActivity();
                me.threadsPage.innerHTML = '<span style="color:red">Unable to fetch messages at the moment</span>';
            }
            return me;
        }).bind({ threadsPage: this, thread: thread })();
        var messaging = IMI.ICMessaging.getInstance();
        messaging.fetchMessages(
            thread.getId(),
            new Date(),
            1,
            fetchMessagesCallback
        );

    }
    orderThreadsByLatestUpdatedFirst(threads) {
        return threads.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    onScrolledToBottomComplete() {
        let allItems = this.querySelectorAll('.thread');
        this.fetchThreads(allItems.length);
    }
    onMessageReceived(ev) {
        let message = ev.detail;
        let thread = message.getThread();
        if (!thread) {
            return; //nothing to display on this page;
        }
        let elThread = this.getThreadElement(message);
        switch (message.getType()) {
            case IMI.ICMessageType.Message:
            case IMI.ICMessageType.Republish:
                if (elThread) {
                    //If thread exists, update text and time and move it to top of the list.
                    this.getThreadElement(message, ThreadElementSelector.TIME_AGO).setAttribute("date", message.getSubmittedAt());
                    this.getThreadElement(message, ThreadElementSelector.MESSAGE_TEXT).textContent = message.getMessage();
                    elThread.parentNode.insertBefore(elThread, elThread.parentNode.firstChild);
                    this.highlightElementChange(elThread);
                }
                else {
                    thread.message = message;
                    this.prepend([thread]);
                }
                break;
            case IMI.ICMessageType.CloseThread:
            case IMI.ICMessageType.ReopenThread:
                if (elThread) {
                    console.log("Question: Should a thread not displayed on the current page be added to top of the list when THread is Closed?");
                    console.log("as of now, only updating the status if closed");
                    this.getThreadElement(message, ThreadElementSelector.TIME_AGO).textContent = timeAgo(message.getSubmittedAt());
                    this.getThreadElement(message, ThreadElementSelector.STATUS).textContent = thread.getStatus();
                    this.highlightElementChange(this.getThreadElement(message, ThreadElementSelector.STATUS));
                }
                break;
            case IMI.ICMessageType.UpdateThread:
                console.log("UpdateThread: Question: Should a thread not displayed on the current page be added to top of the list?");
                console.log("UpdateThread: This event is only received when 'title' is updated, without updating 'status' ");
                if (elThread) {
                    this.getThreadElement(message, ThreadElementSelector.THREAD_TITLE).textContent = thread.getTitle();
                    this.highlightElementChange(this.getThreadElement(message, ThreadElementSelector.THREAD_TITLE));
                }
                break;
            case IMI.ICMessageType.TypingStart:
                if (elThread) {
                    this.getThreadElement(message, ThreadElementSelector.TYPING_INDICATOR).style.display = 'inline-block';
                    this.getThreadElement(message, ThreadElementSelector.MESSAGE_TEXT).style.display = 'none'
                }
                break;
            case IMI.ICMessageType.TypingStop:
                if (elThread) {
                    this.getThreadElement(message, ThreadElementSelector.TYPING_INDICATOR).style.display = 'none';
                    this.getThreadElement(message, ThreadElementSelector.MESSAGE_TEXT).style.display = 'block';
                }
                break;
            case IMI.ICMessageType.MessageDeleted:
                if (elThread) {
                    let elMessage = this.getThreadElement(message, ThreadElementSelector.MESSAGE_TEXT);
                    if (elMessage && elMessage.id == `tm_${message.getTransactionId()}`) {
                        this.getThreadElement(message, ThreadElementSelector.TIME_AGO).textContent = timeAgo(message.getSubmittedAt());
                        this.getThreadElement(message, ThreadElementSelector.MESSAGE_TEXT).textContent = "This message has been deleted";
                    }
                }
                break;
            case IMI.ICMessageType.Alert:
                break;
            default:
                console.log('Unknown event type');
                break;
        }
    }
    getThreadElement(message, childElementSelector) {
        let thread = message.getThread();
        if (!thread) throw new Error("Thread not found in message");
        let querySelector = `#t_${thread.getId()}`;
        if (childElementSelector)
            querySelector = `${querySelector} ${childElementSelector} `;
        return document.querySelector(querySelector);
    }
    OnSecurityTokenRefreshComplete(success) {
        if (success) {
            let allItems = this.querySelectorAll('.thread');
            this.fetchThreads(allItems.length);
        }
    }
}

const ThreadElementSelector = {
    THREAD_TITLE: ".title",
    TIME_AGO: ".time-ago",
    STATUS: ".status",
    MESSAGE_TEXT: ".message-text",
    TYPING_INDICATOR: ".typing-activity"
}
customElements.define("imi-threads-page", IMIThreadsPage);