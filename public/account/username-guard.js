const guardedForms = [
  { formId: "signup-form", inputId: "signup-username", stateId: "username-state" },
  { formId: "profile-setup-form", inputId: "setup-username", stateId: "setup-username-state" },
];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function valid(value) {
  return /^[a-z0-9][a-z0-9._]{2,29}$/.test(normalize(value));
}

async function availability(username) {
  const response = await fetch(`/api/account/username?username=${encodeURIComponent(username)}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  return { response, payload };
}

for (const config of guardedForms) {
  const form = document.getElementById(config.formId);
  const input = document.getElementById(config.inputId);
  const state = document.getElementById(config.stateId);
  if (!form || !input || !state) continue;

  let bypassOnce = false;
  let checking = false;

  form.addEventListener("submit", async (event) => {
    if (bypassOnce) {
      bypassOnce = false;
      return;
    }
    if (checking) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const username = normalize(input.value);
    input.value = username;
    if (!valid(username)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    checking = true;
    state.textContent = "Checking availability before continuing…";
    state.className = "field-state";

    try {
      const { response, payload } = await availability(username);
      if (response.ok && payload?.data?.available === true) {
        state.textContent = `@${username} is available.`;
        state.className = "field-state good";
        bypassOnce = true;
        form.requestSubmit();
        return;
      }
      if (response.ok && payload?.data?.available === false) {
        state.textContent = `@${username} is already taken. Choose another username.`;
      } else {
        state.textContent = payload?.error?.message || "We could not confirm username availability. Try again.";
      }
      state.className = "field-state bad";
      input.focus();
    } catch {
      state.textContent = "We could not confirm username availability. Check your connection and try again.";
      state.className = "field-state bad";
      input.focus();
    } finally {
      checking = false;
    }
  }, true);
}
