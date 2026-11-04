const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getFormattedDate(date, prefomattedDate = false, hideYear = false) {
  if (!date) {
    throw "Invalid date parameter";
  }
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()].substring(0, 3);
  const year = date.getFullYear();
  let hours = date.getHours();
  let timeOfDay = "AM";
  if (hours > 12) {
    hours = hours - 12;
    timeOfDay = "PM";
  }
  let minutes = date.getMinutes();

  if (minutes < 10) {
    // Adding leading zero to minutes
    minutes = `0${minutes}`;
  }

  if (prefomattedDate) {
    // Today at 10:20
    // Yesterday at 10:20
    return `${prefomattedDate}, ${hours}:${minutes} ${timeOfDay}`;
  }

  if (hideYear) {
    // 10. January at 10:20
    return `${day} ${month}, ${hours}:${minutes} ${timeOfDay}`;
  }

  // 10. January 2017. at 10:20
  return `${day} ${month} ${year}, ${hours}:${minutes} ${timeOfDay}`;
}

// --- Main function
function timeAgo(dateParam) {
  if (!dateParam) {
    return "";
  }

  const date = typeof dateParam === "object" ? dateParam : new Date(dateParam);
  const DAY_IN_MS = 86400000; // 24 * 60 * 60 * 1000
  const today = new Date();
  const yesterday = new Date(today - DAY_IN_MS);
  const seconds = Math.round((today - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const isToday = today.toDateString() === date.toDateString();
  const isYesterday = yesterday.toDateString() === date.toDateString();
  const isThisYear = today.getFullYear() === date.getFullYear();

  if (seconds < 5) {
    return "now";
  } else if (seconds < 60) {
    return `${seconds} seconds ago`;
  } else if (seconds < 90) {
    return "about a minute ago";
  } else if (minutes < 60) {
    return `${minutes} minutes ago`;
  } else if (isToday) {
    return getFormattedDate(date, "Today"); // Today at 10:20
  } else if (isYesterday) {
    return getFormattedDate(date, "Yesterday"); // Yesterday at 10:20
  } else if (isThisYear) {
    return getFormattedDate(date, false, true); // 10. January at 10:20
  }

  return getFormattedDate(date); // 10. January 2017. at 10:20
}
function getCSSClassForTemplateOrQuickReply(message) {
  let css = '';
  if (message.getAttachments()) {
    let attachment = message.getAttachments()[0];
    if (attachment.getContentType() == IMI.ICContentType.Template &&
      attachment.getTemplateType() == IMI.ICTemplateType.Generic)
      css += " template";
  }

  return css;
}
function getCssClassByMessageOutgoing(message) {
  let css = '';
  if (message.getOutgoing()) css += " sent";
  else css += " received";

  if (message.getStatus() == IMI.ICMessageStatus.NotSent)
    css += ' failed';

  if (message.getQuickReplyData() && message.getQuickReplyData().getButtons().length > 0)
    css += " quick-reply-ahead";

  return css;
}

function getStatusForMessage(message) {
  if (message.getOutgoing())
    if (message.getStatus() == IMI.ICMessageStatus.NotSent)
      return "not sent";
    else return "sent";
  else return "received";
}
function hasImage(message) {
  if (
    !message ||
    !message.getAttachments() ||
    message.getAttachments().length == 0
  )
    return false;

  let hasImage = message.getAttachments()[0].getContentType() == IMI.ICContentType.Image;
  return hasImage;

}
function isFileAnImage(filename) {
  return (filename.match(/.(jpg|jpeg|png|gif)$/i));
}

function unescapeHtml(unsafe) {
  return unsafe
    .replace(/&amp;/g, "&")
    .replace(/&lt/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function getDisplayFileName(filename) {
  let temp = filename.split('/');
  return temp[temp.length - 1];
}

function validateEmail(email) {
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }