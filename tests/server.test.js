const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../server');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ruangstok-json-'));
  const dataFile = path.join(directory, 'data.json');
  const servers = [];
  async function start() {
    const server = await createApp({ dataFile });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  t.after(async () => {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { url: await start(), start, dataFile };
}
const barang = { name: 'Laptop', category: 'Elektronik', quantity: 3, note: 'Tim A' };
function send(url, method, body) {
  return fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('CRUD mengubah file JSON dan data tetap ada saat server dimulai ulang', async t => {
  const f = await fixture(t);
  assert.deepEqual(await (await fetch(f.url + '/api/items')).json(), []);
  let response = await send(f.url + '/api/items', 'POST', barang);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(JSON.parse(await fs.readFile(f.dataFile, 'utf8'))[0].name, 'Laptop');
  response = await send(f.url + '/api/items/' + created.id, 'PUT', { ...barang, quantity: 7 });
  assert.equal(response.status, 200);
  const restarted = await f.start();
  const items = await (await fetch(restarted + '/api/items')).json();
  assert.equal(items[0].quantity, 7);
  assert.equal((await send(restarted + '/api/items/' + created.id, 'DELETE')).status, 200);
  assert.deepEqual(JSON.parse(await fs.readFile(f.dataFile, 'utf8')), []);
});

test('request tambah bersamaan tidak saling menimpa', async t => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => send(f.url + '/api/items', 'POST', { ...barang, name: `Barang ${i}` })));
  assert.ok(results.every(response => response.status === 201));
  const items = JSON.parse(await fs.readFile(f.dataFile, 'utf8'));
  assert.equal(items.length, 12);
  assert.equal(new Set(items.map(item => item.id)).size, 12);
});

test('input salah, JSON rusak, dan payload berlebih ditolak tanpa menyimpan', async t => {
  const f = await fixture(t);
  for (const body of [{ ...barang, quantity: -1 }, { ...barang, quantity: 1.5 }, { ...barang, quantity: '3' }, { ...barang, name: '  ' }]) {
    assert.equal((await send(f.url + '/api/items', 'POST', body)).status, 422);
  }
  assert.equal((await fetch(f.url + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal((await send(f.url + '/api/items', 'POST', { ...barang, note: 'a'.repeat(17000) })).status, 413);
  assert.deepEqual(JSON.parse(await fs.readFile(f.dataFile, 'utf8')), []);
});

test('ID tidak ada, cross-origin, dan file server tidak boleh diakses', async t => {
  const f = await fixture(t);
  assert.equal((await send(f.url + '/api/items/missing', 'PUT', barang)).status, 404);
  assert.equal((await send(f.url + '/api/items/missing', 'DELETE')).status, 404);
  assert.equal((await fetch(f.url + '/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: JSON.stringify(barang) })).status, 403);
  for (const file of ['/data.json', '/server.js', '/.git/config']) assert.equal((await fetch(f.url + file)).status, 404);
  assert.equal((await fetch(f.url + '/')).status, 200);
});

test('file JSON rusak tidak dihapus atau ditimpa', async t => {
  const f = await fixture(t);
  await fs.writeFile(f.dataFile, 'jangan timpa data ini');
  assert.equal((await send(f.url + '/api/items', 'POST', barang)).status, 500);
  assert.equal(await fs.readFile(f.dataFile, 'utf8'), 'jangan timpa data ini');
  await assert.rejects(createApp({ dataFile: f.dataFile }));
});
