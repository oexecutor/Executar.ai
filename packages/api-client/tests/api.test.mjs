import test from 'node:test';
import assert from 'node:assert/strict';

test('URL da API mantém caminho absoluto', () => {
  assert.equal(new URL('/api/health', 'https://executa.example').pathname, '/api/health');
});
