// CRUD melalui API server; data disimpan di file data.json.
const form = document.querySelector("#item-form");
const nameInput = document.querySelector("#name");
const categoryInput = document.querySelector("#category");
const quantityInput = document.querySelector("#quantity");
const noteInput = document.querySelector("#note");
const searchInput = document.querySelector("#search");
const itemList = document.querySelector("#item-list");
const cancelButton = document.querySelector("#cancel-button");
const message = document.querySelector("#message");
let items = [];
let editingId = null;
let busy = false;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.hidden = false;
}

// Fetch menghubungkan tombol di browser dengan operasi file JSON di server.
async function api(path = "", options = {}) {
  const response = await fetch(`/api/items${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}

function setBusy(value) {
  busy = value;
  form.querySelectorAll("input, textarea, button").forEach(element => element.disabled = value);
  itemList.querySelectorAll("button").forEach(element => element.disabled = value);
}

async function loadItems() {
  items = await api();
  renderItems();
}

function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector("#form-title").textContent = "Tambah barang";
  document.querySelector("#save-button").textContent = "+ Tambah barang";
  cancelButton.hidden = true;
}

// textContent membuat nama/catatan ditampilkan sebagai teks, bukan kode HTML.
function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

// READ: tampilkan isi array, dengan pencarian nama atau kategori.
function renderItems() {
  const query = searchInput.value.trim().toLocaleLowerCase("id");
  const visibleItems = items.filter(item =>
    item.name.toLocaleLowerCase("id").includes(query) ||
    item.category.toLocaleLowerCase("id").includes(query)
  );

  document.querySelector("#total-items").textContent = items.length;
  document.querySelector("#total-quantity").textContent = items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("id-ID");
  document.querySelector("#result-count").textContent = `${visibleItems.length} barang`;
  document.querySelector("#empty-state").hidden = visibleItems.length > 0;
  document.querySelector("#table-container").hidden = visibleItems.length === 0;
  document.querySelector("#empty-title").textContent = query ? "Barang tidak ditemukan" : "Belum ada barang";
  document.querySelector("#empty-description").textContent = query
    ? "Coba cari dengan nama atau kategori lainnya."
    : "Tambahkan barang pertama melalui formulir tambah barang.";

  itemList.replaceChildren();
  visibleItems.forEach(item => {
    const row = document.createElement("tr");
    const infoCell = document.createElement("td");
    infoCell.append(textElement("span", "item-name", item.name));
    infoCell.append(textElement("span", "item-category", item.category));
    if (item.note) infoCell.append(textElement("span", "item-note", item.note));

    const quantityCell = textElement("td", "quantity", `${item.quantity.toLocaleString("id-ID")} unit`);
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";
    const editButton = textElement("button", "action-button", "Edit");
    editButton.type = "button";
    editButton.setAttribute("aria-label", `Edit ${item.name}`);
    editButton.addEventListener("click", () => editItem(item.id));
    const deleteButton = textElement("button", "action-button delete-button", "Hapus");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Hapus ${item.name}`);
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    actions.append(editButton, deleteButton);
    actionCell.append(actions);
    row.append(infoCell, quantityCell, actionCell);
    itemList.append(row);
  });
}

// CREATE dan UPDATE: bedakan tambah baru dengan edit berdasarkan editingId.
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const quantity = Number(quantityInput.value);
  const note = noteInput.value.trim();

  if (!name || !category || quantityInput.value.trim() === "" ||
      !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000 ||
      name.length > 100 || category.length > 60 || note.length > 300) {
    showMessage("Isi nama, kategori, dan jumlah bilangan bulat 0–1.000.000 dengan benar.", true);
    return;
  }

  const wasEditing = editingId !== null;
  const itemId = editingId;
  setBusy(true);
  try {
    await api(wasEditing ? `/${itemId}` : "", {
      method: wasEditing ? "PUT" : "POST",
      body: JSON.stringify({ name, category, quantity, note }),
    });
    resetForm();
    try {
      await loadItems();
      showMessage(wasEditing ? "Perubahan barang berhasil disimpan." : "Barang berhasil ditambahkan.");
    } catch {
      showMessage("Barang sudah disimpan, tetapi daftar belum dapat dimuat ulang. Muat ulang halaman.", true);
    }
  } catch (error) {
    showMessage(`Belum tersimpan: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
});

function editItem(id) {
  if (busy) return;
  const item = items.find(item => item.id === id);
  if (!item) return;
  editingId = id;
  nameInput.value = item.name;
  categoryInput.value = item.category;
  quantityInput.value = item.quantity;
  noteInput.value = item.note;
  document.querySelector("#form-title").textContent = "Edit barang";
  document.querySelector("#save-button").textContent = "Simpan perubahan";
  cancelButton.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  nameInput.focus({ preventScroll: true });
}

// DELETE: server menghapus barang berdasarkan ID lalu memperbarui data.json.
async function deleteItem(id) {
  if (busy) return;
  const item = items.find(item => item.id === id);
  if (!item || !window.confirm(`Hapus barang "${item.name}"?`)) return;
  setBusy(true);
  try {
    await api(`/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    try {
      await loadItems();
      showMessage("Barang berhasil dihapus.");
    } catch {
      showMessage("Barang sudah dihapus, tetapi daftar belum dapat dimuat ulang. Muat ulang halaman.", true);
    }
  } catch (error) {
    showMessage(`Belum terhapus: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

cancelButton.addEventListener("click", () => {
  resetForm();
  nameInput.focus();
});
searchInput.addEventListener("input", () => {
  renderItems();
  if (busy) setBusy(true);
});
setBusy(true);
loadItems().catch(() => {
  showMessage("Data belum dapat dimuat. Jalankan npm start dan buka website dari alamat server. Data tersimpan tidak dihapus.", true);
}).finally(() => setBusy(false));
