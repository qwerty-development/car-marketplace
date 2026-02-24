// utils/signOutState.ts
// Shared sign-out state extracted to break require cycles between
// AuthContext <-> (home)/_layout <-> useNotifications <-> NotificationService

let isSigningOut = false;
export { isSigningOut };

export function setIsSigningOut(value: boolean) {
  const previous = isSigningOut;
  isSigningOut = value;

  if (previous !== value) {
    console.log(`[SignOutState] Sign out state changed: ${previous} -> ${value}`);

    if (value === true) {
      console.log("[SignOutState] Cancelling pending operations due to sign out");
    }
  }
}

export async function coordinateSignOut(
  router: any,
  authSignOut: () => Promise<void>
) {
  if (isSigningOut) {
    console.log("[SignOutState] Sign out already in progress");
    return;
  }

  setIsSigningOut(true);

  try {
    console.log("[SignOutState] Navigating to sign-in screen");
    router.replace("/(auth)/sign-in");

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("[SignOutState] Executing auth sign out");
    await authSignOut();

    console.log("[SignOutState] Sign out coordination completed successfully");
    return true;
  } catch (error) {
    console.error("[SignOutState] Error during coordinated sign out:", error);
    router.replace("/(auth)/sign-in");
    setIsSigningOut(false);
    return false;
  }
}
