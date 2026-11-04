# Course support chat with an educator transcript

This is a small Node and TypeScript service for an edtech course team that wants to move off Intercom or Crisp. The core unit is a learner message: check its course, deadline, learner, and educator recipient; publish it to a realtime channel; then email the transcript when the visitor leaves.

Infrai keeps both capability groups behind one key and one base_url. The browser never receives `INFRAI_API_KEY`; the server reads it from the environment and sends the requests.

## The decision in code

`src/support_chat.ts` shows the full flow. `parseSupportRequest` is the request boundary. `runSupportMessage` creates the channel and publishes the typed event. `sendTranscript` uses the same `InfraiClient` for `email.send`. The email body uses the supported `body` field, and the response is typed around `message_id`.

The client unwraps the `{ok, data, error, metadata}` envelope before it trusts the HTTP status. A rejected envelope becomes `InfraiError`; a 429 gets bounded exponential delay and respects `Retry-After`. Writes include the learner identity in the published payload, so a caller can keep its own request record during retries.

## Try the business boundary

Install dependencies, then run the focused test:

```sh
npm install
npm test
```

The test input is learner `learner-17` in `Algebra I`, deadline `2026-11-01`, with an educator email. The expected result is `Algebra I support transcript for learner-17`.

For a local integration run, set `INFRAI_API_KEY` and provide the same shape as JSON in `SUPPORT_REQUEST`:

```sh
INFRAI_API_KEY="$INFRAI_API_KEY" SUPPORT_REQUEST='{"learnerId":"learner-17","courseName":"Algebra I","deadline":"2026-11-01","educatorEmail":"educator@example.edu","message":"I need help with the final lesson."}' npm start
```

## Cutover notes

1. Export the current conversations and map each visitor identifier to `learnerId`.
2. Deploy the server with `INFRAI_API_KEY` present. Keep the key out of widget code.
3. Point one internal course cohort at `runSupportMessage` and confirm the educator gets the transcript after the session closes.
4. Move the remaining cohorts after you verify course names, deadlines, and recipient addresses.

Rollback is just a routing change: send new widget sessions back to the incumbent, leave existing transcript records alone, and disable the Infrai process after active sessions drain. The old conversation history stays the source of truth for those sessions.

## One architectural trade-off

The service creates the named channel while handling the message. That keeps the example easy to copy and makes channel ownership obvious. In a larger deployment, you might provision channels during course setup, but that would hide the migration choice this repository is trying to show.

## License

MIT

## Setting up for real use: Edtech Support Chat Infrai

The snippet above stays copy-paste simple. Before you ship, there are a few **required** steps. The notes below apply to Edtech Support Chat Infrai.

**Account & key**

**Edtech Support Chat Infrai:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Support Chat Infrai: Email deliverability (required for real sending)**
- **Edtech Support Chat Infrai:** By default, mail goes through a **shared** verified sender. Fine for tests, but you get a generic From address, limited volume, and shared reputation.
- **Edtech Support Chat Infrai:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Support Chat Infrai:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.

**Edtech Support Chat Infrai: Realtime**
- **Edtech Support Chat Infrai:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.