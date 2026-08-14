# Telegram Bot

Public thin client with **stateless interactive menus**.

## Menus

`/start` shows the main menu. Callbacks are fixed allowlisted values only (`menu:*`, `tool:*`, `status:refresh`, `audit:*`, `nav:back`).

Selecting a tool shows usage instructions — analyzers run only after the user sends a command with a target.

No conversational sessions or stored menu state.

## Commands

Registry: `src/telegram/registry.js`. Aliases: `/check`→audit, `/site`→website.
