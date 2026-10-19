const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwK9XQr155xNGdDDmry7TegcfuAYC4tYxSMDLeYcya1Kk0DEiR5IAR2flaVbS2sFoRh/exec";

const totalSaung = 20;
let bookedList = [];

document.addEventListener("DOMContentLoaded", () => {
    initSaungGrid();
    fetchBookedData();

    document.getElementById("tanggal").addEventListener("change", fetchBookedData);
    document.getElementById("sesi").addEventListener("change", fetchBookedData);
    document.getElementById("bookingForm").addEventListener("submit", handleBookingSubmit);

    const modal = document.getElementById("adminModal");
    document.getElementById("adminToggleBtn").addEventListener("click", () => {
        modal.style.display = "flex";
    });
    document.getElementById("closeModal").addEventListener("click", () => {
        modal.style.display = "none";
    });

    document.getElementById("loginPinBtn").addEventListener("click", () => {
        const pin = document.getElementById("adminPin").value;
        if (pin === "1234") {
            document.getElementById("adminLoginArea").style.display = "none";
            document.getElementById("adminDashboard").style.display = "block";
            loadAdminData();
        } else {
            alert("PIN Salah! Gunakan 1234");
        }
    });
});

function initSaungGrid() {
    const grid = document.getElementById("gridSaung");
    grid.innerHTML = "";
    for (let i = 1; i <= totalSaung; i++) {
        const box = document.createElement("div");
        box.className = "saung-box available";
        box.id = `saung-${i}`;
        box.innerText = `Saung ${i}`;
        box.addEventListener("click", () => selectSaung(i));
        grid.appendChild(box);
    }
}

let chosenSaung = null;
function selectSaung(number) {
    const box = document.getElementById(`saung-${number}`);
    if (box.classList.contains("booked")) {
        alert("Maaf, saung ini sudah terisi pada jadwal tersebut.");
        return;
    }

    if (chosenSaung !== null) {
        const prevBox = document.getElementById(`saung-${chosenSaung}`);
        if (prevBox) prevBox.className = "saung-box available";
    }

    chosenSaung = number;
    box.className = "saung-box selected";
    document.getElementById("selectedSaung").value = number;
}

function fetchBookedData() {
    const tanggal = document.getElementById("tanggal").value;
    const sesi = document.getElementById("sesi").value;

    if (!tanggal || !sesi) return;

    for (let i = 1; i <= totalSaung; i++) {
        const box = document.getElementById(`saung-${i}`);
        box.className = "saung-box available";
        box.innerText = `Saung ${i}`;
    }
    chosenSaung = null;
    document.getElementById("selectedSaung").value = "";

    fetch(SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            bookedList = data;
            data.forEach(item => {
                if (item.tanggal === tanggal && item.sesi === sesi && item.status !== "Dibatalkan") {
                    const box = document.getElementById(`saung-${item.saung}`);
                    if (box) {
                        box.className = "saung-box booked";
                        box.innerText = `Saung ${item.saung}\n(Terisi)`;
                    }
                }
            });
        })
        .catch(err => console.log("Gagal memuat data saung:", err));
}

function handleBookingSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    btn.innerText = "Sedang Memproses...";
    btn.disabled = true;

    const payload = {
        namaOrtu: document.getElementById("namaOrtu").value,
        namaSantri: document.getElementById("namaSantri").value,
        kelas: document.getElementById("kelas").value,
        noHp: document.getElementById("noHp").value,
        tanggal: document.getElementById("tanggal").value,
        sesi: document.getElementById("sesi").value,
        saung: document.getElementById("selectedSaung").value
    };

    if (!payload.saung) {
        alert("Silakan pilih salah satu nomor saung terlebih dahulu pada denah!");
        btn.innerText = "Konfirmasi Booking Saung";
        btn.disabled = false;
        return;
    }

    // Menggunakan mode 'no-cors' agar request sukses terkirim ke Google Apps Script tanpa terblokir browser
    fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert("Alhamdulillah, Booking Saung Berhasil! Data Anda telah tercatat di Spreadsheet.");
        document.getElementById("bookingForm").reset();
        chosenSaung = null;
        fetchBookedData();
        btn.innerText = "Konfirmasi Booking Saung";
        btn.disabled = false;
    })
    .catch(err => {
        alert("Terjadi kendala jaringan, namun data biasanya tetap terkirim. Silakan cek spreadsheet.");
        btn.innerText = "Konfirmasi Booking Saung";
        btn.disabled = false;
    });
}

function loadAdminData() {
    const tbody = document.getElementById("adminTableBody");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat data...</td></tr>`;

    fetch(SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = "";
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada data booking.</td></tr>`;
                return;
            }
            data.forEach(item => {
                const tr = document.createElement("tr");
                const tanggalBooking = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "-";
                tr.innerHTML = `
                    <td>${tanggalBooking}</td>
                    <td>${item.namaOrtu}</td>
                    <td>${item.namaSantri} <br><small>Kelas: ${item.kelas}</small></td>
                    <td><b>Saung ${item.saung}</b></td>
                    <td>${item.tanggal}<br><small>${item.sesi}</small></td>
                    <td>${item.noHp}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data admin.</td></tr>`;
        });
}