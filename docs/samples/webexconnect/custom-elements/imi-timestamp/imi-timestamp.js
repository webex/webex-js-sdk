let DateUtil = {
  formatDate: window.getFormattedDate
}
class IMITimeStampElement extends HTMLElement {
  static observedAttributes = ["date"];
  date = undefined;
  constructor() {
    super();
    if (!DateUtil.formatDate)
      throw ("Required utility functions are not available.");
  }
  connectedCallback() {

  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name == "date") {
      if (newValue && newValue != "undefined") { //undefined is a string here
      this.date = newValue;
      this.setTimer();
    }
  }
  }
  setTimer() {
    const date = typeof this.date === "object" ? this.date : new Date(this.date);
    if (!date) return "";

    const DAY_IN_MS = 86400000; // 24 * 60 * 60 * 1000
    const today = new Date();
    const yesterday = new Date(today - DAY_IN_MS);
    const seconds = Math.round((today - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const isToday = today.toDateString() === date.toDateString();
    const isYesterday = yesterday.toDateString() === date.toDateString();
    const isThisYear = today.getFullYear() === date.getFullYear();
    let result = "";
    let timeout;
    if (seconds < 5) {
      result = "now";
      timeout = 5000; // 5 seconds
    } else if (seconds < 60) {
      result = `${seconds} secs ago`;
      timeout = 60000; // 60 seconds
    } else if (seconds < 90) {
      result = "about a minute ago";
      timeout = 90000; // 90 seconds
    } else if (minutes < 60) {
      result = `${minutes} mins ago`;
      timeout = 36000000; // 60 minutes
    } else if (isToday) {
      result = DateUtil.formatDate(date, "Today"); // Today at 10:20
    } else if (isYesterday) {
      result = DateUtil.formatDate(date, "Yesterday"); // Yesterday at 10:20
    } else if (isThisYear) {
      result = DateUtil.formatDate(date, false, true); // 10. January at 10:20
    }
    else {
      result = DateUtil.formatDate(date); // 10. January 2017. at 10:20
    }
    setTimeout(() => {
      this.setTimer();
    }, timeout);
    this.textContent = result;
  }
  disconnectedCallback() {

  }
}
customElements.define("imi-timestamp", IMITimeStampElement);
