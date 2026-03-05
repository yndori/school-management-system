import { handleLogout } from "./auth.js";
const API_BASE = "/api";

// Tab switching
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

function switchTab(tabId) {
  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  tabPanels.forEach((p) => p.classList.toggle("active", p.id === tabId));
  if (tabId === "tab-schedule-admin") buildScheduleGrid();
}

tabBtns.forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)),
);

// Logout
document.getElementById("logout-btn")?.addEventListener("click", handleLogout);

// ── Modal helpers ──
function openModal(modal) {
  modal.classList.add("open");
}
function closeModal(modal) {
  modal.classList.remove("open");
}

document.querySelectorAll(".modal-overlay .close-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal-overlay");
    if (modal) closeModal(modal);
  });
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ── Courses & assignments ──
const coursesTbody = document.getElementById("courses-tbody");
const gradesTbody = document.getElementById("grades-tbody");
let coursesCache = [];

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return await res.json();
}

async function loadCoursesForTables() {
  if (!coursesTbody) return;
  coursesTbody.innerHTML =
    '<tr><td colspan="6" class="empty-msg">Loading…</td></tr>';
  try {
    const courses = await fetchJSON(`${API_BASE}/courses`);
    coursesCache = courses;
    if (!courses.length) {
      coursesTbody.innerHTML =
        '<tr><td colspan="6" class="empty-msg">No courses found.</td></tr>';
      return;
    }
    coursesTbody.innerHTML = "";
    courses.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.code}</td>
        <td>${c.name}</td>
        <td>${c.credits}</td>
        <td>${c.instructor || ""}</td>
        <td>${c.major_name || ""}</td>
        <td>
          <button class="action-btn edit-btn" data-course-id="${c.id}">Assignments</button>
        </td>
      `;
      coursesTbody.appendChild(tr);
    });
  } catch (err) {
    coursesTbody.innerHTML =
      '<tr><td colspan="6" class="empty-msg">Failed to load courses.</td></tr>';
    console.error(err);
  }
}

// ── Admin announcements ──
const announcementForm = document.getElementById("announcement-form");
const adminAnnouncementsTbody = document.getElementById(
  "admin-announcements-tbody",
);

async function loadAdminAnnouncements() {
  if (!adminAnnouncementsTbody) return;
  adminAnnouncementsTbody.innerHTML =
    '<tr><td colspan="3" class="empty-msg">Loading…</td></tr>';
  try {
    const anns = await fetchJSON(`${API_BASE}/announcements`);
    if (!anns.length) {
      adminAnnouncementsTbody.innerHTML =
        '<tr><td colspan="3" class="empty-msg">No announcements yet.</td></tr>';
      return;
    }
    adminAnnouncementsTbody.innerHTML = "";
    anns.forEach((a) => {
      const tr = document.createElement("tr");
      const created = a.created_at
        ? new Date(a.created_at).toLocaleString()
        : "";
      tr.innerHTML = `
        <td>${a.title}</td>
        <td>${a.body || ""}</td>
        <td>${created}</td>
      `;
      adminAnnouncementsTbody.appendChild(tr);
    });
  } catch (err) {
    adminAnnouncementsTbody.innerHTML =
      '<tr><td colspan="3" class="empty-msg">Failed to load announcements.</td></tr>';
    console.error(err);
  }
}

announcementForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("ann-title").value.trim();
  const body = document.getElementById("ann-body").value.trim();
  if (!title) return;
  try {
    await fetchJSON(`${API_BASE}/announcements`, {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });
    announcementForm.reset();
    await loadAdminAnnouncements();
  } catch (err) {
    console.error("Failed to post announcement", err);
  }
});

// ── Admin schedule (same grid builder as student) ──
const editScheduleBtn = document.getElementById("btn-edit-schedule");

const DAY_MAP_ADMIN = {
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
const DAY_CLS_ADMIN = ["ev-mon", "ev-tue", "ev-wed", "ev-thu", "ev-fri"];
const TIME_START_ADMIN = 8; // 08:00
const TIME_END_ADMIN = 20; // 20:00
const SLOT_MIN_ADMIN = 30; // minutes per row

function parseTimeAdmin(str) {
  if (!str) return null;
  const clean = str.trim().toUpperCase();
  const m = clean.match(/(\d{1,2}):?(\d{2})\s*(AM|PM)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function parseRangeAdmin(str) {
  if (!str) return null;
  const parts = str.split(/\s*(?:–|-|to)\s*/i);
  if (parts.length < 2) return null;
  const start = parseTimeAdmin(parts[0]);
  const end = parseTimeAdmin(parts[1]);
  if (start == null || end == null) return null;
  return { start, end };
}

function buildScheduleGrid() {
  const grid = document.getElementById("week-grid");
  const tbody = document.getElementById("schedule-body");
  if (!grid) return;

  let events = [];
  if (tbody && tbody.dataset.scheduleJson) {
    try {
      events = JSON.parse(tbody.dataset.scheduleJson);
    } catch {
      events = [];
    }
  }

  if (!events.length) {
    while (grid.children.length > 6) grid.removeChild(grid.lastChild);
    const msg = document.createElement("div");
    msg.className = "schedule-empty";
    msg.textContent = "No classes scheduled.";
    grid.appendChild(msg);
    return;
  }

  let minTime = TIME_START_ADMIN * 60;
  let maxTime = TIME_END_ADMIN * 60;
  events.forEach((ev) => {
    const r = parseRangeAdmin(ev.time);
    if (!r) return;
    minTime = Math.min(minTime, r.start);
    maxTime = Math.max(maxTime, r.end);
  });

  const slotCount = Math.ceil((maxTime - minTime) / SLOT_MIN_ADMIN);

  while (grid.children.length > 6) grid.removeChild(grid.lastChild);

  if (!slotCount) {
    const msg = document.createElement("div");
    msg.className = "schedule-empty";
    msg.textContent = "No classes scheduled.";
    grid.appendChild(msg);
    return;
  }

  const cellMap = {};
  for (let s = 0; s < slotCount; s++) {
    const totalMin = minTime + s * SLOT_MIN_ADMIN;
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

  events.forEach((ev) => {
    const dayKey = ev.day?.trim().toLowerCase();
    const dayIdx = DAY_MAP_ADMIN[dayKey];
    if (dayIdx === undefined) return;
    const range = parseRangeAdmin(ev.time);
    if (!range) return;

    const startSlot = Math.round((range.start - minTime) / SLOT_MIN_ADMIN);
    const spanSlots = Math.max(
      1,
      Math.round((range.end - range.start) / SLOT_MIN_ADMIN),
    );
    if (startSlot < 0 || startSlot >= slotCount) return;

    const anchorCell = cellMap[`${dayIdx}-${startSlot}`];
    if (!anchorCell) return;

    anchorCell.style.position = "relative";

    const block = document.createElement("div");
    block.className = `wg-event ${DAY_CLS_ADMIN[dayIdx]}`;
    const cellH = 60;
    block.style.height = `calc(${spanSlots * cellH}px - 6px)`;
    block.style.zIndex = "1";
    block.innerHTML = `
      <span class="ev-code">${ev.code || ""}</span>
      <span class="ev-name">${ev.name}</span>
      <span class="ev-room">${[ev.room, ev.instructor]
        .filter(Boolean)
        .join(" · ")}</span>
    `;
    anchorCell.appendChild(block);

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

async function loadScheduleAdmin() {
  const tbody = document.getElementById("schedule-body");
  if (!tbody) return;
  try {
    const rows = await fetchJSON(`${API_BASE}/schedule`);
    const events = rows.map((r) => ({
      day: r.day,
      code: r.course_code,
      name: r.course_name,
      time: `${r.time_start} – ${r.time_end}`,
      room: r.room || "",
      instructor: r.instructor || "",
    }));
    tbody.dataset.scheduleJson = JSON.stringify(events);
    if (
      document
        .getElementById("tab-schedule-admin")
        ?.classList.contains("active")
    )
      buildScheduleGrid();
  } catch (err) {
    console.error("Failed to load admin schedule", err);
  }
}

async function loadGradesTable() {
  if (!gradesTbody) return;
  gradesTbody.innerHTML =
    '<tr><td colspan="8" class="empty-msg">Loading…</td></tr>';
  try {
    const rows = await fetchJSON(`${API_BASE}/grades`);
    if (!rows.length) {
      gradesTbody.innerHTML =
        '<tr><td colspan="8" class="empty-msg">No enrollments found.</td></tr>';
      return;
    }
    gradesTbody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.student_number || ""}</td>
        <td>${row.student_name || ""}</td>
        <td>${row.course_code || ""}</td>
        <td>${row.course_name || ""}</td>
        <td>${row.assignment_name || ""}</td>
        <td>${row.semester || ""} ${row.year || ""}</td>
        <td>${row.grade_value != null ? row.grade_value : "—"}</td>
        <td>
          <button
            class="action-btn edit-btn btn-open-grade"
            data-enrollment-id="${row.enrollment_id}"
            data-course-id="${row.course_id}"
            data-student-name="${row.student_name || ""}"
            data-course-name="${row.course_name || ""}"
          >
            Assign grade
          </button>
        </td>
      `;
      gradesTbody.appendChild(tr);
    });
  } catch (err) {
    gradesTbody.innerHTML =
      '<tr><td colspan="8" class="empty-msg">Failed to load grades.</td></tr>';
    console.error(err);
  }
}

