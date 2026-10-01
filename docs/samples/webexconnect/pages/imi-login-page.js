class IMILoginPage extends IMITemplateComponent {
    constructor() {
        let templateUrl = "pages/imi-login-page.html";
        let cssUrl = "pages/imi-login-page.css";
        super(templateUrl, cssUrl);
    }
    progressBar;
    onTemplateInitialized() {
        this.progressBar = this.querySelector('progress-bar');
        this.progressBar.deactivate();
        if (IMI.IMIconnect.isRegistered())
            this.onRegistration();

        document.addEventListener(IMIEvent.onSecurityTokenRefreshCompleteEvent, (ev) => {
            this.OnSecurityTokenRefreshComplete(ev.detail);
        });
    }
    isValidUserID() {
        return (this.querySelector('#txtUserID').value.trim().length > 0);
    }
    onRegistration() {
        this.progressBar.deactivate();
        window.location.href = "#/threads"
    }
    login() {
        this.progressBar.activate();
        if (!this.isValidUserID()) {
            IMIToast.show("Please enter UserID");
            return;
        }
        if (document.querySelector('#chkUseSecurityToken').checked)
            this.generateAndSetSecurityToken(this.querySelector('#txtUserID').value.trim());
        else
            this.register();
    }
    register() {
        var userID = this.querySelector('#txtUserID').value.trim();
        var deviceID = userID + new Date().getTime(); //any random no.
        var deviceProfile = new IMI.ICDeviceProfile(deviceID, userID);
        var registerCallback = {
            onSuccess: (msg) => {
                this.onRegistration();
            },
            onFailure: (err) => {
                IMIToast.show(JSON.stringify(err));
            },
        };
        IMI.IMIconnect.register(deviceProfile, registerCallback);
        return userID;
    }
    OnSecurityTokenRefreshComplete(success) {
        console.log('OnSecurityTokenRefreshComplete --->', success);
        if (success && !IMI.IMIconnect.isRegistered()) {
            this.register();
        }
    }
}
customElements.define("imi-login-page", IMILoginPage);