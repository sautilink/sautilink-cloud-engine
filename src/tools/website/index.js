/**
 * Website & SEO tools module (foundation placeholder).
 * Implementations land in Phase 3.
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
