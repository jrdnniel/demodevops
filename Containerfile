# Gunakan base image Node.js Alpine yang ringan
FROM node:18-alpine

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install dependensi
RUN npm install --omit=dev

# Salin seluruh file proyek ke dalam container
COPY . .

# Buka port yang digunakan oleh server.js (default biasanya 3000 atau 5000)
EXPOSE 3000

# Jalankan server
CMD ["node", "server.js"]