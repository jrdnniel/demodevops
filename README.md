# RuangStok — CRUD dengan file JSON

Website HTML, CSS, dan JavaScript. Server Node.js membaca dan menulis barang ke **data.json**. Tidak ada dependency tambahan yang perlu diinstal.

## Menjalankan di laptop

1. Pasang Node.js versi LTS (minimal versi 22) dari https://nodejs.org/ jika belum ada.
2. Buka folder proyek di VS Code. Pilih **Terminal → New Terminal**.
3. Ketik `npm start`, lalu Enter.
4. Buka browser, ketik `http://localhost:3000`.
5. Tambahkan barang. File **data.json** otomatis muncul di folder proyek. Klik file itu di VS Code untuk melihat data.

Contoh isi file setelah menambahkan barang:

```json
[
  {
    "id": "id-unik-dibuat-server",
    "name": "Laptop",
    "category": "Elektronik",
    "quantity": 3,
    "note": "Lemari ruang kerja"
  }
]
```

Kamu juga dapat membuka `http://localhost:3000/api/items` untuk melihat data JSON dari browser. File yang sama digunakan oleh browser yang mengakses server ini, sehingga data tidak terpisah per browser lagi.

**Untuk versi ini, jalankan server dahulu.** Membuka index.html dengan klik dua kali atau memakai Live Server saja tidak menjalankan API CRUD. Biarkan terminal tetap terbuka. Tekan Ctrl+C untuk menghentikan server; data tetap ada saat server dijalankan lagi.

## Mengenal file proyek

- `index.html`: tampilan/formulir dan tabel.
- `style.css`: desain website.
- `script.js`: tombol CRUD memanggil API menggunakan fetch.
- `server.js`: melayani website, memvalidasi input, dan mengubah file JSON.
- `data.json`: data barang asli, dibuat otomatis saat startup; cadangkan file ini. Tidak diunggah ke GitHub.
- `package.json`: perintah `npm start` dan `npm test`.
- `tests/server.test.js`: pengujian CRUD, persistensi, request bersamaan, dan penanganan error.

Alurnya: **formulir → JavaScript fetch → server Node.js → data.json**.

## API

| Aksi | Metode | Alamat |
| --- | --- | --- |
| Read | GET | `/api/items` |
| Create | POST | `/api/items` |
| Update | PUT | `/api/items/:id` |
| Delete | DELETE | `/api/items/:id` |

Jalankan `npm test` untuk pengujian. Pengujian memakai file sementara, bukan data.json milikmu.

## Catatan penyimpanan

- File JSON ini adalah penyimpanan sederhana untuk tahap belajar; belum ada akun/login.
- Jalankan satu proses server untuk satu file JSON. Server mengantrekan perubahan dan menulis lewat file sementara agar request bersamaan tidak menimpa penambahan barang.
- Hentikan server sebelum mengedit data.json secara manual. File yang rusak tidak otomatis direset agar data lama tidak hilang.
- Data localStorage dari versi lama tetap berada di browser dan belum otomatis dipindahkan ke file JSON.
- Untuk container nanti, file JSON harus dipasang pada volume persisten. `DATA_FILE` dapat dipakai untuk menentukan path file; `HOST=0.0.0.0` untuk akses dari container, dan `PORT` untuk mengganti port.
