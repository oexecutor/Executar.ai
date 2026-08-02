import test from 'node:test';
import assert from 'node:assert/strict';

test('estrutura de projeto exige exatamente três passos', () => {
  const steps = ['Entender', 'Executar', 'Confirmar'];
  assert.equal(steps.length, 3);
});
