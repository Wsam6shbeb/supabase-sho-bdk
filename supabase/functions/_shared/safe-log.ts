// Helpers that keep secrets out of Edge Function logs.
//
// Deno's fetch errors (for example "error sending request for url (https://...?key=...)")
// embed the full request URL, so logging a raw error object can leak a query-string API key.
// Use describeError() instead of passing error objects to console.error.

const URL_WITH_QUERY = /(https?:\/\/[^\s?#)"'<>]+)\?[^\s)"'<>]*/gi;
const KEY_PARAM = /([?&;](?:key|api_key|apikey|access_token|token)=)[^&\s)"'<>]+/gi;
const GOOGLE_API_KEY = /AIza[0-9A-Za-z_-]{20,}/g;
const BEARER_TOKEN = /(\bBearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi;
const JWT_LIKE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

export function redactSecrets(input: string): string {
  return input
    .replace(URL_WITH_QUERY, "$1?[redacted]")
    .replace(KEY_PARAM, "$1[redacted]")
    .replace(GOOGLE_API_KEY, "[redacted-key]")
    .replace(BEARER_TOKEN, "$1[redacted]")
    .replace(JWT_LIKE, "[redacted-jwt]");
}

export function describeError(error: unknown, maxLength = 300): string {
  let name = "Error";
  let message = "";
  if (error instanceof Error) {
    name = error.name || "Error";
    message = error.message || "";
  } else if (typeof error === "string") {
    message = error;
  } else {
    message = "non-error value thrown";
  }
  return redactSecrets(`${name}: ${message}`).slice(0, maxLength);
}
