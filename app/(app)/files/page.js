"use client";

import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import NewFolderModal from "@/components/modals/NewFolderModal";
import UploadFileModal from "@/components/modals/UploadFileModal";
import { useUserCollection } from "@/lib/useUserCollection";
import { formatRelativeTime } from "@/lib/utils";
import {
  Files,
  Folder,
  FolderPlus,
  Upload,
  FileText,
} from "lucide-react";

/**
 * Format byte size as a human-readable string.
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export default function FilesPage() {
  const { items: folders, loading: foldersLoading } = useUserCollection("folders");
  const { items: files, loading: filesLoading } = useUserCollection("files");

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const loading = foldersLoading || filesLoading;
  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  // Quick lookup: folderId → folder name (for showing on file rows).
  const folderNameById = useMemo(() => {
    const m = new Map();
    folders.forEach((f) => m.set(f.id, f.name));
    return m;
  }, [folders]);

  return (
    <>
      <Header
        title="Mina filer"
        subtitle={
          loading
            ? "// laddar..."
            : `// ${folders.length} mappar · ${files.length} filer`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={FolderPlus}
              size="md"
              onClick={() => setFolderModalOpen(true)}
            >
              Ny mapp
            </Button>
            <Button
              icon={Upload}
              size="md"
              onClick={() => setUploadModalOpen(true)}
            >
              Ladda upp fil
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-8 animate-fade-in">
        {loading ? (
          <LoadingState />
        ) : isEmpty ? (
          <Card padding="none">
            <EmptyState
              icon={Files}
              title="Inga filer eller mappar än"
              description="Skapa din första mapp eller ladda upp en fil för att komma igång."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    icon={FolderPlus}
                    onClick={() => setFolderModalOpen(true)}
                  >
                    Ny mapp
                  </Button>
                  <Button icon={Upload} onClick={() => setUploadModalOpen(true)}>
                    Ladda upp fil
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <>
            {folders.length > 0 && (
              <section>
                <SectionHeader
                  title="Mappar"
                  subtitle={`// ${folders.length} st`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
                  {folders.map((folder) => {
                    const fileCount = files.filter(
                      (f) => f.folderId === folder.id
                    ).length;
                    return (
                      <Card key={folder.id} hover className="group">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                            <Folder className="w-5 h-5 text-[#0052FF]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-body font-semibold text-slate-900 truncate group-hover:text-[#0052FF] transition-colors">
                              {folder.name}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {fileCount} {fileCount === 1 ? "fil" : "filer"}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {files.length > 0 && (
              <section>
                <SectionHeader
                  title="Filer"
                  subtitle={`// ${files.length} st`}
                />
                <Card padding="none">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                            Namn
                          </th>
                          <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                            Mapp
                          </th>
                          <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                            Storlek
                          </th>
                          <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                            Skapad
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {files.map((file) => (
                          <tr
                            key={file.id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                </div>
                                <span className="font-body font-medium text-slate-900 group-hover:text-[#0052FF] transition-colors truncate">
                                  {file.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {file.folderId ? (
                                <Badge color="#0052FF" size="xs">
                                  {folderNameById.get(file.folderId) ||
                                    "Okänd mapp"}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400 font-mono">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-mono text-slate-600">
                                {formatBytes(file.size)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-mono text-slate-500">
                                {formatRelativeTime(file.createdAt)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>
            )}
          </>
        )}
      </div>

      <NewFolderModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
      />
      <UploadFileModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        folders={folders}
      />
    </>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-heading text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 font-mono">{subtitle}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-start gap-3 animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-slate-200" />
              <div className="h-2 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
