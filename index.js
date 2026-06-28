/**
 * Custom entry — instruments createRoot before expo-router bootstraps React.
 */
const trace = require("./lib/startup-mount-trace");

trace.markStartupMount("entry:module-load", "sync");

if (typeof window !== "undefined" && typeof document !== "undefined") {
  try {
    const ReactDOM = require("react-dom/client");
    const originalCreateRoot = ReactDOM.createRoot;

    ReactDOM.createRoot = function patchedCreateRoot(container, options) {
      trace.markStartupMount("entry:createRoot:before", "sync");
      const root = originalCreateRoot.call(this, container, options);
      trace.markStartupMount("entry:createRoot:returned", "sync");

      const originalRender = root.render.bind(root);
      root.render = function patchedRender(element) {
        trace.markStartupMount("entry:createRoot:render:start", "sync");
        try {
          return originalRender(element);
        } finally {
          trace.markStartupMount("entry:createRoot:render:end", "sync");
        }
      };

      return root;
    };
  } catch (error) {
    trace.markStartupMount(`entry:createRoot:patch-failed:${String(error)}`, "sync");
  }
}

require("expo-router/entry");
trace.markStartupMount("entry:expo-router-loaded", "sync");
