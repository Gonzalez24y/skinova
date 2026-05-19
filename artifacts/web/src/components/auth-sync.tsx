import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useSyncUser } from "@workspace/api-client-react";

export function AuthSync() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const syncUser = useSyncUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && user?.primaryEmailAddress?.emailAddress && !syncedRef.current) {
      syncedRef.current = true;
      syncUser.mutate({
        data: { email: user.primaryEmailAddress.emailAddress }
      });
    }
  }, [isLoaded, isSignedIn, user, syncUser]);

  return null;
}
