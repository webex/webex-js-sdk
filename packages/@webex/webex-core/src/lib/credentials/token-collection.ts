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
   * Gets a token by its scope
   * @param scope - The scope to search for
   * @returns The token with the matching scope, or undefined
   */
  get(scope: string): Token | undefined {
    return this.getModels().find((token) => token.get('scope') === scope);
  }

  /**
   * Removes a token by scope
   * @param scope - The scope of the token to remove
   * @returns Whether a token was removed
   */
  remove(scope: string): boolean;
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
   * @param token - The token to add
   */
  add(token: Token): void {
    // Remove any existing token with the same scope
    const existingToken = this.get(token.get('scope'));
    if (existingToken) {
      super.remove(existingToken);
    }

    super.add(token);
  }

  /**
   * Gets all models in the collection
   * @returns Array of all tokens
   */
  get models(): Token[] {
    return this.getModels();
  }
}

export default TokenCollection;
