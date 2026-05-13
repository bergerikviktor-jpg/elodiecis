"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StickyNote,
  ImageIcon,
  Video,
  Link2,
  Trash2,
  Loader2,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  Spline,
  X,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import AddImageItemModal from "@/components/modals/AddImageItemModal";
import AddUrlItemModal from "@/components/modals/AddUrlItemModal";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useProjectBoardItems,
  useProjectConnections,
} from "@/lib/useProjectsData";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  NOTE_COLORS,
  createNote,
  deleteBoardItem,
  updateBoardItem,
} from "@/lib/boardItems";
import {
  createConnection,
  deleteConnection,
  deleteConnectionsForItem,
} from "@/lib/connections";
import { PROJECT_PHASES } from "@/lib/schema";
import { cn } from "@/lib/utils";

const PHASE_FILTER_ALL = "all";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

/**
 * Milanote-style creative board.
 *
 *   - 3000×2000 canvas with absolute positioning per item
 *   - Zoom 20%–250%, default = fit-to-viewport so 16:9 monitors see the
 *     whole board on first paint without horizontal scroll
 *   - Connections subcollection: arrows linking two items, drawn via
 *     SVG layer below items. Auto-follow items when they move.
 *   - Drag/resize math is zoom-aware (screen-delta / scale).
 */
