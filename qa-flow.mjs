export default async function run(page, ui) {
  const out = {};

  // 1. Buka modal tambah pasien
  await page.click('button.btn-tambah-pasien');
  await page.waitForSelector('#modalDaftar.active', { timeout: 5000 });

  // 2. Isi form (nomor uji unik)
  const nomorUji = 'TEST-' + Date.now().toString().slice(-6);
  out.nomorUji = nomorUji;
  await page.fill('#modalNomor', nomorUji);
  await page.fill('#modalNama', 'Pasien Uji QA');
  await page.selectOption('#modalKlaster', 'K2');
  await page.selectOption('#modalJenisAntrian', 'AON');
  await page.click('#btnSimpanModal');

  // 3. Tunggu pasien muncul di panel Jenis Antrian (submit sukses + render)
  await page.waitForSelector('.btn-checkin', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // 4. Cek panel jenis antrian
  out.panelJenisSetelahDaftar = (await page.locator('#bodyJenisAntrian').innerText()).slice(0, 200);

  // 5. Klik Check In
  const checkinBtn = page.locator('.btn-checkin').first();
  out.jumlahTombolCheckin = await checkinBtn.count();
  if (await checkinBtn.count() > 0) {
    await checkinBtn.click();
    await page.waitForTimeout(2500);
  }

  // 6. Cek panel klaster K2 & panel jenis antrian setelah check in
  out.panelK2SetelahCheckin = (await page.locator('#bodyK2').innerText()).slice(0, 200);
  out.panelJenisSetelahCheckin = (await page.locator('#bodyJenisAntrian').innerText()).slice(0, 200);

  // 7. Bersihkan data uji dari Firebase
  try {
    const n = await page.evaluate(async (nomor) => {
      const db = firebase.database();
      const snap = await db.ref('antrians').orderByChild('nomor_antrian').equalTo(nomor).once('value');
      const updates = {};
      snap.forEach(c => { updates[c.key] = null; });
      await db.ref().update(updates);
      return Object.keys(updates).length;
    }, nomorUji);
    out.dihapus = n;
  } catch (e) {
    out.hapusError = e.message;
  }

  await page.waitForTimeout(1500);
  out.panelJenisSetelahBersih = (await page.locator('#bodyJenisAntrian').innerText()).slice(0, 120);

  return out;
}
