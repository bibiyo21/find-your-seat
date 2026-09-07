const $ = s => document.querySelector(s);

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value;
  const errorBox = $("#loginError");
  errorBox.classList.add("hidden");
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Login failed");
    window.location.href = "/";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
    $("#password").value = "";
    $("#password").focus();
  }
});
