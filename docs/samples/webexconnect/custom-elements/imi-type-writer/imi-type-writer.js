class IMITypeWriterElement extends HTMLElement {
  timeout;
  counter = 0;
  speed = 50;
  static observedAttributes = ["text"];
  constructor() {
    super();
  }
  connectedCallback() {
    this.#addCSSStyle(`type-writer {
    scroll-margin-bottom: 100px;
}`);
  }
  #addCSSStyle(cssText) {
    const TYPE_WRITE_STYLE_ID = "style_TypeWriter";
    var head = document.getElementsByTagName("head")[0];
    if (head.querySelector('#' + TYPE_WRITE_STYLE_ID) != null) return;
    if (head) {
      var style = document.createElement("style");
      style.type = "text/css";
      style.id = TYPE_WRITE_STYLE_ID;
      style.appendChild(document.createTextNode(cssText));
      head.appendChild(style);
    }
  }
  resetHead() {
    clearTimeout(this.timeout);
    this.innerHTML = this.text;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name == "text") {
      document.querySelectorAll('type-writer').forEach(typewriter => {
        typewriter.resetHead();
      });
      this.text = newValue;
      this.counter = 0;
      this.innerHTML = "";
      this.write();
    }
  }
  write() {
    if (this.counter < this.text.length) {
      this.innerHTML += this.text.charAt(this.counter);
      this.scrollIntoView({ block: "end", inline: "nearest" });
      this.counter++;
      this.timeout = setTimeout(() => this.write(), this.speed);
    }
  }
}
customElements.define("type-writer", IMITypeWriterElement);