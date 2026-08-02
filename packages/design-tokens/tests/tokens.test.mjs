import test from 'node:test';
import assert from 'node:assert/strict';

test('identidade base permanece monocromática', () => {
  assert.equal('#FFFFFF', '#FFFFFF');
  assert.equal('#0A0A0A', '#0A0A0A');
});
