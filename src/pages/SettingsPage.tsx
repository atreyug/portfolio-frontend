import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  KeyRound,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/fields";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useSessionData } from "@/context/SessionDataContext";
import { changeMyPassword, deleteMyAccount, updateMyProfile } from "@/services/managers";
import { normalizeApiError } from "@/services/client";
import { formatDateTime } from "@/utils/format";
import { isEmail, passwordIssues, required } from "@/utils/validate";
import { titleCase } from "@/utils/format";

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { manager, setManager, logout } = useAuth();
  const { clearAll } = useSessionData();
  const toast = useToast();
  const navigate = useNavigate();

  /* ------------------------------ profile ------------------------------ */
  const initialName = typeof manager?.full_name === "string" ? manager.full_name : typeof manager?.name === "string" ? manager.name : "";
  const initialEmail = typeof manager?.email === "string" ? manager.email : "";
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const dirty = fullName.trim() !== initialName || email.trim() !== initialEmail;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (required(email)) next.email = "Email is required.";
    else if (!isEmail(email)) next.email = "Enter a valid email address.";
    setProfileErrors(next);
    if (Object.keys(next).length) return;

    setSavingProfile(true);
    try {
      const payload: Record<string, string> = {};
      if (email.trim() !== initialEmail) payload.email = email.trim().toLowerCase();
      if (fullName.trim() !== initialName) {
        payload.full_name = fullName.trim();
        payload.name = fullName.trim();
      }
      const updated = await updateMyProfile(payload);
      setManager({ ...(manager ?? {}), ...updated });
      toast.success("Profile updated");
    } catch (err) {
      const e2 = normalizeApiError(err);
      toast.error("Update failed", e2.details?.[0] ?? e2.message);
    } finally {
      setSavingProfile(false);
    }
  };

  /* ------------------------------ password ------------------------------ */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState(false);

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (required(currentPw)) next.current = "Current password is required.";
    const issue = passwordIssues(newPw);
    if (required(newPw)) next.new = "New password is required.";
    else if (issue) next.new = issue;
    if (confirmPw !== newPw) next.confirm = "Passwords do not match.";
    if (currentPw && newPw && currentPw === newPw) next.new = "New password must differ from the current one.";
    setPwErrors(next);
    if (Object.keys(next).length) return;

    setSavingPw(true);
    try {
      await changeMyPassword({ current_password: currentPw, old_password: currentPw, new_password: newPw });
      toast.success("Password changed", "Use your new password next time you sign in.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const e2 = normalizeApiError(err);
      toast.error("Password change failed", e2.details?.[0] ?? e2.message);
    } finally {
      setSavingPw(false);
    }
  };

  /* ------------------------------- deletion ----------------------------- */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount(deletePw.trim() || undefined);
      toast.success("Account deleted", "Your account and profile have been removed.");
      clearAll();
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error("Deletion failed", normalizeApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const signOutEverywhere = () => {
    clearAll();
    logout();
    navigate("/login", { replace: true });
    toast.info("Signed out", "Session data was cleared from memory.");
  };

  const otherFields = Object.entries(manager ?? {}).filter(
    ([k, v]) =>
      !["id", "email", "full_name", "name", "created_at", "updated_at", "password", "hashed_password"].includes(k) &&
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean"),
  );

  const createdAt = typeof manager?.created_at === "string" ? manager.created_at : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" subtitle="Manage your account, credentials and session." />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" subtitle="How your account is identified" icon={<User className="h-4 w-4" />} />
          <CardBody>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow icon={KeyRound} label="Manager ID" value={manager?.id !== undefined ? String(manager.id) : "—"} />
                <InfoRow icon={Calendar} label="Member since" value={createdAt ? formatDateTime(createdAt) : "—"} />
              </div>
              <Field label="Full name" error={profileErrors.fullName}>
                {(id) => <Input id={id} value={fullName} placeholder="Your name" autoComplete="name" onChange={(e) => setFullName(e.target.value)} />}
              </Field>
              <Field label="Email address" required error={profileErrors.email}>
                {(id) => (
                  <Input id={id} type="email" value={email} invalid={!!profileErrors.email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                )}
              </Field>
              {otherFields.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">From your account record</p>
                  <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {otherFields.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 text-[13px]">
                        <dt className="text-slate-500">{titleCase(k)}</dt>
                        <dd className="truncate font-medium text-slate-800">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={!dirty} loading={savingProfile}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Password */}
        <Card className="h-fit">
          <CardHeader title="Password" subtitle="Change the password you sign in with" icon={<ShieldCheck className="h-4 w-4" />} />
          <CardBody>
            <form onSubmit={savePassword} className="space-y-4">
              <Field label="Current password" required error={pwErrors.current}>
                {(id) => (
                  <PasswordInput id={id} value={currentPw} invalid={!!pwErrors.current} autoComplete="current-password" onChange={(e) => setCurrentPw(e.target.value)} />
                )}
              </Field>
              <Field label="New password" required error={pwErrors.new} hint="At least 8 characters with a letter and a number.">
                {(id) => <PasswordInput id={id} value={newPw} invalid={!!pwErrors.new} autoComplete="new-password" onChange={(e) => setNewPw(e.target.value)} />}
              </Field>
              <Field label="Confirm new password" required error={pwErrors.confirm}>
                {(id) => <PasswordInput id={id} value={confirmPw} invalid={!!pwErrors.confirm} autoComplete="new-password" onChange={(e) => setConfirmPw(e.target.value)} />}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="navy" loading={savingPw}>
                  <KeyRound className="h-4 w-4" /> Change password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Session */}
        <Card className="h-fit">
          <CardHeader title="Session" subtitle="Your data posture on this device" icon={<LogOut className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="text-[13px] leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">Privacy-first session</p>
                <p className="mt-1">
                  Analysis payloads and results live in memory only. Signing out clears them instantly and drops your
                  access token.
                </p>
              </div>
              <Badge tone="emerald">Active</Badge>
            </div>
            <Button variant="secondary" onClick={signOutEverywhere} className="w-full">
              <LogOut className="h-4 w-4" /> Sign out of this workspace
            </Button>
          </CardBody>
        </Card>

        {/* Danger zone */}
        <Card className="h-fit border-rose-200/80">
          <CardHeader
            title={<span className="text-rose-600">Danger zone</span>}
            subtitle="Irreversible account actions"
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          />
          <CardBody className="space-y-4">
            <p className="text-[13px] leading-relaxed text-slate-600">
              Deleting your account permanently removes your manager profile from the backend. This action cannot be
              undone, and any alerts tied to your account may be removed.
            </p>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete account
            </Button>
          </CardBody>
        </Card>
      </div>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete your account?" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              This permanently deletes your manager account <strong>{initialEmail || ""}</strong>. There is no recovery.
            </p>
          </div>
          <Field label="Password (if the backend requires it)" hint="Sent with the delete request; never stored.">
            {(id) => <PasswordInput id={id} value={deletePw} autoComplete="current-password" onChange={(e) => setDeletePw(e.target.value)} placeholder="Confirm with your password" />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Keep my account
            </Button>
            <DeleteConfirmTrigger deleting={deleting} onConfirm={doDelete} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DeleteConfirmTrigger({ deleting, onConfirm }: { deleting: boolean; onConfirm: () => Promise<void> }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setConfirmOpen(true)} loading={deleting}>
        <Trash2 className="h-4 w-4" /> Continue to delete
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await onConfirm();
          setConfirmOpen(false);
        }}
        loading={deleting}
        danger
        typeToConfirm="DELETE"
        title="Final confirmation"
        message={
          <>
            Type <span className="font-mono font-semibold">DELETE</span> to permanently remove your account. This is your
            last chance to turn back.
          </>
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}
