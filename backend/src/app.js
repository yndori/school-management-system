import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import pool from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

// ── Commons ──

// ── Students Management (Admin) ──

app.get("/api/students", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.student_number, u.major, u.entry_semester, u.entry_year
      FROM users u
      WHERE u.role = 'student'
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/students error:", err);
    res.status(500).json({ error: "Failed to load students" });
  }
});

app.post("/api/students", async (req, res) => {
  const { name, email, password, major, semester, year } = req.body || {};
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }

  try {
    // Check if email exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate student number STU-XXXX
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const studentNumber = `STU-${randomNum}`;

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, student_number, major, entry_semester, entry_year) VALUES (?, ?, ?, 'student', ?, ?, ?, ?)",
      [
        name,
        email,
        hashedPassword,
        studentNumber,
        major || null,
        semester || null,
        year || null,
      ],
    );

    res.status(201).json({
      id: result.insertId,
      student_number: studentNumber,
      message: "Student created successfully",
    });
  } catch (err) {
    console.error("POST /api/students error:", err);
    res.status(500).json({ error: "Failed to create student" });
  }
});

app.put("/api/students/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, major, semester, year, password } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET name = ?, email = ?, major = ?, entry_semester = ?, entry_year = ?, password_hash = ? WHERE id = ? AND role = 'student'",
        [name, email, major || null, semester || null, year || null, hashedPassword, id],
      );
    } else {
      await pool.query(
        "UPDATE users SET name = ?, email = ?, major = ?, entry_semester = ?, entry_year = ? WHERE id = ? AND role = 'student'",
        [name, email, major || null, semester || null, year || null, id],
      );
    }

    res.json({ success: true, message: "Student updated successfully" });
  } catch (err) {
    console.error("PUT /api/students error:", err);
    res.status(500).json({ error: "Failed to update student" });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM users WHERE id = ? AND role = 'student'", [
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/students error:", err);
    res.status(500).json({ error: "Failed to delete student" });
  }
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
      `SELECT c.id, c.code, c.name, c.credits, c.instructor
       FROM courses c
       ORDER BY c.code`,
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/courses error:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
});

app.post("/api/courses", async (req, res) => {
  const { code, name, credits, instructor } = req.body || {};
  if (!code || !name || !credits) {
    return res
      .status(400)
      .json({ error: "Code, name, and credits are required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO courses (code, name, credits, instructor) VALUES (?, ?, ?, ?)",
      [code, name, parseInt(credits, 10), instructor || null],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Course added successfully" });
  } catch (err) {
    console.error("POST /api/courses error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Course code already exists" });
    }
    res.status(500).json({ error: "Failed to create course" });
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

// ── Admin: Enrollments ──

app.post("/api/enrollments", async (req, res) => {
  const { studentId, courseId, semester, year, major } = req.body || {};
  if (!studentId) {
    return res.status(400).json({ error: "Student is required" });
  }

  try {
    const sem = semester || "Fall";
    const yr = year || 2025;

    if (!courseId) {
      return res.status(200).json({ message: "No course selected" });
    }

    if (major) {
      await pool.query("UPDATE users SET major = ? WHERE id = ?", [
        major,
        studentId,
      ]);
    }

    await pool.query(
      "INSERT INTO enrollments (student_id, course_id, semester, year) VALUES (?, ?, ?, ?)",
      [studentId, courseId, sem, yr],
    );

    res.status(201).json({ message: "Student enrolled successfully" });
  } catch (err) {
    console.error("POST /api/enrollments error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error: "Student is already enrolled in this course for this semester",
      });
    }
    res.status(500).json({ error: "Failed to enroll student" });
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

async function ensureStudentColumns() {
  try {
    const dbName = process.env.DB_NAME;
    if (!dbName) return;
    const columns = [
      { name: "major", sql: "ALTER TABLE users ADD COLUMN major VARCHAR(100) NULL" },
      { name: "entry_semester", sql: "ALTER TABLE users ADD COLUMN entry_semester VARCHAR(20) NULL" },
      { name: "entry_year", sql: "ALTER TABLE users ADD COLUMN entry_year INT NULL" },
    ];
    for (const col of columns) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [dbName, col.name],
      );
      if (rows[0]?.count === 0) {
        await pool.query(col.sql);
      }
    }
  } catch (err) {
    console.error("Ensure student columns error:", err.message);
  }
}

// Basic startup-time DB ping
(async () => {
  try {
    await ensureStudentColumns();
    await pool.query("SELECT 1");
    console.log("MySQL connected");
  } catch (err) {
    console.error("MySQL error:", err.message);
  }
})();

export default app;
