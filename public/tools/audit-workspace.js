import { installAuditPower } from "./audit-power.js?v=3";
import { initAuditWorkspace } from "./audit.js?v=3";

function init() {
  installAuditPower();
  initAuditWorkspace();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
