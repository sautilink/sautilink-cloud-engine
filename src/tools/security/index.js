/**
 * Security tools module (foundation placeholder).
 * Implementations land in Phase 4.
 */

export function notImplemented(toolName) {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `${toolName} is not implemented yet.`,
    },
  };
}
