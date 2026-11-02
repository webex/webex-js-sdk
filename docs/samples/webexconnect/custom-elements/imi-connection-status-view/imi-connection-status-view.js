class IMIConnectionStatusView extends IMITemplateComponent {
    listener = (ev) => this.onConnectionStatusChanged(ev.detail);
    constructor() {
        let templateUrl = "custom-elements/imi-connection-status-view/imi-connection-status-view.html";
        let cssUrl = "custom-elements/imi-connection-status-view/imi-connection-status-view.css";

        super(templateUrl, cssUrl);
    }
    lastStatus;
    connectedCallback() {
        document.addEventListener(IMIEvent.onConnectionStatusChanged, this.listener);
        if (window.IMI) this.onConnectionStatusChanged(IMI.ICMessaging.getInstance().getConnectionStatus());
    }
    onTemplateInitialized() {
        this.onConnectionStatusChanged(IMI.ICMessaging.getInstance().getConnectionStatus())
    }
    onConnectionStatusChanged(status) {
        this.lastStatus = status;
        if (!this.isTemplateInitialized) {
            return;
        }
        let div = this.querySelector('div');
        let span = this.querySelector('span[name=text]');
        switch (status) {
            case 0:
            case IMI.ICConnectionStatus.None:
                div.className = 'none';
                span.innerHTML = 'None';
                break;
            case 1:
            case IMI.ICConnectionStatus.Connecting:
                div.className = 'connecting blink';
                span.innerHTML = 'Connecting';
                break;
            case 2:
            case IMI.ICConnectionStatus.Connected:
                div.className = 'connected';
                span.innerHTML = 'Connected';
                break;
            case 3:
            case IMI.ICConnectionStatus.Refused:
                div.className = 'refused';
                span.innerHTML = 'Disconnected';
                break;
            case 4:
            case IMI.ICConnectionStatus.Closed:
                div.className = 'closed';
                span.innerHTML = 'Closed';
                break;
            case 6:
            case IMI.ICConnectionStatus.Error:
                div.className = 'errors';
                span.innerHTML = 'Error';
                break;
            default:
                break;
        }
    }
    disconnectedCallback() {
        document.removeEventListener(IMIEvent.onConnectionStatusChanged, this.listener);
    }
}

customElements.define("imi-connection-status-view", IMIConnectionStatusView);
