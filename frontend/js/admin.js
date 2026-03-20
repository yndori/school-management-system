import { handleLogout } from "./auth.js";
import { getApiBase } from "./api.js";
const API_BASE = getApiBase();

// Check admin access
if (localStorage.getItem("role") !== "admin") {
  window.location.href = "login.html";
}

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
const totalStudentsEl = document.getElementById("total-students");
const totalCoursesEl = document.getElementById("total-courses");
let coursesCache = [];
const courseById = new Map();

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

function getAcademicInfoUTC() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11

  let term = "Fall";
  if (month <= 3) {
    term = "Winter";
  } else if (month <= 5) {
    term = "Spring";
  } else if (month <= 7) {
    term = "Summer";
  }

  const academicYearStart = month >= 8 ? year : year - 1;
  const academicYearLabel = `Academic Year ${academicYearStart} - ${
    academicYearStart + 1
  }`;
  const termLabel = `${term} ${year}`;

  return { academicYearLabel, termLabel };
}

function updateAcademicLabels() {
  const { academicYearLabel, termLabel } = getAcademicInfoUTC();
  document.querySelectorAll("[data-academic-year]").forEach((el) => {
    el.textContent = academicYearLabel;
  });
  document.querySelectorAll("[data-academic-term]").forEach((el) => {
    el.textContent = termLabel;
  });
}

document.addEventListener("DOMContentLoaded", updateAcademicLabels);

function parseMajors(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function readCheckedMajors(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value);
}

function setCheckedMajors(container, majors) {
  if (!container) return;
  const selected = new Set(majors || []);
  container.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

async function loadCoursesForTables() {
  if (!coursesTbody) return;
  coursesTbody.innerHTML =
    '<tr><td colspan="6" class="empty-msg">Loading…</td></tr>';
  try {
    const courses = await fetchJSON(`${API_BASE}/courses`);
    coursesCache = Array.isArray(courses) ? courses : [];
    courseById.clear();
    coursesCache.forEach((course) => {
      courseById.set(String(course.id), course);
    });
    if (totalCoursesEl) totalCoursesEl.textContent = courses.length || 0;
    if (!courses.length) {
      coursesTbody.innerHTML =
        '<tr><td colspan="6" class="empty-msg">No courses found.</td></tr>';
      return;
    }
    coursesTbody.innerHTML = "";
    courses.forEach((c) => {
      const majorsList = parseMajors(c.majors);
      const majorsLabel = majorsList.length ? majorsList.join(", ") : "—";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.code}</td>
        <td>${c.name}</td>
        <td>${c.credits}</td>
        <td>${c.instructor || ""}</td>
        <td>${majorsLabel}</td>
        <td>
          <button class="action-btn edit-btn btn-course-assignments" data-course-id="${c.id}">Assignments</button>
          <button class="action-btn edit-btn btn-edit-course" data-course-id="${c.id}">Edit</button>
          <button class="action-btn del-btn btn-delete-course" data-course-id="${c.id}">Delete</button>
        </td>
      `;
      const assignmentsBtn = tr.querySelector(".btn-course-assignments");
      assignmentsBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        openAssignmentsForCourse(c.id);
      });
      coursesTbody.appendChild(tr);
    });
  } catch (err) {
    if (totalCoursesEl) totalCoursesEl.textContent = 0;
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
    '<tr><td colspan="4" class="empty-msg">Loading…</td></tr>';
  try {
    const anns = await fetchJSON(`${API_BASE}/announcements`);
    if (!anns.length) {
      adminAnnouncementsTbody.innerHTML =
        '<tr><td colspan="4" class="empty-msg">No announcements yet.</td></tr>';
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
        <td>
          <button class="action-btn del-btn btn-delete-announcement" data-id="${a.id}">Delete</button>
        </td>
      `;
      adminAnnouncementsTbody.appendChild(tr);
    });
  } catch (err) {
    adminAnnouncementsTbody.innerHTML =
      '<tr><td colspan="4" class="empty-msg">Failed to load announcements.</td></tr>';
    console.error(err);
  }
}

announcementForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titleEl = document.getElementById("ann-title");
  const bodyEl = document.getElementById("ann-body");
  const title = titleEl?.value?.trim() || "";
  const body = bodyEl?.value?.trim() || "";
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
    alert("Failed to post announcement: " + err.message);
  }
});

adminAnnouncementsTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-delete-announcement");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (!confirm("Delete this announcement?")) return;
  try {
    await fetchJSON(`${API_BASE}/announcements/${id}`, { method: "DELETE" });
    await loadAdminAnnouncements();
  } catch (err) {
    alert(err.message || "Failed to delete announcement");
  }
});

// ── Admin schedule (same grid builder as student) ──
const editScheduleBtn = document.getElementById("btn-edit-schedule");
const scheduleListTbody = document.getElementById("schedule-list-tbody");

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
    if (scheduleListTbody) {
      if (!rows.length) {
        scheduleListTbody.innerHTML =
          '<tr><td colspan="5" class="empty-msg">No schedule slots yet.</td></tr>';
      } else {
        scheduleListTbody.innerHTML = "";
        rows.forEach((r) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${r.course_code} – ${r.course_name}</td>
            <td>${r.day}</td>
            <td>${r.time_start} - ${r.time_end}</td>
            <td>${r.room || ""}</td>
            <td>
              <button class="action-btn edit-btn btn-edit-schedule" data-id="${r.id}" data-course-id="${r.course_id}" data-day="${r.day}" data-start="${r.time_start}" data-end="${r.time_end}" data-room="${r.room || ""}">Edit</button>
              <button class="action-btn del-btn btn-delete-schedule" data-id="${r.id}">Delete</button>
            </td>
          `;
          scheduleListTbody.appendChild(tr);
        });
      }
    }
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
const assignmentsModal = document.getElementById("modal-course-assignments");
const assignmentsTbody = document.getElementById("assignments-tbody");
const assignmentsCourseName = document.getElementById(
  "assignments-course-name",
);
const editAssignmentModal = document.getElementById("modal-edit-assignment");
const editAssignmentForm = document.getElementById("edit-assignment-form");
let currentAssignmentsCourseId = null;

document
  .getElementById("btn-add-assignment")
  ?.addEventListener("click", async () => {
    if (!assignmentModal || !aCourseSelect) return;
    await populateAssignmentCourseOptions();
    assignmentForm?.reset();
    openModal(assignmentModal);
  });

document
  .getElementById("btn-add-assignment-inline")
  ?.addEventListener("click", () => {
    if (!currentAssignmentsCourseId) return;
    assignmentForm?.reset();
    populateAssignmentCourseOptions().then(() => {
      if (aCourseSelect)
        aCourseSelect.value = String(currentAssignmentsCourseId);
    });
    openModal(assignmentModal);
  });

async function populateAssignmentCourseOptions() {
  if (!aCourseSelect) return;
  try {
    aCourseSelect.innerHTML = '<option value="">Select course…</option>';
    let list = coursesCache;
    if (!list.length) {
      list = await fetchJSON(`${API_BASE}/courses`);
    }
    list.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.code} – ${c.name}`;
      aCourseSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load courses for assignment modal", err);
  }
}

assignmentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const courseId = Number(aCourseSelect.value);
  const name = document.getElementById("a-name").value.trim();
  const weight = Number(document.getElementById("a-weight").value);
  const description = document.getElementById("a-description").value.trim();
  const maxPoints = document.getElementById("a-max")?.value;
  if (!courseId || !name) return;
  try {
    await fetchJSON(`${API_BASE}/assignments`, {
      method: "POST",
      body: JSON.stringify({ courseId, name, description, weight, maxPoints }),
    });
    closeModal(assignmentModal);
    if (currentAssignmentsCourseId === courseId) {
      await loadAssignmentsTable(courseId);
    }
    await loadGradesTable();
  } catch (err) {
    console.error("Failed to save assignment", err);
  }
});

