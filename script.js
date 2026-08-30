// ============================================================
// 1. KONFIGURASI FIREBASE (tetap sama)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyB-nAMpSMXfomAxtq5Ntebv0IYOmuKitj0",
    authDomain: "sistem-antrian-puskesmas.firebaseapp.com",
    databaseURL: "https://sistem-antrian-puskesmas-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sistem-antrian-puskesmas",
    storageBucket: "sistem-antrian-puskesmas.firebasestorage.app",
    messagingSenderId: "727104534075",
    appId: "1:727104534075:web:9814d1598c9f846e050e1e"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================================
// 2. VARIABEL GLOBAL
// ============================================================
const synth = window.speechSynthesis;
let suaraTerpilih = null;
let suaraDiizinkan = false;
const queueSuara = [];
let sedangBerbicara = false;
let cachePanggilan = { K2: null, K3D: null, K3L: null };
let snapshotTerakhir = null;

// ============================================================
// 3. FUNGSI KONVERSI ANGKA KE KATA
// ============================================================
function angkaKeKata(angka) {
    if (typeof angka !== 'number' || isNaN(angka)) return '';
    if (angka === 0) return 'nol';

    const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
    const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
        'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'
    ];

    if (angka < 10) return satuan[angka];
    if (angka < 20) {
        if (angka === 10) return 'sepuluh';
        return belasan[angka - 10];
    }
    if (angka < 100) {
        const puluhan = Math.floor(angka / 10);
        const sisa = angka % 10;
        if (sisa === 0) return satuan[puluhan] + ' puluh';
        return satuan[puluhan] + ' puluh ' + satuan[sisa];
    }
    if (angka < 1000) {
        const ratusan = Math.floor(angka / 100);
        const sisa = angka % 100;
        let hasil = (ratusan === 1) ? 'seratus' : satuan[ratusan] + ' ratus';
        if (sisa === 0) return hasil;
        return hasil + ' ' + angkaKeKata(sisa);
    }
    return angka.toString();
}

