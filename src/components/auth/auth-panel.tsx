"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  departments,
  getRoleDestination,
  interestOptions,
  normalizePhoneNumber,
  normalizeUsername,
  roleDescriptions,
  roleLabels,
  signupRoles,
  validateInstitutionalId,
  validatePhoneNumber,
  validateUsername,
  type SignupRole,
} from "@/lib/onboarding";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type Mode = "signup" | "login" | "reset";
type StatusTone = "neutral" | "success" | "error";

type Availability = {
  tone: StatusTone;
  message: string;
  available: boolean;
  suggestions: string[];
};

const steps = [
  "Account",
  "Profile",
  "Institution",
  "Role",
  "Interests",
] as const;

const defaultAvailability: Availability = {
  tone: "neutral",
  message: "",
  available: false,
  suggestions: [],
};

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "signup";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<SignupRole>("reader");
  const [departmentCode, setDepartmentCode] = useState("SWE");
  const [entryYear, setEntryYear] = useState("2022");
  const [matricOrStaffId, setMatricOrStaffId] = useState("");
  const [interests, setInterests] = useState<string[]>(["Campus news"]);
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: "neutral",
    message: "Create your account one step at a time.",
  });
  const [usernameStatus, setUsernameStatus] =
    useState<Availability>(defaultAvailability);
  const [phoneStatus, setPhoneStatus] = useState<Availability>(defaultAvailability);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const normalizedUsername = normalizeUsername(username);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const usernameValidation = validateUsername(username);
  const phoneValidation = validatePhoneNumber(phoneNumber);
  const idValidation = useMemo(
    () => validateInstitutionalId(matricOrStaffId, departmentCode, entryYear),
    [departmentCode, entryYear, matricOrStaffId],
  );

  useEffect(() => {
    if (!username) {
      return;
    }

    const validation = validateUsername(username);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (!validation.valid) {
        setUsernameStatus({
          tone: "error",
          message: validation.message,
          available: false,
          suggestions: [],
        });
        return;
      }

      const params = new URLSearchParams({
        username: validation.username,
        fullName,
      });
      const response = await fetch(`/api/auth/availability?${params}`, {
        signal: controller.signal,
      }).catch(() => null);

      if (!response) {
        return;
      }

      const result = (await response.json()) as {
        available: boolean;
        message: string;
        suggestions?: string[];
      };
      setUsernameStatus({
        tone: result.available ? "success" : "error",
        message: result.message,
        available: result.available,
        suggestions: result.suggestions ?? [],
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [fullName, username]);

  useEffect(() => {
    if (!phoneNumber) {
      return;
    }

    const validation = validatePhoneNumber(phoneNumber);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (!validation.valid) {
        setPhoneStatus({
          tone: "error",
          message: validation.message,
          available: false,
          suggestions: [],
        });
        return;
      }

      const params = new URLSearchParams({ phoneNumber: validation.phoneNumber });
      const response = await fetch(`/api/auth/availability?${params}`, {
        signal: controller.signal,
      }).catch(() => null);

      if (!response) {
        return;
      }

      const result = (await response.json()) as {
        available: boolean;
        message: string;
      };
      setPhoneStatus({
        tone: result.available ? "success" : "error",
        message: result.message,
        available: result.available,
        suggestions: [],
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [phoneNumber]);

  function toggleInterest(value: string) {
    setInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function canContinue() {
    if (mode !== "signup") {
      return true;
    }

    if (step === 0) {
      return email.includes("@") && password.length >= 8;
    }

    if (step === 1) {
      return (
        fullName.trim().length > 2 &&
        usernameValidation.valid &&
        usernameStatus.available &&
        phoneValidation.valid &&
        phoneStatus.available
      );
    }

    if (step === 2) {
      return departmentCode && /^[0-9]{4}$/.test(entryYear) && idValidation.valid;
    }

    if (step === 3) {
      return signupRoles.includes(role);
    }

    return interests.length > 0;
  }

  function nextStep() {
    if (!canContinue()) {
      setStatus({
        tone: "error",
        message: "Complete this step before continuing.",
      });
      return;
    }

    setStatus({ tone: "neutral", message: "Create your account one step at a time." });
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleSignup() {
    if (!canContinue()) {
      setStatus({ tone: "error", message: "Complete every required signup field." });
      return;
    }

    setPending(true);
    setStatus({ tone: "neutral", message: "Creating your CampusPress account..." });

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        fullName,
        username: normalizedUsername,
        phoneNumber: normalizedPhone,
        role,
        departmentCode,
        entryYear,
        matricOrStaffId,
        interests,
      }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      message: string;
      suggestions?: string[];
    };
    setPending(false);

    if (!result.ok) {
      setStatus({ tone: "error", message: result.message });
      if (result.suggestions?.length) {
        setUsernameStatus({
          tone: "error",
          message: result.message,
          available: false,
          suggestions: result.suggestions,
        });
        setStep(1);
      }
      return;
    }

    setStatus({ tone: "success", message: result.message });
    setMode("login");
    setStep(0);
  }

  async function handleLogin() {
    setPending(true);
    setStatus({ tone: "neutral", message: "Checking your sign in details..." });

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setPending(false);
      setStatus({
        tone: "error",
        message: error?.message ?? "CampusPress could not sign you in.",
      });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    setPending(false);

    if (profileError || !profile?.role) {
      setStatus({
        tone: "error",
        message: "Your account exists, but the onboarding profile was not found.",
      });
      return;
    }

    router.push(getRoleDestination(profile.role));
  }

  async function handleReset() {
    setPending(true);
    setStatus({ tone: "neutral", message: "Preparing password reset instructions..." });

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { ok: boolean; message: string };
    setPending(false);
    setStatus({ tone: result.ok ? "success" : "error", message: result.message });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup") {
      if (step < steps.length - 1) {
        nextStep();
        return;
      }

      await handleSignup();
      return;
    }

    if (mode === "login") {
      await handleLogin();
      return;
    }

    await handleReset();
  }

  return (
    <section className="w-full max-w-3xl rounded-md border bg-background/90 p-6 shadow-sm backdrop-blur md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-primary">Chrisland access</p>
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-5xl font-semibold leading-none text-foreground">
              Auth and onboarding
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              Sign in with a personal email, then attach the Chrisland ID that
              will later be roster-verified by the university team.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(["signup", "login", "reset"] as const).map((item) => (
            <Button
              aria-pressed={mode === item}
              key={item}
              onClick={() => {
                setMode(item);
                setStep(0);
              }}
              type="button"
              variant={mode === item ? "default" : "outline"}
            >
              {item === "signup" ? "Sign up" : item === "login" ? "Sign in" : "Reset"}
            </Button>
          ))}
        </div>

        {mode === "signup" ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-primary">
                Step {step + 1} of {steps.length}
              </span>
              <span className="text-muted-foreground">{steps[step]}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {steps.map((item, index) => (
                <div
                  aria-label={item}
                  className={
                    index <= step ? "h-2 rounded-md bg-primary" : "h-2 rounded-md bg-muted"
                  }
                  key={item}
                />
              ))}
            </div>
          </div>
        ) : null}

        <form className="grid gap-6" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <SignupStep
              departmentCode={departmentCode}
              email={email}
              entryYear={entryYear}
              fullName={fullName}
              idValidationMessage={idValidation.message}
              idValidationValid={idValidation.valid}
              interests={interests}
              matricOrStaffId={matricOrStaffId}
              password={password}
              phoneNumber={phoneNumber}
              phoneStatus={phoneStatus}
              role={role}
              setDepartmentCode={setDepartmentCode}
              setEmail={setEmail}
              setEntryYear={setEntryYear}
              setFullName={setFullName}
              setMatricOrStaffId={setMatricOrStaffId}
              setPassword={setPassword}
              setPhoneNumber={setPhoneNumber}
              setRole={setRole}
              setUsername={setUsername}
              showPassword={showPassword}
              step={step}
              togglePassword={() => setShowPassword((current) => !current)}
              toggleInterest={toggleInterest}
              username={username}
              usernameStatus={usernameStatus}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Email
                <Input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              {mode !== "reset" ? (
                <label className="grid gap-2 text-sm font-semibold">
                  Password
                  <PasswordField
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                    showPassword={showPassword}
                    togglePassword={() => setShowPassword((current) => !current)}
                    value={password}
                  />
                </label>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
            <p
              className={
                status.tone === "error"
                  ? "text-sm leading-6 text-destructive"
                  : status.tone === "success"
                    ? "text-sm leading-6 text-primary"
                    : "text-sm leading-6 text-muted-foreground"
              }
              role="status"
            >
              {status.message}
            </p>
            <div className="flex gap-3">
              {mode === "signup" && step > 0 ? (
                <Button
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
              ) : null}
              <Button disabled={pending} type="submit">
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {mode === "signup"
                  ? step < steps.length - 1
                    ? "Next"
                    : "Create account"
                  : mode === "login"
                    ? "Sign in"
                    : "Send reset"}
              </Button>
            </div>
          </div>
          {mode === "signup" ? (
            <p className="text-sm leading-6 text-muted-foreground">
              By creating an account, you agree to the{" "}
              <Link className="font-semibold text-primary" href="/terms">
                Terms of Service
              </Link>{" "}
              and acknowledge the{" "}
              <Link className="font-semibold text-primary" href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

type SignupStepProps = {
  departmentCode: string;
  email: string;
  entryYear: string;
  fullName: string;
  idValidationMessage: string;
  idValidationValid: boolean;
  interests: string[];
  matricOrStaffId: string;
  password: string;
  phoneNumber: string;
  phoneStatus: Availability;
  role: SignupRole;
  setDepartmentCode: (value: string) => void;
  setEmail: (value: string) => void;
  setEntryYear: (value: string) => void;
  setFullName: (value: string) => void;
  setMatricOrStaffId: (value: string) => void;
  setPassword: (value: string) => void;
  setPhoneNumber: (value: string) => void;
  setRole: (value: SignupRole) => void;
  setUsername: (value: string) => void;
  showPassword: boolean;
  step: number;
  togglePassword: () => void;
  toggleInterest: (value: string) => void;
  username: string;
  usernameStatus: Availability;
};

function SignupStep(props: SignupStepProps) {
  if (props.step === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <Input
            autoComplete="email"
            onChange={(event) => props.setEmail(event.target.value)}
            required
            type="email"
            value={props.email}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <PasswordField
            autoComplete="new-password"
            onChange={(event) => props.setPassword(event.target.value)}
            showPassword={props.showPassword}
            togglePassword={props.togglePassword}
            value={props.password}
          />
        </label>
      </div>
    );
  }

  if (props.step === 1) {
    return (
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Full name
          <Input
            autoComplete="name"
            onChange={(event) => props.setFullName(event.target.value)}
            required
            value={props.fullName}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Username
            <Input
              autoComplete="username"
              onChange={(event) => props.setUsername(event.target.value.toLowerCase())}
              pattern="[a-z0-9_]{3,20}"
              required
              value={props.username}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Phone number
            <Input
              autoComplete="tel"
              onChange={(event) => props.setPhoneNumber(event.target.value)}
              placeholder="+2348012345678"
              required
              type="tel"
              value={props.phoneNumber}
            />
          </label>
        </div>
        <AvailabilityMessage status={props.usernameStatus} />
        {props.usernameStatus.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {props.usernameStatus.suggestions.map((suggestion) => (
              <button
                className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                key={suggestion}
                onClick={() => props.setUsername(suggestion)}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <AvailabilityMessage status={props.phoneStatus} />
      </div>
    );
  }

  if (props.step === 2) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Department
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => props.setDepartmentCode(event.target.value)}
              value={props.departmentCode}
            >
              {departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Entry year
            <Input
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => props.setEntryYear(event.target.value)}
              pattern="[0-9]{4}"
              required
              value={props.entryYear}
            />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Matric number or staff ID
          <Input
            aria-describedby="institutional-id-status"
            onChange={(event) => props.setMatricOrStaffId(event.target.value)}
            placeholder="XXX/YYYY/NNN"
            required
            value={props.matricOrStaffId}
          />
        </label>
        <p
          className={
            props.idValidationValid
              ? "text-sm font-semibold text-primary"
              : "text-sm font-semibold text-destructive"
          }
          id="institutional-id-status"
        >
          {props.idValidationMessage}
        </p>
      </div>
    );
  }

  if (props.step === 3) {
    return (
      <div className="grid gap-4">
        <p className="text-sm font-semibold">Role</p>
        <div className="grid gap-4 md:grid-cols-2">
          {signupRoles.map((item) => (
            <button
              className={
                props.role === item
                  ? "rounded-md border border-primary bg-accent p-4 text-left shadow-sm"
                  : "rounded-md border bg-background p-4 text-left shadow-sm"
              }
              key={item}
              onClick={() => props.setRole(item)}
              type="button"
            >
              <span className="block text-sm font-semibold">{roleLabels[item]}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                {roleDescriptions[item]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Editor and administrator access is granted separately by an existing
          administrator after account creation.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold">Interests</p>
      <div className="grid gap-4 md:grid-cols-3">
        {interestOptions.map((item) => {
          const selected = props.interests.includes(item);
          return (
            <button
              className={
                selected
                  ? "inline-flex items-center gap-2 rounded-md border border-primary bg-accent px-4 py-2 text-sm font-semibold"
                  : "inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-semibold"
              }
              key={item}
              onClick={() => props.toggleInterest(item)}
              type="button"
            >
              {selected ? <CheckCircle2 aria-hidden className="size-4" /> : null}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PasswordField({
  autoComplete,
  onChange,
  showPassword,
  togglePassword,
  value,
}: {
  autoComplete: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword: boolean;
  togglePassword: () => void;
  value: string;
}) {
  return (
    <div className="relative">
      <Input
        autoComplete={autoComplete}
        className="pr-10"
        minLength={8}
        onChange={onChange}
        required
        type={showPassword ? "text" : "password"}
        value={value}
      />
      <button
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground"
        onClick={togglePassword}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

function AvailabilityMessage({ status }: { status: Availability }) {
  if (!status.message) {
    return null;
  }

  return (
    <p
      className={
        status.tone === "success"
          ? "text-sm font-semibold text-primary"
          : status.tone === "error"
            ? "text-sm font-semibold text-destructive"
            : "text-sm text-muted-foreground"
      }
    >
      {status.message}
    </p>
  );
}