async function loadAssignmentsTable(courseId) {
  const tbody = document.getElementById("assignments-tbody");
  if (!tbody) return;
  tbody.innerHTML =
    '<tr><td colspan="4" class="empty-msg">Loading…</td></tr>';
  try {
    const items = await fetchJSON(
      `${API_BASE}/courses/${courseId}/assignments`,
    );
    if (!items.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-msg">No assignments yet.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    items.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.name}</td>
        <td>${a.weight}</td>
        <td>${a.max_points ?? ""}</td>
        <td>
          <button class="action-btn edit-btn btn-edit-assignment" data-assignment-id="${a.id}" data-course-id="${courseId}" data-name="${a.name}" data-weight="${a.weight}" data-max="${a.max_points ?? ""}" data-description="${a.description || ""}">Edit</button>
          <button class="action-btn del-btn btn-delete-assignment" data-assignment-id="${a.id}" data-course-id="${courseId}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="empty-msg">Failed to load assignments.</td></tr>';
    console.error(err);
  }
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("#assignments-tbody button");
  if (!btn) return;

  if (btn.classList.contains("btn-edit-assignment")) {
    document.getElementById("edit-a-id").value = btn.dataset.assignmentId;
    document.getElementById("edit-a-course-id").value =
      btn.dataset.courseId || "";
    document.getElementById("edit-a-name").value = btn.dataset.name || "";
    document.getElementById("edit-a-weight").value =
      btn.dataset.weight || "";
    document.getElementById("edit-a-max").value = btn.dataset.max || "";
    document.getElementById("edit-a-description").value =
      btn.dataset.description || "";
    openModal(editAssignmentModal);
    return;
  }

  if (btn.classList.contains("btn-delete-assignment")) {
    const assignmentId = btn.dataset.assignmentId;
    const courseId = Number(btn.dataset.courseId);
    if (!assignmentId) return;
    if (!confirm("Delete this assignment?")) return;
    try {
      await fetchJSON(`${API_BASE}/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      await loadAssignmentsTable(courseId);
    } catch (err) {
      alert(err.message || "Failed to delete assignment");
    }
  }
});

editAssignmentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-a-id").value;
  const courseId = Number(document.getElementById("edit-a-course-id").value);
  const name = document.getElementById("edit-a-name").value.trim();
  const weight = document.getElementById("edit-a-weight").value;
  const maxPoints = document.getElementById("edit-a-max").value;
  const description = document.getElementById("edit-a-description").value.trim();

  try {
    await fetchJSON(`${API_BASE}/assignments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, weight, maxPoints, description }),
    });
    closeModal(editAssignmentModal);
    if (courseId) await loadAssignmentsTable(courseId);
  } catch (err) {
    alert(err.message || "Failed to update assignment");
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

// ── Student Management ──

const studentsTbody = document.getElementById("students-tbody");
const addStudentModal = document.getElementById("modal-add-student");
const addStudentForm = document.getElementById("add-student-form");
const editStudentModal = document.getElementById("modal-edit-student");
const editStudentForm = document.getElementById("edit-student-form");

async function loadStudents() {
  if (!studentsTbody) return;
  studentsTbody.innerHTML =
    '<tr><td colspan="4" class="empty-msg">Loading…</td></tr>';
  try {
    const students = await fetchJSON(`${API_BASE}/students`);
    if (totalStudentsEl) totalStudentsEl.textContent = students.length || 0;
    if (!students.length) {
      studentsTbody.innerHTML =
        '<tr><td colspan="4" class="empty-msg">No students found.</td></tr>';
      return;
    }
    studentsTbody.innerHTML = "";
    students.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.student_number || "—"}</td>
        <td>${s.name}</td>
        <td>${s.email}</td>
        <td>
          <button class="action-btn edit-btn btn-edit-student" 
            data-id="${s.id}" data-name="${s.name}" data-email="${s.email}"
            data-major="${s.major || ""}" data-semester="${s.entry_semester || ""}"
            data-year="${s.entry_year || ""}">Edit</button>
          <button class="action-btn btn-delete-student" data-id="${s.id}">Delete</button>
        </td>
      `;
      studentsTbody.appendChild(tr);
    });
  } catch (err) {
    if (totalStudentsEl) totalStudentsEl.textContent = 0;
    studentsTbody.innerHTML =
      '<tr><td colspan="4" class="empty-msg">Failed to load students.</td></tr>';
    console.error(err);
  }
}

document.getElementById("btn-add-student")?.addEventListener("click", () => {
  addStudentForm?.reset();
  openModal(addStudentModal);
});

addStudentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("s-name").value.trim();
  const email = document.getElementById("s-email").value.trim();
  const major = document.getElementById("s-major")?.value || "";
  const semester = document.getElementById("s-semester")?.value || "";
  const year = document.getElementById("s-year")?.value || "";
  const password = document.getElementById("s-password").value;

  try {
    await fetchJSON(`${API_BASE}/students`, {
      method: "POST",
      body: JSON.stringify({ name, email, password, major, semester, year }),
    });
    closeModal(addStudentModal);
    await loadStudents();
  } catch (err) {
    alert(err.message || "Failed to add student");
  }
});

studentsTbody?.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-edit-student")) {
    const btn = e.target;
    document.getElementById("edit-s-id").value = btn.dataset.id;
    document.getElementById("edit-s-name").value = btn.dataset.name;
    document.getElementById("edit-s-email").value = btn.dataset.email;
    const majorEl = document.getElementById("edit-s-major");
    const semesterEl = document.getElementById("edit-s-semester");
    const yearEl = document.getElementById("edit-s-year");
    if (majorEl) majorEl.value = btn.dataset.major || "";
    if (semesterEl) semesterEl.value = btn.dataset.semester || "Fall";
    if (yearEl) yearEl.value = btn.dataset.year || "2025";
    const passEl = document.getElementById("edit-s-password");
    if (passEl) passEl.value = "";
    openModal(editStudentModal);
  } else if (e.target.classList.contains("btn-delete-student")) {
    const studentId = e.target.dataset.id;
    if (!studentId) return;
    if (!confirm("Delete this student and all related enrollments?")) return;
    try {
      await fetchJSON(`${API_BASE}/students/${studentId}`, {
        method: "DELETE",
      });
      await loadStudents();
      await loadGradesTable();
    } catch (err) {
      alert(err.message || "Failed to delete student");
    }
  }
});

editStudentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-s-id").value;
  const name = document.getElementById("edit-s-name").value.trim();
  const email = document.getElementById("edit-s-email").value.trim();
  const major = document.getElementById("edit-s-major")?.value || "";
  const semester = document.getElementById("edit-s-semester")?.value || "";
  const year = document.getElementById("edit-s-year")?.value || "";
  const password = document.getElementById("edit-s-password")?.value || "";

  const payload = { name, email, major, semester, year };
  if (password) payload.password = password;

  try {
    await fetchJSON(`${API_BASE}/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    closeModal(editStudentModal);
    await loadStudents();
  } catch (err) {
    alert(err.message || "Failed to update student");
  }
});

 

