"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";

type Props = {
  initialName: string;
  initialAvatarUrl: string | null;
  email: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const URL_RE = /^https?:\/\//i;

export default function AccountSettingsForm({
  initialName,
  initialAvatarUrl,
  email,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [imgErrored, setImgErrored] = useState(false);
  // Track the original values we last successfully saved against so the
  // "dirty" check survives a router.refresh() without flipping back to
  // disabled. We use a ref instead of state so updating it doesn't trigger
  // a render.
  const baselineRef = useRef({
    name: initialName,
    avatarUrl: initialAvatarUrl ?? "",
  });

  // After a successful save, hide the ✓ Saved indicator after 3s.
  useEffect(() => {
    if (status.kind !== "success") return;
    const id = setTimeout(() => setStatus({ kind: "idle" }), 3000);
    return () => clearTimeout(id);
  }, [status]);

  // Reset the broken-image flag whenever the URL changes so a fresh attempt
  // can succeed.
  useEffect(() => {
    setImgErrored(false);
  }, [avatarUrl]);

  const trimmedName = name.trim();
  const trimmedAvatarUrl = avatarUrl.trim();
  const isDirty =
    trimmedName !== baselineRef.current.name.trim() ||
    trimmedAvatarUrl !== baselineRef.current.avatarUrl.trim();
  const avatarValid = trimmedAvatarUrl === "" || URL_RE.test(trimmedAvatarUrl);
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 60;
  const saving = status.kind === "saving";
  const canSave = isDirty && nameValid && avatarValid && !saving;

  // Initial for the fallback avatar circle.
  const initial = useMemo(() => {
    const src = trimmedName || email || "?";
    return src.charAt(0).toUpperCase();
  }, [trimmedName, email]);

  async function handleSave() {
    if (!canSave) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: trimmedName,
          avatar_url: trimmedAvatarUrl || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setStatus({
          kind: "error",
          message: body?.error ?? "Failed to save.",
        });
        return;
      }
      baselineRef.current = {
        name: trimmedName,
        avatarUrl: trimmedAvatarUrl,
      };
      setStatus({ kind: "success" });
      // Tell server components above (sidebar widget, navbar pill, greeting)
      // to re-render with the new profile.
      router.refresh();
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Network error. Try again.",
      });
    }
  }

  return (
    <Card padding="32px">
      <div style={{ marginBottom: "28px" }}>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            marginBottom: "4px",
            letterSpacing: "-0.015em",
          }}
        >
          Account
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Update your personal information.
        </p>
      </div>

      {/* Avatar preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "28px",
        }}
      >
        <AvatarPreview
          url={trimmedAvatarUrl}
          letter={initial}
          errored={imgErrored}
          onError={() => setImgErrored(true)}
        />
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          This is your profile picture. Paste an image URL below.
        </p>
      </div>

      {/* Form fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <FieldGroup
          label="Display name"
          helper="How your name appears across Pulse."
          htmlFor="displayName"
        >
          <TextInput
            id="displayName"
            value={name}
            onChange={setName}
            maxLength={60}
            placeholder="Your name"
            required
          />
        </FieldGroup>

        <FieldGroup
          label="Avatar URL"
          helper="Paste a public image URL (e.g. from Gravatar, GitHub, imgur). Leave blank to use your initial."
          htmlFor="avatarUrl"
        >
          <TextInput
            id="avatarUrl"
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="https://…"
            invalid={
              trimmedAvatarUrl !== "" && !URL_RE.test(trimmedAvatarUrl)
            }
          />
        </FieldGroup>

        <FieldGroup
          label="Email"
          helper="Contact support to change your email."
        >
          <ReadOnlyValue value={email} />
        </FieldGroup>
      </div>

      {/* Save row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "28px",
          paddingTop: "24px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <StatusText status={status} />
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            background: "var(--accent)",
            color: "var(--text-primary)",
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.5,
            transition: "opacity 150ms ease-out",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            if (canSave) e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            if (canSave) e.currentTarget.style.opacity = "1";
          }}
        >
          Save changes
        </button>
      </div>
    </Card>
  );
}

function AvatarPreview({
  url,
  letter,
  errored,
  onError,
}: {
  url: string;
  letter: string;
  errored: boolean;
  onError: () => void;
}) {
  const useLetter = !url || errored || !URL_RE.test(url);
  if (useLetter) {
    return (
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--text-primary)",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {letter}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Avatar preview"
      width={72}
      height={72}
      onError={onError}
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "1px solid var(--border)",
      }}
    />
  );
}

function FieldGroup({
  label,
  helper,
  htmlFor,
  children,
}: {
  label: string;
  helper: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          margin: 0,
          marginBottom: "10px",
        }}
      >
        {helper}
      </p>
      {children}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      style={{
        width: "100%",
        background: "var(--bg-elevated)",
        border: `1px solid ${
          invalid
            ? "var(--accent-red)"
            : focused
              ? "var(--accent)"
              : "var(--border)"
        }`,
        borderRadius: "10px",
        padding: "12px 14px",
        color: "var(--text-primary)",
        fontSize: "14px",
        outline: "none",
        fontFamily: "inherit",
        transition: "border-color 150ms ease-out",
      }}
    />
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div
      style={{
        width: "100%",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "12px 14px",
        color: "var(--text-muted)",
        fontSize: "14px",
        cursor: "not-allowed",
        userSelect: "text",
      }}
      aria-readonly="true"
    >
      {value}
    </div>
  );
}

function StatusText({ status }: { status: Status }) {
  if (status.kind === "idle") {
    return <span style={{ fontSize: "13px" }}>&nbsp;</span>;
  }
  if (status.kind === "saving") {
    return (
      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
        Saving…
      </span>
    );
  }
  if (status.kind === "success") {
    return (
      <span style={{ fontSize: "13px", color: "var(--accent-green)" }}>
        ✓ Saved
      </span>
    );
  }
  return (
    <span style={{ fontSize: "13px", color: "var(--accent-red)" }}>
      Error: {status.message}
    </span>
  );
}
