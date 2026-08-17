const page = document.body?.dataset?.accountPage || "";
const PENDING_EMAIL_KEY = "sl_pending_verification_email";
let usernameTimer = null;

async function api(path, options = {}) {
  const response = await fetch(`/api/account/${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  return { response, payload };
}

function setMessage(id, message, kind = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.className = `form-message ${kind}`;
  el.hidden = !message;
}

function setBusy(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function usernameLooksValid(value) {
  return /^[a-z0-9][a-z0-9._]{2,29}$/.test(normalizeUsername(value));
}

function initials(name) {
  const parts = String(name || "SautiLink User").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SL";
  const first = parts[0]?.[0] || "S";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || "L";
  return `${first}${second}`.toUpperCase();
}

function readableDate(value) {
  if (!value) return "SautiLink Account";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "SautiLink Account";
  return `Member since ${new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date)}`;
}

function setupNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

async function checkUsername(input, state) {
  const username = normalizeUsername(input?.value);
  if (!state) return;
  if (!usernameLooksValid(username)) {
    state.textContent = "Use 3–30 lowercase letters, numbers, dots, or underscores.";
    state.className = "field-state bad";
    return;
  }
  state.textContent = "Checking availability…";
  state.className = "field-state";
  try {
    const { response, payload } = await api(`username?username=${encodeURIComponent(username)}`);
    if (response.ok && payload?.data?.available === true) {
      state.textContent = `@${username} is available.`;
      state.className = "field-state good";
      return;
    }
    if (response.ok && payload?.data?.available === false) {
      state.textContent = `@${username} is already taken.`;
      state.className = "field-state bad";
      return;
    }
    state.textContent = payload?.error?.message || "Unable to check this username right now.";
    state.className = "field-state bad";
  } catch {
    state.textContent = "Unable to check this username right now.";
    state.className = "field-state bad";
  }
}

function bindUsernameAvailability(inputId, stateId) {
  const input = document.getElementById(inputId);
  const state = document.getElementById(stateId);
  if (!input || !state) return;
  input.addEventListener("input", () => {
    input.value = normalizeUsername(input.value);
    clearTimeout(usernameTimer);
    usernameTimer = setTimeout(() => checkUsername(input, state), 350);
  });
  input.addEventListener("blur", () => checkUsername(input, state));
}

function setupSignup() {
  const form = document.getElementById("signup-form");
  const submit = document.getElementById("signup-submit");
  const username = document.getElementById("signup-username");
  bindUsernameAvailability("signup-username", "username-state");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("form-message", "");
    const fullName = document.getElementById("signup-name")?.value.trim() || "";
    const email = document.getElementById("signup-email")?.value.trim().toLowerCase() || "";
    const password = document.getElementById("signup-password")?.value || "";
    const confirmPassword = document.getElementById("signup-confirm")?.value || "";
    const cleanUsername = normalizeUsername(username?.value);
    const emailUpdates = document.getElementById("email-updates")?.checked === true;

    if (!fullName || !email || !cleanUsername || !password) {
      setMessage("form-message", "Complete all required fields.");
      return;
    }
    if (!usernameLooksValid(cleanUsername)) {
      setMessage("form-message", "Choose a valid SautiLink username.");
      return;
    }
    if (password.length < 10) {
      setMessage("form-message", "Use at least 10 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("form-message", "Passwords do not match.");
      return;
    }

    setBusy(submit, true, "Creating account…", "Create account");
    try {
      const { response, payload } = await api("signup", {
        method: "POST",
        body: { fullName, username: cleanUsername, email, password, emailUpdates },
      });
      if (!response.ok || payload?.success !== true) {
        setMessage("form-message", payload?.error?.message || "Unable to create your account.");
        return;
      }
      sessionStorage.setItem(PENDING_EMAIL_KEY, email);
      window.location.assign("/account/verify");
    } catch {
      setMessage("form-message", "Network error. Check your connection and try again.");
    } finally {
      setBusy(submit, false, "Creating account…", "Create account");
    }
  });
}

function setupLogin() {
  const form = document.getElementById("login-form");
  const submit = document.getElementById("login-submit");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("form-message", "");
    const email = document.getElementById("login-email")?.value.trim().toLowerCase() || "";
    const password = document.getElementById("login-password")?.value || "";
    if (!email || !password) {
      setMessage("form-message", "Enter your email and password.");
      return;
    }
    setBusy(submit, true, "Signing in…", "Sign in");
    try {
      const { response, payload } = await api("login", { method: "POST", body: { email, password } });
      if (!response.ok || payload?.success !== true) {
        setMessage("form-message", payload?.error?.message || "Unable to sign in.");
        return;
      }
      window.location.assign(payload?.data?.next || "/account/");
    } catch {
      setMessage("form-message", "Network error. Check your connection and try again.");
    } finally {
      setBusy(submit, false, "Signing in…", "Sign in");
    }
  });
}

function verificationCode(inputs) {
  return inputs.map((input) => input.value).join("");
}

function setupVerificationInputs(inputs) {
  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && inputs[index + 1]) inputs[index + 1].focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && inputs[index - 1]) inputs[index - 1].focus();
      if (event.key === "ArrowLeft" && inputs[index - 1]) inputs[index - 1].focus();
      if (event.key === "ArrowRight" && inputs[index + 1]) inputs[index + 1].focus();
    });
    input.addEventListener("paste", (event) => {
      const digits = event.clipboardData?.getData("text")?.replace(/\D/g, "").slice(0, 6) || "";
      if (digits.length !== 6) return;
      event.preventDefault();
      digits.split("").forEach((digit, i) => { if (inputs[i]) inputs[i].value = digit; });
      inputs[5]?.focus();
    });
  });
}

function startResendCooldown(button, seconds = 60) {
  let left = seconds;
  button.disabled = true;
  button.textContent = `Resend in ${left}s`;
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = "Resend code";
      return;
    }
    button.textContent = `Resend in ${left}s`;
  }, 1000);
}

function setupVerify() {
  const email = sessionStorage.getItem(PENDING_EMAIL_KEY) || new URLSearchParams(location.search).get("email") || "";
  const emailEl = document.getElementById("verify-email");
  const form = document.getElementById("verify-form");
  const submit = document.getElementById("verify-submit");
  const resend = document.getElementById("resend-code");
  const inputs = Array.from(document.querySelectorAll("#verify-code input"));
  if (emailEl) emailEl.textContent = email || "your email";
  setupVerificationInputs(inputs);
  if (!email) {
    setMessage("form-message", "We could not find a pending email address. Start signup again.");
    if (submit) submit.disabled = true;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("form-message", "");
    const code = verificationCode(inputs);
    if (!/^\d{6}$/.test(code)) {
      setMessage("form-message", "Enter all six digits from your verification email.");
      return;
    }
    setBusy(submit, true, "Verifying…", "Verify account");
    try {
      const { response, payload } = await api("verify", { method: "POST", body: { email, code } });
      if (!response.ok || payload?.success !== true) {
        setMessage("form-message", payload?.error?.message || "Unable to verify this code.");
        return;
      }
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      setMessage("form-message", "Email verified. Opening your SautiLink Account…", "success");
      window.location.assign(payload?.data?.next || "/account/");
    } catch {
      setMessage("form-message", "Network error. Check your connection and try again.");
    } finally {
      setBusy(submit, false, "Verifying…", "Verify account");
    }
  });

  resend?.addEventListener("click", async () => {
    if (!email || resend.disabled) return;
    setMessage("form-message", "");
    try {
      const { response, payload } = await api("resend", { method: "POST", body: { email } });
      if (!response.ok || payload?.success !== true) {
        setMessage("form-message", payload?.error?.message || "Unable to resend the code yet.");
        return;
      }
      setMessage("form-message", "A new verification code has been sent.", "success");
      startResendCooldown(resend);
    } catch {
      setMessage("form-message", "Network error. Try again shortly.");
    }
  });
}

function renderIdentity(me, profile) {
  const name = profile?.full_name || "SautiLink User";
  const username = profile?.username || "username";
  const nameEl = document.getElementById("account-name");
  if (nameEl) {
    nameEl.textContent = name;
    nameEl.classList.remove("skeleton");
  }
  const avatar = document.getElementById("profile-avatar");
  if (avatar) avatar.textContent = initials(name);
  const handle = document.getElementById("account-handle");
  if (handle) handle.textContent = `@${username}`;
  const email = document.getElementById("account-email");
  if (email) email.textContent = me.email || "";
  const since = document.getElementById("member-since");
  if (since) since.textContent = readableDate(me.createdAt || profile?.created_at);

  const verifiedBadge = document.getElementById("verified-badge");
  const verifiedChip = document.getElementById("verified-chip");
  if (verifiedBadge) verifiedBadge.hidden = !me.emailVerified;
  if (verifiedChip) verifiedChip.hidden = !me.emailVerified;

  const securityEmail = document.getElementById("security-email");
  if (securityEmail) securityEmail.textContent = me.email || "";
  const securityState = document.getElementById("security-email-state");
  if (securityState) {
    securityState.textContent = me.emailVerified ? "Verified" : "Unverified";
    securityState.className = me.emailVerified ? "security-state blue" : "security-state";
  }

  const profileName = document.getElementById("profile-name");
  const profileUsername = document.getElementById("profile-username");
  const profileEmail = document.getElementById("profile-email");
  const updates = document.getElementById("profile-email-updates");
  if (profileName) profileName.value = profile?.full_name || "";
  if (profileUsername) profileUsername.value = profile?.username || "";
  if (profileEmail) profileEmail.value = me.email || "";
  if (updates) updates.checked = profile?.email_updates === true;
  const updatesSummary = document.getElementById("email-updates-summary");
  if (updatesSummary) updatesSummary.textContent = profile?.email_updates === true ? "On" : "Off";
}

async function loadDashboard() {
  const [{ response: meResponse, payload: mePayload }, { response: profileResponse, payload: profilePayload }] = await Promise.all([
    api("me"),
    api("profile"),
  ]);
  if (meResponse.status === 401 || profileResponse.status === 401) {
    window.location.replace("/account/login");
    return null;
  }
  if (!meResponse.ok || mePayload?.success !== true) {
    setMessage("dashboard-message", mePayload?.error?.message || "Unable to load your account.");
    return null;
  }
  if (!profileResponse.ok || profilePayload?.success !== true) {
    setMessage("dashboard-message", profilePayload?.error?.message || "Unable to load your profile.");
    return null;
  }
  const me = mePayload.data;
  const profile = profilePayload.data?.profile || null;
  renderIdentity(me, profile);
  return { me, profile };
}

function setupDashboard() {
  const profileForm = document.getElementById("profile-form");
  const saveButton = document.getElementById("profile-save");
  const logout = document.getElementById("logout-button");
  const setupPanel = document.getElementById("profile-setup-panel");
  const setupForm = document.getElementById("profile-setup-form");
  const setupSubmit = document.getElementById("setup-submit");
  const dashboardContent = document.getElementById("dashboard-content");
  bindUsernameAvailability("setup-username", "setup-username-state");

  loadDashboard().then((state) => {
    if (!state) return;
    if (!state.profile) {
      if (setupPanel) setupPanel.hidden = false;
      if (dashboardContent) dashboardContent.hidden = true;
    }
  }).catch(() => setMessage("dashboard-message", "Network error while loading your account."));

  setupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = document.getElementById("setup-name")?.value.trim() || "";
    const username = normalizeUsername(document.getElementById("setup-username")?.value);
    if (!fullName || !usernameLooksValid(username)) {
      setMessage("dashboard-message", "Enter a valid name and available username.");
      return;
    }
    setBusy(setupSubmit, true, "Finishing setup…", "Finish account setup");
    try {
      const { response, payload } = await api("profile/setup", { method: "POST", body: { fullName, username } });
      if (!response.ok || payload?.success !== true) {
        setMessage("dashboard-message", payload?.error?.message || "Unable to finish your profile.");
        return;
      }
      window.location.replace("/account/");
    } catch {
      setMessage("dashboard-message", "Network error. Try again.");
    } finally {
      setBusy(setupSubmit, false, "Finishing setup…", "Finish account setup");
    }
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("dashboard-message", "");
    const fullName = document.getElementById("profile-name")?.value.trim() || "";
    const username = normalizeUsername(document.getElementById("profile-username")?.value);
    const emailUpdates = document.getElementById("profile-email-updates")?.checked === true;
    if (!fullName || !usernameLooksValid(username)) {
      setMessage("dashboard-message", "Enter a valid name and username.");
      return;
    }
    setBusy(saveButton, true, "Saving…", "Save profile");
    try {
      const { response, payload } = await api("profile", { method: "PATCH", body: { fullName, username, emailUpdates } });
      if (!response.ok || payload?.success !== true) {
        setMessage("dashboard-message", payload?.error?.message || "Unable to save your profile.");
        return;
      }
      const meResult = await api("me");
      if (meResult.response.ok) renderIdentity(meResult.payload.data, payload.data?.profile);
      setMessage("dashboard-message", "Profile updated.", "success");
    } catch {
      setMessage("dashboard-message", "Network error. Try again.");
    } finally {
      setBusy(saveButton, false, "Saving…", "Save profile");
    }
  });

  logout?.addEventListener("click", async () => {
    setBusy(logout, true, "Signing out…", "Sign out");
    try { await api("logout", { method: "POST", body: {} }); } catch {}
    window.location.replace("/account/login");
  });
}

setupNav();
setYear();
if (page === "signup") setupSignup();
if (page === "login") setupLogin();
if (page === "verify") setupVerify();
if (page === "dashboard") setupDashboard();
