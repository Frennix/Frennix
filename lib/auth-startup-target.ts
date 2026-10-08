export type AuthStartupTarget = {
  kind: "login" | "signup";
  mountId: string;
  nodeId: string;
  title: string;
  missingMountMessage: string;
  missingNodeMessage: string;
};

/**
 * The auth layout wraps every signed-out screen. Only the screen for the
 * current path is required to mount. /signup must not wait on the login form.
 */
export function authStartupTargetForPath(pathname: string): AuthStartupTarget | null {
  const path = pathname.toLowerCase();
  if (path.includes("signup")) {
    return {
      kind: "signup",
      mountId: "auth-signup:mounted",
      nodeId: "auth-signup-screen",
      title: "Sign-up screen failed to load",
      missingMountMessage: "Sign-up screen did not finish mounting.",
      missingNodeMessage: "Sign-up form did not appear in the page.",
    };
  }
  if (path.includes("login")) {
    return {
      kind: "login",
      mountId: "auth-login:mounted",
      nodeId: "auth-login-screen",
      title: "Sign-in screen failed to load",
      missingMountMessage: "Login screen did not finish mounting.",
      missingNodeMessage: "Login UI did not appear in the page.",
    };
  }
  return null;
}