// ── Course & Schedule Modals ──

const addCourseModal = document.getElementById("modal-add-course");
const addCourseForm = document.getElementById("add-course-form");
const editCourseModal = document.getElementById("modal-edit-course");
const editCourseForm = document.getElementById("edit-course-form");

document.getElementById("btn-add-course")?.addEventListener("click", () => {
  addCourseForm?.reset();
  setCheckedMajors(document.getElementById("c-majors"), []);
  openModal(addCourseModal);
});

addCourseForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = document.getElementById("c-code").value.trim();
  const name = document.getElementById("c-name").value.trim();
  const credits = document.getElementById("c-credits").value;
  const instructor = document.getElementById("c-instructor").value.trim();
  const majors = readCheckedMajors(document.getElementById("c-majors"));

  try {
    await fetchJSON(`${API_BASE}/courses`, {
      method: "POST",
      body: JSON.stringify({ code, name, credits, instructor, majors }),
    });
    closeModal(addCourseModal);
    await loadCoursesForTables();
  } catch (err) {
    alert(err.message || "Failed to add course");
  }
});

async function openAssignmentsForCourse(courseId) {
  const modal = document.getElementById("modal-course-assignments");
  const nameEl = document.getElementById("assignments-course-name");
  if (!courseId || !modal) return;
  const course = courseById.get(String(courseId));
  currentAssignmentsCourseId = Number(courseId);
  if (nameEl) {
    nameEl.textContent = course
      ? `${course.code} - ${course.name}`
      : "";
  }
  openModal(modal);
  try {
    await loadAssignmentsTable(courseId);
  } catch (err) {
    console.error("Failed to load assignments", err);
  }
}
coursesTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("btn-course-assignments")) {
    const courseId = btn.dataset.courseId;
    await openAssignmentsForCourse(courseId);
    return;
  }

  if (btn.classList.contains("btn-edit-course")) {
    const courseId = btn.dataset.courseId;
    const course = courseById.get(String(courseId));
    if (!course) {
      alert("Course not found. Refresh and try again.");
      return;
    }
    document.getElementById("edit-c-id").value = course.id;
    document.getElementById("edit-c-code").value = course.code || "";
    document.getElementById("edit-c-name").value = course.name || "";
    document.getElementById("edit-c-credits").value = course.credits ?? "";
    document.getElementById("edit-c-instructor").value = course.instructor || "";
    setCheckedMajors(
      document.getElementById("edit-c-majors"),
      parseMajors(course.majors),
    );
    openModal(editCourseModal);
    return;
  }

  if (btn.classList.contains("btn-delete-course")) {
    const courseId = btn.dataset.courseId;
    if (!courseId) return;
    if (!confirm("Delete this course? This will remove related data.")) return;
    try {
      await fetchJSON(`${API_BASE}/courses/${courseId}`, { method: "DELETE" });
      await loadCoursesForTables();
    } catch (err) {
      alert(err.message || "Failed to delete course");
    }
  }
});

editCourseForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-c-id").value;
  const code = document.getElementById("edit-c-code").value.trim();
  const name = document.getElementById("edit-c-name").value.trim();
  const credits = document.getElementById("edit-c-credits").value;
  const instructor = document.getElementById("edit-c-instructor").value.trim();
  const majors = readCheckedMajors(document.getElementById("edit-c-majors"));

  try {
    await fetchJSON(`${API_BASE}/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ code, name, credits, instructor, majors }),
    });
    closeModal(editCourseModal);
    await loadCoursesForTables();
  } catch (err) {
    alert(err.message || "Failed to update course");
  }
});

const addScheduleModal = document.getElementById("modal-add-schedule");
const addScheduleForm = document.getElementById("add-schedule-form");
const scheduleModalTitle = document.querySelector(
  "#modal-add-schedule .modal-header h3",
);

async function populateScheduleCourseOptions(selectedId) {
  const schCourse = document.getElementById("sch-course");
  if (!schCourse) return;
  try {
    schCourse.innerHTML = '<option value="">Select course...</option>';
    let list = coursesCache;
    if (!list.length) {
      list = await fetchJSON(`${API_BASE}/courses`);
    }
    list.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.code} – ${c.name}`;
      schCourse.appendChild(opt);
    });
    if (selectedId) schCourse.value = String(selectedId);
  } catch (err) {
    console.error("Failed to load courses for schedule", err);
  }
}

editScheduleBtn?.addEventListener("click", async () => {
  addScheduleForm?.reset();
  addScheduleForm.dataset.editingId = "";
  if (scheduleModalTitle)
    scheduleModalTitle.textContent = "Add Class Schedule Slot";
  await populateScheduleCourseOptions();
  openModal(addScheduleModal);
});

addScheduleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const courseId = document.getElementById("sch-course").value;
  const day = document.getElementById("sch-day").value;
  const timeStart = document.getElementById("sch-start").value;
  const timeEnd = document.getElementById("sch-end").value;
  const room = document.getElementById("sch-room").value.trim();
  const editingId = addScheduleForm.dataset.editingId;

  try {
    const url = editingId
      ? `${API_BASE}/schedule/${editingId}`
      : `${API_BASE}/schedule`;
    const method = editingId ? "PUT" : "POST";
    await fetchJSON(url, {
      method,
      body: JSON.stringify({ courseId, day, timeStart, timeEnd, room }),
    });
    closeModal(addScheduleModal);
    await loadScheduleAdmin();
  } catch (err) {
    alert(err.message || "Failed to save schedule slot");
  }
});

scheduleListTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.classList.contains("btn-edit-schedule")) {
    const id = btn.dataset.id;
    const courseId = btn.dataset.courseId;
    if (scheduleModalTitle)
      scheduleModalTitle.textContent = "Edit Schedule Slot";
    addScheduleForm.dataset.editingId = id;
    await populateScheduleCourseOptions(courseId);
    document.getElementById("sch-day").value = btn.dataset.day || "Monday";
    document.getElementById("sch-start").value = btn.dataset.start || "09:00";
    document.getElementById("sch-end").value = btn.dataset.end || "10:30";
    document.getElementById("sch-room").value = btn.dataset.room || "";
    openModal(addScheduleModal);
    return;
  }

  if (btn.classList.contains("btn-delete-schedule")) {
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm("Delete this schedule slot?")) return;
    try {
      await fetchJSON(`${API_BASE}/schedule/${id}`, { method: "DELETE" });
      await loadScheduleAdmin();
    } catch (err) {
      alert(err.message || "Failed to delete schedule slot");
    }
  }
});
// Initial loads
loadStudents();
loadCoursesForTables();
loadGradesTable();
loadAdminAnnouncements();
loadScheduleAdmin();




