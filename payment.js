/*
  Synthia payment adapter.

  Launch behavior is intentionally safe: until a real checkout URL or custom handler
  is supplied, checkout() rejects instead of pretending a purchase succeeded.

  Fastest production wiring:
  1. Set checkoutUrl to the hosted checkout URL from your payment provider.
  2. Optionally replace checkout() with a provider-specific implementation later.
*/
(function () {
  'use strict';

  const config = Object.freeze({
    checkoutUrl: '',
    successPath: '/?payment=success',
    cancelPath: '/?payment=cancelled'
  });

  async function checkout(context) {
    if (!config.checkoutUrl) {
      throw new Error('Payment checkout URL is not configured.');
    }

    try {
      sessionStorage.setItem('synthia.checkout.context', JSON.stringify({
        ...context,
        startedAt: new Date().toISOString()
      }));
    } catch (_) {}

    window.location.assign(config.checkoutUrl);
  }

  function getCheckoutContext() {
    try {
      return JSON.parse(sessionStorage.getItem('synthia.checkout.context') || 'null');
    } catch (_) {
      return null;
    }
  }

  window.SynthiaPayment = Object.freeze({
    config,
    checkout,
    getCheckoutContext
  });
})();