export default function CreativeBoard({ teamId, projectId, isArchived = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { items: firestoreItems, loading } = useProjectBoardItems(
    teamId,
    projectId
  );
  const { connections } = useProjectConnections(teamId, projectId);

  // Local optimistic mirror — drag/resize mutate this directly,
  // Firestore listener resyncs on commit.
  const [items, setItems] = useState(firestoreItems);
  useEffect(() => setItems(firestoreItems), [firestoreItems]);

  // ── Pan + zoom (Miro/Figma-style fixed viewport) ─────────────
  // The viewport never scrolls. Instead the inner canvas is
  // translated + scaled via a single CSS transform. Pan changes
  // panX/panY (in screen pixels). Zoom-around-cursor adjusts pan
  // so the point under the cursor stays stable.
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [viewInitialized, setViewInitialized] = useState(false);

  // Auto-fit + center on first mount.
  useEffect(() => {
    if (viewInitialized) return;
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw === 0 || vh === 0) return;
    const fit = Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT, 1);
    const z = Math.max(MIN_ZOOM, fit);
    setZoom(z);
    setPanX((vw - CANVAS_WIDTH * z) / 2);
    setPanY((vh - CANVAS_HEIGHT * z) / 2);
    setViewInitialized(true);
  }, [viewInitialized]);

  /**
   * Apply a new zoom level while keeping the point at (anchorScreenX,
   * anchorScreenY) — measured in viewport-local coordinates — stable.
   */
  const zoomAround = useCallback(
    (newZoom, anchorScreenX, anchorScreenY) => {
      setZoom((curZoom) => {
        const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
        if (z === curZoom) return curZoom;
        setPanX((curPanX) => {
          // canvasX at the anchor before zoom: (anchorScreenX - curPanX) / curZoom
          // we want it to stay there after zoom: anchorScreenX = canvasX * z + newPanX
          // → newPanX = anchorScreenX - canvasX * z
          const canvasX = (anchorScreenX - curPanX) / curZoom;
          return anchorScreenX - canvasX * z;
        });
        setPanY((curPanY) => {
          const canvasY = (anchorScreenY - curPanY) / curZoom;
          return anchorScreenY - canvasY * z;
        });
        return z;
      });
    },
    []
  );

  // Ctrl + wheel: zoom around cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom((curZoom) => {
        const z = clamp(curZoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (z === curZoom) return curZoom;
        setPanX((curPanX) => ax - ((ax - curPanX) / curZoom) * z);
        setPanY((curPanY) => ay - ((ay - curPanY) / curZoom) * z);
        return z;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomFromCenter = useCallback(
    (newZoom) => {
      const el = viewportRef.current;
      if (!el) return;
      zoomAround(newZoom, el.clientWidth / 2, el.clientHeight / 2);
    },
    [zoomAround]
  );

  const handleZoomIn = () => zoomFromCenter(zoom + ZOOM_STEP);
  const handleZoomOut = () => zoomFromCenter(zoom - ZOOM_STEP);
  const handleZoom100 = () => zoomFromCenter(1);
  const handleFitView = () => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const fit = Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT, 1);
    const z = Math.max(MIN_ZOOM, fit);
    setZoom(z);
    setPanX((vw - CANVAS_WIDTH * z) / 2);
    setPanY((vh - CANVAS_HEIGHT * z) / 2);
  };

  // ── Selection + connect-mode ──────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [draftEditId, setDraftEditId] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState(null);

  // ESC cancels connect-mode
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setConnectMode(false);
        setConnectFromId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Modals ────────────────────────────────────────────────────
  const [addImageOpen, setAddImageOpen] = useState(false);
  const [addUrlOpen, setAddUrlOpen] = useState(false);
  const [addUrlMode, setAddUrlMode] = useState("link");

  // ── Phase filter ──────────────────────────────────────────────
  const [phaseFilter, setPhaseFilter] = useState(PHASE_FILTER_ALL);
  const visibleItems = useMemo(() => {
    if (phaseFilter === PHASE_FILTER_ALL) return items;
    return items.filter((it) => it.phase === phaseFilter);
  }, [items, phaseFilter]);

  // Used for hiding orphan connections (both endpoints filtered out)
  const visibleItemIds = useMemo(
    () => new Set(visibleItems.map((it) => it.id)),
    [visibleItems]
  );
  const visibleConnections = useMemo(
    () =>
      connections.filter(
        (c) =>
          visibleItemIds.has(c.fromItemId) && visibleItemIds.has(c.toItemId)
      ),
    [connections, visibleItemIds]
  );

  const maxZ = useMemo(
    () => items.reduce((m, it) => Math.max(m, it.z || 0), 0),
    [items]
  );

  /* ── Spawn position ────────────────────────────────────────── */
  const computeSpawnPosition = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return { x: 200, y: 200, z: maxZ + 1 };
    // Viewport center in canvas coordinates:
    //   canvas = (screen - pan) / zoom
    const cx = (el.clientWidth / 2 - panX) / zoom - 110;
    const cy = (el.clientHeight / 2 - panY) / zoom - 70;
    return {
      x: Math.max(0, Math.min(cx, CANVAS_WIDTH - 220)),
      y: Math.max(0, Math.min(cy, CANVAS_HEIGHT - 140)),
      z: maxZ + 1,
    };
  }, [maxZ, zoom, panX, panY]);

  /* ── Pan via drag on empty canvas ──────────────────────────── */
  const startPan = useCallback((e) => {
    // Only when clicking the bare canvas background, not an item.
    // BoardItems stop propagation in their own pointerdown handlers
    // so this only fires for empty-area clicks.
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let panOriginX, panOriginY;
    setPanX((p) => {
      panOriginX = p;
      return p;
    });
    setPanY((p) => {
      panOriginY = p;
      return p;
    });
    let moved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      setPanX(panOriginX + dx);
      setPanY(panOriginY + dy);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Treat a pointer-up with no movement as a "click on empty" —
      // useful for clearing selection or cancelling connect-mode.
      if (!moved) {
        setSelectedId(null);
        setDraftEditId(null);
        if (connectMode) {
          setConnectMode(false);
          setConnectFromId(null);
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [connectMode]);

  /* ── Toolbar actions ───────────────────────────────────────── */

  const handleAddNote = async () => {
    if (isArchived || !user) return;
    try {
      const pos = computeSpawnPosition();
      const id = await createNote(teamId, projectId, user.uid, pos);
      setSelectedId(id);
      setDraftEditId(id);
    } catch (err) {
      console.error("createNote failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte skapa anteckning.");
    }
  };

  const openAddImage = () => {
    if (isArchived) return;
    setAddImageOpen(true);
  };

  const openAddUrl = (mode) => {
    if (isArchived) return;
    setAddUrlMode(mode);
    setAddUrlOpen(true);
  };

  const toggleConnectMode = () => {
    if (isArchived) return;
    setConnectMode((on) => !on);
    setConnectFromId(null);
    setSelectedId(null);
  };

  /* ── Item operations ───────────────────────────────────────── */

  const bringToFront = useCallback(
    (itemId) => {
      const newZ = maxZ + 1;
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, z: newZ } : it))
      );
      updateBoardItem(teamId, projectId, itemId, { z: newZ }).catch(() => {});
    },
    [maxZ, teamId, projectId]
  );

  const persistItemPose = useCallback(
    async (itemId, pose) => {
      try {
        await updateBoardItem(teamId, projectId, itemId, pose);
      } catch (err) {
        console.error("persistItemPose failed", err?.code, err?.message);
        toast.error("Kunde inte spara position.");
      }
    },
    [teamId, projectId, toast]
  );

  const handleDelete = async (itemId) => {
    try {
      // Optimistic + delete connections first (so SVG layer doesn't
      // try to draw to a missing item between snapshot waves)
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      await Promise.all([
        deleteBoardItem(teamId, projectId, itemId),
        deleteConnectionsForItem(teamId, projectId, itemId).catch(() => {}),
      ]);
      if (selectedId === itemId) setSelectedId(null);
    } catch (err) {
      console.error("deleteBoardItem failed", err?.code, err?.message);
      toast.error("Kunde inte ta bort objektet.");
    }
  };

  // Optimistic save + local update so the textarea-to-display
  // transition doesn't flash the old text.
  const handleNoteCommit = async (itemId, text) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, text } : it))
    );
    setDraftEditId(null);
    try {
      await updateBoardItem(teamId, projectId, itemId, { text });
    } catch (err) {
      console.error("note commit failed", err?.code, err?.message);
      toast.error("Kunde inte spara texten.");
    }
  };

  const handleSetPhase = async (itemId, phase) => {
    await updateBoardItem(teamId, projectId, itemId, {
      phase: phase || null,
    });
  };

  /* ── Connect-mode handling ─────────────────────────────────── */

  const handleItemClickInConnectMode = (itemId) => {
    if (!connectFromId) {
      setConnectFromId(itemId);
      return;
    }
    if (connectFromId === itemId) {
      // Clicking the same item cancels
      setConnectFromId(null);
      return;
    }
    // Create the connection
    createConnection(teamId, projectId, user.uid, {
      fromItemId: connectFromId,
      toItemId: itemId,
    })
      .then(() => toast.info("Koppling skapad."))
      .catch((err) => {
        console.error("createConnection failed", err?.code, err?.message);
        toast.error(err.message || "Kunde inte skapa koppling.");
      });
    setConnectFromId(null);
    setConnectMode(false);
  };

  const handleDeleteConnection = async (connectionId) => {
    try {
      await deleteConnection(teamId, projectId, connectionId);
    } catch (err) {
      console.error("deleteConnection failed", err?.code, err?.message);
      toast.error("Kunde inte ta bort kopplingen.");
    }
  };

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ToolbarButton
            icon={StickyNote}
            label="Anteckning"
            onClick={handleAddNote}
            disabled={isArchived || connectMode}
          />
          <ToolbarButton
            icon={ImageIcon}
            label="Bild"
            onClick={openAddImage}
            disabled={isArchived || connectMode}
          />
          <ToolbarButton
            icon={Video}
            label="Video"
            onClick={() => openAddUrl("video")}
            disabled={isArchived || connectMode}
          />
          <ToolbarButton
            icon={Link2}
            label="Länk"
            onClick={() => openAddUrl("link")}
            disabled={isArchived || connectMode}
          />
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <ToolbarButton
            icon={Spline}
            label={connectMode ? "Avbryt koppling" : "Pil / koppling"}
            onClick={toggleConnectMode}
            disabled={isArchived}
            active={connectMode}
          />
        </div>

        {/* Phase filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mr-1">
            <Layers className="w-3 h-3 inline mr-1" />
            Fas
          </span>
          <PhaseChip
            active={phaseFilter === PHASE_FILTER_ALL}
            onClick={() => setPhaseFilter(PHASE_FILTER_ALL)}
            color="#64748b"
          >
            Alla
          </PhaseChip>
          {PROJECT_PHASES.map((p) => (
            <PhaseChip
              key={p.id}
              active={phaseFilter === p.id}
              onClick={() => setPhaseFilter(p.id)}
              color={p.color}
            >
              {p.label}
            </PhaseChip>
          ))}
        </div>
      </div>

      {/* Connect-mode hint */}
      {connectMode && (
        <div className="mb-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 animate-fade-in">
          <Spline className="w-3.5 h-3.5 text-[#0052FF]" />
          <p className="text-xs font-mono text-slate-700">
            {connectFromId
              ? "Klicka på det andra objektet för att koppla ihop"
              : "Klicka på det första objektet att koppla från (ESC för att avbryta)"}
          </p>
        </div>
      )}

      {/* Fixed viewport — pan/zoom transforms the inner canvas. The
          viewport itself never scrolls. */}
      <div
        ref={viewportRef}
        onPointerDown={startPan}
        className={cn(
          "flex-1 rounded-2xl border border-slate-200 overflow-hidden relative select-none",
          connectMode ? "bg-blue-50/30 cursor-pointer" : "bg-slate-100 cursor-grab active:cursor-grabbing"
        )}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
          </div>
        ) : (
          <>
            {/* Transformed canvas plane. No layout-sizing wrapper —
                viewport stays fixed, transform pans/zooms the canvas. */}
            <div
              className="absolute top-0 left-0 bg-[radial-gradient(circle,_#cbd5e1_1px,_transparent_1px)] bg-[length:24px_24px]"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: "0 0",
                // Soft border so the canvas edge is visible against
                // the viewport background.
                outline: "1px solid #cbd5e1",
              }}
            >
              {/* SVG connections layer */}
              <ConnectionsLayer
                items={visibleItems}
                connections={visibleConnections}
                onDeleteConnection={handleDeleteConnection}
                isArchived={isArchived}
              />

              {visibleItems.map((item) => (
                <BoardItem
                  key={item.id}
                  item={item}
                  zoom={zoom}
                  selected={selectedId === item.id}
                  editing={draftEditId === item.id}
                  isArchived={isArchived}
                  connectMode={connectMode}
                  isConnectSource={connectFromId === item.id}
                  onSelect={() => {
                    if (connectMode) {
                      handleItemClickInConnectMode(item.id);
                      return;
                    }
                    setSelectedId(item.id);
                    bringToFront(item.id);
                  }}
                  onStartEdit={() => setDraftEditId(item.id)}
                  onCommitText={(text) => handleNoteCommit(item.id, text)}
                  onPersistPose={(pose) => persistItemPose(item.id, pose)}
                  onUpdateLocal={(patch) =>
                    setItems((prev) =>
                      prev.map((it) =>
                        it.id === item.id ? { ...it, ...patch } : it
                      )
                    )
                  }
                  onDelete={() => handleDelete(item.id)}
                  onSetPhase={(phase) => handleSetPhase(item.id, phase)}
                />
              ))}
            </div>

            {items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                <EmptyState
                  icon={StickyNote}
                  title="Tomt board"
                  description="Klicka på en knapp i toolbaren ovan för att lägga till din första anteckning, bild, video eller länk."
                />
              </div>
            )}
          </>
        )}

        {/* Zoom controls — absolute, bottom-right of the viewport */}
        <ZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoom100={handleZoom100}
          onFitView={handleFitView}
        />
      </div>

      {/* Status / hint */}
      <p className="text-[10px] text-slate-400 font-mono mt-2 px-1">
        // realtime · dra tomt utrymme för att panorera · Ctrl+scroll för zoom · högerhörn för storlek
        {isArchived && " · projektet är arkiverat och låst"}
      </p>

      {/* Modals */}
      <AddImageItemModal
        isOpen={addImageOpen}
        onClose={() => setAddImageOpen(false)}
        teamId={teamId}
        projectId={projectId}
        spawnPosition={addImageOpen ? computeSpawnPosition() : null}
      />
      <AddUrlItemModal
        isOpen={addUrlOpen}
        onClose={() => setAddUrlOpen(false)}
        teamId={teamId}
        projectId={projectId}
        spawnPosition={addUrlOpen ? computeSpawnPosition() : null}
        mode={addUrlMode}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Connections SVG layer
   ────────────────────────────────────────────────────────────────── */

