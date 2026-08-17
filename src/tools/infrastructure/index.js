/** Infrastructure tool exports. */

export {
  preparePublicIp,
  reverseDnsName,
  reverseDnsLookup,
  lookupIp,
} from "./ip.js";

export function notImplemented(toolName) {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `${toolName} is not implemented yet.`,
    },
  };
}
