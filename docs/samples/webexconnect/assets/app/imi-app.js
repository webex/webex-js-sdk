// IMITemplateComponent abstracts the loading the html/css for a page/component
// A "onTemplateInitialized()" callback is available to do postLoad actions
//onTemplateInitializationError callback 
const TARGET_ASSET = imiEnvironments[imiEnvironments.target];

class IMITemplateComponent extends HTMLElement {
    static isRegeneratingToken = false;
    static isTokenRegistered = false;
    static SecurityTokenRefreshCompleteEvent = "securityTokenRefreshComplete";

    constructor(templateUrl, cssUrl) {
        super();
        if (!templateUrl) {
            console.error("IMITemplateComponent requires 'templateUrl'");
            return;
        }
        this.ID = this.getAttribute("id");
        this.initFileLoad(templateUrl, cssUrl);
    }
    templateUrl;
    cssUrl;
    isTemplateInitialized;
    isCssInitialized;
    initFileLoad(templateUrl, cssUrl) {
        this.templateUrl = templateUrl;
        this.cssUrl = cssUrl;
        this.loadTemplateHTML();

    }
    loadCSS() {
        if (this.cssUrl && !this.isCssInitialized) {
            this.innerHTML += `
        <style>
        @import "${this.cssUrl}";
        </style>`;
            this.isCssInitialized = true;
        }
    }
    loadTemplateHTML() {
        if (this.templateUrl && !this.isTemplateInitialized) {
            fetch(this.templateUrl)
                .then((response) => {
                    return response.text();

                })
                .then((html) => {
                    this.innerHTML += html;
                    this.isTemplateInitialized = true;


                    if (this.onTemplateInitialized)
                        this.onTemplateInitialized();
                }).then(() => {
                    this.loadCSS();
                    if (TARGET_ASSET.isJWTEnabled != undefined && TARGET_ASSET.isJWTEnabled == true) //Only set security token listener if JWT is enabled
                        IMI.IMIconnect.registerSecurityTokenListener(this);
                }
                )
                .catch((err) => {
                    console.error('IMITemplateComponent: template/init failed for', this.templateUrl, err);
                    if (this.onTemplateInitializationError)
                        this.onTemplateInitializationError();
                });
        }
    }
    onFailure(error) {
        IMITemplateComponent.isTokenRegistered = false;
        this.generateAndSetSecurityToken();
    }
    initUniqueID() {
        if (this.id == '') {
            this.id = this.#generateUniqueId();
            this.setAttribute("id", this.id);
        }
    }
    #generateUniqueId() {
        return this.constructor.name + "_" + Math.random().toString(16).slice(2);
    }

    generateAndSetSecurityToken(userId) {
        if (IMITemplateComponent.isRegeneratingToken) {
            console.debug('Token regeneration already in progress. Skipping duplicate request --->');
            return;
        }
        IMITemplateComponent.isRegeneratingToken = true;
        if (!userId)
            if (IMI.IMIconnect.isRegistered())
                userId = IMI.IMIconnect.getDeviceProfile().userId;
            else {
                let ev = new CustomEvent(IMIEvent.onSecurityTokenRefreshCompleteEvent, { detail: false });
                document.dispatchEvent(ev);
                IMITemplateComponent.isRegeneratingToken = false;
                throw "IMI.IMIconnect user is not registered";
            }
        let expiry = new Date();
        let JWT_TOKEN_EXPIRY_IN_MINUTES = TARGET_ASSET.JWTTokenExpiryInMinutes || window.JWTTokenExpiryInMinutes || 2;
        expiry.setMinutes(expiry.getMinutes() + JWT_TOKEN_EXPIRY_IN_MINUTES);

        IMIApi.generateJWTToken(userId, expiry.getTime())
            .then((result) => {
                IMITemplateComponent.isRegeneratingToken = false;
                if (result.code == "0") {
                    IMITemplateComponent.isTokenRegistered = true;
                    IMI.IMIconnect.setSecurityToken(result.token);
                    let ev = new CustomEvent(IMIEvent.onSecurityTokenRefreshCompleteEvent, { detail: result });
                    document.dispatchEvent(ev);
                }
                else {
                    IMITemplateComponent.isRegeneratingToken = false;
                    let ev = new CustomEvent(IMIEvent.onSecurityTokenRefreshCompleteEvent, { detail: false });
                    document.dispatchEvent(ev);
                }
            })
            .catch((error) => {
                let ev = new CustomEvent(IMIEvent.onSecurityTokenRefreshCompleteEvent, { detail: false });
                document.dispatchEvent(ev);
                IMITemplateComponent.isRegeneratingToken = false;
            })
    }
}

