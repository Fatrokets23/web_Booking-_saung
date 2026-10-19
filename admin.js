document.addEventListener("DOMContentLoaded", () => {
    // =========================================
    // KONFIGURASI API
    // =========================================

    const SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbwK9XQr155xNGdDDmry7TegcfuAYC4tYxSMDLeYcya1Kk0DEiR5IAR2flaVbS2sFoRh/exec";

    const STATUS_PENDING = "Menunggu Konfirmasi";
    const STATUS_CONFIRMED = "Dikonfirmasi";
    const STATUS_CANCELLED = "Dibatalkan";

    let bookings = [];
    let adminToken = sessionStorage.getItem("adminToken") || "";
    let isLoading = false;

    // =========================================
    // ELEMEN HTML
    // =========================================

    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");

    const searchInput = document.getElementById("searchBooking");
    const filterStatus = document.getElementById("filterStatus");
    const refreshBtn = document.getElementById("refreshBtn");

    // =========================================
    // SIDEBAR
    // =========================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
        item.addEventListener("click", () => {
            sidebar?.classList.remove("open");
        });
    });

    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            if (item.getAttribute("href")?.startsWith("#")) {
                document.querySelectorAll(".nav-item").forEach(nav => {
                    nav.classList.remove("active");
                });

                item.classList.add("active");
            }
        });
    });

    // =========================================
    // NOTIFIKASI
    // =========================================

    function notify(message) {
        alert(message);
    }

    // =========================================
    // NORMALISASI STATUS
    // =========================================

    function normalizeStatus(status) {
        const value = String(status || "").trim().toLowerCase();

        if (value === "confirmed" || value === "dikonfirmasi") {
            return STATUS_CONFIRMED;
        }

        if (value === "cancelled" || value === "dibatalkan") {
            return STATUS_CANCELLED;
        }

        return STATUS_PENDING;
    }

    // =========================================
    // ESCAPE HTML
    // =========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    // =========================================
    // REQUEST POST KE APPS SCRIPT
    // =========================================

    async function postData(data) {
        const body = new URLSearchParams();

        Object.entries(data).forEach(([key, value]) => {
            body.append(key, String(value ?? ""));
        });

        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: body
        });

        if (!response.ok) {
            throw new Error(
                "Server memberikan HTTP " + response.status
            );
        }

        const result = await response.json();

        return result;
    }

    // =========================================
    // LOGIN ADMIN
    // =========================================

    function createLoginScreen() {
        let overlay = document.getElementById("adminLoginOverlay");

        if (overlay) {
            return overlay;
        }

        overlay = document.createElement("div");
        overlay.id = "adminLoginOverlay";

        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            zIndex: "99999",
            background: "#f0fdf4",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px"
        });

        overlay.innerHTML = `
            <form id="adminLoginForm" style="
                width:100%;
                max-width:400px;
                background:white;
                padding:32px;
                border-radius:16px;
                box-shadow:0 10px 35px rgba(0,0,0,.12);
                font-family:Arial,sans-serif;
            ">
                <h2 style="margin-top:0;color:#166534">
                    Login Admin
                </h2>

                <p style="color:#64748b">
                    Masuk untuk mengelola booking saung.
                </p>

                <label for="adminUsername">Username</label>

                <input
                    id="adminUsername"
                    type="text"
                    autocomplete="username"
                    required
                    style="
                        box-sizing:border-box;
                        width:100%;
                        padding:12px;
                        margin:8px 0 18px;
                        border:1px solid #cbd5e1;
                        border-radius:8px;
                    "
                >

                <label for="adminPassword">Password</label>

                <input
                    id="adminPassword"
                    type="password"
                    autocomplete="current-password"
                    required
                    style="
                        box-sizing:border-box;
                        width:100%;
                        padding:12px;
                        margin:8px 0 18px;
                        border:1px solid #cbd5e1;
                        border-radius:8px;
                    "
                >

                <button
                    type="submit"
                    id="adminLoginButton"
                    style="
                        width:100%;
                        padding:12px;
                        border:0;
                        border-radius:8px;
                        background:#15803d;
                        color:white;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    Masuk
                </button>

                <p
                    id="adminLoginMessage"
                    role="status"
                    style="color:#dc2626;font-size:14px"
                ></p>
            </form>
        `;

        document.body.appendChild(overlay);

        document.getElementById("adminLoginForm")
            .addEventListener("submit", handleLogin);

        return overlay;
    }

    async function handleLogin(event) {
        event.preventDefault();

        const username =
            document.getElementById("adminUsername").value.trim();

        const password =
            document.getElementById("adminPassword").value;

        const button =
            document.getElementById("adminLoginButton");

        const message =
            document.getElementById("adminLoginMessage");

        button.disabled = true;
        button.textContent = "Memeriksa...";
        message.textContent = "";

        try {
            const result = await postData({
                action: "login",
                username: username,
                password: password
            });

            if (result.result !== "success" || !result.token) {
                throw new Error(result.message || "Login gagal.");
            }

            adminToken = result.token;

            sessionStorage.setItem("adminToken", adminToken);

            document.getElementById("adminLoginOverlay").remove();

            await loadBookings();

        } catch (error) {
            message.textContent =
                error.message || "Gagal menghubungi server.";

        } finally {
            button.disabled = false;
            button.textContent = "Masuk";
        }
    }

    // =========================================
    // MUAT DATA BOOKING
    // =========================================

    async function loadBookings() {
        if (!adminToken) {
            createLoginScreen();
            return;
        }

        if (isLoading) {
            return;
        }

        isLoading = true;

        if (refreshBtn) {
            refreshBtn.disabled = true;
        }

        try {
            const url = new URL(SCRIPT_URL);

            url.searchParams.set("action", "adminList");
            url.searchParams.set("token", adminToken);

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(
                    "Gagal mengambil data. HTTP " + response.status
                );
            }

            const result = await response.json();

            if (result.result === "error") {
                if (/sesi admin|token|login/i.test(result.message || "")) {
                    adminToken = "";

                    sessionStorage.removeItem("adminToken");

                    createLoginScreen();

                    notify(
                        "Sesi admin berakhir. Silakan login kembali."
                    );

                    return;
                }

                throw new Error(
                    result.message || "Gagal mengambil data booking."
                );
            }

            if (
                result.result !== "success" ||
                !Array.isArray(result.data)
            ) {
                throw new Error("Format data API tidak sesuai.");
            }

            bookings = result.data.map(item => ({
                ...item,
                rowNumber: Number(item.rowNumber),
                status: normalizeStatus(item.status)
            }));

            renderBookings();
            updateStatistics();

        } catch (error) {
            console.error("Gagal memuat booking:", error);

            notify(
                "Data booking gagal dimuat.\n\n" + error.message
            );

        } finally {
            isLoading = false;

            if (refreshBtn) {
                refreshBtn.disabled = false;
            }
        }
    }

    // =========================================
    // CARI TABEL
    // =========================================

    function getTableBody() {
        let tbody =
            document.getElementById("bookingTableBody") ||
            document.querySelector("#bookingTable tbody") ||
            document.querySelector("table tbody");

        if (!tbody) {
            const table =
                document.getElementById("bookingTable") ||
                document.querySelector("table");

            if (table) {
                tbody = document.createElement("tbody");
                tbody.id = "bookingTableBody";

                table.appendChild(tbody);
            }
        }

        return tbody;
    }

    // =========================================
    // TAMPILKAN DATA BOOKING
    // =========================================

    function renderBookings() {
        const tbody = getTableBody();

        if (!tbody) {
            console.error("Tabel booking tidak ditemukan.");
            return;
        }

        const keyword = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const selectedStatus = filterStatus
            ? filterStatus.value
            : "";

        const filtered = bookings.filter(booking => {
            const matchesKeyword = [
                booking.namaOrtu,
                booking.namaSantri,
                booking.kelas,
                booking.saung,
                booking.noHp
            ].some(value =>
                String(value || "").toLowerCase().includes(keyword)
            );

            const matchesStatus =
                !selectedStatus ||
                selectedStatus === "all" ||
                normalizeStatus(selectedStatus) === booking.status;

            return matchesKeyword && matchesStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10"
                        style="text-align:center;padding:24px">
                        Tidak ada booking yang cocok.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = filtered.map(booking => {
            const status = booking.status;

            let statusColor = "#92400e";
            let statusBackground = "#fef3c7";

            if (status === STATUS_CONFIRMED) {
                statusColor = "#166534";
                statusBackground = "#dcfce7";
            } else if (status === STATUS_CANCELLED) {
                statusColor = "#991b1b";
                statusBackground = "#fee2e2";
            }

            let actions = "";

            if (status === STATUS_PENDING) {
                actions = `
                    <button
                        type="button"
                        data-action="confirm"
                        data-row="${booking.rowNumber}"
                        style="
                            padding:7px 10px;
                            margin:2px;
                            border:0;
                            border-radius:6px;
                            background:#15803d;
                            color:white;
                            cursor:pointer;
                        "
                    >
                        Konfirmasi
                    </button>

                    <button
                        type="button"
                        data-action="cancel"
                        data-row="${booking.rowNumber}"
                        style="
                            padding:7px 10px;
                            margin:2px;
                            border:0;
                            border-radius:6px;
                            background:#dc2626;
                            color:white;
                            cursor:pointer;
                        "
                    >
                        Batalkan
                    </button>
                `;
            } else if (status === STATUS_CONFIRMED) {
                actions = `
                    <button
                        type="button"
                        data-action="cancel"
                        data-row="${booking.rowNumber}"
                        style="
                            padding:7px 10px;
                            margin:2px;
                            border:0;
                            border-radius:6px;
                            background:#dc2626;
                            color:white;
                            cursor:pointer;
                        "
                    >
                        Batalkan
                    </button>
                `;
            } else {
                actions = `
                    <span style="color:#64748b">
                        Booking dibatalkan
                    </span>
                `;
            }

            actions += `
                <button
                    type="button"
                    data-action="delete"
                    data-row="${booking.rowNumber}"
                    style="
                        padding:7px 10px;
                        margin:2px;
                        border:0;
                        border-radius:6px;
                        background:#475569;
                        color:white;
                        cursor:pointer;
                    "
                >
                    Hapus
                </button>
            `;

            return `
                <tr>
                    <td>${escapeHTML(booking.timestamp)}</td>
                    <td>${escapeHTML(booking.namaOrtu)}</td>
                    <td>${escapeHTML(booking.namaSantri)}</td>
                    <td>${escapeHTML(booking.kelas)}</td>
                    <td>${escapeHTML(booking.saung)}</td>
                    <td>${escapeHTML(booking.tanggal)}</td>
                    <td>${escapeHTML(booking.sesi)}</td>
                    <td>${escapeHTML(booking.noHp)}</td>

                    <td>
                        <span style="
                            display:inline-block;
                            padding:5px 9px;
                            border-radius:6px;
                            background:${statusBackground};
                            color:${statusColor};
                            white-space:nowrap;
                        ">
                            ${escapeHTML(status)}
                        </span>
                    </td>

                    <td>${actions}</td>
                </tr>
            `;
        }).join("");
    }

    // =========================================
    // UBAH STATUS DAN HAPUS BOOKING
    // =========================================

    document.addEventListener("click", async event => {
        const button = event.target.closest(
            "button[data-action][data-row]"
        );

        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const rowNumber = Number(button.dataset.row);

        const booking = bookings.find(item =>
            Number(item.rowNumber) === rowNumber
        );

        if (!booking) {
            notify(
                "Data booking tidak ditemukan. Muat ulang daftar booking."
            );

            return;
        }

        if (!Number.isInteger(rowNumber) || rowNumber < 2) {
            notify("Nomor baris booking tidak valid.");
            return;
        }

        let requestData;
        let confirmationMessage;

        // KONFIRMASI BOOKING
        if (action === "confirm") {
            if (booking.status !== STATUS_PENDING) {
                notify("Hanya booking yang menunggu konfirmasi yang dapat dikonfirmasi.");
                return;
            }

            confirmationMessage =
                "Konfirmasi booking saung " +
                booking.saung +
                " atas nama santri " +
                booking.namaSantri +
                "?";

            requestData = {
                action: "updateStatus",
                token: adminToken,
                rowNumber: rowNumber,
                status: STATUS_CONFIRMED
            };
        }

        // BATALKAN BOOKING
        else if (action === "cancel") {
            if (booking.status === STATUS_CANCELLED) {
                notify("Booking ini sudah dibatalkan.");
                return;
            }

            confirmationMessage =
                "Batalkan booking atas nama " +
                booking.namaSantri +
                "?";

            requestData = {
                action: "updateStatus",
                token: adminToken,
                rowNumber: rowNumber,
                status: STATUS_CANCELLED
            };
        }

        // HAPUS BOOKING
        else if (action === "delete") {
            confirmationMessage =
                "Yakin ingin menghapus booking atas nama " +
                booking.namaSantri +
                "?\n\nData yang dihapus tidak dapat dikembalikan.";

            requestData = {
                action: "deleteBooking",
                token: adminToken,
                rowNumber: rowNumber
            };
        }

        else {
            return;
        }

        if (!confirm(confirmationMessage)) {
            return;
        }

        button.disabled = true;

        const originalText = button.textContent;
        button.textContent = "Memproses...";

        try {
            const result = await postData(requestData);

            if (result.result !== "success") {
                throw new Error(
                    result.message || "Permintaan gagal diproses."
                );
            }

            notify(
                result.message ||
                "Perubahan booking berhasil disimpan."
            );

            await loadBookings();

        } catch (error) {
            console.error("Gagal memproses booking:", error);

            notify(
                "Gagal memproses booking.\n\n" +
                error.message +
                "\n\nPeriksa Apps Script dan koneksi internet."
            );

            button.disabled = false;
            button.textContent = originalText;
        }
    });

    // =========================================
    // STATISTIK DASHBOARD
    // =========================================

    function updateStatistics() {
        const total = bookings.length;

        const pending = bookings.filter(item =>
            item.status === STATUS_PENDING
        ).length;

        const confirmed = bookings.filter(item =>
            item.status === STATUS_CONFIRMED
        ).length;

        const cancelled = bookings.filter(item =>
            item.status === STATUS_CANCELLED
        ).length;

        const totalElement =
            document.getElementById("totalBooking");

        const pendingElement =
            document.getElementById("pendingBooking");

        const confirmedElement =
            document.getElementById("confirmedBooking");

        const cancelledElement =
            document.getElementById("cancelledBooking");

        if (totalElement) {
            totalElement.textContent = total;
        }

        if (pendingElement) {
            pendingElement.textContent = pending;
        }

        if (confirmedElement) {
            confirmedElement.textContent = confirmed;
        }

        if (cancelledElement) {
            cancelledElement.textContent = cancelled;
        }
    }

    // =========================================
    // EVENT PENCARIAN DAN FILTER
    // =========================================

    if (searchInput) {
        searchInput.addEventListener("input", renderBookings);
    }

    if (filterStatus) {
        filterStatus.addEventListener("change", renderBookings);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadBookings);
    }

    // =========================================
    // MULAI APLIKASI
    // =========================================

    if (adminToken) {
        loadBookings();
    } else {
        createLoginScreen();
    }
});