import assert from "node:assert/strict";
import { describeError, redactSecrets } from "../_shared/safe-log.ts";

const FAKE_KEY = "AIzaSyFAKE_FAKE_FAKE_FAKE_FAKE_12345";

Deno.test("redactSecrets removes API keys in query strings and bare Google keys", () => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/m:generateContent?key=${FAKE_KEY}`;
  const out = redactSecrets(`error sending request for url (${url}): connect error`);
  assert.ok(!out.includes(FAKE_KEY), out);
  assert.ok(!out.includes("key="), out);
  assert.ok(out.includes("generativelanguage.googleapis.com"));
  assert.ok(!redactSecrets(`token ${FAKE_KEY} leaked`).includes(FAKE_KEY));
});

Deno.test("redactSecrets removes bearer tokens and JWT-like strings", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop";
  const out = redactSecrets(`Authorization: Bearer ${jwt} and again ${jwt}`);
  assert.ok(!out.includes(jwt), out);
});

Deno.test("describeError never returns the key even when the runtime embeds the URL in the message", () => {
  const err = new TypeError(
    `error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/m:generateContent?key=${FAKE_KEY}): client error (Connect)`,
  );
  const out = describeError(err);
  assert.ok(out.startsWith("TypeError:"), out);
  assert.ok(!out.includes(FAKE_KEY), out);
});

Deno.test("describeError handles non-Error values and truncates", () => {
  assert.equal(describeError({ weird: true }), "Error: non-error value thrown");
  assert.ok(describeError(new Error("x".repeat(5000))).length <= 300);
});
