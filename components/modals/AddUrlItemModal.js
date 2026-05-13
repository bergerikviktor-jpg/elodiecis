"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Video } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  createLinkItem,
  createVideoItem,
  defaultLinkTitle,
  faviconFor,
  parseVideoUrl,
} from "@/lib/boardItems";

/**
 * Single modal that handles both "Lägg till video" and "Lägg till länk".
 * The mode prop biases the UX (label, validation hint) but the auto-
 * detection is the same: if the pasted URL matches a known video host
 * we create a video item, otherwise a link card.
 */
export default function AddUrlItemModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  spawnPosition,
  mode = "link", // "link" | "video" — chooses default UX hint
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      setTitle("");
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  const parsed = useMemo(() => parseVideoUrl(url), [url]);
  const isVideo = !!parsed;
  const trimmed = url.trim();

  // Basic URL validation — try constructing a URL object
  const urlValid = useMemo(() => {
    try {
      const u = new URL(trimmed);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [trimmed]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!urlValid || !user) return;
    setSubmitting(true);
    setError("");
    try {
      const spawn = {
        x: spawnPosition?.x ?? 100,
        y: spawnPosition?.y ?? 100,
        z: spawnPosition?.z ?? 1,
      };

      if (parsed) {
        await createVideoItem(teamId, projectId, user.uid, {
          ...spawn,
          videoUrl: trimmed,
          videoProvider: parsed.provider,
          videoEmbedUrl: parsed.embedUrl,
        });
        toast.success("Video tillagd på board.");
      } else {
        await createLinkItem(teamId, projectId, user.uid, {
          ...spawn,
          url: trimmed,
          linkTitle: title.trim() || defaultLinkTitle(trimmed),
          linkFavicon: faviconFor(trimmed),
        });
        toast.success("Länk tillagd på board.");
      }
      onClose?.();
    } catch (err) {
      console.error("create url item failed", err?.code, err?.message);
      setError(err.message || "Kunde inte lägga till.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={mode === "video" ? "Lägg till video" : "Lägg till länk"}
      subtitle={mode === "video" ? "// board.video()" : "// board.link()"}
    >
      <div className="space-y-4">
        <Input
          label="URL"
          autoFocus
          placeholder={
            mode === "video"
              ? "t.ex. https://www.youtube.com/watch?v=..."
              : "t.ex. https://example.com"
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting}
          required
        />

        {/* Auto-detection feedback */}
        {trimmed && urlValid && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
            {isVideo ? (
              <div className="flex items-start gap-3">
                <Video className="w-4 h-4 text-[#0052FF] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-mono font-medium text-slate-700">
                    {parsed.provider === "youtube" ? "YouTube" : "Vimeo"}-video upptäckt
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Embedas direkt i boardet
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Link2 className="w-4 h-4 text-[#0052FF] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-mono font-medium text-slate-700">
                    Länk
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Visas som klickbart kort med favicon
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Title only relevant for non-video links */}
        {!isVideo && (
          <Input
            label="Titel (valfri)"
            placeholder="Hjälper dig hitta länken senare"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={submitting}
          />
        )}

        {trimmed && !urlValid && (
          <p className="text-xs text-amber-600 font-mono">
            Ange en giltig URL som börjar med http:// eller https://
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            icon={isVideo ? Video : Link2}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!urlValid}
          >
            Lägg till på board
          </Button>
        </div>
      </div>
    </Modal>
  );
}
