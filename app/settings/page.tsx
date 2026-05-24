"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data.data) {
      setProvider(data.data.provider || "openai");
      setModel(data.data.model || "gpt-4o");
      setHasApiKey(data.data.hasApiKey);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });
      setHasApiKey(true);
      setApiKey("");
    } finally {
      setIsSaving(false);
    }
  }

  const models: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4", "gpt-3.5-turbo"],
    anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
    custom: ["custom-model"],
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
        <h2 className="font-semibold mb-4">LLM 配置</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              提供商
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(models[e.target.value][0]);
              }}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">模型</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2"
            >
              {models[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              API Key
              {hasApiKey && (
                <span className="text-green-500 ml-2">已配置</span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasApiKey ? "输入新的 API Key 以更新" : "输入 API Key"
              }
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2"
            />
          </div>

          {provider === "custom" && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                API Base URL
              </label>
              <input
                type="text"
                placeholder="https://api.example.com/v1"
                className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !apiKey}
            className="w-full py-2 bg-[#4f8cff] text-white rounded hover:bg-[#3a7aee] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
