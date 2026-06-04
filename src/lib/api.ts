/**
 * Unified API Client for Comic Lab.
 * Automatically injects client-side custom GEMINI_API_KEY if configured in settings.
 */

export const CUSTOM_KEY_STORAGE_NAME = "comic-lab-custom-gemini-key";

/**
 * Custom fetch wrapper that automatically appends the 'x-gemini-key' header
 * if a custom key is saved locally by the user.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const customKey = localStorage.getItem(CUSTOM_KEY_STORAGE_NAME);
  
  const headers = {
    "Content-Type": "application/json",
    ...(customKey ? { "x-gemini-key": customKey } : {}),
    ...init?.headers,
  };

  return fetch(url, {
    ...init,
    headers,
  });
}
