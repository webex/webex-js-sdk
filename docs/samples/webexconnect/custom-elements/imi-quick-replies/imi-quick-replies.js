class IMIQuickRepliesView extends IMITemplateComponent {
    constructor() {
        let templateUrl = "custom-elements/imi-quick-replies/imi-quick-replies.html";
        let cssUrl = "custom-elements/imi-quick-replies/imi-quick-replies.css";
        super(templateUrl, cssUrl);
    }
    enabled = false;
    scroller;
    icMessage;
    messageElement;
    quickReplyData = '';
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == 'data-icmessage') {
            if (newValue && newValue != "null") {
                this.icMessage = new IMI.ICMessage.fromJSON(JSON.parse(newValue));
                this.renderButtons();
            }
            else
                this.hide();
        }
    }
    observer;
    attachObserver() {
        if (this.observer)
            this.observer.unobserve(this.messageElement.children[0]);
        this.messageElement = document.querySelector(`#m_${this.icMessage.getTransactionId()}`);
        this.observer = new IntersectionObserver((ev) => this.onScroll(ev), {
            root: null,
            threshold: 0
        })
        this.observer.observe(this.messageElement.children[0]);
    }
    onScroll(entries) {
        entries.forEach(entry => {
            if (entry.intersectionRatio >= 0.001)
                this.show();
            else
                this.hide();
        });
    }
    static get observedAttributes() {
        return ['data-icmessage'];
    }
    renderButtons() {
        if (!this.scroller) this.scroller = this.querySelector('.quick-replies-scroller');
        this.scroller.innerHTML = '';
        if (this.icMessage.getQuickReplyData() && this.icMessage.getQuickReplyData().getButtons().length > 0) {
            this.generateBtnName();
            this.attachObserver();
            this.enabled = true;
            this.show();
            this.icMessage.getQuickReplyData().getButtons().forEach(quickreplyBtn => {
                let btnTemplate = `<input type="button" name="${this.btnName}" class="quick-reply-button" value="${quickreplyBtn.getTitle()}" data-icbutton='${JSON.stringify(quickreplyBtn)
                    }'/>`;
                this.scroller.innerHTML += btnTemplate;
            });
            let totalButtonWidth = 0;
            this.scroller.style.width = Array.from(this.scroller.children).reduce((totalButtonWidth, bi) => totalButtonWidth + bi.offsetWidth, totalButtonWidth) + 'px';
            let clickButtons = this.querySelectorAll(`.quick-reply-button[name=${this.btnName}]`);
            clickButtons.forEach(btn => btn.onclick = (ev) => this.submitClickPostback(ev));
        }
        else
            this.enabled = false;
    }
    btnName;
    generateBtnName() {
        this.btnName = this.icMessage.getQuickReplyData().getReference().toString().replaceAll(' ', '_');
    }
    submitClickPostback(ev) {
        this.enabled = false;
        let icButtonJSON = ev.target.getAttribute('data-icbutton');
        let icButton = new IMI.ICButton(JSON.parse(icButtonJSON));
        let onquickreplyclick = new CustomEvent("onquickreplyclick", { detail: { icButton: icButton, message: this.icMessage } });
        this.dispatchEvent(onquickreplyclick);
        this.hide();
    }
    show() {
        if (this.enabled)
            this.style.display = "block";
    }
    hide() {
        this.style.display = "none";
    }
}
customElements.define("imi-quick-replies-view", IMIQuickRepliesView);