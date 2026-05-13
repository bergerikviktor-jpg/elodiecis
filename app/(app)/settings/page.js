"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  Bell,
  Eye,
  Palette,
  AlertTriangle,
  Camera,
  Copy,
  Check,
  LogOut,
  KeyRound,
  MailCheck,
  Mail,
  ShieldCheck,
  Trash2,
  Database,
  Calendar,
  Clock,
  Monitor,
} from "lucide-react";
import { sendEmailVerification } from "firebase/auth";

import Header from "@/components/layout/Header";
import SettingsCard from "@/components/ui/SettingsCard";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/FormFields";

import ChangePasswordModal from "@/components/modals/ChangePasswordModal";
import DeleteAccountModal from "@/components/modals/DeleteAccountModal";
import AvatarUploadModal from "@/components/modals/AvatarUploadModal";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfile } from "@/lib/useUserProfile";
import { auth } from "@/lib/firebase";
import { updateProfileNames, updatePreferences } from "@/lib/account";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function toJsDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

function formatFullDateTime(timestamp) {
  const date = toJsDate(timestamp);
  if (!date) return "—";
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAccountAge(timestamp) {
  const date = toJsDate(timestamp);
  if (!date) return "—";
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (months < 1) {
    const days = Math.max(0, Math.floor((now - date) / 86400000));
    return `${days} ${days === 1 ? "dag" : "dagar"}`;
  }
  if (months < 12) {
    return `${months} ${months === 1 ? "månad" : "månader"}`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0
    ? `${years} ${years === 1 ? "år" : "år"} ${rem} ${rem === 1 ? "månad" : "månader"}`
    : `${years} ${years === 1 ? "år" : "år"}`;
}

function passwordStrengthLabel(timestamp) {
  const date = toJsDate(timestamp);
  if (!date) return { label: "Okänt", color: "text-slate-500" };
  const days = (Date.now() - date.getTime()) / 86400000;
  if (days < 90) return { label: "Färskt", color: "text-emerald-600" };
  if (days < 180) return { label: "OK", color: "text-amber-600" };
  return { label: "Dags att byta", color: "text-red-600" };
}

/* ──────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const { profile, loading } = useUserProfile();

  // Modal state
  const [pwModal, setPwModal] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null); // null | "delete-all" | "delete-account"

  if (loading || !profile) {
    return (
      <>
        <Header title="Inställningar" subtitle="// laddar..." />
        <div className="p-8 max-w-4xl mx-auto">
          <SettingsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Inställningar" subtitle="// account.settings()" />

      <div className="p-8 space-y-6 max-w-4xl mx-auto animate-fade-in">
        <ProfileSection profile={profile} onAvatarClick={() => setAvatarModal(true)} />
        <AccountSection
          profile={profile}
          user={user}
          onChangePassword={() => setPwModal(true)}
          onLogout={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
        <SecuritySection
          profile={profile}
          onChangePassword={() => setPwModal(true)}
        />
        <NotificationsSection profile={profile} user={user} />
        <PrivacySection profile={profile} user={user} />
        <AppearanceSection profile={profile} user={user} />
        <DangerZone
          onRemoveAllData={() => setDeleteMode("delete-all")}
          onDeleteAccount={() => setDeleteMode("delete-account")}
        />
      </div>

      <ChangePasswordModal
        isOpen={pwModal}
        onClose={() => setPwModal(false)}
      />
      <AvatarUploadModal
        isOpen={avatarModal}
        onClose={() => setAvatarModal(false)}
        profile={profile}
      />
      <DeleteAccountModal
        isOpen={!!deleteMode}
        mode={deleteMode || "delete-account"}
        onClose={() => setDeleteMode(null)}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sections
   ────────────────────────────────────────────────────────────────── */

function ProfileSection({ profile, onAvatarClick }) {
  const toast = useToast();

  // Local form state — initialized from profile, reset whenever profile changes.
  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // When the upstream profile updates (e.g. another tab edited), pull fresh values
  // unless the user is mid-edit (the inputs differ from saved profile).
  useEffect(() => {
    setFirstName(profile.firstName || "");
    setLastName(profile.lastName || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.firstName, profile.lastName]);

  const previewDisplayName = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return [f, l].filter(Boolean).join(" ") || "—";
  }, [firstName, lastName]);

  const dirty =
    firstName.trim() !== (profile.firstName || "") ||
    lastName.trim() !== (profile.lastName || "");
  const valid = firstName.trim().length > 0;

  const handleSave = async () => {
    if (!dirty || !valid) return;
    setSaving(true);
    try {
      await updateProfileNames(profile.uid || profile.id, {
        firstName,
        lastName,
      });
      toast.success("Profil uppdaterad.");
    } catch (err) {
      console.error("updateProfileNames failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte spara profil.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(profile.uid || profile.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Kunde inte kopiera UID.");
    }
  };

  return (
    <SettingsCard
      icon={User}
      title="Profil"
      description="// din identitet i appen"
    >
      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onAvatarClick}
            className="relative group rounded-full"
            aria-label="Ändra profilbild"
          >
            <Avatar
              name={profile.displayName}
              src={profile.photoURL}
              size="xl"
              className="w-20 h-20 text-xl"
            />
            <div className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/50 transition-colors flex items-center justify-center">
              <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
          <div>
            <p className="text-sm font-body font-semibold text-slate-900">
              Profilbild
            </p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Klicka på bilden för att byta
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={Camera}
              className="mt-2"
              onClick={onAvatarClick}
            >
              Ladda upp
            </Button>
          </div>
        </div>

        {/* Name inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Förnamn"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={saving}
            maxLength={50}
            required
          />
          <Input
            label="Efternamn"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={saving}
            maxLength={50}
          />
        </div>

        {/* Computed display name */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Visningsnamn (auto)
          </label>
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-body flex items-center justify-between">
            <span className="truncate">{previewDisplayName}</span>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest shrink-0 ml-3">
              härleds från för- &amp; efternamn
            </span>
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            E-postadress
          </label>
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-mono flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>
        </div>

        {/* UID with copy */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Firebase UID
          </label>
          <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono flex items-center gap-2">
            <span className="truncate flex-1">{profile.uid || profile.id}</span>
            <button
              type="button"
              onClick={handleCopyUid}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 hover:text-[#0052FF] transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  Kopierat
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Kopiera
                </>
              )}
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-100">
          <Button
            loading={saving}
            disabled={!dirty || !valid}
            onClick={handleSave}
          >
            Spara ändringar
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function AccountSection({ profile, user, onChangePassword, onLogout }) {
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!auth.currentUser) return;
    setVerifying(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verifieringsmejl skickat. Kolla även skräpposten.");
    } catch (err) {
      console.error("sendEmailVerification failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte skicka mejl.");
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = !!user?.emailVerified;

  return (
    <SettingsCard
      icon={ShieldCheck}
      title="Konto"
      description="// account.info()"
    >
      <dl className="space-y-4">
        <InfoRow icon={Calendar} label="Konto skapat">
          <div>
            <p className="text-sm text-slate-900 font-body">
              {formatFullDateTime(profile.createdAt)}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Ålder: {formatAccountAge(profile.createdAt)}
            </p>
          </div>
        </InfoRow>

        <InfoRow icon={Clock} label="Senaste inloggning">
          <p className="text-sm text-slate-900 font-body">
            {formatRelativeTime(profile.lastLoginAt)}
          </p>
        </InfoRow>

        <InfoRow icon={ShieldCheck} label="Kontostatus">
          <Badge color="#22c55e" size="sm">
            {profile.accountStatus === "active" ? "Aktiv" : profile.accountStatus || "Aktiv"}
          </Badge>
        </InfoRow>

        <InfoRow icon={MailCheck} label="E-postverifiering">
          {isVerified ? (
            <Badge color="#22c55e" size="sm">
              Verifierad
            </Badge>
          ) : (
            <div className="flex items-center gap-3">
              <Badge color="#f59e0b" size="sm">
                Ej verifierad
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                loading={verifying}
                onClick={handleVerify}
              >
                Skicka mejl
              </Button>
            </div>
          )}
        </InfoRow>
      </dl>

      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="secondary" icon={KeyRound} onClick={onChangePassword}>
          Byt lösenord
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={onLogout}>
          Logga ut
        </Button>
      </div>
    </SettingsCard>
  );
}

function SecuritySection({ profile, onChangePassword }) {
  const strength = passwordStrengthLabel(profile.lastPasswordUpdate);

  return (
    <SettingsCard
      icon={Shield}
      title="Säkerhet"
      description="// security.policy()"
    >
      <dl className="space-y-4">
        <InfoRow icon={KeyRound} label="Lösenord">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn("text-sm font-body font-medium", strength.color)}>
              {strength.label}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {profile.lastPasswordUpdate
                ? `Senast uppdaterad ${formatRelativeTime(profile.lastPasswordUpdate)}`
                : "Aldrig uppdaterat sedan registrering"}
            </span>
            <Button size="sm" variant="secondary" onClick={onChangePassword}>
              Byt lösenord
            </Button>
          </div>
        </InfoRow>

        <InfoRow icon={Monitor} label="Aktiva sessioner">
          <div>
            <p className="text-sm text-slate-700 font-body">Den här enheten</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Sessionhantering kommer i en framtida version.
            </p>
          </div>
        </InfoRow>

        <InfoRow icon={ShieldCheck} label="Reauthentication">
          <p className="text-sm text-slate-700 font-body leading-relaxed">
            Säkerhetskritiska åtgärder (lösenordsbyte, kontoradering) kräver att
            du bekräftar ditt nuvarande lösenord.
          </p>
        </InfoRow>
      </dl>
    </SettingsCard>
  );
}

function NotificationsSection({ profile, user }) {
  const toast = useToast();
  const set = async (key, value) => {
    try {
      await updatePreferences(user.uid, { [key]: value });
    } catch (err) {
      console.error("updatePreferences failed", err?.code, err?.message);
      toast.error("Kunde inte spara inställningen.");
      throw err;
    }
  };

  return (
    <SettingsCard
      icon={Bell}
      title="Notifikationer"
      description="// notifications.preferences()"
    >
      <div className="divide-y divide-slate-100">
        <Toggle
          label="Notifikationer aktiverade"
          description="Slå av/på alla notifikationer från ElodieCIS"
          checked={!!profile.notificationsEnabled}
          onChange={(v) => set("notificationsEnabled", v)}
        />
        <Toggle
          label="E-postnotifikationer"
          description="Få sammanfattningar och viktiga händelser via e-post"
          checked={!!profile.emailNotifications}
          onChange={(v) => set("emailNotifications", v)}
          disabled={!profile.notificationsEnabled}
        />
        <Toggle
          label="Ljudnotifikationer"
          description="Spela upp ett ljud när nya händelser inträffar"
          checked={!!profile.soundEnabled}
          onChange={(v) => set("soundEnabled", v)}
          disabled={!profile.notificationsEnabled}
        />
        <Toggle
          label="Chattnotifikationer"
          description="Notifikationer för nya meddelanden"
          checked={!!profile.chatNotifications}
          onChange={(v) => set("chatNotifications", v)}
          disabled={!profile.notificationsEnabled}
        />
        <Toggle
          label="Vänförfrågningar"
          description="Notifikationer när någon skickar en vänförfrågan"
          checked={!!profile.friendRequestNotifications}
          onChange={(v) => set("friendRequestNotifications", v)}
          disabled={!profile.notificationsEnabled}
        />
      </div>
    </SettingsCard>
  );
}

function PrivacySection({ profile, user }) {
  const toast = useToast();
  const set = async (key, value) => {
    try {
      await updatePreferences(user.uid, { [key]: value });
    } catch (err) {
      console.error("updatePreferences failed", err?.code, err?.message);
      toast.error("Kunde inte spara inställningen.");
      throw err;
    }
  };

  return (
    <SettingsCard
      icon={Eye}
      title="Integritet"
      description="// privacy.preferences()"
    >
      <div className="divide-y divide-slate-100">
        <Toggle
          label="Visa min online-status"
          description="Andra användare ser om du är online, borta eller offline"
          checked={!!profile.showOnlineStatus}
          onChange={(v) => set("showOnlineStatus", v)}
        />
        <Toggle
          label="Tillåt vänförfrågningar"
          description="Andra användare kan skicka dig vänförfrågningar"
          checked={!!profile.allowFriendRequests}
          onChange={(v) => set("allowFriendRequests", v)}
        />
        <Toggle
          label="Meddelanden från icke-vänner"
          description="Tillåt direktmeddelanden från användare som inte är dina vänner"
          checked={!!profile.allowMessagesFromNonFriends}
          onChange={(v) => set("allowMessagesFromNonFriends", v)}
        />
        <Toggle
          label="Privat läge"
          description="Dölj din profil från sökning för icke-vänner"
          checked={!!profile.privacyMode}
          onChange={(v) => set("privacyMode", v)}
        />
      </div>
    </SettingsCard>
  );
}

function AppearanceSection({ profile, user }) {
  const toast = useToast();
  const set = async (key, value) => {
    try {
      await updatePreferences(user.uid, { [key]: value });
    } catch (err) {
      console.error("updatePreferences failed", err?.code, err?.message);
      toast.error("Kunde inte spara inställningen.");
      throw err;
    }
  };

  return (
    <SettingsCard
      icon={Palette}
      title="Utseende"
      description="// appearance.theme()"
    >
      <div className="divide-y divide-slate-100">
        <Toggle
          label="Mörkt läge"
          description="Använd en mörk färgpalett i hela appen"
          checked={!!profile.darkMode}
          onChange={(v) => set("darkMode", v)}
          comingSoon
        />
        <Toggle
          label="Kompakt läge"
          description="Mindre padding och tätare layout"
          checked={!!profile.compactMode}
          onChange={(v) => set("compactMode", v)}
          comingSoon
        />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 font-mono leading-relaxed">
          // dina preferenser sparas redan, men det visuella temat
          implementeras i nästa release.
        </p>
      </div>
    </SettingsCard>
  );
}

function DangerZone({ onRemoveAllData, onDeleteAccount }) {
  return (
    <SettingsCard
      tone="danger"
      icon={AlertTriangle}
      title="Riskzon"
      description="// destructive.actions()"
    >
      <div className="space-y-3">
        <DangerRow
          icon={Database}
          title="Ta bort all data"
          description="Rensa alla mappar, filer, anteckningar, vänner och förfrågningar. Kontot behålls men nollställs."
          action={
            <Button
              variant="secondary"
              icon={Trash2}
              onClick={onRemoveAllData}
              className="text-red-600 border-red-200 hover:border-red-300 hover:bg-red-50"
            >
              Ta bort all data
            </Button>
          }
        />
        <DangerRow
          icon={Trash2}
          title="Radera konto permanent"
          description="Tar bort ditt konto, all data och din identitet i Firebase. Kan inte ångras."
          action={
            <Button variant="danger" icon={Trash2} onClick={onDeleteAccount}>
              Radera konto
            </Button>
          }
        />
      </div>
    </SettingsCard>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Small bits
   ────────────────────────────────────────────────────────────────── */

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-1">
          {label}
        </dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function DangerRow({ icon: Icon, title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-red-200 bg-white">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-red-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-body font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white shadow-card p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/4 rounded bg-slate-200" />
              <div className="h-2 w-1/6 rounded bg-slate-100" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-12 w-full rounded-xl bg-slate-100" />
            <div className="h-12 w-full rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
