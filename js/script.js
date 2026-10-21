const KUNCI_AKUN = "lentera.akun";
const KUNCI_SESI = "lentera.sesi";

const TANPA_KRIPTO = {
    ok: false,
    pesan: "Peramban belum mendukung penyimpanan kata sandi yang aman. Buka situs melalui https atau localhost."
};

function ambil(kunci, bawaan) {
    try {
        return JSON.parse(localStorage.getItem(kunci)) ?? bawaan;
    } catch (galat) {
        return bawaan;
    }
}

function simpan(kunci, nilai) {
    try {
        localStorage.setItem(kunci, JSON.stringify(nilai));
    } catch (galat) {
        console.warn("Penyimpanan peramban tidak tersedia.");
    }
}

async function hash(teks) {
    const bit = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
    return Array.from(new Uint8Array(bit), b => b.toString(16).padStart(2, "0")).join("");
}

const akunAktif = () =>
    ambil(KUNCI_AKUN, []).find(akun => akun.username.toLowerCase() === ambil(KUNCI_SESI, ""));

async function aksiDaftar({ nama, surel, username, sandi }) {
    if (!crypto.subtle) return TANPA_KRIPTO;

    const daftar = ambil(KUNCI_AKUN, []);
    const kunci = username.trim().toLowerCase();
    const email = surel.trim().toLowerCase();

    if (daftar.some(akun => akun.surel === email || akun.username.toLowerCase() === kunci)) {
        return { ok: false, pesan: "Email atau username sudah terdaftar." };
    }

    daftar.push({
        nama: nama.trim(),
        surel: email,
        username: username.trim(),
        hash: await hash(kunci + ":" + sandi)
    });

    simpan(KUNCI_AKUN, daftar);
    simpan(KUNCI_SESI, kunci);
    return { ok: true, pesan: "Akun berhasil dibuat. Anda akan dialihkan ke beranda." };
}

async function aksiMasuk({ akun, sandi }) {
    if (!crypto.subtle) return TANPA_KRIPTO;

    const kunci = akun.trim().toLowerCase();
    const ditemukan = ambil(KUNCI_AKUN, []).find(
        a => a.surel === kunci || a.username.toLowerCase() === kunci
    );
    const nama = ditemukan && ditemukan.username.toLowerCase();
    const cocok = ditemukan && (await hash(nama + ":" + sandi)) === ditemukan.hash;

    if (!cocok) return { ok: false, pesan: "Akun atau kata sandi tidak sesuai." };

    simpan(KUNCI_SESI, nama);
    return { ok: true, pesan: "Berhasil masuk. Anda akan dialihkan ke beranda." };
}

const buatId = judul => judul.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const kartu = (item, urutan) => `
    <article class="kartu">
        <div class="sampul warna-${urutan}">
            <img src="images/${buatId(item.judul)}.jpg" alt="Sampul ${item.judul}" onerror="this.remove()">
            <span class="sampul-judul">${item.judul}</span>
            <span class="sampul-penulis">${item.penulis}</span>
        </div>
        <h3>${item.judul}</h3>
        <p class="penulis">${item.penulis}</p>
        <span class="tag">${item.genre}</span>
        <p class="ringkasan">${item.ringkasan}</p>
    </article>`;

const artikel = item => `
    <li class="artikel">
        <span class="tag">${item.rubrik}</span>
        <h3>${item.judul}</h3>
        <p>${item.ringkasan}</p>
        <details>
            <summary class="btn btn-kecil">Baca Selengkapnya</summary>
            <p class="artikel-isi">${item.isi}</p>
        </details>
    </li>`;

function tampilkan(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

tampilkan("rak-buku", BUKU.map(kartu).join(""));
tampilkan("rak-novel", NOVEL.map(kartu).join(""));

const daftarNews = document.getElementById("daftar-news");

if (daftarNews) {
    const jumlah = Number(daftarNews.dataset.jumlah) || NEWS.length;
    daftarNews.innerHTML = NEWS.slice(0, jumlah).map(artikel).join("");
}

const burger = document.querySelector(".burger");
const menu = document.getElementById("menu-utama");

burger.addEventListener("click", () => {
    burger.setAttribute("aria-expanded", menu.classList.toggle("buka"));
});

const tautanLogin = document.getElementById("tautan-login");

if (akunAktif()) {
    tautanLogin.textContent = "Logout";
    tautanLogin.href = "index.html";
    tautanLogin.classList.remove("on");
    tautanLogin.addEventListener("click", () => simpan(KUNCI_SESI, null));
}

const dialog = document.getElementById("dialog-pilih");

if (dialog) {
    document.querySelector("[data-dialog]").addEventListener("click", () => dialog.showModal());

    dialog.addEventListener("click", e => {
        if (e.target === dialog || e.target.closest("a, [data-tutup]")) dialog.close();
    });
}

const cek = {
    wajib: nilai => (nilai.trim() ? "" : "Kolom ini wajib diisi."),
    surel: nilai => (/^\S+@\S+\.\S+$/.test(nilai.trim()) ? "" : "Format email tidak valid."),
    username: nilai =>
        /^[A-Za-z0-9_.]{4,}$/.test(nilai.trim())
            ? ""
            : "Gunakan minimal 4 karakter berupa huruf, angka, titik, atau garis bawah.",
    sandi: nilai => (nilai.length >= 8 ? "" : "Kata sandi minimal 8 karakter."),
    ulang: (nilai, semua) => (nilai === semua.sandi ? "" : "Konfirmasi kata sandi tidak sama.")
};

function pasangForm(id, aksi) {
    const form = document.getElementById(id);

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const nilai = Object.fromEntries(new FormData(form));
        let valid = true;

        form.querySelectorAll("[data-untuk]").forEach(el => {
            const nama = el.dataset.untuk;
            el.textContent = cek[el.dataset.aturan || nama](nilai[nama], nilai);
            if (el.textContent) valid = false;
        });

        const hasil = valid
            ? await aksi(nilai)
            : { ok: false, pesan: "Periksa kembali isian yang ditandai." };

        const kotak = form.querySelector(".hasil");
        kotak.hidden = false;
        kotak.className = "hasil " + (hasil.ok ? "ok" : "gagal");
        kotak.textContent = hasil.pesan;

        if (hasil.ok) setTimeout(() => { location.href = "index.html"; }, 900);
    });
}

if (document.getElementById("form-login")) {
    if (akunAktif()) location.replace("index.html");

    const tab = document.querySelectorAll("[data-form]");

    tab.forEach(tombol => {
        tombol.addEventListener("click", () => {
            tab.forEach(t => {
                t.classList.toggle("on", t === tombol);
                t.setAttribute("aria-pressed", t === tombol);
            });

            document.getElementById("form-login").hidden = tombol.dataset.form !== "login";
            document.getElementById("form-daftar").hidden = tombol.dataset.form !== "daftar";
        });
    });

    pasangForm("form-login", aksiMasuk);
    pasangForm("form-daftar", aksiDaftar);
}
