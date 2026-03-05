import express from "express";
import cors from "cors";
import pool from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Announcements ──

app.get("/api/announcements", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, body, created_at
       FROM announcements
       ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/announcements error:", err);
    res.status(500).json({ error: "Failed to load announcements" });
  }
});

app.post("/api/announcements", async (req, res) => {
  const { title, body } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO announcements (title, body) VALUES (?, ?)`,
      [title, body || null],
    );
    const [rows] = await pool.query(
      `SELECT id, title, body, created_at
       FROM announcements
       WHERE id = ?`,
      [result.insertId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/announcements error:", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// ── Admin: courses & assignments ──

app.get("/api/courses", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.name, c.credits, c.instructor,
              m.name AS major_name
       FROM courses c
       LEFT JOIN majors m ON c.major_id = m.id
       ORDER BY c.code`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/courses error:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
});

app.get("/api/courses/:courseId/assignments", async (req, res) => {
  const { courseId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, weight, max_points
       FROM assignments
       WHERE course_id = ?
       ORDER BY id`,
      [courseId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/courses/:courseId/assignments error:", err);
    res.status(500).json({ error: "Failed to load assignments" });
  }
});

app.post("/api/assignments", async (req, res) => {
  const { courseId, name, description, weight, maxPoints } = req.body || {};
  if (!courseId || !name || weight == null) {
    return res
      .status(400)
      .json({ error: "courseId, name and weight are required" });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO assignments (course_id, name, description, weight, max_points)
       VALUES (?, ?, ?, ?, ?)`,
      [courseId, name, description || null, weight, maxPoints || 100],
    );
    const [rows] = await pool.query(
      `SELECT id, course_id, name, description, weight, max_points
       FROM assignments
       WHERE id = ?`,
      [result.insertId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/assignments error:", err);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

// ── Admin: grades (per-assignment) + aggregated course grade ──

app.get("/api/grades", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         e.id AS enrollment_id,
         u.student_number,
         u.name AS student_name,
         c.id AS course_id,
         c.code AS course_code,
         c.name AS course_name,
         e.semester,
         e.year,
         a.name AS assignment_name,
         a.weight,
         g.id AS grade_id,
         g.grade AS grade_value,
         g.letter_grade
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN grades g ON g.enrollment_id = e.id
       LEFT JOIN assignments a ON g.assignment_id = a.id
       ORDER BY u.student_number, c.code, a.id`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/grades error:", err);
    res.status(500).json({ error: "Failed to load grades" });
  }
});

app.post("/api/grades", async (req, res) => {
  const { enrollmentId, assignmentId, grade } = req.body || {};
  if (!enrollmentId || !assignmentId || grade == null) {
    return res
      .status(400)
      .json({ error: "enrollmentId, assignmentId and grade are required" });
  }
  const g = Number(grade);
  const letter =
    g >= 90 ? "A" : g >= 80 ? "B" : g >= 70 ? "C" : g >= 60 ? "D" : "F";
  try {
    await pool.query(
      `INSERT INTO grades (enrollment_id, assignment_id, grade, letter_grade)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade), letter_grade = VALUES(letter_grade)`,
      [enrollmentId, assignmentId, g, letter],
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /api/grades error:", err);
    res.status(500).json({ error: "Failed to save grade" });
  }
});

// ── Schedule (admin + student) ──

// All schedule slots for admin
app.get("/api/schedule", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id,
              s.course_id,
              c.code AS course_code,
              c.name AS course_name,
              c.instructor,
              s.day,
              TIME_FORMAT(s.time_start, '%H:%i') AS time_start,
              TIME_FORMAT(s.time_end, '%H:%i') AS time_end,
              s.room
       FROM schedule s
       JOIN courses c ON s.course_id = c.id
       ORDER BY FIELD(s.day,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.time_start`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/schedule error:", err);
    res.status(500).json({ error: "Failed to load schedule" });
  }
});

app.post("/api/schedule", async (req, res) => {
  const { courseId, day, timeStart, timeEnd, room } = req.body || {};
  if (!courseId || !day || !timeStart || !timeEnd) {
    return res
      .status(400)
      .json({ error: "courseId, day, timeStart and timeEnd are required" });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO schedule (course_id, day, time_start, time_end, room)
       VALUES (?, ?, ?, ?, ?)`,
      [courseId, day, timeStart, timeEnd, room || null],
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("POST /api/schedule error:", err);
    res.status(500).json({ error: "Failed to create schedule slot" });
  }
});

app.put("/api/schedule/:id", async (req, res) => {
  const { id } = req.params;
  const { courseId, day, timeStart, timeEnd, room } = req.body || {};
  if (!courseId || !day || !timeStart || !timeEnd) {
    return res
      .status(400)
      .json({ error: "courseId, day, timeStart and timeEnd are required" });
  }
  try {
    await pool.query(
      `UPDATE schedule
       SET course_id = ?, day = ?, time_start = ?, time_end = ?, room = ?
       WHERE id = ?`,
      [courseId, day, timeStart, timeEnd, room || null, id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /api/schedule/:id error:", err);
    res.status(500).json({ error: "Failed to update schedule slot" });
  }
});

// Student profile details
app.get("/api/students/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, student_number, name
       FROM users
       WHERE id = ? AND role = 'student'`,
      [studentId],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("GET /api/students/:studentId error:", err);
    res.status(500).json({ error: "Failed to load student profile" });
  }
});

// Student-specific schedule (for weekly grid)
app.get("/api/students/:studentId/schedule", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         s.day,
         c.code AS course_code,
         c.name AS course_name,
         c.instructor,
         TIME_FORMAT(s.time_start, '%H:%i') AS time_start,
         TIME_FORMAT(s.time_end, '%H:%i') AS time_end,
         s.room
       FROM enrollments e
       JOIN schedule s ON s.course_id = e.course_id
       JOIN courses c ON c.id = s.course_id
       WHERE e.student_id = ?
       ORDER BY FIELD(s.day,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.time_start`,
      [studentId],
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/students/:studentId/schedule error:", err);
    res.status(500).json({ error: "Failed to load student schedule" });
  }
});

// ── Student: transcript with weighted course grades ──

app.get("/api/students/:studentId/transcript", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         e.id AS enrollment_id,
         c.code AS course_code,
         c.name AS course_name,
         c.credits,
         e.semester,
         e.year,
         SUM(g.grade * a.weight / 100) AS final_numeric
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN grades g ON g.enrollment_id = e.id
       LEFT JOIN assignments a ON g.assignment_id = a.id
       WHERE e.student_id = ?
       GROUP BY e.id
       ORDER BY e.year, e.semester, c.code`,
      [studentId],
    );

    let totalCredits = 0;
    let totalPoints = 0;
    const courses = rows.map((row) => {
      const numeric = row.final_numeric;
      let letter = null;
      let points = 0;
      if (numeric != null) {
        if (numeric >= 90) {
          letter = "A";
          points = 4;
        } else if (numeric >= 80) {
          letter = "B";
          points = 3;
        } else if (numeric >= 70) {
          letter = "C";
          points = 2;
        } else if (numeric >= 60) {
          letter = "D";
          points = 1;
        } else {
          letter = "F";
          points = 0;
        }
        totalCredits += row.credits;
        totalPoints += points * row.credits;
      }
      return {
        code: row.course_code,
        name: row.course_name,
        credits: row.credits,
        semester: row.semester,
        year: row.year,
        numericGrade: numeric != null ? Number(numeric.toFixed(2)) : null,
        letterGrade: letter,
      };
    });

    const gpa =
      totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : null;

    res.json({
      courses,
      totalCredits,
      gpa,
    });
  } catch (err) {
    console.error("GET /api/students/:studentId/transcript error:", err);
    res.status(500).json({ error: "Failed to load transcript" });
  }
});

// Basic startup-time DB ping
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("MySQL connected");
  } catch (err) {
    console.error("MySQL error:", err.message);
  }
})();

export default app;
