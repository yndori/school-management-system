import * as api from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const errorMsg = document.getElementById("error-msg");

      try {
        const { token, user } = await api.login(email, password);
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        if (user.role === "admin") {
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
