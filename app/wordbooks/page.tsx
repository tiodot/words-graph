"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Wordbook {
  id: number;
  name: string;
  source: string;
  wordCount: number;
  createdAt: string;
}

export default function WordbooksPage() {
  const router = useRouter();
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [bookName, setBookName] = useState("");

  useEffect(() => {
    fetchWordbooks();
  }, []);

  async function fetchWordbooks() {
    const res = await fetch("/api/wordbooks");
    const data = await res.json();
    if (data.success) setWordbooks(data.data);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (bookName) formData.append("name", bookName);

    try {
      const res = await fetch("/api/wordbooks", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setBookName("");
        fetchWordbooks();
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这本单词书吗？")) return;

    await fetch(`/api/wordbooks/${id}`, { method: "DELETE" });
    fetchWordbooks();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">单词书管理</h1>

      <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a] mb-8">
        <h2 className="font-semibold mb-4">导入单词书</h2>
        <div className="flex gap-4 items-end">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              书名（可选）
            </label>
            <input
              type="text"
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              placeholder="输入书名"
              className="bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              选择文件
            </label>
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleUpload}
              disabled={isUploading}
              className="text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          支持格式：墨墨 CSV、不背单词 JSON、通用 CSV、纯文本
        </p>
      </div>

      <div className="grid gap-4">
        {wordbooks.map((wb) => (
          <div
            key={wb.id}
            className="bg-[#1a1a1a] p-4 rounded-lg border border-[#2a2a2a] flex items-center justify-between"
          >
            <div>
              <h3 className="font-medium">{wb.name}</h3>
              <p className="text-sm text-gray-400">
                {wb.wordCount} 词 · {wb.source}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/graph?wordbook=${wb.id}`)}
                className="px-4 py-2 bg-[#4f8cff] text-white rounded text-sm hover:bg-[#3a7aee]"
              >
                查看图谱
              </button>
              <button
                onClick={() => handleDelete(wb.id)}
                className="px-4 py-2 bg-[#2a2a2a] text-gray-400 rounded text-sm hover:bg-[#3a3a3a]"
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {wordbooks.length === 0 && (
          <p className="text-center text-gray-500 py-8">暂无单词书，请导入</p>
        )}
      </div>
    </div>
  );
}