function ConnectionsLayer({ items, connections, onDeleteConnection, isArchived }) {
  const itemsById = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  if (connections.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
    >
      <defs>
        <marker
          id="board-arrow"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon points="0 0, 12 6, 0 12" fill="#0052FF" />
        </marker>
      </defs>
      {connections.map((conn) => {
        const from = itemsById.get(conn.fromItemId);
        const to = itemsById.get(conn.toItemId);
        if (!from || !to) return null;
        return (
          <ConnectionPath
            key={conn.id}
            from={from}
            to={to}
            connectionId={conn.id}
            onDelete={onDeleteConnection}
            isArchived={isArchived}
          />
        );
      })}
    </svg>
  );
}

function ConnectionPath({ from, to, connectionId, onDelete, isArchived }) {
  // Compute box centers
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2;

  // Trim line endpoints to the box edge (so arrowhead doesn't bury in the box)
  const fromEdge = edgePoint(from, fx, fy, tx, ty);
  const toEdge = edgePoint(to, tx, ty, fx, fy);

  // Midpoint for the delete affordance
  const mx = (fromEdge.x + toEdge.x) / 2;
  const my = (fromEdge.y + toEdge.y) / 2;

  const [hover, setHover] = useState(false);

  return (
    <g
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ pointerEvents: "auto", cursor: "pointer" }}
    >
      {/* Wider invisible hit area for easier clicking */}
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke="transparent"
        strokeWidth={14}
      />
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke="#0052FF"
        strokeWidth={hover ? 3 : 2}
        markerEnd="url(#board-arrow)"
      />
      {hover && !isArchived && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(connectionId);
          }}
        >
          <circle
            cx={mx}
            cy={my}
            r={11}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={2}
          />
          <text
            x={mx}
            y={my + 4}
            textAnchor="middle"
            fill="#fff"
            fontSize={14}
            fontWeight={600}
            pointerEvents="none"
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Find the intersection of a line from the box center to the target
 * point with the box edge. Used to position arrows so they don't
 * disappear behind the source/target item.
 */
