import { SignIn } from "@clerk/clerk-react";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-foreground mb-2">Skinova</h1>
          <p className="text-muted-foreground">당신의 피부를 위한 AI 솔루션</p>
        </div>
        <SignIn routing="path" path="/login" forceRedirectUrl="/" signUpForceRedirectUrl="/" />
      </div>
    </div>
  );
}
