class IMIFab extends IMITemplateComponent {
  constructor() {
    let html = "custom-elements/imi-fab/imi-fab.html";
    let css = "custom-elements/imi-fab/imi-fab.css";
    super(html, css);
  }
  getTarget() {
    return document.querySelector(this.getAttribute('target'));
  }
  onTemplateInitialized() {
    if (!this.isTemplateInitialied) return;
  }

  clickListener = (ev) => this.toggleFabContent(ev);
  connectedCallback() {
    this.addEventListener("click", this.clickListener);
    if (!this.isTemplateInitialied) return;
  }
  toggleFabContent() {
    if (this.getTarget().style.opacity == '1')
      this.getTarget().style.opacity = '0';
    else if (this.getTarget().style.opacity == '0' || this.getTarget().style.opacity == '')
      this.getTarget().style.opacity = '1';
  }
}

customElements.define("imi-fab", IMIFab);
