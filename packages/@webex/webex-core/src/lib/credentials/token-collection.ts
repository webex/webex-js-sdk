/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Collection, Token} from '@webex/common';

/**
 * Collection for managing Token instances with scope-based indexing
 */
export class TokenCollection extends Collection<Token> {
  private mainIndex = 'scope';
  namespace = 'Credentials';

  /**
   * Creates an instance of TokenCollection.
   * @param {Token[]} [models=[]] - Initial array of Token models
   * @param {any} [options={}] - Options including parent reference
   * @memberof TokenCollection
   */
  constructor(models: Token[] = [], options: any = {}) {
    super(models, options);

    // Ensure all tokens have proper parent reference if provided
    if (options.parent) {
      super.getModels().forEach((token) => {
        if (token && typeof token.parent !== 'undefined') {
          if (!token.parent) {
            token.parent = options.parent;
          }
        }
      });
    }
  }

  /**
   * Gets a token by its scope
   * @param {string} scope - The scope to search for
   * @returns {Token | undefined} The token with the matching scope, or undefined
   */
  get(scope: string): Token | undefined {
    return super.getModels().find((token) => token.get('scope') === scope);
  }

  /**
   * Removes a token by scope
   * @param {string} scope - The scope of the token to remove
   * @returns {boolean} Whether a token was removed
   */
  remove(scope: string): boolean;
  /**
   * Removes a token model from the collection
   * @param {Token} model - The token model to remove
   * @returns {void}
   */
  remove(model: Token): void;
  remove(scopeOrModel: string | Token): boolean | void {
    if (typeof scopeOrModel === 'string') {
      const token = this.get(scopeOrModel);
      if (token) {
        super.remove(token);

        return true;
      }

      return false;
    }
    super.remove(scopeOrModel);
  }

  /**
   * Adds a token to the collection, replacing any existing token with the same scope
   * @param {Token} token - The token to add
   * @returns {void}
   */
  add(token: Token): void {
    // Remove any existing token with the same scope
    const existingToken = this.get(token.get('scope'));
    if (existingToken) {
      super.remove(existingToken);
    }

    // Ensure parent reference is set if available
    if (super.getParent() && token && typeof token.parent !== 'undefined') {
      if (!token.parent) {
        token.parent = super.getParent();
      }
    }

    super.add(token);
  }

  /**
   * Gets all models in the collection
   * @returns {Token[]} Array of all tokens
   */
  get models(): Token[] {
    return super.getModels();
  }
}

export default TokenCollection;
