import { LinearClient } from '@linear/sdk'
import { OAuthService, withAccessToken, getAccessToken } from '@raycast/utils'

/**
 * Linear OAuth via Raycast's built-in provider — the same flow the official
 * Linear extension uses. Tokens are stored and refreshed by Raycast; the
 * extension never handles a raw API key.
 */
export const linear = OAuthService.linear({
  scope: 'read write',
})

let cachedClient: LinearClient | null = null
let cachedToken: string | null = null

/**
 * Get a LinearClient bound to the current access token. Must be called from a
 * component wrapped with `withLinearAuth` (so a token is available).
 */
export function getLinearClient(): LinearClient {
  const { token } = getAccessToken()
  if (!token) {
    throw new Error('Not authenticated with Linear.')
  }
  if (!cachedClient || cachedToken !== token) {
    cachedClient = new LinearClient({ accessToken: token })
    cachedToken = token
  }
  return cachedClient
}

/** HOC that ensures the wrapped command is authenticated before rendering. */
export function withLinearAuth<T>(Component: React.ComponentType<T>) {
  return withAccessToken<T>(linear)(Component)
}
