import test from 'node:test';
import assert from 'node:assert/strict';

test('rejeita token curto', () => {
  assert.equal(/^qr_[A-Za-z0-9_-]{24,96}$/.test('qr_curto'), false);
});
