"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type TutorialRole = "reader" | "journalist" | "editor" | "admin" | "subadmin";

type Profile = {
  id: string;
  full_name: string;
  role: TutorialRole;
  preferences: unknown;
};

type TutorialStep = {
  title: string;
  body: string;
};

const tutorialScripts: Record<Exclude<TutorialRole, "subadmin">, TutorialStep[]> = {
  reader: [
    {
      title: "Start with For you",
      body: "Your reader home ranks published campus stories around the interests saved on your profile.",
    },
    {
      title: "Follow useful writers",
      body: "Use Search and Following to find journalists, then follow the ones whose reporting you want to keep seeing.",
    },
    {
      title: "Save stories",
      body: "Bookmarks keep articles attached to your account so you can return to them from any signed-in browser.",
    },
    {
      title: "Join carefully",
      body: "Comments and likes are public activity around published stories. Saved articles stay private.",
    },
  ],
  journalist: [
    {
      title: "Check your home first",
      body: "Your journalist home summarizes drafts, submitted stories, AI report status, and published engagement.",
    },
    {
      title: "Write in the desk",
      body: "Open the writing desk to draft, autosave, polish readability and grammar, then submit for review.",
    },
    {
      title: "Track review status",
      body: "Submitted stories move through editorial review, revision requested, approved, rejected, or published states.",
    },
    {
      title: "Use AI Hint carefully",
      body: "When an editor asks for revisions, AI Hint can point to specific issues, but the editor note is the main direction.",
    },
    {
      title: "Keep your portfolio current",
      body: "Your public portfolio shows your verified badge, follower count, published work, and credibility track record.",
    },
  ],
  editor: [
    {
      title: "Start on editor home",
      body: "The editor home shows review pressure, time-sensitive submissions, common AI report flags, and recent decisions.",
    },
    {
      title: "Open the review queue",
      body: "The review queue is where you read submissions beside the full AI analysis report.",
    },
    {
      title: "Decide with notes",
      body: "Approvals, rejections, and revision requests should include plain notes a journalist can act on.",
    },
    {
      title: "Protect internal context",
      body: "AI analysis report contents and private decision notes stay inside the editorial workflow.",
    },
  ],
  admin: [
    {
      title: "Start on admin home",
      body: "The admin home summarizes moderation movement, pending appeals, roster status, and pending invites.",
    },
    {
      title: "Open the control panel",
      body: "Use the control panel for user moderation, appeals, roster upload, invites, and test-mode monetisation tools.",
    },
    {
      title: "Use roster verification",
      body: "Roster uploads match Chrisland IDs to profiles and award the Verified Chrisland Student badge.",
    },
    {
      title: "Handle moderation consistently",
      body: "Warnings, suspensions, bans, restores, and appeal decisions should use the connected moderation actions model.",
    },
  ],
};

export function RoleTutorial() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTutorialState() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (active) {
          setProfile(null);
          setVisible(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, preferences")
        .eq("id", userId)
        .single();

      if (!active || !data || !isTutorialRole(data.role)) {
        return;
      }

      const typedProfile = data as Profile;
      const scriptKey = scriptRole(typedProfile.role);
      const dismissed = readTutorialDismissed(typedProfile.preferences, scriptKey);
      const sessionKey = tutorialSessionKey(typedProfile.id, scriptKey);
      setProfile(typedProfile);
      setVisible(!dismissed && window.sessionStorage.getItem(sessionKey) !== "remind_later");
      setStepIndex(0);
    }

    void loadTutorialState();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadTutorialState();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (!profile || !visible) {
    return null;
  }

  const role = scriptRole(profile.role);
  const steps = tutorialScripts[role];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  async function save(action: "finish" | "skip" | "remind_later") {
    if (!profile) {
      return;
    }

    setSaving(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setSaving(false);
      setVisible(false);
      return;
    }

    const response = await fetch("/api/onboarding/tutorial", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, role: profile.role }),
    }).catch(() => null);

    setSaving(false);
    if (action === "remind_later") {
      window.sessionStorage.setItem(tutorialSessionKey(profile.id, role), "remind_later");
    }

    if (!response || response.ok) {
      setVisible(false);
    }
  }

  return (
    <section
      aria-label={`${roleLabel(profile.role)} onboarding tutorial`}
      className="fixed bottom-6 right-6 z-50 grid w-[min(24rem,calc(100vw-3rem))] gap-4 rounded-md border bg-card p-5 shadow-sm"
      data-testid="role-onboarding-tutorial"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase text-primary">
            {roleLabel(profile.role)} tutorial
          </p>
          <h2 className="text-xl font-semibold">{step.title}</h2>
        </div>
        <button
          aria-label="Skip tutorial"
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
          disabled={saving}
          onClick={() => void save("skip")}
          title="Skip tutorial"
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Step {stepIndex + 1} of {steps.length}
        </span>
        <button
          className="font-semibold text-primary disabled:text-muted-foreground"
          disabled={saving}
          onClick={() => void save("remind_later")}
          type="button"
        >
          Remind me later
        </button>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t pt-4">
        <Button
          disabled={saving || stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </Button>
        <div className="flex gap-3">
          <Button disabled={saving} onClick={() => void save("skip")} type="button" variant="outline">
            Skip
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              if (isLastStep) {
                void save("finish");
                return;
              }
              setStepIndex((current) => Math.min(steps.length - 1, current + 1));
            }}
            type="button"
          >
            {isLastStep ? "Finish" : "Next"}
            {!isLastStep ? <ChevronRight aria-hidden className="size-4" /> : null}
          </Button>
        </div>
      </div>
    </section>
  );
}

function scriptRole(role: TutorialRole): Exclude<TutorialRole, "subadmin"> {
  return role === "subadmin" ? "admin" : role;
}

function roleLabel(role: TutorialRole) {
  if (role === "journalist") {
    return "Journalist";
  }
  if (role === "editor") {
    return "Editor";
  }
  if (role === "admin") {
    return "Admin";
  }
  if (role === "subadmin") {
    return "Subadmin";
  }
  return "Reader";
}

function tutorialSessionKey(userId: string, role: Exclude<TutorialRole, "subadmin">) {
  return `campuspress:tutorial:${userId}:${role}`;
}

function readTutorialDismissed(preferences: unknown, role: Exclude<TutorialRole, "subadmin">) {
  const prefs = objectValue(preferences);
  const tutorial = objectValue(prefs.tutorial);
  const dismissed = objectValue(tutorial.dismissed);
  return dismissed[role] === true;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isTutorialRole(value: string): value is TutorialRole {
  return ["reader", "journalist", "editor", "admin", "subadmin"].includes(value);
}
