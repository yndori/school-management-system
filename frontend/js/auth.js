import * as api from "./api.js";

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
      const email = resetForm
        .querySelector('input[type="email"]')
        .value.trim()
        .toLowerCase();
      const btn = resetForm.querySelector(".btn-reset");

      try {
        btn.textContent = "Sending...";
        btn.disabled = true;
        const data = await api.resetPassword(email);
        alert(data.message || "Password reset request sent.");
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
