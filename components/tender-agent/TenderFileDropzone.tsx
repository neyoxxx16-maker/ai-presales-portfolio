"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  CompanyWorkspaceMode,
  ParsedBidDocument,
} from "@/types/tender-agent";

type Item = { file: File; parsed?: ParsedBidDocument; error?: string };
const supported = new Set(["pdf", "docx", "txt", "md", "png", "jpg", "jpeg"]);
const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const readableSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

export function TenderFileDropzone({
  companyMode,
  onBusy,
  onFilesReady,
}: {
  companyMode: CompanyWorkspaceMode;
  onBusy: (busy: boolean) => void;
  onFilesReady: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  async function begin(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    const valid = incoming.filter(
      (file) =>
        supported.has(extension(file.name)) &&
        file.size > 0 &&
        file.size <= 15 * 1024 * 1024,
    );
    if (!valid.length) {
      setMessage(
        "请选择不超过 15 MB 的 PDF、DOCX、图片、TXT 或 Markdown 文件。",
      );
      return;
    }
    const additions = valid.filter(
      (file) =>
        !items.some(
          (item) =>
            item.file.name === file.name && item.file.size === file.size,
        ),
    );
    if (!additions.length) {
      setMessage("所选文件已在当前项目资料中。");
      return;
    }
    setParsing(true);
    onBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      additions.forEach((file) => body.append("file", file));
      body.append("companyMode", companyMode);
      body.append("action", "parse");
      const response = await fetch("/api/tender-agent", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        files?: ParsedBidDocument[];
        message?: string;
      };
      if (!response.ok || !data.files)
        throw new Error(data.message || "文件解析未完成。");
      const next = [
        ...items,
        ...additions.map((file, index) => ({
          file,
          parsed: data.files![index],
        })),
      ];
      setItems(next);
      onFilesReady(next.map((item) => item.file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件解析未完成。");
    } finally {
      setParsing(false);
      onBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  function remove(file: File) {
    const next = items.filter((item) => item.file !== file);
    setItems(next);
    onFilesReady(next.map((item) => item.file));
  }
  return (
    <div className="mt-5">
      <div
        role="button"
        tabIndex={0}
        aria-label="上传招标文件"
        onClick={() => !parsing && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !parsing)
            inputRef.current?.click();
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void begin(event.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border border-dashed p-4 text-center text-xs ${parsing ? "cursor-wait border-black/10 bg-[#f7f8f9]" : "border-black/15 bg-[#f7f8f9]"}`}
      >
        {parsing ? (
          <LoaderCircle
            className="mx-auto mb-2 animate-spin text-[#7fbf22]"
            size={20}
          />
        ) : (
          <Upload className="mx-auto mb-2 text-neutral-600" size={20} />
        )}
        <span className="block font-medium text-neutral-800">
          {parsing ? "正在解析招标材料..." : "拖拽或点击追加招标材料"}
        </span>
        <span className="mt-1 block text-neutral-500">
          支持 PDF / Word / 图片 / TXT / Markdown
        </span>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,text/plain,text/markdown"
          onChange={(event) => {
            if (event.target.files) void begin(event.target.files);
          }}
        />
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={`${item.file.name}-${item.file.size}`}
              className="rounded-xl bg-[#f7f8f9] p-3 text-xs"
            >
              <div className="flex gap-2">
                <FileText
                  className="mt-0.5 shrink-0 text-neutral-500"
                  size={15}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-800">
                    {item.file.name}
                  </p>
                  <p className="text-neutral-500">
                    {item.parsed?.fileType ??
                      extension(item.file.name).toUpperCase()}{" "}
                    · {readableSize(item.file.size)}
                  </p>
                  <p className="mt-1 text-emerald-700">
                    {item.parsed ? (
                      <>
                        <CheckCircle2 className="mr-1 inline" size={13} />
                        已解析 {item.parsed.characterCount} 字 ·{" "}
                        {item.parsed.pageCount ?? "—"} 页 ·{" "}
                        {item.parsed.parseMethod === "ocr"
                          ? "已触发 OCR"
                          : "文本解析"}
                      </>
                    ) : (
                      item.error
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`删除 ${item.file.name}`}
                  onClick={() => remove(item.file)}
                  className="text-neutral-400 hover:text-red-700"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {message && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900"
        >
          {message}
        </p>
      )}
    </div>
  );
}
