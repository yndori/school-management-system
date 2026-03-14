import * as api from "./api.js";

const ADMIN_EMAIL = "admin@schoollink.com";
const ADMIN_PASSWORD = "SchoolLink007";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const role = localStorage.getItem("role");
    if (role === "admin") {
      window.location.href = "admin-dashboard.html";
      return;
    } else if (role === "student") {
      window.location.href = "student-dashboard.html";
      return;
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value.trim();
      const errorMsg = document.getElementById("error-msg");

      if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        localStorage.setItem("role", "admin");
        window.location.href = "admin-dashboard.html";
        return;
      }

      try {
        const { token, user } = await api.login(email, password);
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        const role = user.role || "student";
        localStorage.setItem("role", role);

        if (role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "student-dashboard.html";
        }
      } catch (err) {
        if (errorMsg) errorMsg.textContent = err.message;
        console.error("Login error:", err);
      }
    });
  }

  const resetForm = document.querySelector(".reset-card form");
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = resetForm.querySelector('input[type="email"]').value;
      const btn = resetForm.querySelector(".btn-reset");

      try {
        btn.textContent = "Sending...";
        btn.disabled = true;
        await api.resetPassword(email);
        alert(
          "If an account exists, a reset link has been sent to your email.",
        );
        window.location.href = "login.html";
      } catch (err) {
        alert(err.message);
        btn.textContent = "Send Reset Link";
        btn.disabled = false;
      }
    });
  }
});

export function handleLogout() {
  api.logout();
  window.location.href = "login.html";
}
