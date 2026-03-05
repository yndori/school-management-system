import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0) {
      // Don't reveal if user exists for security
      return res.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const token = Math.random().toString(36).substring(2, 15);
    const resetLink = `http://localhost:3000/pages/reset.html?token=${token}`;

    // Simulate sending email
    console.log(`[PASSWORD RESET] Email sent to: ${email}`);
    console.log(`[PASSWORD RESET] Link: ${resetLink}`);

    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
