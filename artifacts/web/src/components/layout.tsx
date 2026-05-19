import { Link } from "wouter";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Crown } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, signOut } = useAuth();
  const { data: user } = useGetMe({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMeQueryKey(),
    },
  });

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl font-medium text-foreground tracking-tight">
              Skin<span className="text-primary">ova</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            {isSignedIn ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:block mr-1">
                  {user?.credits != null
                    ? user.credits >= 9999
                      ? "무제한"
                      : `잔여 ${user.credits}회`
                    : ""}
                </span>
                <Link href="/pricing">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    data-testid="button-pricing-nav"
                  >
                    <Crown size={13} />
                    요금제
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-muted-foreground"
                  data-testid="button-signout"
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button
                  variant="default"
                  size="sm"
                  data-testid="button-login-nav"
                >
                  로그인 / 회원가입
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
