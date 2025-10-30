/**
 * Global Token Provider
 * 
 * Stores the token provider function for use by services throughout the application.
 * This is initialized during server startup and used by ADO HTTP clients.
 */

let globalTokenProvider: (() => Promise<string>) | null = null;

/**
 * Set the global token provider
 * Should be called once during server initialization
 */
export function setTokenProvider(provider: () => Promise<string>): void {
  globalTokenProvider = provider;
}

/**
 * Get the global token provider
 * Throws an error if not initialized
 */
export function getTokenProvider(): () => Promise<string> {
  if (!globalTokenProvider) {
    throw new Error(
      'Token provider not initialized. This is a programming error - ' +
      'setTokenProvider() must be called during server startup.'
    );
  }
  return globalTokenProvider;
}
