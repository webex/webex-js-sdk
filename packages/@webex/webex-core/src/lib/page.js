/* eslint-disable no-constructor-return */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const itemsMap = new WeakMap();
const linksMap = new WeakMap();
const webexsMap = new WeakMap();

/**
 * @class Page
 */
export default class Page {
  /**
   * @type {Array}
   */
  get items() {
    return itemsMap.get(this);
  }

  /**
   * @type {number}
   */
  get length() {
    return this.items.length;
  }

  /**
   * @private
   * @type {Object}
   */
  get links() {
    return linksMap.get(this);
  }

  /**
   * @private
   * @type {ProxyWebex}
   */
  get webex() {
    return webexsMap.get(this);
  }

  /**
   * @constructs {Page}
   * @param {HttpResponse} res
   * @param {ProxyWebex} webex
   * @returns {Page}
   */
  constructor(res, webex) {
    itemsMap.set(this, res.body.items);
    linksMap.set(this, Page.parseLinkHeaders(res.headers.link));
    webexsMap.set(this, webex);

    return this;
  }

  /**
   * Separate a single link header string into an actionable object
   * @param {string} linkHeaders
   * @private
   * @returns {Object}
   */
  static parseLinkHeaders(linkHeaders) {
    if (!linkHeaders) {
      return {};
    }

    linkHeaders = Array.isArray(linkHeaders) ? linkHeaders : [linkHeaders];

    return linkHeaders.reduce((links, linkHeader) => {
      linkHeader = linkHeader.split(';');
      const link = linkHeader[0].replace('<', '').replace('>', '');
      const rel = linkHeader[1].split('=')[1].replace(/"/g, '');

      links[rel] = link;

      return links;
    }, {});
  }

  /**
   * Get next page
   * @returns {Function}
   */
  next() {
    return this.getLink('next');
  }

  /**
   * Indicates if there's another page
   * @returns {Boolean}
   */
  hasNext() {
    return this.hasLink('next');
  }

  /**
   * Get previous page
   * @returns {Page}
   */
  previous() {
    return this.getLink('previous');
  }

  /**
   * Indicates if there is a previous Page
   * @returns {Boolean}
   */
  hasPrevious() {
    return this.hasLink('previous');
  }

  /**
   * Retrieves the `Page` at url specified by `link`
   * @param {string} link Specifies which link header to return
   * @private
   * @returns {Promise<Page>}
   */
  getLink(link) {
    return this.webex
      .request({
        uri: this.links[link],
      })
      .then((res) => new Page(res, this.webex));
  }

  /**
   * Indicates if the specified link is in the link header
   * @param {string} link
   * @private
   * @returns {Boolean}
   */
  hasLink(link) {
    return Boolean(this.links[link]);
  }

  /**
   * Iterator
   * @returns {Object}
   */
  [Symbol.iterator]() {
    let i = -1;

    return {
      next: () => {
        i += 1;
        if (i < this.length) {
          return {
            value: this.items[i],
          };
        }

        return {done: true};
      },
    };
  }
}
