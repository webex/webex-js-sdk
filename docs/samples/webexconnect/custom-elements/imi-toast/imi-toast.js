class IMIToast extends IMITemplateComponent {
    constructor() {
        var html = "custom-elements/imi-toast/imi-toast.html";
        var css = "custom-elements/imi-toast/imi-toast.css";
        super(html, css);
    }
    static counter = 0;

    static show(text) {
        let self = document.querySelector("imi-toast");
        if (!self) {
            return;
        }
        IMIToast.counter++;
        let divToast = self.querySelector('div.toast');
        let divText = self.querySelector("div.toast-text");

        if (!divToast || !divText) {
            console.log("IMIToast: not yet initialized");
            return;
        }
        divText.innerHTML = text;

        divToast.className = "toast show";

        divToast.style.width = acme.offsetWidth / 1.5 + 'px';
        divToast.style.left = (acme.offsetLeft + acme.offsetWidth / 10) + 'px';

        setTimeout(() => {
            IMIToast.counter--;
            if (IMIToast.counter == 0) {
                divToast.className = divToast.className.replace("show", "");
                divText.innerHTML = '';
            }

        }, 3000);
    }

}
customElements.define("imi-toast", IMIToast);
