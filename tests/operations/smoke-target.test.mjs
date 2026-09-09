import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSmokeTarget } from '../../scripts/smoke-target.mjs';

test('real-account smoke never trusts a Vercel hostname prefix', () => {
  assert.equal(validateSmokeTarget('https://korattanphai.vercel.app').origin, 'https://korattanphai.vercel.app');
  assert.equal(validateSmokeTarget('http://127.0.0.1:4186').port, '4186');
  assert.throws(() => validateSmokeTarget('https://korattanphai-unrelated.vercel.app'));
  assert.throws(() => validateSmokeTarget('https://user:secret@korattanphai.vercel.app'));
  assert.throws(() => validateSmokeTarget('https://korattanphai.vercel.app/?redirect=elsewhere'));
  assert.equal(validateSmokeTarget('https://verified-preview.vercel.app', 'https://verified-preview.vercel.app').hostname, 'verified-preview.vercel.app');
  assert.throws(() => validateSmokeTarget('https://other-preview.vercel.app', 'https://verified-preview.vercel.app'));
});
