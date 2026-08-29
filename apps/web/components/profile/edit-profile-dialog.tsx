"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { FormMessage, type Message } from "@/components/form-message";
import { ProfileClientAPI } from "@/lib/api/profile-client";

import { handleRejectionKind, profileErrorField } from "./profile-data";

/**
 * Edit profile — the owner's one affordance on `/my/profile`.
 *
 * Three things and no more: name, picture, handle. They are the three fields
 * `PATCH /profile` accepts, and a form offering a fourth would be offering
 * something the API will silently drop.
 *
 * **It talks to `PATCH`, not `PUT`.** The old `ProfileForm` sent
 * `PUT /profile { name }` by hand with `fetch`, which is the pre-handle
 * endpoint: it cannot set a handle, it does not run the 30-day rule, and it
 * answers a rejected value with a 500. `PATCH` is the endpoint that knows the
 * rules, and this goes through the generated client so the request shape is
 * the contract's rather than this file's.
 *
 * **Both 409s land under the handle field, and they are surfaced differently**,
 * because the reader can act on one and not the other:
 *
 *  - *taken* — the field stays editable and keeps focus. The next thing to do
 *    is type a different handle, so the form leaves them where they can.
 *  - *cooldown* — the field is reverted and locked for the rest of the dialog.
 *    There is nothing to type; a field that still accepts keystrokes it will
 *    reject again is an invitation to fail twice.
 *
 * Neither is a page-level banner (docs/design-system/pages.md § Auth, the rule
 * every form in the app now follows): the message sits under the field it is
 * about, carries the field's `aria-describedby`, and the field carries
 * `aria-invalid`.
 */
export interface EditProfileDialogProps {
  name: string;
  pictureUrl: string;
  handle: string;
  /**
   * "12 September 2026", already formatted **on the server**.
   *
   * A `Date` formatted in the browser would be a different string than the one
   * the server rendered for any reader outside the server's locale, and React
   * abandons hydration on a text mismatch — leaving a page that screenshots
   * perfectly and whose every button is dead. Absent when the handle is free
   * to change now.
   */
  handleAvailableOn?: string;
}

type FieldName = "name" | "pictureUrl" | "handle";

