import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

export const login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "24h" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        student_number: user.student_number,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const signOut = (req, res) => {
  // Client is responsible for deleting the token
  res.json({ message: "Signed out successfully" });
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE email = ? AND role = 'student'",
      [normalizedEmail],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Email is not registered" });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpSecure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
    const fromAddress = process.env.SMTP_FROM || smtpUser;
    const adminEmail = process.env.SCHOOL_ADMIN_EMAIL || "schoollink181@gmail.com";

    if (!smtpHost || !smtpUser || !smtpPass || !fromAddress) {
      return res.status(500).json({ error: "Email service not configured" });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const student = rows[0];
    await transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: "Password reset request",
      text: `Password reset requested for student:\nName: ${student.name}\nEmail: ${student.email}\nPlease contact the student to change the password.`,
    });

    res.json({ message: "Password reset request sent." });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
