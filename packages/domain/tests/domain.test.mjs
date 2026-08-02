import test from 'node:test';
import assert from 'node:assert/strict';

function calculateProgress(completed, total) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

test('calcula progresso com limite de 0 a 100', () => {
  assert.equal(calculateProgress(1, 4), 25);
  assert.equal(calculateProgress(0, 0), 0);
  assert.equal(calculateProgress(8, 4), 100);
});
