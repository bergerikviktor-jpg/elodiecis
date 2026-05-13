/**
 * Creative-board item operations.
 *
 * Path: teams/{teamId}/projects/{projectId}/boardItems/{itemId}
 *
 * Items are positioned absolutely on a 3000×2000 px canvas. Position
 * (x, y), size (width, height) and stacking (z) are all stored in
 * Firestore so the layout is shared in realtime between collaborators.
 *
 * Four item types: note / image / video / link. The schema is the
 * union of all fields — only the relevant ones are written for each
 * type. Type-checking happens in the UI layer.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const TEAMS = "teams";
const PROJECTS = "projects";
const BOARD_ITEMS = "boardItems";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

/* ──────────────────────────────────────────────────────────────────
   Canvas constants (also exported for the UI)
   ────────────────────────────────────────────────────────────────── */

export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 2000;

export const ITEM_DEFAULTS = {
  note: { width: 220, height: 140, color: "yellow" },
  image: { width: 260, height: 180 }, // server may update height after we know aspect
  video: { width: 320, height: 180 }, // 16:9
  link: { width: 280, height: 100 },
};

export const NOTE_COLORS = [
  { id: "yellow", bg: "#fef3c7", border: "#fde68a", text: "#78350f" },
  { id: "pink", bg: "#fce7f3", border: "#fbcfe8", text: "#831843" },
  { id: "blue", bg: "#dbeafe", border: "#bfdbfe", text: "#1e3a8a" },
  { id: "green", bg: "#dcfce7", border: "#bbf7d0", text: "#14532d" },
  { id: "purple", bg: "#ede9fe", border: "#ddd6fe", text: "#4c1d95" },
];

/* ──────────────────────────────────────────────────────────────────
   URL parsing — for video / link items
   ────────────────────────────────────────────────────────────────── */

/**
 * Try to parse a URL as a known video provider. Returns embed info
 * or null if the URL isn't recognized.
 */
export function parseVideoUrl(rawUrl) {
  const url = (rawUrl || "").trim();
  if (!url) return null;

  // YouTube — three URL shapes
  const yt =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^?&#/]+)/);
  if (yt) {
    return {
      provider: "youtube",
      id: yt[1],
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }

  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return {
      provider: "vimeo",
      id: vm[1],
      embedUrl: `https://player.vimeo.com/video/${vm[1]}`,
      thumbnailUrl: null, // would need an API call to get thumb; skip
    };
  }

  return null;
}

/**
 * Best-effort favicon URL via Google's service. Works for any HTTPS
 * domain. Returns null for invalid URLs.
 */
export function faviconFor(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
}

/**
 * Pull a sensible display title from a URL — host + first path segment.
 */
export function defaultLinkTitle(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.host.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

/* ──────────────────────────────────────────────────────────────────
   Image upload
   ────────────────────────────────────────────────────────────────── */

export async function uploadBoardImage(
  teamId,
  projectId,
  file,
  { onProgress } = {}
) {
  if (!file) throw new Error("Ingen fil vald.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Bilden får max vara 8 MB.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Filen måste vara en bild.");
  }

  onProgress?.(10);
  const path = `projects/${teamId}/${projectId}/board/${Date.now()}-${file.name}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  onProgress?.(70);

  const url = await getDownloadURL(ref);
  onProgress?.(100);

  return {
    url,
    path,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Create / update / delete
   ────────────────────────────────────────────────────────────────── */

/**
 * Generic create. Caller passes a fully-formed item object — see
 * createNote / createImage / etc helpers below for type-specific
 * constructors with sensible defaults.
 */
export async function createBoardItem(teamId, projectId, creatorUid, item) {
  if (!teamId || !projectId) throw new Error("Saknar projekt-data.");
  if (!["note", "image", "video", "link"].includes(item.type)) {
    throw new Error("Ogiltig item-typ.");
  }

  const payload = {
    type: item.type,
    x: Number.isFinite(item.x) ? item.x : 100,
    y: Number.isFinite(item.y) ? item.y : 100,
    width: Number.isFinite(item.width)
      ? item.width
      : ITEM_DEFAULTS[item.type].width,
    height: Number.isFinite(item.height)
      ? item.height
      : ITEM_DEFAULTS[item.type].height,
    z: Number.isFinite(item.z) ? item.z : 1,
    phase: item.phase || null,
    // Type-specific
    text: item.text || null,
    color: item.color || null,
    src: item.src || null,
    storagePath: item.storagePath || null,
    filename: item.filename || null,
    videoUrl: item.videoUrl || null,
    videoProvider: item.videoProvider || null,
    videoEmbedUrl: item.videoEmbedUrl || null,
    url: item.url || null,
    linkTitle: item.linkTitle || null,
    linkFavicon: item.linkFavicon || null,
    // Metadata
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(
    collection(db, TEAMS, teamId, PROJECTS, projectId, BOARD_ITEMS),
    payload
  );
  return ref.id;
}

export async function createNote(teamId, projectId, creatorUid, { x, y, z = 1, phase = null }) {
  return createBoardItem(teamId, projectId, creatorUid, {
    type: "note",
    x,
    y,
    z,
    phase,
    width: ITEM_DEFAULTS.note.width,
    height: ITEM_DEFAULTS.note.height,
    text: "",
    color: ITEM_DEFAULTS.note.color,
  });
}

export async function createImageItem(
  teamId,
  projectId,
  creatorUid,
  { x, y, z = 1, phase = null, src, storagePath, filename, naturalWidth, naturalHeight }
) {
  // Scale image to fit within default width while preserving aspect
  const defaultW = ITEM_DEFAULTS.image.width;
  let w = defaultW;
  let h = ITEM_DEFAULTS.image.height;
  if (naturalWidth > 0 && naturalHeight > 0) {
    h = Math.round(defaultW * (naturalHeight / naturalWidth));
  }
  return createBoardItem(teamId, projectId, creatorUid, {
    type: "image",
    x,
    y,
    z,
    phase,
    width: w,
    height: h,
    src,
    storagePath,
    filename,
  });
}

export async function createVideoItem(
  teamId,
  projectId,
  creatorUid,
  { x, y, z = 1, phase = null, videoUrl, videoProvider, videoEmbedUrl }
) {
  return createBoardItem(teamId, projectId, creatorUid, {
    type: "video",
    x,
    y,
    z,
    phase,
    width: ITEM_DEFAULTS.video.width,
    height: ITEM_DEFAULTS.video.height,
    videoUrl,
    videoProvider,
    videoEmbedUrl,
  });
}

export async function createLinkItem(
  teamId,
  projectId,
  creatorUid,
  { x, y, z = 1, phase = null, url, linkTitle, linkFavicon }
) {
  return createBoardItem(teamId, projectId, creatorUid, {
    type: "link",
    x,
    y,
    z,
    phase,
    width: ITEM_DEFAULTS.link.width,
    height: ITEM_DEFAULTS.link.height,
    url,
    linkTitle,
    linkFavicon,
  });
}

export async function updateBoardItem(teamId, projectId, itemId, updates) {
  await updateDoc(
    doc(db, TEAMS, teamId, PROJECTS, projectId, BOARD_ITEMS, itemId),
    {
      ...updates,
      updatedAt: serverTimestamp(),
    }
  );
}

export async function deleteBoardItem(teamId, projectId, itemId) {
  await deleteDoc(
    doc(db, TEAMS, teamId, PROJECTS, projectId, BOARD_ITEMS, itemId)
  );
}
