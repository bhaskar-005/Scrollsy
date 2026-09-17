import assert from 'node:assert/strict';
import { test } from 'node:test';

import { androidIntentUrl, inviterFirstName, isAndroid, playStoreUrl } from '../src/lib/links.ts';

test('the Play link carries the invite code as the install referrer', () => {
  const url = new URL(playStoreUrl('com.scrollsy.app', '0123456789ab'));
  assert.equal(url.searchParams.get('id'), 'com.scrollsy.app');
  assert.equal(url.searchParams.get('referrer'), 'invite=0123456789ab');
});

test('without a code the Play link is just the listing', () => {
  assert.equal(playStoreUrl('com.scrollsy.app'), 'https://play.google.com/store/apps/details?id=com.scrollsy.app');
});

test('the Android link opens the app on the invite and falls back to Play', () => {
  const store = playStoreUrl('com.scrollsy.app', '0123456789ab');
  const intent = androidIntentUrl('com.scrollsy.app', '0123456789ab', store);

  assert.ok(intent.startsWith('intent://invite/0123456789ab#Intent;'));
  assert.ok(intent.includes(';scheme=scrollsy;'));
  assert.ok(intent.includes(';package=com.scrollsy.app;'));
  assert.ok(intent.endsWith(';end'));

  const fallback = intent.match(/S\.browser_fallback_url=([^;]+)/)?.[1];
  assert.equal(decodeURIComponent(fallback ?? ''), store);
  // Encoded, so the fallback's own & and = cannot break the intent's fields.
  assert.ok(!fallback?.includes('&'));
});

test('Android is told apart from everything else', () => {
  assert.equal(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126'), true);
  assert.equal(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
  assert.equal(isAndroid('WhatsApp/2.24'), false);
  assert.equal(isAndroid(null), false);
});

test('the page greets by first name, and never with a blank', () => {
  assert.equal(inviterFirstName('Ravi Menon'), 'Ravi');
  assert.equal(inviterFirstName('  Anya  '), 'Anya');
  assert.equal(inviterFirstName(''), null);
  assert.equal(inviterFirstName('   '), null);
  assert.equal(inviterFirstName(null), null);
});
