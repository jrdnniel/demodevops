// Server JavaScript tanpa library tambahan: website + API CRUD + file JSON.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function validateItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(422, 'Data barang tidak valid.');
  const { name, category, quantity, note = '' } = body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      typeof category !== 'string' || !category.trim() || category.trim().length > 60 ||
      !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000 ||
      typeof note !== 'string' || note.trim().length > 300) {
    throw fail(422, 'Nama dan kategori wajib. Jumlah harus bilangan bulat 0–1.000.000.');
  }
  return { name: name.trim(), category: category.trim(), quantity, note: note.trim() };
}

function readBody(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw fail(415, 'Gunakan Content-Type application/json.');
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 16384) reject(fail(413, 'Data terlalu besar.'));
      else chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      if (size > 16384) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(fail(400, 'Format JSON tidak valid.')); }
    });
  });
}

async function createApp({ dataFile = process.env.DATA_FILE || path.join(__dirname, 'data.json') } = {}) {
  dataFile = path.resolve(dataFile);
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try { await fs.writeFile(dataFile, '[]\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }

  async function readItems() {
    const items = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    if (!Array.isArray(items)) throw new Error('data.json harus berisi array.');
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id) throw new Error('ID barang tidak valid.');
      validateItem(item);
    }
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('ID barang duplikat.');
    return items;
  }
  // Berhenti bila file rusak; jangan menggantinya dengan data kosong.
  await readItems();

  // Semua perubahan masuk antrean satu proses agar request bersamaan tidak saling menimpa.
  let queue = Promise.resolve();
  function changeItems(change) {
    const operation = queue.then(async () => {
      const items = await readItems();
      const result = change(items);
      const temporary = `${dataFile}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, JSON.stringify(items, null, 2) + '\n', { mode: 0o600 });
        await fs.rename(temporary, dataFile);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  }

  const staticFiles = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/script.js': ['script.js', 'text/javascript; charset=utf-8'],
  };

  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    function json(status, data) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const endpoint = url.pathname;
      const itemMatch = endpoint.match(/^\/api\/items\/([a-zA-Z0-9-]+)$/);
      if (endpoint === '/api/items' || itemMatch) {
        // Tidak menerima perubahan dari halaman pada origin lain.
        if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin &&
            request.headers.origin !== `http://${request.headers.host}` &&
            request.headers.origin !== `https://${request.headers.host}`) {
          throw fail(403, 'Permintaan harus berasal dari website ini.');
        }
        if (request.method === 'GET' && endpoint === '/api/items') {
          await queue;
          return json(200, await readItems());
        }
        if (request.method === 'POST' && endpoint === '/api/items') {
          const fields = validateItem(await readBody(request));
          const item = await changeItems(items => {
            const created = { id: randomUUID(), ...fields };
            items.unshift(created);
            return created;
          });
          return json(201, item);
        }
        if (itemMatch && ['PUT', 'DELETE'].includes(request.method)) {
          const fields = request.method === 'PUT' ? validateItem(await readBody(request)) : null;
          const item = await changeItems(items => {
            const index = items.findIndex(item => item.id === itemMatch[1]);
            if (index === -1) throw fail(404, 'Barang tidak ditemukan. Muat ulang daftar barang.');
            if (request.method === 'DELETE') return items.splice(index, 1)[0];
            items[index] = { id: items[index].id, ...fields };
            return items[index];
          });
          return json(200, item);
        }
        throw fail(405, 'Metode tidak didukung.');
      }
      if (endpoint === '/favicon.ico') { response.writeHead(204); return response.end(); }
      const file = staticFiles[endpoint];
      if (!file) throw fail(404, 'Halaman tidak ditemukan.');
      if (!['GET', 'HEAD'].includes(request.method)) throw fail(405, 'Metode tidak didukung.');
      const content = await fs.readFile(path.join(__dirname, file[0]));
      response.writeHead(200, { 'Content-Type': file[1] });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      // Error penyimpanan tidak boleh ditampilkan sebagai keberhasilan atau menghapus data.
      if (!error.status) console.error('Gagal memproses data:', error.message);
      json(error.status || 500, { error: error.status ? error.message : 'Data tidak dapat dibaca/disimpan. Periksa server dan data.json.' });
    }
  });
}

if (require.main === module) {
  createApp().then(server => {
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '0.0.0.0';
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`RuangStok berjalan di http://${host}:${port}\nPenyimpanan: ${path.resolve(process.env.DATA_FILE || path.join(__dirname, 'data.json'))}`));
  }).catch(error => { console.error('Server tidak dapat dimulai:', error.message); process.exitCode = 1; });
}
module.exports = { createApp };