export function EditProfileDialog({
  name: initialName,
  pictureUrl: initialPicture,
  handle: initialHandle,
  handleAvailableOn,
}: EditProfileDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [pictureUrl, setPictureUrl] = React.useState(initialPicture);
  const [handle, setHandle] = React.useState(initialHandle);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>(
    {}
  );
  // Set by a cooldown 409, or known up front from `handleAvailableOn`.
  const [lockedUntil, setLockedUntil] = React.useState<string | null>(
    handleAvailableOn ?? null
  );

  const handleInput = React.useRef<HTMLInputElement>(null);

  // Opening is the reset point, not closing: a dialog that cleared itself on
  // the way out would blank the fields while it was still animating away.
  function change(next: boolean) {
    if (next) {
      setName(initialName);
      setPictureUrl(initialPicture);
      setHandle(initialHandle);
      setErrors({});
      setLockedUntil(handleAvailableOn ?? null);
    }
    setOpen(next);
  }

  const handleLocked = lockedUntil !== null;

  const trimmedName = name.trim();
  const trimmedPicture = pictureUrl.trim();
  const trimmedHandle = handle.trim().toLowerCase();

  const dirty =
    trimmedName !== initialName.trim() ||
    trimmedPicture !== initialPicture.trim() ||
    (!handleLocked && trimmedHandle !== initialHandle);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;

    setSaving(true);
    setErrors({});

    // Only what changed. Sending every field on every save would spend the
    // 30-day handle allowance on someone who only renamed themselves — the
    // service treats an unchanged handle as free, but relying on that is
    // relying on a rule this form does not own.
    const request: {
      name?: string | null;
      pictureUrl?: string | null;
      handle?: string;
    } = {};

    if (trimmedName !== initialName.trim()) {
      // Empty means "remove it", which the API spells `null`. Sending `""`
      // would store an empty display name and the profile would render a
      // nameless heading.
      request.name = trimmedName === "" ? null : trimmedName;
    }
    if (trimmedPicture !== initialPicture.trim()) {
      request.pictureUrl = trimmedPicture === "" ? null : trimmedPicture;
    }
    if (!handleLocked && trimmedHandle !== initialHandle) {
      request.handle = trimmedHandle;
    }

    const result = await ProfileClientAPI.update(request);
    setSaving(false);

    if (result.ok) {
      setOpen(false);
      // The page is server-rendered from `GET /users/{handle}`; this is what
      // makes the new name appear without a full reload.
      router.refresh();
      toast({ title: "Profile updated", variant: "success" });
      return;
    }

    const field = profileErrorField(result.message);
    setErrors({ [field]: result.message });

    if (field !== "handle") return;

    if (handleRejectionKind(result.message) === "cooldown") {
      // Nothing to retype. Put the handle back and stop offering the field.
      setHandle(initialHandle);
      setLockedUntil(result.message);
      return;
    }

    // Taken, or the wrong shape: the next keystroke is the fix.
    handleInput.current?.focus();
    handleInput.current?.select();
  }

  const handleMessage: Message | null = errors.handle
    ? { error: errors.handle }
    : handleLocked
      ? { message: lockedUntil }
      : null;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button variant="secondary">Edit profile</Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name and picture appear on everything you make public. Your
            handle is your profile&rsquo;s address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="flex flex-col gap-4">
          <Field
            label="Display name"
            htmlFor="cd-profile-name"
            message={
              errors.name ? (
                <FormMessage
                  id="cd-profile-name-message"
                  message={{ error: errors.name }}
                />
              ) : null
            }
          >
            <Input
              id="cd-profile-name"
              value={name}
              maxLength={200}
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? "cd-profile-name-message" : undefined
              }
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
            />
          </Field>

          <Field
            label="Picture URL"
            htmlFor="cd-profile-picture"
            message={
              errors.pictureUrl ? (
                <FormMessage
                  id="cd-profile-picture-message"
                  message={{ error: errors.pictureUrl }}
                />
              ) : null
            }
          >
            <Input
              id="cd-profile-picture"
              value={pictureUrl}
              maxLength={2048}
              inputMode="url"
              spellCheck={false}
              placeholder="https://…"
              aria-invalid={Boolean(errors.pictureUrl)}
              aria-describedby={
                errors.pictureUrl ? "cd-profile-picture-message" : undefined
              }
              onChange={(event) => {
                setPictureUrl(event.target.value);
                setErrors((current) => ({ ...current, pictureUrl: undefined }));
              }}
            />
          </Field>

          <Field
            label="Handle"
            htmlFor="cd-profile-handle"
            message={
              handleMessage ? (
                <FormMessage
                  id="cd-profile-handle-message"
                  message={handleMessage}
                />
              ) : (
                <p className="font-sans text-[12.5px] leading-[1.45] text-fg-tertiary">
                  Lowercase letters, numbers and underscores. Changeable once
                  every 30 days.
                </p>
              )
            }
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] leading-none text-fg-tertiary">
                /u/
              </span>
              <Input
                id="cd-profile-handle"
                ref={handleInput}
                value={handle}
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                disabled={handleLocked}
                aria-invalid={Boolean(errors.handle)}
                aria-describedby={
                  handleMessage ? "cd-profile-handle-message" : undefined
                }
                onChange={(event) => {
                  setHandle(event.target.value.toLowerCase());
                  setErrors((current) => ({ ...current, handle: undefined }));
                }}
              />
            </div>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => change(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!dirty}
            >
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One labelled field with its message slot underneath.
 *
 * The auth pages have their own copy of this shape inside their route group;
 * this is the same idea for a dialog, and it exists so the message slot is
 * part of the field rather than something the form remembers to place.
 */
function Field({
  label,
  htmlFor,
  children,
  message,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  message?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-sans text-[12.5px] font-medium leading-none text-fg-secondary"
      >
        {label}
      </label>
      {children}
      {message}
    </div>
  );
}
