/**
 * Process a single Telegram Update (stateless).
 */

import { parseCommand, KNOWN_COMMANDS } from "./router.js";
import { handleCommand } from "./commands.js";
import { sendMessage, editMessageText } from "./telegram.js";

/**
 * @param {object} update - Telegram Update
 * @param {{ token: string, cloudEngineBaseUrl: string }}
 */
export async function processUpdate(update, config) {
  if (!update || typeof update !== "object") {
    return { handled: false, reason: "empty_update" };
  }

  // Only text messages for this phase
  const message = update.message || update.edited_message;
  if (!message || typeof message.text !== "string") {
    return { handled: false, reason: "unsupported_update" };
  }

  const chat = message.chat;
  const from = message.from;
  if (!chat || chat.id == null) {
    return { handled: false, reason: "no_chat" };
  }

  const parsed = parseCommand(message.text);
  if (!parsed) {
    // Ignore non-commands silently (groups)
    return { handled: false, reason: "not_command" };
  }

  if (!KNOWN_COMMANDS.has(parsed.command)) {
    await sendMessage(config.token, chat.id, "Unknown command. Try /help.");
    return { handled: true, command: parsed.command };
  }

  const slowCommands = new Set([
    "audit",
    "email",
    "website",
    "mobile",
    "ssl",
    "headers",
    "sitemap",
    "robots",
    "http",
    "dns",
  ]);

  let pendingId = null;
  if (slowCommands.has(parsed.command) && parsed.arg) {
    const pending = await sendMessage(
      config.token,
      chat.id,
      "⏳ Checking… please wait."
    );
    if (pending.ok && pending.result && pending.result.message_id != null) {
      pendingId = pending.result.message_id;
    }
  }

  const result = await handleCommand(
    {
      command: parsed.command,
      arg: parsed.arg,
      chat,
      from,
    },
    config
  );

  const text = result.text || "No response.";

  if (pendingId != null) {
    const edited = await editMessageText(
      config.token,
      chat.id,
      pendingId,
      text
    );
    if (!edited.ok) {
      await sendMessage(config.token, chat.id, text);
    }
  } else {
    await sendMessage(config.token, chat.id, text);
  }

  return { handled: true, command: parsed.command };
}