// ── Assignment modal ──
const assignmentModal = document.getElementById("modal-assignment");
const assignmentForm = document.getElementById("assignment-form");
const aCourseSelect = document.getElementById("a-course");

document
  .getElementById("btn-add-assignment")
  ?.addEventListener("click", async () => {
    if (!assignmentModal || !aCourseSelect) return;
    try {
      const courses = await fetchJSON(`${API_BASE}/courses`);
      aCourseSelect.innerHTML = '<option value="">Select course…</option>';
      courses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.code} – ${c.name}`;
        aCourseSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load courses for assignment modal", err);
    }
    assignmentForm?.reset();
    openModal(assignmentModal);
  });

assignmentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const courseId = Number(aCourseSelect.value);
  const name = document.getElementById("a-name").value.trim();
  const weight = Number(document.getElementById("a-weight").value);
  const description = document.getElementById("a-description").value.trim();
  if (!courseId || !name) return;
  try {
    await fetchJSON(`${API_BASE}/assignments`, {
      method: "POST",
      body: JSON.stringify({ courseId, name, description, weight }),
    });
    closeModal(assignmentModal);
    await loadGradesTable();
  } catch (err) {
    console.error("Failed to save assignment", err);
  }
});

// ── Grade modal ──
const gradeModal = document.getElementById("modal-grade");
const gradeForm = document.getElementById("grade-form");
const gEnrollmentId = document.getElementById("g-enrollment-id");
const gCourseId = document.getElementById("g-course-id");
const gStudentName = document.getElementById("g-student-name");
const gCourseName = document.getElementById("g-course-name");
const gAssignmentSelect = document.getElementById("g-assignment");

async function openGradeModalFromButton(btn) {
  const enrollmentId = btn.dataset.enrollmentId;
  const courseId = btn.dataset.courseId;
  const studentName = btn.dataset.studentName || "";
  const courseName = btn.dataset.courseName || "";
  if (!enrollmentId || !courseId) return;

  gEnrollmentId.value = enrollmentId;
  gCourseId.value = courseId;
  gStudentName.textContent = studentName;
  gCourseName.textContent = courseName;

  // Load assignments for this course
  gAssignmentSelect.innerHTML = '<option value="">Select assignment…</option>';
  try {
    const assignments = await fetchJSON(
      `${API_BASE}/courses/${courseId}/assignments`,
    );
    assignments.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.name} (${a.weight}%)`;
      gAssignmentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load assignments for course", err);
  }

  openModal(gradeModal);
}

gradesTbody?.addEventListener("click", (e) => {
  const target = e.target;
  if (
    target instanceof HTMLElement &&
    target.classList.contains("btn-open-grade")
  ) {
    openGradeModalFromButton(target);
  }
});

gradeForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const enrollmentId = Number(gEnrollmentId.value);
  const assignmentId = Number(gAssignmentSelect.value);
  const grade = Number(document.getElementById("g-grade").value);
  if (!enrollmentId || !assignmentId) return;
  try {
    await fetchJSON(`${API_BASE}/grades`, {
      method: "POST",
      body: JSON.stringify({ enrollmentId, assignmentId, grade }),
    });
    closeModal(gradeModal);
    await loadGradesTable();
  } catch (err) {
    console.error("Failed to save grade", err);
  }
});

// Simple hook for future schedule editing
editScheduleBtn?.addEventListener("click", () => {
  // For now we just reload from the backend;
  // you can extend this to open a full editor modal.
  loadScheduleAdmin();
});

// Initial loads
loadCoursesForTables();
loadGradesTable();
loadAdminAnnouncements();
loadScheduleAdmin();
