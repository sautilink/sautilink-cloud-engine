import test from "node:test";
import assert from "node:assert/strict";

import { handleCommand } from "../src/telegram/commands.js";
import { formatHelp, formatVpn, formatProxy, formatContact } from "../src/telegram/format.js";
import { contactKeyboard } from "../src/telegram/menu.js";
import { getCommandMeta } from "../src/telegram/registry.js";
import { parseCommand, KNOWN_COMMANDS } from "../src/telegram/router.js";

test("vpn, proxy, and contact are public cheap commands", () => {
  for (const command of ["vpn", "proxy", "contact"]) {
    assert.equal(parseCommand(`/${command}`).command, command);
    assert.equal(KNOWN_COMMANDS.has(command), true);
    const meta = getCommandMeta(command);
    assert.equal(meta.cost, "cheap");
    assert.equal(meta.requiresArgument, false);
    assert.notEqual(meta.visibility, "admin");
  }
});

test("service previews are bilingual and do not claim a live service", () => {
  const vpnEn = formatVpn("en");
  const vpnSw = formatVpn("sw");
  const proxyEn = formatProxy("en");
  const proxySw = formatProxy("sw");

  assert.match(vpnEn, /Coming soon/i);
  assert.match(vpnEn, /SSH, Trojan, WebSocket/i);
  assert.match(vpnSw, /Inakuja hivi karibuni/i);
  assert.match(proxyEn, /Connect to Proxy/i);
  assert.match(proxyEn, /No active SautiLink proxy/i);
  assert.match(proxySw, /hakuna active SautiLink proxy/i);
});

test("contact provides the exact approved support destinations", () => {
  const keyboard = contactKeyboard("en");
  const buttons = keyboard.inline_keyboard.flat();
  const destinations = new Map(buttons.filter((button) => button.url).map((button) => [button.text, button.url]));

  assert.equal(destinations.get("Support Agent 1"), "https://t.me/drcharlestz");
  assert.equal(destinations.get("Support Agent 2"), "https://t.me/suzytz");
  assert.equal(destinations.get("Support Agent 3"), "https://t.me/mrxafrica");
  assert.equal(destinations.get("Bot Partner · Ivy Network"), "https://www.ivynetwork.co.uk");
  assert.equal(destinations.get("Contact SautiLink HQ"), "https://sautilink.com/contact");
  assert.deepEqual(buttons.at(-1), { text: "⬅️ Back", callback_data: "menu:main" });
});

test("contact copy is honest about changing live availability", () => {
  assert.match(formatContact("en"), /Live online status can change/i);
  assert.match(formatContact("sw"), /Hali ya kuwa online inaweza kubadilika/i);
});

test("command handlers return the service copy and contact keyboard", async () => {
  const context = { arg: "", chat: { id: 101 }, from: { id: 202 }, locale: "en" };
  const config = { cloudEngineBaseUrl: "https://cloudengine.sautilink.com", env: {} };

  const vpn = await handleCommand({ ...context, command: "vpn" }, config);
  const proxy = await handleCommand({ ...context, command: "proxy" }, config);
  const contact = await handleCommand({ ...context, command: "contact" }, config);

  assert.match(vpn.text, /Coming soon/i);
  assert.match(proxy.text, /Coming soon/i);
  assert.equal(contact.reply_markup.inline_keyboard[0][0].url, "https://t.me/drcharlestz");
});

test("public help advertises new commands but keeps admin hidden", () => {
  const help = formatHelp("en");
  assert.match(help, /\/vpn/);
  assert.match(help, /\/proxy/);
  assert.match(help, /\/contact/);
  assert.doesNotMatch(help, /\/admin/);
});
