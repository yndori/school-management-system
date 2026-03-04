const API_BASE = "/api";

// Tab switching
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

function switchTab(tabId) {
  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  tabPanels.forEach((p) => p.classList.toggle("active", p.id === tabId));
  if (tabId === "tab-schedule") buildScheduleGrid();
}

tabBtns.forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)),
);

// Quick-link navigation
document.querySelectorAll(".nav-link").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(a.dataset.tab);
  });
});

// Print
document
  .getElementById("print-btn")
  ?.addEventListener("click", () => window.print());

// Logout
document.getElementById("logout-btn")?.addEventListener("click", () => {
  if (typeof signOut === "function") signOut();
  else {
    localStorage.clear();
    window.location.href = "../index.html";
  }
});

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return await res.json();
}

// ── Transcript + dashboard summary using weighted grades ──
async function loadStudentOverview() {
  const studentId = Number(localStorage.getItem("studentId"));
  if (!studentId) return;

  try {
    const data = await fetchJSON(
      `${API_BASE}/students/${studentId}/transcript`,
    );

    const gpaEl = document.getElementById("gpa");
    const totalCreditsEl = document.getElementById("total-credits");
    const courseCountEl = document.getElementById("course-count");
    const tGpaEl = document.getElementById("transcript-gpa");
    const tCreditsEl = document.getElementById("transcript-credits");
    const tbody = document.getElementById("transcript-body");

    if (gpaEl && data.gpa != null) gpaEl.textContent = data.gpa.toFixed(2);
    if (totalCreditsEl) totalCreditsEl.textContent = data.totalCredits || 0;
    if (courseCountEl) courseCountEl.textContent = data.courses.length || 0;
    if (tGpaEl && data.gpa != null) tGpaEl.textContent = data.gpa.toFixed(2);
    if (tCreditsEl) tCreditsEl.textContent = data.totalCredits || 0;

    if (tbody) {
      if (!data.courses.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-msg">No transcript data.</td></tr>';
      } else {
        tbody.innerHTML = "";
        data.courses.forEach((c) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${c.code}</td>
            <td>${c.name}</td>
            <td>${c.credits}</td>
            <td>${c.semester} ${c.year}</td>
            <td>
              ${
                c.numericGrade != null
                  ? `${c.numericGrade.toFixed(2)} (${c.letterGrade})`
                  : "-"
              }
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error("Failed to load transcript", err);
  }
}

// ── Announcements for students ──
async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;
  container.innerHTML =
    '<div class="announcement-card"><h4>Loading announcements…</h4></div>';
  try {
    const anns = await fetchJSON(`${API_BASE}/announcements`);
    if (!anns.length) {
      container.innerHTML =
        '<div class="announcement-card"><h4>No announcements at this time.</h4></div>';
      return;
    }
    container.innerHTML = "";
    anns.forEach((a) => {
      const div = document.createElement("div");
      div.className = "announcement-card";
      const created = a.created_at
        ? new Date(a.created_at).toLocaleDateString()
        : "";
      div.innerHTML = `
        <h4>${a.title}</h4>
        <p>${a.body || ""}</p>
        ${created ? `<p class="announcement-date">${created}</p>` : ""}
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load announcements", err);
  }
}

// ── Weekly Schedule Grid Builder ──
// Reads events from #schedule-body.dataset.scheduleJson populated by API calls.

const DAY_MAP = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
};
const DAY_CLS = ["ev-mon", "ev-tue", "ev-wed", "ev-thu", "ev-fri"];
const TIME_START = 8; // 08:00
const TIME_END = 20; // 20:00
const SLOT_MIN = 30; // minutes per row

function parseTime(str) {
  // accepts "09:30", "9:30 AM", "9:30AM", "930"
  if (!str) return null;
  const clean = str.trim().toUpperCase();
  const m = clean.match(/(\d{1,2}):?(\d{2})\s*(AM|PM)?/);
  if (!m) return null;
  let h = parseInt(m[1]),
    min = parseInt(m[2]);
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function parseRange(str) {
  if (!str) return null;
  // "09:00 – 10:30", "9:00-10:30", "9:00 to 10:30"
  const parts = str.split(/\s*(?:–|-|to)\s*/i);
  if (parts.length < 2) return null;
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (start == null || end == null) return null;
  return { start, end };
}

function buildScheduleGrid() {
  const grid = document.getElementById("week-grid");
  const tbody = document.getElementById("schedule-body");
  if (!grid) return;

  // Collect events from JSON attribute
  let events = [];
  if (tbody && tbody.dataset.scheduleJson) {
    try {
      events = JSON.parse(tbody.dataset.scheduleJson);
    } catch (e) {
      events = [];
    }
  }

  if (!events.length) {
    const msg = document.createElement("div");
    msg.className = "schedule-empty";
    msg.textContent = "No classes scheduled.";
    // Remove old rows and append message
    while (grid.children.length > 6) grid.removeChild(grid.lastChild);
    grid.appendChild(msg);
    return;
  }

  // Determine visible time range
  let minTime = TIME_START * 60,
    maxTime = TIME_END * 60;
  events.forEach((ev) => {
    const r = parseRange(ev.time);
    if (!r) return;
    minTime = Math.min(minTime, r.start);
    maxTime = Math.max(maxTime, r.end);
  });
  // Round to slot boundaries
  const slotCount = Math.ceil((maxTime - minTime) / SLOT_MIN);

  // Build time-slot label & 5 cells for each slot
  // Remove old slot rows (keep first 6 header cells)
  while (grid.children.length > 6) grid.removeChild(grid.lastChild);

  if (!slotCount) {
    const msg = document.createElement("div");
    msg.className = "schedule-empty";
    msg.textContent = "No classes scheduled.";
    grid.appendChild(msg);
    return;
  }

  // Create slot rows
  const cellMap = {}; // "dayIndex-slotIndex" → cell element
  for (let s = 0; s < slotCount; s++) {
    const totalMin = minTime + s * SLOT_MIN;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const timeCell = document.createElement("div");
    timeCell.className = "wg-time-label";
    timeCell.textContent = label;
    grid.appendChild(timeCell);

    for (let d = 0; d < 5; d++) {
      const cell = document.createElement("div");
      cell.className = "wg-cell";
      grid.appendChild(cell);
      cellMap[`${d}-${s}`] = cell;
    }
  }

  // Place events
  events.forEach((ev) => {
    const dayKey = ev.day?.trim().toLowerCase();
    const dayIdx = DAY_MAP[dayKey];
    if (dayIdx === undefined) return;
    const range = parseRange(ev.time);
    if (!range) return;

    const startSlot = Math.round((range.start - minTime) / SLOT_MIN);
    const spanSlots = Math.max(
      1,
      Math.round((range.end - range.start) / SLOT_MIN),
    );
    if (startSlot < 0 || startSlot >= slotCount) return;

    const anchorCell = cellMap[`${dayIdx}-${startSlot}`];
    if (!anchorCell) return;

    // Make anchor cell relative-positioned with correct height
    anchorCell.style.position = "relative";

    const block = document.createElement("div");
    block.className = `wg-event ${DAY_CLS[dayIdx]}`;
    // span multiple slots using absolute height
    const cellH = 60; // px, matches min-height
    block.style.height = `calc(${spanSlots * cellH}px - 6px)`;
    block.style.zIndex = "1";

    block.innerHTML = `
            <span class="ev-code">${ev.code || ""}</span>
            <span class="ev-name">${ev.name}</span>
            <span class="ev-room">${[ev.room, ev.instructor].filter(Boolean).join(" · ")}</span>
          `;
    anchorCell.appendChild(block);

    // Mark spanned cells so they don't show hover bg awkwardly
    for (
      let s2 = startSlot + 1;
      s2 < startSlot + spanSlots && s2 < slotCount;
      s2++
    ) {
      const span = cellMap[`${dayIdx}-${s2}`];
      if (span) span.style.borderTop = "none";
    }
  });
}

// Load schedule from API and build grid
async function loadStudentSchedule() {
  const studentId = Number(localStorage.getItem("studentId"));
  if (!studentId) return;
  const tbody = document.getElementById("schedule-body");
  if (!tbody) return;
  try {
    const rows = await fetchJSON(
      `${API_BASE}/students/${studentId}/schedule`,
    );
    const events = rows.map((r) => ({
      day: r.day,
      code: r.course_code,
      name: r.course_name,
      time: `${r.time_start} – ${r.time_end}`,
      room: r.room || "",
      instructor: r.instructor || "",
    }));
    tbody.dataset.scheduleJson = JSON.stringify(events);
    if (document.getElementById("tab-schedule")?.classList.contains("active"))
      buildScheduleGrid();
  } catch (err) {
    console.error("Failed to load student schedule", err);
  }
}

// Initial data load
loadStudentOverview();
loadAnnouncements();
loadStudentSchedule();
