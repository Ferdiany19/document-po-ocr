# Panduan Deployment: Frontend (Vercel) & Backend (AWS EC2) + CI/CD

Panduan ini berisi langkah-langkah detail untuk men-_deploy_ aplikasi OCR Anda.
Frontend akan di-host di **Vercel** (karena mudah & gratis), sedangkan Backend akan menggunakan cloud **AWS EC2** (Ubuntu). CI/CD akan menggunakan **GitHub Actions** sehingga jika terdapat perubahan _code_ di folder `backend/` yang ada di *branch* `main`, perubahan akan ter-_deploy_ secara mutlak otomatis ke dalam EC2 instances.

---

## 🚀 1. Persiapan AWS EC2 (Backend)

Langkah awal kita adalah menyiapkan "rumah" server EC2 untuk Node.js `server.js` Anda secara manual.

1. **Buat Instance EC2:**
   - Login ke [AWS Management Console](https://aws.amazon.com/console/).
   - Buka layanan **EC2** > klik tombol oranye **Launch Instance**.
   - **Nama:** Beri nama, misalnya `po-ocr-backend`.
   - **OS (AMI):** Pilih **Ubuntu 24.04 LTS** atau **22.04 LTS**.
   - **Instance Type:** `t2.micro` (Jika masih memenuhi _free tier_ 1 tahun pertama).
   - **Key Pair (Login):** Buat Key Pair tipe `RSA` format `.pem`, lalu unduh. **PENTING: Simpan file `.pem` ini baik-baik, jangan disebarkan.**
   - **Network Settings (Firewall):** Centang ke tiga opsi di bawah ini:
     - _Allow SSH traffic from Anywhere_
     - _Allow HTTP traffic from the internet_
     - _Allow HTTPS traffic from the internet_
   - Klik **Launch Instance**.

2. **Akses Server EC2 dari Komputer Lokal Anda:**
   - Buka PowerShell / Terminal atau Command Prompt. Pindah direktori ke folder tempat file `.pem` berada.
   - Atur permission (jika pakai MacOS/Linux): `chmod 400 nama_key.pem`
   - Akses via SSH:
     ```bash
     ssh -i "nama_key.pem" ubuntu@<PUBLIC_IP_EC2>
     ```

3. **Install Dependencies Server (Node.js & PM2):**
   Pada terminal ubuntu EC2, jalankan perintah di bawah ini satu-persatu:
   ```bash
   # Update & upgrade package server
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js versi 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 (Process Manager, agar backend tetap menyala walaupun terminal SSH ditutup)
   sudo npm install -g pm2
   
   # Buat folder untuk menampung aplikasi dari GitHub
   mkdir -p /home/ubuntu/document-po-ocr
   ```

4. **Konfigurasi Reverse Proxy menggunakan Nginx (Direkomendasikan):**
   Nginx bertugas meneruskan *request* internet (dari `80`) ke spesific `PORT` aplikasi Anda (misal `5000`).
   ```bash
   sudo apt install nginx -y
   sudo nano /etc/nginx/sites-available/default
   ```
   Hapus isinya atau modifikasi bagian block `server { ... location / { ... } }` sehingga menjadi:
   ```nginx
   server {
       listen 80 default_server;
       listen [::]:80 default_server;
       
       server_name _;
       
       # Supaya file upload (seperti File PDF/Excel) OCR ukurannya bisa di limit s/d 50MB (Bebas di atur).
       client_max_body_size 50M; 

       location / {
           # PASTIKAN localhost:5000 itu port dari server.js backend Node Anda.
           proxy_pass http://localhost:5000; 
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Save (Tekan `Ctrl+O`, kemudian `Enter`, untuk keluar `Ctrl+X`). Lalu kita validasi syntaknya dan restart nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## ⚙️ 2. CI/CD Backend dengan GitHub Actions (Auto Deploy)

Sistem ini memastikan agar Anda tidak perlu login SSH dan _copy paste_ setiap kali backend ada pembaruan kode.

### Langkah A: Daftarkan Secrets di GitHub
1. Buka Repositori GitHub Anda (`https://github.com/Ferdiany19/document-po-ocr`).
2. Masuk ke tab **Settings** > Pilih menu navigasi kiri **Secrets and variables** > submenu **Actions**.
3. Klik tombol hijau **New repository secret**.
4. Tambahkan ke-3 Secret Key Variable ini satu per satu:
   - **Name:** `EC2_HOST`
     - **Secret:** *Isi dengan Public IP Address IPV4 dari sistem AWS EC2 Anda (contoh: 54.123.45.67)*
   - **Name:** `EC2_USERNAME`
     - **Secret:** `ubuntu`
   - **Name:** `EC2_SSH_KEY`
     - **Secret:** Buka file `.pem` Anda dengan menggunakan `Notepad` / `VS Code`. Lalu *copy* SEMUA isinya mulai dari `-----BEGIN RSA PRIVATE KEY-----` sampai `-----END RSA PRIVATE KEY-----` lalu *paste*-kan valuenya di sini.

### Langkah B: Buat File `.yml` CI/CD di dalam Project (.github)
Buka Workspace Anda, lalu buat folder `.github` > subfolder `workflows` dan buat file `deploy-backend.yml`. Path mutlaknya: `.github/workflows/deploy-backend.yml` yang berisi config ini:

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches:
      - main
    paths:
      - 'backend/**' 

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code from Repository
        uses: actions/checkout@v4

      - name: Copy backend folder directory via SCP
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          source: "backend"
          target: "/home/ubuntu/document-po-ocr"

      - name: Execute Node PM2 on remote EC2 SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            # Pindah directory ke dalam foldernya
            cd /home/ubuntu/document-po-ocr/backend
            
            # Install Modules Production Only
            npm install --production
            
            # Restart Application PM2 kalau ada perubahan (fallback: Start application kalo tidak error) 
            pm2 restart backend-api || pm2 start server.js --name "backend-api"
            
            # Simpan list state service yg aktif supaya menyala setelah Instance Restart.
            pm2 save
```
> **PENTING TENTANG FILE `.env`**: Karena `scp-action` hanya menyalin file bawaan dari Git sedangkan `.env` selalu masuk dalam `gitignore`, Anda **DIWAJIBKAN** membuat `.env` secara manual di dalam server EC2 satu kali di alamat `/home/ubuntu/document-po-ocr/backend/.env` (menggunakan perintah `nano .env` pada SSH Server), lalu isikan Environment OCR / MongoDB Anda kesana. Setup selesai! Setiap Anda Pull & Push, maka `backend` akan otomatis terupdate.

---

## 🌐 3. Deploy Frontend ke Vercel

Hosting ke Vercel sangatlah praktis karena otomatis dikaitkan ke _Repository_ dari akun GitHub.

1. Buka halaman [Vercel](https://vercel.com/) dan lakukan pendaftaran masuk (Login terintegrasi **Continue with GitHub**).
2. Di dashboard vercel, klik tombol **Add New...** di atas kanan > lalu pilih **Project**.
3. Import GitHub Repositories milik `Ferdiany19/document-po-ocr`.
4. Di halaman _Konfigurasi_, sesuaikan setting berikut:
   - **Framework Preset:** Vercel secara otomatis akan mendeteksi library yang anda gunakan, entah itu `Vite` atau `Create-React-App`.
   - **Root Directory:** Klik menu "Edit" dan ubah lokasinya menjadi `frontend`. Hal ini penting karena project React kita tidak berada tepat di _Root folder base_.
   - **Environment Variables:**
     - Expand menu Environment Variables dan masukkan target endpoint di mana backend Anda running agar sistem frontend terhubung dgn backend EC2. (Tergantung cara config, contoh misal menggunakakn nama `VITE_API_URL` atau `REACT_APP_API_URL`)
     - Value: `http://<IP-EC2-ANDA>` (Contoh: `http://54.123.45.67`)
5. Tekan Tombol **Deploy**.
6. Vercel akan menganalisa dan melakukan pemuatan npm build. Jika berhasil maka akan menyajikan link live website layaknya `namaproject.vercel.app`!

### Catatan Tambahan (BACA JIKA APLIKASI MENGALAMI MIXED-CONTENT HTTP/HTTPS ERROR)
Backend yang Anda jalankan di IP EC2 saat ini menggunakan protokol `HTTP` tanpa SSSL/TLS. Vercel defaultnya `HTTPS`. Seringkali Browser seperti Google Chrome akan memberikan flag *CORS - Blocked Mixed Content* ketika HTTPS melakukan FETCH API terhadap HTTP.
- **Alternatif Solusi:** Pointing/Redirect _Custom Domain_ terhadap IP Publik EC2 tersebut, lalu buatkan SSL LetsEncrypt Certificates untuk Nginx Proxy-nya.
  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d be.domainmu.com
  ```
  Lalu Ganti *Environment Var* (VITE_API_BASE_URL) di settings dashboard Vercel milik frontend yang sebelumnya IP polosan, dirubah menjadi dengan bentuk FQHN layaknya `https://be.domainmu.com` dan Redepoy Ulang UI nya.