// IMIPage abstracts the iteratable features like append/prepend/scroll etc.
// A "onIMIPageInitCompleted" callback is provided
class IMIPage extends IMITemplateComponent {
    config;
    #contentTemplate;
    #progressBar;
    constructor(templateUrl, cssUrl) {
        super(templateUrl);
    }
    setConfig(val) {
        if (val instanceof UIPageConfig) {
            this.config = val;
        }
        else {
            throw "Config must be an instance of UIPageConfig";
            return;
        }

    }
    onTemplateInitialized() {
        this.#progressBar = this.querySelector("progress-bar");
        this.#contentTemplate = this.querySelector(
            this.config.templateSelector
        ).innerHTML;
        this.hideActivity();

        if (this.onIMIPageInitCompleted)
            this.onIMIPageInitCompleted();
    }
    reset() {

        var elContainer = this.querySelector(this.config.containerSelector);
        elContainer.innerHTML = '';
        this.innerHTML = '';
    }
    #compileContentTemplate(item) {
        return new Function(
            this.config.compileParamName,
            "return String.raw`" + unescapeHtml(this.#contentTemplate) + "`;"
        )(item);
    }
    append(items, scrollTo) {
        if (!(items instanceof Array))
            items = [items];

        if (items.length == 0) this.#appendNoResult();
        var elContainer = this.querySelector(this.config.containerSelector);
        items.forEach((item) => {
            this.renderAppendItem(item, elContainer, scrollTo);
        });
        this.watchScroll();
        if (this.onAppendComplete)
            this.onAppendComplete(items);
    }

    renderAppendItem(item, elContainer, scrollTo) {
        var elItemDiv = document.createElement('div');
        elItemDiv.innerHTML = this.#compileContentTemplate(item);
        if (this.onBeforeItemAdd) {
            this.onBeforeItemAdd(elItemDiv,item);
        }
        elContainer.append(elItemDiv);
        if (scrollTo) {
            let scrollItem = elItemDiv.querySelector('.scroll');
            if (scrollItem)
                scrollItem.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
            else
                elItemDiv.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }
    }

    renderPrependItem(item, scrollTo) {
        var elItemDiv = document.createElement('div');
        elItemDiv.innerHTML = this.#compileContentTemplate(item);
        if (this.onBeforeItemAdd) {
            this.onBeforeItemAdd(elItemDiv, item);
        }
        elContainer.append(elItemDiv);
        if (scrollTo) {
            elContainer.parentElement.scrollBy(0, 200);
        }
    }

    prepend(items, scrollTo) {
        if (!(items instanceof Array))
            items = [items];

        if (items.length == 0) this.#prependNoResult();
        var elContainer = this.querySelector(this.config.containerSelector);
        items.forEach((item) => {
            this.renderPrependItem(item, elContainer, scrollTo);
        });
        if (this.onPrependCompleted)
            this.onPrependCompleted(items);
    }

    renderPrependItem(item, elContainer, scrollTo) {
        var elItemDiv = document.createElement('div');
        elItemDiv.innerHTML = this.#compileContentTemplate(item);

        if (this.onBeforeItemAdd) {
            this.onBeforeItemAdd(elItemDiv, item);
        }
        elContainer.prepend(elItemDiv);
        if (scrollTo) {
            elContainer.parentElement.scrollBy(0, -200);
        }
    }

    #prependNoResult() {
        var elContainer = this.querySelector(this.config.containerSelector);
        let noResultTemplate = this.querySelector(
            this.config.templateNoResult
        ).innerHTML;
        var temp = document.createElement('div');
        temp.innerHTML = noResultTemplate;
        elContainer.prepend(temp.firstElementChild);
    }
    #appendNoResult() {
        var elContainer = this.querySelector(this.config.containerSelector);
        let noResultTemplate = this.querySelector(
            this.config.templateNoResult
        ).innerHTML;
        elContainer.innerHTML += noResultTemplate;
    }
    showActivity() {
        this.#progressBar.activate();
    }
    hideActivity() {
        this.#progressBar.deactivate();
    }

    observerBottom;
    observerTop;
    watchScroll() {
        if (this.config.scrollObserver & ScrollObserver.bottom) {

            if (this.observerBottom) this.observerBottom.disconnect();

            let topObserverConfig = {
                root: document.querySelector(this.config.containerSelector.parentElement),
                threshold: 0.1
            }
            this.observerBottom = new IntersectionObserver((ev) => this.onScrollToBottom(ev), topObserverConfig);
            let allItems = this.querySelectorAll(this.config.itemSelector);
            if (allItems && allItems.length > 0) {
                let lastItem = allItems[allItems.length - 1];
                this.observerBottom.observe(lastItem);
            }
        }
        if (this.config.scrollObserver & ScrollObserver.top) {

            if (this.observerTop) this.observerTop.disconnect();

            let bottomObserverConfig = {
                root: document.querySelector(this.config.containerSelector.parentElement),
                threshold: 0.1
            }
            this.observerTop = new IntersectionObserver((ev) => this.onScrollToTop(ev), bottomObserverConfig);

            let firstItem = this.querySelector(this.config.itemSelector);
            this.observerTop.observe(firstItem);

        }
    }
    cancelObserver() {
        if (this.observerBottom) this.observerBottom.disconnect();
    }
    onScrollToTop(ev) {
        if (ev[0].isIntersecting && this.onScrolledToTopComplete) {
            this.onScrolledToTopComplete();
        }
    }
    onScrollToBottom(ev) {
        if (ev[0].isIntersecting && this.onScrolledToBottomComplete) {
            this.onScrolledToBottomComplete();
        }
    }
    highlightElementChange(selectorOrElement) {
        let el;
        const CSS_CLASS_HIGHLIGHT = 'highlight';
        if (typeof (selectorOrElement) == "string")
            el = document.querySelector(selectorOrElement);
        else if (selectorOrElement instanceof HTMLElement)
            el = selectorOrElement;

        el.classList.add(CSS_CLASS_HIGHLIGHT);
        window.setTimeout(() => {
            el.classList.remove(CSS_CLASS_HIGHLIGHT);
        }, 2200)
    }
}

class IMINav {
    stack = [];
    root;
    constructor(root) {
        if (!root) {
            throw "Mandatory parameter missing - root element";
        }
        this.root = root;
    }
    getTop() {
        return this.stack[this.stack.length - 1];
    }
    show(page) {
        let currentTop = this.getTop();
        if (currentTop) {
            currentTop.style.display = 'none';
            if (currentTop.getAttribute('id') == page.getAttribute('id')) {
                page.style.display = 'block';
            }
            else {
                page.style.display = 'block';
                this.root.appendChild(page);
                this.stack.push(page);
            }
        }
        else {
            this.root.appendChild(page);
            this.stack.push(page);
        }
    }
    pop() {
        let page = this.stack.pop();
        this.root.removeChild(page);
    }
}

var IMIEvent = {
    onMessageReceived: "onMessageReceived",
    onConnectionStatusChanged: "onConnectionStatusChanged",
    onSecurityTokenRefreshCompleteEvent: "onSecurityTokenRefreshCompleteEvent"
}
var ScrollObserver = {
    top: 1,
    bottom: 2
}
class UIPageConfig {
    containerSelector;
    templateSelector;
    templateNoResult;
    compileParamName;
    itemSelector;
    scrollObserver;
}