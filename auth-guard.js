/* ============================================================
   AUTH-GUARD.JS
   ------------------------------------------------------------
   Tugas:
   1. Inisialisasi Firebase (app + auth).
   2. Cek apakah user sudah login.
   3. Jika BELUM → tendang ke login.html.
   4. Jika SUDAH → tampilkan halaman + tombol logout otomatis.
   ============================================================ */

(function () {
    'use strict';

    // ---------- 1. Konfigurasi Firebase ----------
    const firebaseConfig = {
        apiKey: "AIzaSyB-nAMpSMXfomAxtq5Ntebv0IYOmuKitj0",
        authDomain: "sistem-antrian-puskesmas.firebaseapp.com",
        databaseURL: "https://sistem-antrian-puskesmas-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "sistem-antrian-puskesmas",
        storageBucket: "sistem-antrian-puskesmas.firebasestorage.app",
        messagingSenderId: "727104534075",
        appId: "1:727104534075:web:9814d1598c9f846e050e1e"
    };

    // Jangan inisialisasi ulang kalau sudah ada
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // ---------- 2. Jangan jalankan guard di halaman login ----------
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('login.html')) return;

    // ---------- 3. Sembunyikan halaman sampai auth selesai ----------
    // Ini mencegah "flash of protected content" sebelum redirect.
    document.documentElement.style.visibility = 'hidden';

    // ---------- 4. Cek status login ----------
    const auth = firebase.auth();
    let sudahRedirect = false;

    auth.onAuthStateChanged(function (user) {
        if (user) {
            // ✅ LOGIN VALID
            window.currentUser = user;
            document.documentElement.style.visibility = 'visible';

            // Tambahkan tombol logout & info user ke halaman
            injectUserMenu(user);

            // Beri sinyal ke halaman (opsional, untuk kode yang mau menunggu)
            window.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));

            console.log('🔓 Auth OK:', user.email);
        } else {
            // ❌ BELUM LOGIN → tendang ke login
            if (!sudahRedirect) {
                sudahRedirect = true;
                // Simpan halaman tujuan supaya bisa balik setelah login (opsional)
                try {
                    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                } catch (e) { /* ignore */ }
                window.location.replace('login.html');
            }
        }
    });

    // ---------- 5. Fungsi inject tombol logout + info user ----------
    function injectUserMenu(user) {
        // Hindari duplikat
        if (document.getElementById('authUserBar')) return;

        // 🖥️ SKIP di halaman TV — display publik tanpa elemen interaktif
        const halamanSekarang = window.location.pathname.toLowerCase();
        if (halamanSekarang.endsWith('tv.html')) {
            console.log('📺 Halaman TV terdeteksi — tombol logout tidak ditampilkan.');
            return;
        }

        // Tunggu DOM siap
        const siapkan = () => {
            const bar = document.createElement('div');
            bar.id = 'authUserBar';
            bar.innerHTML = `
                <div class="auth-user-info" title="${user.email}">
                    <i class="fas fa-user-circle"></i>
                    <span class="auth-email">${user.email}</span>
                </div>
                <button class="auth-logout-btn" id="btnLogout" title="Keluar">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Keluar</span>
                </button>
            `;
            document.body.appendChild(bar);

            document.getElementById('btnLogout').addEventListener('click', function () {
                if (confirm('Yakin ingin keluar dari sistem?')) {
                    auth.signOut().then(() => {
                        window.location.replace('login.html');
                    });
                }
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', siapkan);
        } else {
            siapkan();
        }
    }

    // ---------- 7. Auto-hide saat scroll (opsional) ----------
    let lastScrollY = 0;
    let ticking = false;

    window.addEventListener('scroll', function () {
        if (ticking) return;
        window.requestAnimationFrame(function () {
            const bar = document.getElementById('authUserBar');
            if (bar) {
                const currentY = window.scrollY;
                if (currentY > lastScrollY && currentY > 120) {
                    // Scroll ke bawah & sudah lewat 120px → sembunyikan
                    bar.style.transform = 'translateY(-120%)';
                    bar.style.opacity = '0';
                    bar.style.pointerEvents = 'none';
                } else {
                    // Scroll ke atas → munculkan lagi
                    bar.style.transform = 'translateY(0)';
                    bar.style.opacity = '1';
                    bar.style.pointerEvents = 'auto';
                }
                lastScrollY = currentY;
            }
            ticking = false;
        });
        ticking = true;
    }, { passive: true });

    // ---------- 6. Suntikkan CSS tombol logout ----------
    const style = document.createElement('style');
    style.textContent = `
        #authUserBar {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 99998;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            padding: 6px 6px 6px 14px;
            border-radius: 60px;
            border: 1px solid rgba(255, 255, 255, 0.7);
            box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.15);
            font-family: 'Inter', sans-serif;
            transition: all 0.3s ease;
        }

        #authUserBar:hover {
            box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.2);
        }

        #authUserBar .auth-user-info {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            color: #334155;
            max-width: 180px;
        }

        #authUserBar .auth-user-info i {
            font-size: 1rem;
            color: #6366f1;
        }

        #authUserBar .auth-email {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        #authUserBar .auth-logout-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 40px;
            background: linear-gradient(135deg, #dc2626, #ef4444);
            color: white;
            font-weight: 700;
            font-size: 0.78rem;
            border: none;
            cursor: pointer;
            transition: all 0.25s ease;
            font-family: 'Inter', sans-serif;
            box-shadow: 0 4px 12px -4px rgba(239, 68, 68, 0.4);
        }

        #authUserBar .auth-logout-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.5);
        }

        #authUserBar .auth-logout-btn:active {
            transform: scale(0.96);
        }

        @media (max-width: 600px) {
            #authUserBar { top: 10px; right: 10px; padding: 4px 4px 4px 10px; }
            #authUserBar .auth-email { display: none; }
            #authUserBar .auth-logout-btn span { display: none; }
            #authUserBar .auth-logout-btn { padding: 8px 12px; }
        }
    `;

    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
})();