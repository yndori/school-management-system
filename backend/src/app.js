import pool from "./config/db.js";

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("MySQL connected");
  } catch (err) {
    console.error("MySQL error:", err.message);
  }
})();
