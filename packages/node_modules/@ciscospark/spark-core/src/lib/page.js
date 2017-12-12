/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const itemsMap = new WeakMap();
const linksMap = new WeakMap();
const sparksMap = new WeakMap();

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
   * @type {ProxySpark}
   */
  get spark() {
    return sparksMap.get(this);
  }

  /**
   * @constructs {Page}
   * @param {HttpResponse} res
   * @param {ProxySpark} spark
   * @returns {Page}
   */
  constructor(res, spark) {
    itemsMap.set(this, res.body.items);
    linksMap.set(this, Page.parseLinkHeaders(res.headers.link));
    sparksMap.set(this, spark);

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
      const link = linkHeader[0]
        .replace('<', '')
        .replace('>', '');
      const rel = linkHeader[1]
        .split('=')[1]
        .replace(/"/g, '');
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
    return this.spark.request({
      uri: this.links[link]
    })
      .then((res) => new Page(res, this.spark));
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
            value: this.items[i]
          };
        }

        return {done: true};
      }
    };
  }
}