function edgePoint(box, cx, cy, tx, ty) {
  const dx = tx - cx;
  const dy = ty - cy;
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Slope. Compute intersection with vertical / horizontal edges.
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const scaleX = halfW / absDx;
  const scaleY = halfH / absDy;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/* ──────────────────────────────────────────────────────────────────
   BoardItem — wrapper handling drag, resize, selection
   ────────────────────────────────────────────────────────────────── */

function BoardItem({
  item,
  zoom,
  selected,
  editing,
  isArchived,
  connectMode,
  isConnectSource,
  onSelect,
  onStartEdit,
  onCommitText,
  onPersistPose,
  onUpdateLocal,
  onDelete,
  onSetPhase,
}) {
  /* ── Drag-to-move ────────────────────────────────────────────── */
  const startPointerDrag = (e) => {
    if (isArchived || connectMode) return;
    if (e.button !== 0) return;
    if (e.target.closest("[data-no-drag]")) return;
    e.stopPropagation();
    e.preventDefault();

    onSelect?.();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = item.x;
    const origY = item.y;

    const onMove = (ev) => {
      // Compensate for zoom — screen delta is in css pixels, canvas
      // delta is in canvas pixels (which scale with zoom).
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const nx = Math.max(0, Math.min(CANVAS_WIDTH - item.width, origX + dx));
      const ny = Math.max(0, Math.min(CANVAS_HEIGHT - item.height, origY + dy));
      onUpdateLocal({ x: nx, y: ny });
    };

    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const nx = Math.max(0, Math.min(CANVAS_WIDTH - item.width, origX + dx));
      const ny = Math.max(0, Math.min(CANVAS_HEIGHT - item.height, origY + dy));
      if (nx !== origX || ny !== origY) {
        onPersistPose({ x: nx, y: ny });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResize = (e) => {
    if (isArchived) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = item.width;
    const origH = item.height;
    const minW = 80;
    const minH = 60;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const nw = Math.max(minW, origW + dx);
      const nh = Math.max(minH, origH + dy);
      onUpdateLocal({ width: nw, height: nh });
    };

    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const nw = Math.max(minW, origW + dx);
      const nh = Math.max(minH, origH + dy);
      if (nw !== origW || nh !== origH) {
        onPersistPose({ width: nw, height: nh });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={startPointerDrag}
      onClick={(e) => {
        if (connectMode) {
          e.stopPropagation();
          onSelect?.();
        }
      }}
      onDoubleClick={item.type === "note" && !connectMode ? onStartEdit : undefined}
      style={{
        position: "absolute",
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z,
      }}
      className={cn(
        "rounded-xl transition-shadow",
        isArchived
          ? "cursor-default"
          : connectMode
          ? "cursor-pointer"
          : "cursor-grab active:cursor-grabbing",
        isConnectSource
          ? "ring-2 ring-[#0052FF] ring-offset-2"
          : selected
          ? "ring-2 ring-[#0052FF] shadow-hover"
          : "shadow-card hover:shadow-md"
      )}
    >
      <ItemBody item={item} editing={editing} onCommitText={onCommitText} />

      {selected && !isArchived && !connectMode && (
        <SelectedControls
          item={item}
          onDelete={onDelete}
          onSetPhase={onSetPhase}
          onResizeStart={startResize}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Per-type renderers
   ────────────────────────────────────────────────────────────────── */

function ItemBody({ item, editing, onCommitText }) {
  if (item.type === "note") {
    const color =
      NOTE_COLORS.find((c) => c.id === item.color) || NOTE_COLORS[0];
    // Two distinct components — mounting/unmounting resets state cleanly.
    if (editing) {
      return <NoteEditor item={item} color={color} onCommit={onCommitText} />;
    }
    return <NoteDisplay item={item} color={color} />;
  }
  if (item.type === "image") {
    return (
      <div className="w-full h-full rounded-xl overflow-hidden bg-white">
        <img
          src={item.src}
          alt={item.filename || "Bild"}
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      </div>
    );
  }
  if (item.type === "video") {
    return (
      <div className="w-full h-full rounded-xl overflow-hidden bg-black">
        {item.videoEmbedUrl ? (
          <iframe
            src={item.videoEmbedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
            title={item.videoUrl}
          />
        ) : (
          <a
            href={item.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-no-drag
            className="flex items-center justify-center w-full h-full text-white text-xs font-mono"
          >
            Öppna video
          </a>
        )}
      </div>
    );
  }
  if (item.type === "link") {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        data-no-drag
        className="w-full h-full rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3 hover:border-[#0052FF]/30 transition-colors"
      >
        {item.linkFavicon ? (
          <img
            src={item.linkFavicon}
            alt=""
            className="w-8 h-8 rounded shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-slate-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-body font-semibold text-slate-900 truncate">
            {item.linkTitle || item.url}
          </p>
          <p className="text-[10px] text-slate-500 font-mono truncate">
            {item.url}
          </p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </a>
    );
  }
  return null;
}

/**
 * Editor mounts/unmounts based on `editing` — this guarantees its
 * internal draft state is freshly initialized from `item.text` each
 * time we enter edit mode, and that we never lose user input when
 * leaving (the draft is committed in onBlur before unmount).
 */
function NoteEditor({ item, color, onCommit }) {
  const [draft, setDraft] = useState(item.text || "");
  return (
    <textarea
      autoFocus
      data-no-drag
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit?.(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.target.blur();
      }}
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
      }}
      className="w-full h-full rounded-xl border-2 p-3 text-sm font-body focus:outline-none resize-none"
      placeholder="Skriv en anteckning..."
    />
  );
}

function NoteDisplay({ item, color }) {
  return (
    <div
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
      }}
      className="w-full h-full rounded-xl border-2 p-3 overflow-hidden"
    >
      {item.text ? (
        <p className="text-sm font-body whitespace-pre-wrap break-words leading-snug">
          {item.text}
        </p>
      ) : (
        <p className="text-sm font-mono italic opacity-50">
          Dubbelklicka för att skriva...
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Floating controls
   ────────────────────────────────────────────────────────────────── */

function SelectedControls({ item, onDelete, onSetPhase, onResizeStart }) {
  return (
    <>
      <div
        data-no-drag
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-9 left-0 flex items-center gap-1 bg-white rounded-lg border border-slate-200 shadow-hover px-1 py-1"
      >
        <select
          value={item.phase || ""}
          onChange={(e) => onSetPhase(e.target.value)}
          className="text-[10px] font-mono px-2 py-1 rounded text-slate-700 bg-transparent border-0 focus:outline-none cursor-pointer"
        >
          <option value="">Ingen fas</option>
          {PROJECT_PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="w-px h-4 bg-slate-200" />
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Ta bort"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        data-no-drag
        onPointerDown={onResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, #0052FF 50%, #0052FF 70%, transparent 70%, transparent 100%)",
        }}
        title="Dra för att ändra storlek"
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Zoom controls
   ────────────────────────────────────────────────────────────────── */

function ZoomControls({ zoom, onZoomIn, onZoomOut, onZoom100, onFitView }) {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl shadow-hover overflow-hidden">
      <ZoomButton onClick={onZoomOut} title="Zooma ut" icon={ZoomOut} />
      <button
        type="button"
        onClick={onZoom100}
        className="px-3 py-2 text-xs font-mono text-slate-600 hover:text-[#0052FF] hover:bg-blue-50 transition-colors min-w-[56px]"
        title="100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ZoomButton onClick={onZoomIn} title="Zooma in" icon={ZoomIn} />
      <div className="w-px h-5 bg-slate-200" />
      <ZoomButton onClick={onFitView} title="Anpassa till vy" icon={Maximize} />
    </div>
  );
}

function ZoomButton({ icon: Icon, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-2 text-slate-500 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Small UI bits
   ────────────────────────────────────────────────────────────────── */

function ToolbarButton({ icon: Icon, label, onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all duration-200",
        disabled
          ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
          : active
          ? "border-[#0052FF] bg-[#0052FF] text-white shadow-glow"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#0052FF]/30 hover:text-[#0052FF] hover:bg-blue-50/50"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function PhaseChip({ active, color, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all duration-200",
        active
          ? "bg-slate-900 text-white"
          : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
      )}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </button>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
