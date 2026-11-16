var ProgressBarType = {
  Determinate: "determinate",
  Indeterminate: "indeterminate",
};

class ProgressBar extends HTMLElement {
  constructor() {
    super();
  }

  type = ProgressBarType.Determinate;
  #interval;
  #divProgress;
  #divContainer;

  progress(val) {
    this.setAttribute("value", val);
  }
  init() {
    this.#divProgress = this.querySelector(".progress");
    this.#divContainer = this.querySelector(".pb-container");
    this.#divProgress.style.width = this.getAttribute("width") || "10%";
  }

  connectedCallback() {
    this.innerHTML = `<style>
    @import "${document.querySelector('base').href}/custom-elements/imi-progress-bar/progress-bar.css";
    </style><div class="progress-bar pb-container"><div class="progress-bar progress">&nbsp;</div></div>`;

    this.init();
    if (this.#isIndeterminate()) {
      this.start();
    }
  }
  static get observedAttributes() {
    return ["value", "type"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#divProgress) return;

    if (name == "value") {
      this.#divProgress.style.width = newValue +'%';
      // this.#divProgress.style.transform = "translateX(" + newValue + "px)";
    }
    if (
      name == "type" &&
      newValue == ProgressBarType.Determinate &&
      oldValue != newValue
    ) {
      this.stop();
    }
    if (
      name == "type" &&
      newValue == ProgressBarType.Indeterminate &&
      oldValue != newValue
    ) {
      this.start();
    }
  }
  start() {
    if (!this.#isIndeterminate()) return;

    this.#divProgress.style.left = "0px";
    this.#interval = setInterval(() => this.moveIndeterminate(), 30);
  }
  step = 10;
  pos = 0;
  moveIndeterminate() {
    if (!this.#divProgress) return;
    let newV = this.pos + this.step;
    this.#divProgress.style.transform = "translateX(" + newV + "px)";
    this.pos = newV;
    if (this.pos > (this.#divContainer.offsetWidth - this.step)) {
      this.pos = 0;
    }
  }

  stop() {
    if (!this.#isIndeterminate()) return;
    clearInterval(this.#interval);
  }
  activate() {
    this.start();
    this.style.visibility = "visible";
  }
  deactivate() {
    this.style.visibility = "hidden";
    this.stop();
  }
  #isIndeterminate() {
    return this.getAttribute("type") == ProgressBarType.Indeterminate;
  }
}

customElements.define("progress-bar", ProgressBar);
