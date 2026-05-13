"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, MailCheck, Check, X, KeyRound } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Lösenordskrav vid registrering. Varje regel kontrolleras live och visas
// under lösenordsfältet i signup-läget.
const PASSWORD_RULES = [
  { id: "length", label: "Minst 6 tecken", test: (pw) => pw.length >= 6 },
  { id: "upper", label: "Minst en stor bokstav (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "Minst en liten bokstav (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "digit", label: "Minst en siffra (0–9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "Minst ett specialtecken (t.ex. !@#$%)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();

  // "signin" | "signup" | "verify" | "forgot" | "reset-sent"
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only redirect if a verified session is active.
  useEffect(() => {
    if (!loading && user && user.emailVerified) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  // Live-utvärdering av lösenordsreglerna (används bara i signup-läget).
  const passwordValid =
    mode !== "signup" || PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Säkerhetsnät — knappen är redan disablad, men någon kan ha kringgått det.
    if (mode === "signup" && !passwordValid) {
      setError("Lösenordet uppfyller inte alla krav.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Verifiera åtkomstkoden mot servern INNAN vi pratar med Firebase.
      //    Den riktiga koden lever bara i process.env.ACCESS_CODE på servern
      //    och skickas aldrig till klienten.
      const verifyRes = await fetch("/api/verify-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });
      if (!verifyRes.ok) {
        if (verifyRes.status === 429) {
          // Rate-limited. Use server-supplied Retry-After to tell the
          // user when they can try again.
          const retryAfterRaw = verifyRes.headers.get("Retry-After");
          const seconds = retryAfterRaw ? Number(retryAfterRaw) : NaN;
          if (Number.isFinite(seconds) && seconds > 0) {
            const mins = Math.ceil(seconds / 60);
            setError(
              mins > 1
                ? `För många försök. Försök igen om ${mins} minuter.`
                : `För många försök. Försök igen om ${seconds} sekunder.`
            );
          } else {
            setError("För många försök. Försök igen senare.");
          }
        } else if (verifyRes.status === 401) {
          setError("Ogiltig åtkomstkod.");
        } else if (verifyRes.status === 500) {
          setError("Åtkomstkod är inte konfigurerad på servern.");
        } else {
          setError("Kunde inte verifiera åtkomstkoden.");
        }
        return;
      }

      // 2) Kod är giltig — fortsätt med Firebase Auth.
      if (mode === "signin") {
        await signIn(email, password);
        router.replace("/dashboard");
      } else if (mode === "signup") {
        const result = await signUp(email, password);
        setVerifyEmail(result.email);
        setPassword("");
        setAccessCode("");
        setMode("verify");
      } else if (mode === "forgot") {
        // Firebase resolves successfully even if the email doesn't exist
        // (intentional: prevents email enumeration). We always show the
        // generic "if the account exists, we've sent a reset email" copy.
        await resetPassword(email);
        setResetEmail(email);
        setAccessCode("");
        setMode("reset-sent");
      }
    } catch (err) {
      // Logging in with an unverified email — surface the verification screen
      // (with the same message used after signup) instead of a red error.
      if (err?.code === "auth/email-not-verified") {
        setVerifyEmail(err.email || email);
        setPassword("");
        setMode("verify");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const goToLogin = () => {
    setMode("signin");
    setError("");
    setPassword("");
    setAccessCode("");
  };

  const goToForgot = () => {
    setMode("forgot");
    setError("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center shadow-glow">
            <Clapperboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-body font-bold text-slate-900 tracking-tight leading-none">
              ElodieCIS
            </h1>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest leading-none mt-1">
              Produktionssvit
            </p>
          </div>
        </div>

        <Card padding="lg">
          {mode === "verify" ? (
            <>
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-2xl bg-blue-50 border border-blue-200">
                <MailCheck className="w-7 h-7 text-[#0052FF]" />
              </div>
              <h2 className="text-2xl font-heading text-slate-900 tracking-tight text-center">
                Verifiera din e-post
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono text-center">
                // verification.pending()
              </p>
              <p className="text-sm text-slate-700 text-center leading-relaxed mt-6">
                Vi har skickat ett verifieringsmejl till{" "}
                <span className="font-semibold text-slate-900">
                  {verifyEmail}
                </span>
                . Verifiera det och logga in.
              </p>
              <p className="text-xs text-slate-500 text-center leading-relaxed mt-2">
                Kolla även skräpposten om du inte ser mejlet.
              </p>
              <Button
                size="lg"
                className="w-full mt-6"
                onClick={goToLogin}
              >
                Login
              </Button>
            </>
          ) : mode === "reset-sent" ? (
            <>
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-2xl bg-blue-50 border border-blue-200">
                <MailCheck className="w-7 h-7 text-[#0052FF]" />
              </div>
              <h2 className="text-2xl font-heading text-slate-900 tracking-tight text-center">
                Återställning skickad
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono text-center">
                // password.reset()
              </p>
              <p className="text-sm text-slate-700 text-center leading-relaxed mt-6">
                Om ett konto finns för{" "}
                <span className="font-semibold text-slate-900">
                  {resetEmail}
                </span>{" "}
                har vi skickat ett mejl med en länk för att återställa lösenordet.
              </p>
              <p className="text-xs text-slate-500 text-center leading-relaxed mt-2">
                Kolla även skräpposten om du inte ser mejlet.
              </p>
              <Button size="lg" className="w-full mt-6" onClick={goToLogin}>
                Tillbaka till inloggning
              </Button>
            </>
          ) : mode === "forgot" ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-heading text-slate-900 tracking-tight">
                  Glömt lösenord
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  // password.reset()
                </p>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Ange din e-postadress så skickar vi en länk för att återställa lösenordet.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="E-post"
                  type="email"
                  autoComplete="email"
                  placeholder="namn@exempel.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div className="pt-2 border-t border-slate-100">
                  <PasswordInput
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3" />
                        Åtkomstkod
                      </span>
                    }
                    autoComplete="off"
                    placeholder="••••••••"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                    // krävs för åtkomst — kontakta administratör
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-xs text-red-600 font-mono">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  className="w-full"
                >
                  Skicka återställningslänk
                </Button>
              </form>

              <p className="text-xs text-slate-500 font-mono mt-6 text-center">
                Kom du på det?{" "}
                <button
                  type="button"
                  onClick={goToLogin}
                  className="text-[#0052FF] hover:text-[#4D7CFF] font-medium"
                >
                  Tillbaka till inloggning
                </button>
              </p>
            </>
          ) : (
            <>
              {/* Mode switch */}
              <div className="flex p-1 mb-6 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200",
                    mode === "signin"
                      ? "bg-white text-[#0052FF] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Logga in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200",
                    mode === "signup"
                      ? "bg-white text-[#0052FF] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Skapa konto
                </button>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-heading text-slate-900 tracking-tight">
                  {mode === "signin" ? "Välkommen tillbaka" : "Skapa ett konto"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {mode === "signin"
                    ? "// session.start()"
                    : "// account.create()"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="E-post"
                  type="email"
                  autoComplete="email"
                  placeholder="namn@exempel.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <PasswordInput
                  label="Lösenord"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {mode === "signup" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Lösenordskrav
                    </p>
                    <ul className="space-y-1.5">
                      {PASSWORD_RULES.map((rule) => {
                        const ok = rule.test(password);
                        return (
                          <li
                            key={rule.id}
                            className="flex items-center gap-2 text-xs font-mono"
                          >
                            {ok ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            )}
                            <span
                              className={cn(
                                "transition-colors",
                                ok ? "text-emerald-600" : "text-slate-500"
                              )}
                            >
                              {rule.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <PasswordInput
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3" />
                        Åtkomstkod
                      </span>
                    }
                    autoComplete="off"
                    placeholder="••••••••"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                    // krävs för åtkomst — kontakta administratör
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-xs text-red-600 font-mono">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  disabled={mode === "signup" && !passwordValid}
                  className="w-full"
                >
                  {mode === "signin" ? "Logga in" : "Skapa konto"}
                </Button>
              </form>

              {mode === "signin" && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={goToForgot}
                    className="text-xs font-mono text-[#0052FF] hover:text-[#4D7CFF] font-medium"
                  >
                    Glömt lösenord?
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-500 font-mono mt-6 text-center">
                {mode === "signin" ? (
                  <>
                    Har du inget konto?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="text-[#0052FF] hover:text-[#4D7CFF] font-medium"
                    >
                      Skapa ett
                    </button>
                  </>
                ) : (
                  <>
                    Har du redan ett konto?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="text-[#0052FF] hover:text-[#4D7CFF] font-medium"
                    >
                      Logga in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
