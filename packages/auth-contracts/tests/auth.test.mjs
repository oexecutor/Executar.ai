import test from 'node:test';
import assert from 'node:assert/strict';

test('não aceita redirect externo', () => {
  const safe = (value) => (!value || !value.startsWith('/') || value.startsWith('//') ? '/' : value);
  assert.equal(safe('//evil.example'), '/');
  assert.equal(safe('/projetos'), '/projetos');
});
