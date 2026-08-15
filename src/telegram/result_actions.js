/**
 * Phase 7L — post-result Telegram actions (fixed callbacks only).
 */

import { sendMessage } from "./telegram.js";
import {
  setAwaitTarget,
  refreshDiagTarget,
  checkAnotherPromptText,
  diagnosticMenuText,
  diagnosticMenuKeyboard,
  expiredGuidedMessage,
  DIAG_ACTIONS,
} from "./guided.js";
import { mainMenuKeyboard, guidedAuditKeyboard } from "./menu.js";

/**
 * @returns {Promise<{ handled: boolean, action?: string, reason?: string }|null>}
 * null means not a result:* action.
 */
export async function handleResultAction(ctx) {
  const {
    action,
    chatId,
    messageId,
    messageText,
    config,
    resolveDiagTarget,
    runDiagnosticAction,
    safeEditOrSend,
    logCb,
    meta,
    from,
    env,
    adminUser,
  } = ctx;

  if (!action || !action.startsWith("result:")) return null;

  if (action === "result:another") {
    setAwaitTarget(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      checkAnotherPromptText(),
      guidedAuditKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action === "result:back") {
    const target = resolveDiagTarget(chatId, messageText);
    if (!target) {
      await sendMessage(config.token, chatId, expiredGuidedMessage(), {
        reply_markup: mainMenuKeyboard(),
      });
      return logCb(meta, action, chatId, "expired");
    }
    refreshDiagTarget(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      diagnosticMenuText(target.display),
      diagnosticMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action === "result:fullaudit") {
    return runDiagnosticAction({
      action: "diag:audit",
      chatId,
      messageId,
      messageText,
      from,
      config,
      env,
      adminUser,
      meta,
    });
  }

  if (action === "result:rerun") {
    const target = resolveDiagTarget(chatId, messageText);
    if (!target) {
      await sendMessage(config.token, chatId, expiredGuidedMessage(), {
        reply_markup: mainMenuKeyboard(),
      });
      return logCb(meta, action, chatId, "expired");
    }
    const last =
      target.lastAction && DIAG_ACTIONS[target.lastAction]
        ? target.lastAction
        : "diag:security";
    return runDiagnosticAction({
      action: last,
      chatId,
      messageId,
      messageText,
      from,
      config,
      env,
      adminUser,
      meta,
    });
  }

  return logCb(meta, action, chatId, "unknown_result");
}
