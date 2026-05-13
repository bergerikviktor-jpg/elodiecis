"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Briefcase, Tag, Wallet, FileText } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { createProject, PROJECT_ACCENTS } from "@/lib/projects";
import { PRODUCTION_TYPES } from "@/lib/deals";
import { cn } from "@/lib/utils";

export default function NewProjectModal({ isOpen, onClose, teamId }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [productionType, setProductionType] = useState("video");
  const [totalBudget, setTotalBudget] = useState("");
  const [coverColor, setCoverColor] = useState(PROJECT_ACCENTS[0].id);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setCustomerName("");
      setDescription("");
      setProductionType("video");
      setTotalBudget("");
      setCoverColor(PROJECT_ACCENTS[0].id);
      setError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const trimmedTitle = title.trim();
  const budgetNumber = totalBudget === "" ? 0 : Number(totalBudget.replace(/\s/g, ""));
  const validBudget =
    totalBudget === "" ||
    (Number.isFinite(budgetNumber) && budgetNumber >= 0);
  const valid = trimmedTitle.length > 0 && validBudget;

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !teamId || !user) return;
    setSubmitting(true);
    try {
      const projectId = await createProject(teamId, user.uid, {
        title: trimmedTitle,
        customerName: customerName.trim(),
        description: description.trim(),
        productionType,
        totalBudget: budgetNumber,
        coverColor,
        initialMemberUids: [],
      });
      toast.success(`Projektet "${trimmedTitle}" har skapats.`);
      onClose?.();
      router.push(`/projects/${projectId}?team=${teamId}`);
    } catch (err) {
      console.error("createProject failed", err?.code, err?.message);
      setError(err.message || "Kunde inte skapa projektet.");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Nytt projekt" subtitle="// project.create()">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={<FieldLabel icon={Briefcase} text="Projekttitel" />}
          autoFocus
          placeholder="t.ex. Adidas Originals Docu-Series"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={submitting}
          required
        />

        <Input
          label={<FieldLabel icon={Building2} text="Kund" />}
          placeholder="t.ex. Adidas"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          maxLength={120}
          disabled={submitting}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={<FieldLabel icon={Tag} text="Produktionstyp" />}
            value={productionType}
            onChange={(e) => setProductionType(e.target.value)}
            options={PRODUCTION_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
            }))}
            disabled={submitting}
          />
          <Input
            label={<FieldLabel icon={Wallet} text="Total budget (ex moms)" />}
            type="number"
            min="0"
            step="1000"
            placeholder="500000"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            disabled={submitting}
            error={
              totalBudget !== "" && !validBudget
                ? "Måste vara positivt heltal"
                : undefined
            }
          />
        </div>

        <Textarea
          label={<FieldLabel icon={FileText} text="Beskrivning (valfri)" />}
          placeholder="Brief, vision, mål..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={submitting}
        />

        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
            Accent
          </label>
          <div className="grid grid-cols-5 gap-2">
            {PROJECT_ACCENTS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setCoverColor(bg.id)}
                disabled={submitting}
                className={cn(
                  "aspect-square rounded-xl border-2 transition-all duration-200",
                  coverColor === bg.id
                    ? "border-[#0052FF] scale-105 shadow-glow"
                    : "border-transparent hover:scale-105"
                )}
                style={{ background: bg.value }}
                aria-label={`Färg ${bg.id}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" loading={submitting} disabled={!valid}>
            Skapa projekt
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FieldLabel({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}