// ============================================================
// 4. FUNGSI FORMAT DURASI (cadangan)
// ============================================================
function formatDurasi(ms) {
    if (!ms || ms < 0) return '—';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return 'baru saja';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari`;
    const weeks = Math.floor(days / 7);
    return `${weeks} minggu`;
}

// ============================================================
// 5. FUNGSI SUARA / TELLER
// ============================================================
function pilihSuaraTerbaik() {
    if (!synth) return null;
    const voices = synth.getVoices();
    let voice = voices.find(v =>
        (v.name.includes('Google') || v.name.includes('Wavenet')) &&
        (v.lang.includes('id') || v.lang.includes('ID'))
    );
    if (!voice) voice = voices.find(v =>
        (v.name.includes('Microsoft') || v.name.includes('Andika')) &&
        (v.lang.includes('id') || v.lang.includes('ID'))
    );
    if (!voice) voice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
    if (!voice && voices.length > 0) voice = voices[0];
    return voice;
}

function aktifkanSuara() {
    if (!synth) {
        document.getElementById('status-suara').textContent = '❌ Browser tidak mendukung.';
        return;
    }
    const testUcap = new SpeechSynthesisUtterance('Selamat datang di sistem informasi antrian dan pemanggilan pasien.');
    testUcap.lang = 'id-ID';
    testUcap.rate = 0.9;
    testUcap.pitch = 1.05;
    if (suaraTerpilih) testUcap.voice = suaraTerpilih;
    synth.speak(testUcap);
    suaraDiizinkan = true;
    document.getElementById('overlay-suara').classList.add('hidden');
    document.getElementById('status-suara').textContent = '✅ Suara Teller aktif!';
}

function updateIndikatorAntrean() {
    const el = document.getElementById('indikator-antrean');
    const elJumlah = document.getElementById('jumlah-antrean');
    const total = queueSuara.length + (sedangBerbicara ? 1 : 0);
    if (total > 0) {
        el.style.display = 'block';
        elJumlah.textContent = total;
    } else {
        el.style.display = 'none';
    }
}

function prosesAntreanSuara() {
    if (sedangBerbicara || queueSuara.length === 0 || !suaraDiizinkan) {
        updateIndikatorAntrean();
        return;
    }
    const item = queueSuara.shift();
    updateIndikatorAntrean();
    const { nomor, nama, klaster } = item;

    function formatNomorAntrian(nomor) {
        if (!nomor) return '';
        const str = nomor.toString().trim();
        const parts = str.split('-');
        if (parts.length !== 2) return str;
        const before = parts[0];
        const after = parts[1];

        const matchHurufAngka = before.match(/^([A-Z]+)(\d*)$/);
        let beforeUcap = '';
        if (matchHurufAngka) {
            const huruf = matchHurufAngka[1];
            const angka = matchHurufAngka[2];
            const hurufPerKarakter = huruf.split('').join(' ');
            const digitMap = {
                '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
                '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
            };
            let angkaUcap = '';
            if (angka) {
                angkaUcap = angka.split('').map(d => digitMap[d] || d).join(' ');
            }
            beforeUcap = hurufPerKarakter + (angkaUcap ? ' ' + angkaUcap : '');
        } else {
            const digitMap = {
                '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
                '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
            };
            beforeUcap = before.split('').map(d => digitMap[d] || d).join(' ');
        }

        let afterUcap = '';
        const angkaUrut = parseInt(after, 10);
        if (!isNaN(angkaUrut)) {
            afterUcap = angkaKeKata(angkaUrut);
        } else {
            const digitMap = {
                '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
                '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
            };
            afterUcap = after.split('').map(d => digitMap[d] || d).join(' ');
        }
        return beforeUcap + ' ' + afterUcap;
    }

    function normalizeNama(nama) {
        if (!nama) return '';
        return nama.toLowerCase().trim();
    }

    const nomorFormatted = formatNomorAntrian(nomor);
    const namaNormal = normalizeNama(nama);

    const mapKlasterFormal = {
        'K2': 'Klaster dua, Pelayanan Anak dan Remaja',
        'K3D': 'Klaster tiga, Pelayanan Dewasa',
        'K3L': 'Klaster tiga, Pelayanan Lansia'
    };
    const klasterNormal = mapKlasterFormal[klaster] || klaster;

    const teks =
        `Nomor antrian ${nomorFormatted}, atas nama ${namaNormal}, dipersilakan menuju ${klasterNormal}.`;

    const utterance = new SpeechSynthesisUtterance(teks);
    utterance.lang = 'id-ID';
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    if (suaraTerpilih) utterance.voice = suaraTerpilih;

    sedangBerbicara = true;
    utterance.onend = () => {
        sedangBerbicara = false;
        prosesAntreanSuara();
    };
    utterance.onerror = () => {
        sedangBerbicara = false;
        prosesAntreanSuara();
    };
    synth.speak(utterance);
}

function tambahAntreanSuara(nomor, nama, klaster) {
    if (!suaraDiizinkan) return;
    queueSuara.push({ nomor, nama, klaster });
    updateIndikatorAntrean();
    prosesAntreanSuara();
}

// ============================================================
// 6. FUNGSI SORT & PREFERENSI
// ============================================================
let sortOptions = { K2: 'nomor-asc', K3D: 'nomor-asc', K3L: 'nomor-asc' };

function extractNumber(nomorStr) {
    if (!nomorStr) return 0;
    const parts = nomorStr.split('-');
    if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) return num;
    }
    const match = nomorStr.match(/(\d+)$/);
    if (match) return parseInt(match[1], 10);
    return 0;
}

function sortPatients(list, option) {
    const copy = [...list];
    switch (option) {
        case 'nomor-asc':
            copy.sort((a, b) => extractNumber(a.nomor_antrian) - extractNumber(b.nomor_antrian));
            break;
        case 'nomor-desc':
            copy.sort((a, b) => extractNumber(b.nomor_antrian) - extractNumber(a.nomor_antrian));
            break;
        case 'checkin-oldest': {
            const getTime = (p) => p.waktu_checkin || p.waktu_daftar || 0;
            copy.sort((a, b) => getTime(a) - getTime(b));
            break;
        }
        case 'checkin-newest': {
            const getTime = (p) => p.waktu_checkin || p.waktu_daftar || 0;
            copy.sort((a, b) => getTime(b) - getTime(a));
            break;
        }
        default:
            break;
    }
    return copy;
}

// Firebase listener untuk preferensi sort
database.ref('preferences').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    ['K2', 'K3D', 'K3L'].forEach(k => {
        if (data[k] && data[k].sortOption) {
            sortOptions[k] = data[k].sortOption;
        }
    });
    if (snapshotTerakhir) {
        renderTV(snapshotTerakhir);
    }
});

// ============================================================
// 7. FUNGSI RENDER TV
// ============================================================
function updateDokterTV(data) {
    ['K2', 'K3D', 'K3L'].forEach(k => {
        const el = document.getElementById(`dokterNama${k}`);
        if (el) {
            el.textContent = data[k] || 'Belum ditentukan';
        }
    });
}

function renderTV(snapshot) {
    snapshotTerakhir = snapshot;
    const klasterList = ['K2', 'K3D', 'K3L'];
    let dataKlaster = {
        K2: { called: null },
        K3D: { called: null },
        K3L: { called: null }
    };

    const waitingLists = { K2: [], K3D: [], K3L: [] };

    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        const k = data.klaster;
        if (!dataKlaster[k]) return;

        if (data.status === 'called') {
            const waktu = data.waktu_panggil || 0;
            if (!dataKlaster[k].called || waktu > (dataKlaster[k].called.waktu_panggil || 0)) {
                dataKlaster[k].called = data;
            }
        } else if (data.status === 'waiting') {
            waitingLists[k].push(data);
        }
    });

    // Urutkan sesuai preferensi sort dari Firebase
    Object.keys(waitingLists).forEach(k => {
        waitingLists[k] = sortPatients(waitingLists[k], sortOptions[k] || 'nomor-asc');
    });

    klasterList.forEach(k => {
        const elNomor = document.getElementById(`nomor${k}`);
        const elNama = document.getElementById(`nama${k}`);
        const elStatus = document.getElementById(`status${k}`);
        const elCard = document.getElementById(`tv${k}`);
        const elJenis = document.getElementById(`jenisAntrian${k}`);
        const elWaiting = document.getElementById(`waiting${k}`);
        const elCount = document.getElementById(`waitingCount${k}`);

        const called = dataKlaster[k].called;

        // --- BAGIAN PANGGILAN AKTIF ---
        if (called) {
            const nomor = called.nomor_antrian;
            const nama = called.nama_pasien;
            elNomor.textContent = nomor;
            elNama.textContent = nama;
            const waktuPanggil = new Date(called.waktu_panggil).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            elStatus.textContent = `Dipanggil ${waktuPanggil}`;

            if (called.jenis_antrian) {
                if (called.jenis_antrian === 'AON') {
                    elJenis.innerHTML = `<i class="fas fa-globe"></i> Antrian Online`;
                } else if (called.jenis_antrian === 'AOFF') {
                    elJenis.innerHTML = `<i class="fas fa-hospital-user"></i> Antrian Offline`;
                } else {
                    elJenis.textContent = called.jenis_antrian;
                }
            } else {
                elJenis.innerHTML = '-';
            }

            const cacheKey = `${nomor}-${nama}-${called.waktu_panggil}`;
            if (cachePanggilan[k] !== cacheKey) {
                cachePanggilan[k] = cacheKey;
                elCard.classList.remove('berkedip');
                void elCard.offsetWidth;
                elCard.classList.add('berkedip');
                tambahAntreanSuara(nomor, nama, k);
            }
        } else {
            elNomor.textContent = '-';
            elNama.textContent = 'Menunggu';
            elStatus.textContent = 'Belum ada panggilan';
            elJenis.innerHTML = '-';
            cachePanggilan[k] = null;
        }

        // --- BAGIAN WAITING LIST (TABEL) ---
        const waiting = waitingLists[k];
        elCount.textContent = waiting.length;

        if (waiting.length === 0) {
            elWaiting.innerHTML = `<div class="waiting-empty">Tidak ada antrian selanjutnya</div>`;
        } else {
            let html = '';
            waiting.forEach(item => {
                const nomor = item.nomor_antrian || '-';
                const nama = item.nama_pasien || '-';
                const jenis = item.jenis_antrian || '';
                let badge = '';
                if (jenis === 'AON') {
                    badge = `<span class="w-jenis aon">AON</span>`;
                } else if (jenis === 'AOFF') {
                    badge = `<span class="w-jenis aoff">AOFF</span>`;
                } else {
                    badge = `<span class="w-jenis" style="background:rgba(255,255,255,0.1);color:#94a3b8;">${jenis || '-'}</span>`;
                }
                html += `
                    <div class="waiting-item">
                        <span class="w-nomor">${nomor}</span>
                        <span class="w-nama">${nama}</span>
                        ${badge}
                    </div>
                `;
            });
            elWaiting.innerHTML = html;
        }
    });
}

// ============================================================
// 8. FUNGSI JAM & TANGGAL
// ============================================================
function updateJamTanggal() {
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('jamDisplay').textContent = jam;

    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const tanggal = now.toLocaleDateString('id-ID', options);
    document.getElementById('tanggalDisplay').innerHTML = `<i class="fas fa-calendar-alt"></i> ${tanggal}`;
}

// ============================================================
// 9. INISIALISASI
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    if (synth) {
        synth.onvoiceschanged = () => {
            suaraTerpilih = pilihSuaraTerbaik();
        };
        setTimeout(() => {
            suaraTerpilih = pilihSuaraTerbaik();
        }, 300);
    }

    database.ref('antrians').on('value', (snapshot) => {
        renderTV(snapshot);
    });

    database.ref('dokter_assignments').on('value', (snapshot) => {
        const data = snapshot.val() || {};
        updateDokterTV(data);
    });

    database.ref('dokter_assignments').once('value', (snapshot) => {
        const data = snapshot.val() || {};
        updateDokterTV(data);
    });

    setInterval(() => {
        if (snapshotTerakhir) {
            renderTV(snapshotTerakhir);
        }
    }, 5000);

    updateJamTanggal();
    setInterval(updateJamTanggal, 1000);

    console.log('📺 TV siap (dengan waiting list yang tersinkronisasi dengan preferensi sort dari dashboard).');
});
