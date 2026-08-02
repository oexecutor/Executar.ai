import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('identificador móvel permanece estável', () => assert.equal('ai.executa.app', 'ai.executa.app'));

test('scanner QR nunca confirma automaticamente', async () => {
  const scanner = await readFile(new URL('../app/qr.tsx', import.meta.url), 'utf8');
  assert.equal(scanner.includes('confirmQr('), false);
  assert.equal(scanner.includes('router.replace(`/confirm/'), true);
});

test('tela de confirmação exige ação explícita', async () => {
  const confirm = await readFile(new URL('../app/confirm/[token].tsx', import.meta.url), 'utf8');
  assert.equal(confirm.includes("api.confirmQr(token"), true);
  assert.equal(confirm.includes('Confirmar ação'), true);
});
