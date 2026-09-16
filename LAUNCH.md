# Synthia — Publication Launch

This branch is intentionally deployable as a zero-build static web application.

## Hosting contract

Use branch: `publishable-core-v1`

The repository root is the publish directory. No install command and no build command are required.

Supported direct paths:

- `/` — production launch shell
- `/SYNTH_OS_touch_top_buttons_fixed%20(1).html` — current Synthia OS payload
- `/payment.js` — payment adapter
- `/site.webmanifest` — installable-web-app metadata

`netlify.toml` and `vercel.json` are already present for repo-connected deployment.

## What remains before public sale

### 1. Connect the repository to a host

Choose the `publishable-core-v1` branch and publish the repository root.

### 2. Connect the custom domain

Point the domain using the hosting provider's normal custom-domain screen. No application code change is required.

### 3. Wire checkout

Open `payment.js` and set `checkoutUrl` to the hosted checkout URL supplied by the chosen payment provider.

The Upgrade button already calls the adapter. Until a checkout URL is supplied, the adapter rejects and no purchase is represented as successful.

For providers that require server-side checkout-session creation or webhook verification, replace `checkout()` in `payment.js` with that provider's secure endpoint call and add the provider's serverless function. Do not place secret keys in browser JavaScript.

## Current persistence and instrumentation

The launch shell records a bounded local event history in browser localStorage under:

`synthia.launch.events.v1`

It records launches, upgrade clicks, checkout errors, and same-origin runtime events that opt into the `synthia-runtime` postMessage contract.

This is deliberately local-first and does not transmit user data to a third-party analytics service.

## Runtime boundary

The public shell does not redefine Synthia's state-space mechanics. It wraps the existing checked-in Synthia OS HTML payload so publishing/commerce concerns stay separate from the runtime. Future canonical runtime upgrades can replace the iframe target without rebuilding the publication layer.

## Launch definition

The branch is publication-ready when:

1. The host deploys `/index.html` successfully.
2. The Synthia OS payload loads inside the shell.
3. The custom domain resolves to the deployment.
4. The chosen payment provider is connected through `payment.js` (and a serverless verification endpoint if required by that provider).

No other repository restructuring is required to put the current public surface online.
