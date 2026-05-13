"use client";

import { useEffect, useMemo, useState } from "react";
import { Percent, Wallet, User, Trash2 } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  upsertProfitShare,
  removeProfitShare,
  formatSEK,
} from "@/lib/profitShares";
import { cn } from "@/lib/utils";

/**
 * Edit or create a profit-share entry for a single project member.
 * Caller passes the existing share (or null for new) + the project
 * member's profile.
 */
export default function EditProfitShareModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  uid,
  existingShare,
  memberProfile,
  // Live finance context — lets us preview the computed SEK amount
  netResult = 0,
  totalFixed = 0,
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState(existingShare?.mode || "percent");
  const [percent, setPercent] = useState(
    existingShare?.percent != null ? String(existingShare.percent) : ""
  );
  const [fixedAmount, setFixedAmount] = useState(
    existingShare?.fixedAmount != null ? String(existingShare.fixedAmount) : ""
  );
  const [roleLabel, setRoleLabel] = useState(existingShare?.roleLabel || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMode(existingShare?.mode || "percent");
    setPercent(
      existingShare?.percent != null ? String(existingShare.percent) : ""
    );
    setFixedAmount(
      existingShare?.fixedAmount != null
        ? String(existingShare.fixedAmount)
        : ""
    );
    setRoleLabel(existingShare?.roleLabel || "");
    setSubmitting(false);
    setError("");
  }, [isOpen, existingShare]);

  // Live preview of what this person would get based on current entry
  const previewAmount = useMemo(() => {
    if (mode === "fixed") {
      const v = Number(fixedAmount);
      return Number.isFinite(v) ? Math.round(v) : 0;
    }
    const pct = Number(percent);
    if (!Number.isFinite(pct)) return 0;
    const remainingPool = Math.max(0, netResult - totalFixed);
    // If this share is currently a fixed one (we're switching to percent),
    // remove its current contribution from totalFixed for the preview.
    const adjustedPool =
      existingShare?.mode === "fixed"
        ? Math.max(0, remainingPool + (existingShare.fixedAmount || 0))
        : remainingPool;
    return Math.round(adjustedPool * (pct / 100));
  }, [mode, percent, fixedAmount, netResult, totalFixed, existingShare]);

  const valid = useMemo(() => {
    if (mode === "percent") {
      const pct = Number(percent);
      return Number.isFinite(pct) && pct >= 0 && pct <= 100;
    }
    const fa = Number(fixedAmount);
    return Number.isFinite(fa) && fa >= 0;
  }, [mode, percent, fixedAmount]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSave = async () => {
    if (!valid || !uid || !user) return;
    setSubmitting(true);
    setError("");
    try {
      await upsertProfitShare(teamId, projectId, uid, user.uid, {
        mode,
        percent: mode === "percent" ? Number(percent) : null,
        fixedAmount: mode === "fixed" ? Number(fixedAmount) : null,
        roleLabel,
      });
      toast.success("Andelen har sparats.");
      onClose?.();
    } catch (err) {
      console.error("upsertProfitShare failed", err?.code, err?.message);
      setError(err.message || "Kunde inte spara.");
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!uid) return;
    setSubmitting(true);
    try {
      await removeProfitShare(teamId, projectId, uid);
      toast.info("Andelen har tagits bort.");
      onClose?.();
    } catch (err) {
      console.error("removeProfitShare failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ta bort.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={existingShare ? "Redigera andel" : "Lägg till andel"}
      subtitle="// profit.share()"
    >
      <div className="space-y-5">
        {/* Member preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
          <Avatar
            name={memberProfile?.displayName}
            src={memberProfile?.photoURL}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-slate-900 truncate">
              {memberProfile?.displayName || uid}
            </p>
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {memberProfile?.email}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
            Fördelningstyp
          </label>
          <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setMode("percent")}
              disabled={submitting}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5",
                mode === "percent"
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Percent className="w-3 h-3" />
              Procent
            </button>
            <button
              type="button"
              onClick={() => setMode("fixed")}
              disabled={submitting}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5",
                mode === "fixed"
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Wallet className="w-3 h-3" />
              Fast belopp
            </button>
          </div>
        </div>

        {/* Mode-specific input */}
        {mode === "percent" ? (
          <Input
            label="Andel (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="40"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            disabled={submitting}
            required
          />
        ) : (
          <Input
            label="Fast belopp (SEK ex moms)"
            type="number"
            min="0"
            step="1000"
            placeholder="30000"
            value={fixedAmount}
            onChange={(e) => setFixedAmount(e.target.value)}
            disabled={submitting}
            required
          />
        )}

        <Input
          label="Roll (valfri)"
          placeholder="t.ex. Producer, Klippare, Foto"
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
          maxLength={60}
          disabled={submitting}
        />

        {/* Live preview */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
            Förhandsberäkning
          </p>
          <p className="text-lg font-heading text-[#0052FF] tracking-tight">
            {formatSEK(previewAmount)}
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-1 leading-snug">
            Baserat på aktuellt netto. Värdet uppdateras live när utgifter
            ändras.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {existingShare ? (
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={handleRemove}
              disabled={submitting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={close} disabled={submitting}>
              Avbryt
            </Button>
            <Button onClick={handleSave} loading={submitting} disabled={!valid}>
              Spara andel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
