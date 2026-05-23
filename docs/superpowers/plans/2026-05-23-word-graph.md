# 英语单词图谱网站实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个支持多维度关联的英语单词图谱网站，用户可导入单词书并通过语义、地点、场景、字符相似度、词根、词缀生成可视化图谱。

**Architecture:** Next.js 14 全栈应用，前端使用 Sigma.js + Graphology 渲染图谱，后端使用 Prisma ORM 操作 PostgreSQL，LLM 集成通过 Vercel AI SDK 支持多提供商。

**Tech Stack:** Next.js 14, React 18, TypeScript, Sigma.js, Graphology, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Vercel AI SDK

---

## 文件结构

```
words-graph/
├── app/
│   ├── layout.tsx                    — 根布局
│   ├── page.tsx                      — 首页
│   ├── wordbooks/
│   │   └── page.tsx                  — 单词书管理页
│   ├── graph/
│   │   └── page.tsx                  — 图谱探索页
│   ├── settings/
│   │   └── page.tsx                  — 设置页
│   └── api/
│       ├── wordbooks/
│       │   ├── route.ts              — GET / POST
│       │   └── [id]/
│       │       └── route.ts          — GET / DELETE
│       ├── words/
│       │   ├── route.ts              — GET
│       │   └── [id]/
│       │       └── route.ts          — GET / PATCH
│       ├── graph/
│       │   ├── route.ts              — GET
│       │   └── generate/
│       │       └── route.ts          — POST
│       ├── settings/
│       │   └── route.ts              — GET / PUT
│       └── llm/
│           └── analyze/
│               └── route.ts          — POST
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx           — Sigma.js 图谱画布
│   │   ├── GraphControls.tsx         — 缩放/布局控制
│   │   ├── GraphFilters.tsx          — 关联类型筛选
│   │   └── WordDetail.tsx            — 单词详情面板
│   ├── layout/
│   │   ├── Sidebar.tsx               — 侧边栏
│   │   └── Header.tsx                — 顶栏
│   └── ui/
│       ├── button.tsx                — shadcn 按钮
│       ├── input.tsx                 — shadcn 输入框
│       ├── dialog.tsx                — shadcn 弹窗
│       └── badge.tsx                 — shadcn 标签
├── lib/
│   ├── db.ts                         — Prisma 客户端
│   ├── parser.ts                     — 单词书解析器
│   ├── similarity.ts                 — 字符相似度算法
│   ├── root-affix.ts                 — 词根词缀匹配
│   ├── llm.ts                        — LLM 调用封装
│   ├── crypto.ts                     — API Key 加密
│   └── types.ts                      — 共享类型定义
├── prisma/
│   └── schema.prisma                 — 数据库模型
├── public/
│   └── data/
│       ├── roots.json                — 词根数据
│       └── affixes.json              — 词缀数据
├── __tests__/
│   ├── lib/
│   │   ├── parser.test.ts
│   │   ├── similarity.test.ts
│   │   └── root-affix.test.ts
│   └── api/
│       └── wordbooks.test.ts
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
cd /Users/xiong/Workplace/words-graph
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

- [ ] **Step 2: 安装核心依赖**

```bash
npm install prisma @prisma/client sigma graphology graphology-layout-forceatlas2
npm install -D @types/node
```

- [ ] **Step 3: 验证项目启动**

```bash
npm run dev
```

Expected: 访问 http://localhost:3000 看到 Next.js 默认页面

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: initialize Next.js project with dependencies"
```

---

## Task 2: 数据库 Schema

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `lib/db.ts`

- [ ] **Step 1: 创建 Prisma Schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Wordbook {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(255)
  source    String?  @db.VarChar(50)
  wordCount Int      @default(0) @map("word_count")
  createdAt DateTime @default(now()) @map("created_at")
  words     Word[]

  @@map("wordbooks")
}

model Word {
  id         Int      @id @default(autoincrement())
  wordbookId Int      @map("wordbook_id")
  word       String   @db.VarChar(100)
  definition String?  @db.Text
  phonetic   String?  @db.VarChar(100)
  tags       Json?    @default("{}")
  createdAt  DateTime @default(now()) @map("created_at")
  wordbook   Wordbook @relation(fields: [wordbookId], references: [id], onDelete: Cascade)
  sourceEdges Edge[] @relation("SourceWord")
  targetEdges Edge[] @relation("TargetWord")

  @@index([wordbookId])
  @@index([word])
  @@map("words")
}

model Edge {
  id        Int      @id @default(autoincrement())
  sourceId  Int      @map("source_id")
  targetId  Int      @map("target_id")
  type      String   @db.VarChar(50)
  weight    Float    @default(1.0)
  source    String?  @db.VarChar(20)
  createdAt DateTime @default(now()) @map("created_at")
  sourceWord Word   @relation("SourceWord", fields: [sourceId], references: [id], onDelete: Cascade)
  targetWord Word   @relation("TargetWord", fields: [targetId], references: [id], onDelete: Cascade)

  @@index([sourceId, targetId])
  @@index([type])
  @@map("edges")
}

model UserSettings {
  id        Int      @id @default(autoincrement())
  provider  String?  @db.VarChar(50)
  apiKey    String?  @map("api_key") @db.Text
  model     String?  @db.VarChar(100)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("user_settings")
}
```

- [ ] **Step 2: 创建数据库连接工具**

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: 创建环境变量文件**

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/words_graph"
```

- [ ] **Step 4: 运行数据库迁移**

```bash
npx prisma migrate dev --name init
```

Expected: 迁移成功，数据库表已创建

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add database schema with Prisma"
```

---

## Task 3: 类型定义

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: 创建共享类型**

```typescript
// lib/types.ts
export type EdgeType = "semantic" | "location" | "scene" | "similar" | "root" | "affix";

export interface GraphNode {
  id: string;
  label: string;
  definition?: string;
  phonetic?: string;
  tags?: { mastered?: boolean; starred?: boolean };
  x?: number;
  y?: number;
  size: number;
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  color: string;
  size: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface WordbookImport {
  name: string;
  words: {
    word: string;
    definition?: string;
    phonetic?: string;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const EDGE_COLORS: Record<EdgeType, string> = {
  semantic: "#4f8cff",
  location: "#43a047",
  scene: "#ff9800",
  similar: "#e91e63",
  root: "#9c27b0",
  affix: "#00bcd4",
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  semantic: "语义",
  location: "地点",
  scene: "场景",
  similar: "相似",
  root: "词根",
  affix: "词缀",
};
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add shared type definitions"
```

---

## Task 4: 单词书解析器

**Files:**
- Create: `lib/parser.ts`, `__tests__/lib/parser.test.ts`

- [ ] **Step 1: 编写解析器测试**

```typescript
// __tests__/lib/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseWordbook, detectFormat } from "@/lib/parser";

describe("detectFormat", () => {
  it("should detect moomoo CSV format", () => {
    const content = "word,definition\nabandon,放弃";
    expect(detectFormat("vocab.csv", content)).toBe("moomoo");
  });

  it("should detect JSON format", () => {
    const content = '[{"word":"abandon","meaning":"放弃"}]';
    expect(detectFormat("vocab.json", content)).toBe("json");
  });

  it("should detect plain text format", () => {
    const content = "abandon\nabstract\nacademic";
    expect(detectFormat("vocab.txt", content)).toBe("text");
  });
});

describe("parseWordbook", () => {
  it("should parse moomoo CSV", () => {
    const content = "word,definition,phonetic\nabandon,放弃,/əˈbændən/\nabstract,抽象,ˈæbstrækt";
    const result = parseWordbook("moomoo", content);
    expect(result.words).toHaveLength(2);
    expect(result.words[0]).toEqual({
      word: "abandon",
      definition: "放弃",
      phonetic: "/əˈbændən/",
    });
  });

  it("should parse buBei JSON", () => {
    const content = JSON.stringify([
      { word: "abandon", meaning: "放弃", phonetic: "/əˈbændən/" },
      { word: "abstract", meaning: "抽象", phonetic: "/ˈæbstrækt/" },
    ]);
    const result = parseWordbook("bubei", content);
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe("abandon");
  });

  it("should parse plain text", () => {
    const content = "abandon\nabstract\nacademic";
    const result = parseWordbook("text", content);
    expect(result.words).toHaveLength(3);
    expect(result.words[0]).toEqual({ word: "abandon", definition: undefined, phonetic: undefined });
  });

  it("should parse generic CSV with column mapping", () => {
    const content = "term,meaning\nabandon,放弃";
    const result = parseWordbook("csv", content, { wordColumn: 0, definitionColumn: 1 });
    expect(result.words).toHaveLength(1);
    expect(result.words[0].definition).toBe("放弃");
  });
});
```

- [ ] **Step 2: 安装测试框架**

```bash
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: 配置 Vitest**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
```

- [ ] **Step 4: 运行测试验证失败**

```bash
npx vitest run __tests__/lib/parser.test.ts
```

Expected: FAIL - 模块未找到

- [ ] **Step 5: 实现解析器**

```typescript
// lib/parser.ts
export type Format = "moomoo" | "bubei" | "csv" | "json" | "text";

export interface ParsedWord {
  word: string;
  definition?: string;
  phonetic?: string;
}

export interface ParseResult {
  name: string;
  words: ParsedWord[];
}

export interface CsvMapping {
  wordColumn: number;
  definitionColumn?: number;
  phoneticColumn?: number;
}

export function detectFormat(filename: string, content: string): Format {
  if (filename.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed[0]?.meaning !== undefined) return "bubei";
      return "json";
    } catch {
      return "text";
    }
  }
  if (filename.endsWith(".csv")) {
    const firstLine = content.split("\n")[0].toLowerCase();
    if (firstLine.includes("word") && firstLine.includes("definition")) return "moomoo";
    return "csv";
  }
  return "text";
}

export function parseWordbook(
  format: Format,
  content: string,
  csvMapping?: CsvMapping
): ParseResult {
  switch (format) {
    case "moomoo":
      return parseMoomooCsv(content);
    case "bubei":
      return parseBubeiJson(content);
    case "csv":
      return parseGenericCsv(content, csvMapping);
    case "json":
      return parseGenericJson(content);
    case "text":
      return parsePlainText(content);
  }
}

function parseMoomooCsv(content: string): ParseResult {
  const lines = content.split("\n").filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const wordIdx = header.indexOf("word");
  const defIdx = header.indexOf("definition");
  const phonIdx = header.indexOf("phonetic");

  const words: ParsedWord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols[wordIdx]) {
      words.push({
        word: cols[wordIdx].trim(),
        definition: defIdx >= 0 ? cols[defIdx]?.trim() : undefined,
        phonetic: phonIdx >= 0 ? cols[phonIdx]?.trim() : undefined,
      });
    }
  }
  return { name: "moomoo", words };
}

function parseBubeiJson(content: string): ParseResult {
  const items = JSON.parse(content);
  const words: ParsedWord[] = items.map((item: any) => ({
    word: item.word,
    definition: item.meaning || item.definition,
    phonetic: item.phonetic,
  }));
  return { name: "bubei", words };
}

function parseGenericCsv(content: string, mapping?: CsvMapping): ParseResult {
  const lines = content.split("\n").filter((l) => l.trim());
  const wordCol = mapping?.wordColumn ?? 0;
  const defCol = mapping?.definitionColumn;
  const phonCol = mapping?.phoneticColumn;

  const words: ParsedWord[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (i === 0 && cols[0]?.toLowerCase() === "word") continue;
    if (cols[wordCol]) {
      words.push({
        word: cols[wordCol].trim(),
        definition: defCol !== undefined ? cols[defCol]?.trim() : undefined,
        phonetic: phonCol !== undefined ? cols[phonCol]?.trim() : undefined,
      });
    }
  }
  return { name: "csv", words };
}

function parseGenericJson(content: string): ParseResult {
  const items = JSON.parse(content);
  const words: ParsedWord[] = items.map((item: any) => ({
    word: item.word || item.term,
    definition: item.definition || item.meaning || item.def,
    phonetic: item.phonetic || item.pronunciation,
  }));
  return { name: "json", words };
}

function parsePlainText(content: string): ParseResult {
  const words: ParsedWord[] = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((word) => ({ word, definition: undefined, phonetic: undefined }));
  return { name: "text", words };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
```

- [ ] **Step 6: 运行测试验证通过**

```bash
npx vitest run __tests__/lib/parser.test.ts
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add wordbook parser with tests"
```

---

## Task 5: 字符相似度算法

**Files:**
- Create: `lib/similarity.ts`, `__tests__/lib/similarity.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
// __tests__/lib/similarity.test.ts
import { describe, it, expect } from "vitest";
import { editDistance, findSimilarWords } from "@/lib/similarity";

describe("editDistance", () => {
  it("should return 0 for identical strings", () => {
    expect(editDistance("hello", "hello")).toBe(0);
  });

  it("should return correct distance for single edit", () => {
    expect(editDistance("hello", "hallo")).toBe(1);
    expect(editDistance("hello", "hell")).toBe(1);
    expect(editDistance("hello", "helloo")).toBe(1);
  });

  it("should return correct distance for multiple edits", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("book", "cook")).toBe(1);
    expect(editDistance("book", "look")).toBe(1);
  });
});

describe("findSimilarWords", () => {
  it("should find words within edit distance threshold", () => {
    const words = ["book", "cook", "look", "room", "cool"];
    const result = findSimilarWords("book", words, 1);
    expect(result).toContain("cook");
    expect(result).toContain("look");
    expect(result).not.toContain("room");
    expect(result).not.toContain("cool");
  });

  it("should not include the word itself", () => {
    const words = ["book", "cook"];
    const result = findSimilarWords("book", words, 1);
    expect(result).not.toContain("book");
  });

  it("should respect threshold", () => {
    const words = ["book", "bok", "bo"];
    const result = findSimilarWords("book", words, 2);
    expect(result).toContain("bok");
    expect(result).toContain("bo");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx vitest run __tests__/lib/similarity.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现相似度算法**

```typescript
// lib/similarity.ts
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export function findSimilarWords(
  target: string,
  words: string[],
  threshold: number = 3
): string[] {
  const targetLower = target.toLowerCase();
  return words
    .filter((w) => w.toLowerCase() !== targetLower)
    .filter((w) => editDistance(targetLower, w.toLowerCase()) <= threshold);
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run __tests__/lib/similarity.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add character similarity algorithm with tests"
```

---

## Task 6: 词根词缀匹配

**Files:**
- Create: `lib/root-affix.ts`, `__tests__/lib/root-affix.test.ts`, `public/data/roots.json`, `public/data/affixes.json`

- [ ] **Step 1: 创建词根数据**

```json
// public/data/roots.json
[
  {"root": "act", "meaning": "做，行动", "words": ["act", "action", "active", "react", "interact"]},
  {"root": "aud", "meaning": "听", "words": ["audio", "audience", "audit", "auditorium"]},
  {"root": "bio", "meaning": "生命", "words": ["biology", "biography", "biodegradable"]},
  {"root": "ced", "meaning": "走，让步", "words": ["proceed", "recede", "precede", "concede"]},
  {"root": "cept", "meaning": "拿，抓", "words": ["accept", "concept", "except", "intercept"]},
  {"root": "cide", "meaning": "切，杀", "words": ["decide", "suicide", "pesticide", "homicide"]},
  {"root": "cred", "meaning": "相信", "words": ["credit", "incredible", "credential", "credo"]},
  {"root": "dict", "meaning": "说", "words": ["dictate", "predict", "dictionary", "verdict"]},
  {"root": "duct", "meaning": "引导", "words": ["conduct", "produce", "deduce", "introduce"]},
  {"root": "fact", "meaning": "做，制造", "words": ["factory", "manufacture", "factor", "artifact"]},
  {"root": "fer", "meaning": "带来", "words": ["transfer", "refer", "prefer", "confer"]},
  {"root": "graph", "meaning": "写，画", "words": ["graph", "paragraph", "biography", "photograph"]},
  {"root": "ject", "meaning": "投，扔", "words": ["project", "reject", "inject", "subject"]},
  {"root": "log", "meaning": "话，理性", "words": ["logic", "dialogue", "apology", "catalog"]},
  {"root": "mit", "meaning": "送，发", "words": ["submit", "permit", "commit", "transmit"]},
  {"root": "mov", "meaning": "动", "words": ["move", "remove", "movie", "promote"]},
  {"root": "nat", "meaning": "出生", "words": ["nature", "nation", "native", "innate"]},
  {"root": "port", "meaning": "拿，运", "words": ["transport", "import", "export", "report"]},
  {"root": "pos", "meaning": "放", "words": ["position", "compose", "deposit", "expose"]},
  {"root": "scrib", "meaning": "写", "words": ["describe", "prescribe", "subscribe", "script"]},
  {"root": "spect", "meaning": "看", "words": ["inspect", "respect", "suspect", "spectacle"]},
  {"root": "struct", "meaning": "建造", "words": ["structure", "construct", "instruct", "destruct"]},
  {"root": "tract", "meaning": "拉", "words": ["attract", "extract", "contract", "distract"]},
  {"root": "vent", "meaning": "来", "words": ["event", "adventure", "prevent", "convention"]},
  {"root": "vert", "meaning": "转", "words": ["convert", "reverse", "divert", "advertise"]},
  {"root": "vis", "meaning": "看", "words": ["visible", "vision", "advise", "revise"]},
  {"root": "voc", "meaning": "声音，叫", "words": ["vocal", "vocabulary", "advocate", "provoke"]}
]
```

- [ ] **Step 2: 创建词缀数据**

```json
// public/data/affixes.json
{
  "prefixes": [
    {"prefix": "un", "meaning": "不，非", "example": ["unable", "unfair", "unhappy"]},
    {"prefix": "re", "meaning": "再，重新", "example": ["review", "return", "rewrite"]},
    {"prefix": "pre", "meaning": "前，预先", "example": ["preview", "predict", "prepare"]},
    {"prefix": "dis", "meaning": "不，分离", "example": ["disagree", "disappear", "disconnect"]},
    {"prefix": "in", "meaning": "不，进入", "example": ["incorrect", "include", "inform"]},
    {"prefix": "im", "meaning": "不，进入", "example": ["impossible", "import", "improve"]},
    {"prefix": "mis", "meaning": "错误", "example": ["mistake", "misunderstand", "mislead"]},
    {"prefix": "over", "meaning": "过度，超过", "example": ["overcome", "overlook", "overflow"]},
    {"prefix": "inter", "meaning": "之间", "example": ["international", "interact", "interview"]},
    {"prefix": "trans", "meaning": "跨越", "example": ["transfer", "transform", "translate"]}
  ],
  "suffixes": [
    {"suffix": "tion", "meaning": "名词化", "example": ["action", "education", "situation"]},
    {"suffix": "sion", "meaning": "名词化", "example": ["decision", "version", "explosion"]},
    {"suffix": "ment", "meaning": "名词化", "example": ["movement", "agreement", "development"]},
    {"suffix": "ness", "meaning": "名词化", "example": ["happiness", "kindness", "weakness"]},
    {"suffix": "able", "meaning": "能够", "example": ["readable", "comfortable", "available"]},
    {"suffix": "ful", "meaning": "充满", "example": ["beautiful", "helpful", "wonderful"]},
    {"suffix": "less", "meaning": "没有", "example": ["helpless", "careless", "homeless"]},
    {"suffix": "ous", "meaning": "充满", "example": ["dangerous", "famous", "nervous"]},
    {"suffix": "ive", "meaning": "有倾向", "example": ["active", "creative", "positive"]},
    {"suffix": "ly", "meaning": "副词化", "example": ["quickly", "happily", "easily"]}
  ]
}
```

- [ ] **Step 3: 编写测试**

```typescript
// __tests__/lib/root-affix.test.ts
import { describe, it, expect } from "vitest";
import { findRootMatches, findAffixMatches } from "@/lib/root-affix";

describe("findRootMatches", () => {
  it("should find words sharing the same root", () => {
    const result = findRootMatches("action");
    expect(result).toContain("react");
    expect(result).toContain("active");
    expect(result).toContain("interact");
  });

  it("should return empty array for unknown root", () => {
    const result = findRootMatches("xyzunknown");
    expect(result).toHaveLength(0);
  });
});

describe("findAffixMatches", () => {
  it("should find words with same prefix", () => {
    const result = findAffixMatches("unable");
    const prefixes = result.filter((r) => r.type === "prefix");
    expect(prefixes.some((p) => p.affix === "un")).toBe(true);
  });

  it("should find words with same suffix", () => {
    const result = findAffixMatches("education");
    const suffixes = result.filter((r) => r.type === "suffix");
    expect(suffixes.some((s) => s.affix === "tion")).toBe(true);
  });
});
```

- [ ] **Step 4: 运行测试验证失败**

```bash
npx vitest run __tests__/lib/root-affix.test.ts
```

Expected: FAIL

- [ ] **Step 5: 实现词根词缀匹配**

```typescript
// lib/root-affix.ts
import rootsData from "@/public/data/roots.json";
import affixesData from "@/public/data/affixes.json";

interface RootEntry {
  root: string;
  meaning: string;
  words: string[];
}

interface AffixEntry {
  prefix?: string;
  suffix?: string;
  meaning: string;
  example: string[];
}

export function findRootMatches(word: string): string[] {
  const wordLower = word.toLowerCase();
  const matches: string[] = [];

  for (const entry of rootsData as RootEntry[]) {
    if (wordLower.includes(entry.root)) {
      for (const relatedWord of entry.words) {
        if (relatedWord.toLowerCase() !== wordLower) {
          matches.push(relatedWord);
        }
      }
    }
  }

  return [...new Set(matches)];
}

export function findAffixMatches(
  word: string
): { affix: string; type: "prefix" | "suffix"; words: string[] }[] {
  const wordLower = word.toLowerCase();
  const results: { affix: string; type: "prefix" | "suffix"; words: string[] }[] = [];

  for (const entry of affixesData.prefixes as AffixEntry[]) {
    if (wordLower.startsWith(entry.prefix!)) {
      results.push({
        affix: entry.prefix!,
        type: "prefix",
        words: entry.example.filter((w) => w.toLowerCase() !== wordLower),
      });
    }
  }

  for (const entry of affixesData.suffixes as AffixEntry[]) {
    if (wordLower.endsWith(entry.suffix!)) {
      results.push({
        affix: entry.suffix!,
        type: "suffix",
        words: entry.example.filter((w) => w.toLowerCase() !== wordLower),
      });
    }
  }

  return results;
}
```

- [ ] **Step 6: 运行测试验证通过**

```bash
npx vitest run __tests__/lib/root-affix.test.ts
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add root/affix matching with test data"
```

---

## Task 7: API Key 加密工具

**Files:**
- Create: `lib/crypto.ts`

- [ ] **Step 1: 实现加密工具**

```typescript
// lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY environment variable is required");
  return Buffer.from(secret, "hex");
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return iv.toString("hex") + tag.toString("hex") + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), "hex");
  const tag = Buffer.from(
    encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedText.slice((IV_LENGTH + TAG_LENGTH) * 2);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

- [ ] **Step 2: 添加环境变量**

```bash
# .env
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add API key encryption utility"
```

---

## Task 8: LLM 调用封装

**Files:**
- Create: `lib/llm.ts`

- [ ] **Step 1: 实现 LLM 调用封装**

```typescript
// lib/llm.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";
import { decrypt } from "./crypto";
import type { EdgeType } from "./types";

interface LLMEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
}

interface LLMResponse {
  edges: LLMEdge[];
}

function getProvider(provider: string, apiKey: string, model: string) {
  switch (provider) {
    case "openai":
      return openai(model, { apiKey });
    case "anthropic":
      return anthropic(model, { apiKey });
    default:
      return openai(model, { apiKey, baseURL: provider });
  }
}

export async function analyzeWordRelations(
  words: string[]
): Promise<LLMEdge[]> {
  const settings = await prisma.userSettings.findFirst();
  if (!settings?.apiKey || !settings?.provider || !settings?.model) {
    throw new Error("LLM settings not configured");
  }

  const apiKey = decrypt(settings.apiKey);
  const provider = getProvider(settings.provider, apiKey, settings.model);

  const prompt = `分析以下单词之间的关联关系，返回 JSON 格式：

单词列表：${JSON.stringify(words)}

请分析以下类型的关联：
1. semantic — 语义相关（同义、反义、上下位）
2. location — 地点相关（常一起出现的场所）
3. scene — 场景相关（常一起出现的活动场景）

只返回有明显关联的单词对。每个关联需要一个 0-1 之间的权重值表示关联强度。

返回格式（仅返回 JSON，不要其他内容）：
{
  "edges": [
    {"source": "word1", "target": "word2", "type": "semantic", "weight": 0.8}
  ]
}`;

  const { text } = await generateText({
    model: provider,
    prompt,
    temperature: 0.3,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const result: LLMResponse = JSON.parse(jsonMatch[0]);
    return result.edges;
  } catch (error) {
    console.error("Failed to parse LLM response:", text);
    throw new Error("Failed to parse LLM response");
  }
}

export async function batchAnalyzeWords(
  words: string[],
  batchSize: number = 30
): Promise<LLMEdge[]> {
  const allEdges: LLMEdge[] = [];

  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    try {
      const edges = await analyzeWordRelations(batch);
      allEdges.push(...edges);
    } catch (error) {
      console.error(`Batch ${i}-${i + batchSize} failed:`, error);
    }
  }

  return allEdges;
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add LLM integration with multi-provider support"
```

---

## Task 9: 图谱数据处理

**Files:**
- Create: `lib/graph.ts`

- [ ] **Step 1: 实现图谱数据生成**

```typescript
// lib/graph.ts
import { prisma } from "./db";
import { findSimilarWords } from "./similarity";
import { findRootMatches, findAffixMatches } from "./root-affix";
import { batchAnalyzeWords } from "./llm";
import { EDGE_COLORS } from "./types";
import type { GraphData, GraphNode, GraphEdge, EdgeType } from "./types";

export async function generateGraphData(wordbookId: number): Promise<void> {
  const words = await prisma.word.findMany({
    where: { wordbookId },
  });

  const wordTexts = words.map((w) => w.word);

  // Clear existing edges for this wordbook
  await prisma.edge.deleteMany({
    where: {
      sourceWord: { wordbookId },
    },
  });

  // 1. Character similarity
  const similarEdges = computeSimilarEdges(words);
  await saveEdges(similarEdges, "prebuilt");

  // 2. Root/affix matching
  const rootAffixEdges = computeRootAffixEdges(words);
  await saveEdges(rootAffixEdges, "prebuilt");

  // 3. LLM analysis (if configured)
  try {
    const llmEdges = await batchAnalyzeWords(wordTexts);
    await saveLLMEdges(llmEdges, words);
  } catch (error) {
    console.warn("LLM analysis skipped:", error);
  }

  // Update wordbook word count
  await prisma.wordbook.update({
    where: { id: wordbookId },
    data: { wordCount: words.length },
  });
}

function computeSimilarEdges(
  words: { id: number; word: string }[]
): { sourceId: number; targetId: number; type: EdgeType; weight: number }[] {
  const edges: { sourceId: number; targetId: number; type: EdgeType; weight: number }[] = [];
  const wordList = words.map((w) => w.word);

  for (let i = 0; i < words.length; i++) {
    const similar = findSimilarWords(words[i].word, wordList, 3);
    for (const simWord of similar) {
      const targetIdx = words.findIndex((w) => w.word === simWord);
      if (targetIdx > i) {
        const dist = editDistance(words[i].word.toLowerCase(), simWord.toLowerCase());
        edges.push({
          sourceId: words[i].id,
          targetId: words[targetIdx].id,
          type: "similar",
          weight: 1 - dist / 3,
        });
      }
    }
  }

  return edges;
}

function computeRootAffixEdges(
  words: { id: number; word: string }[]
): { sourceId: number; targetId: number; type: EdgeType; weight: number }[] {
  const edges: { sourceId: number; targetId: number; type: EdgeType; weight: number }[] = [];
  const wordMap = new Map(words.map((w) => [w.word.toLowerCase(), w.id]));

  for (const word of words) {
    // Root matches
    const rootMatches = findRootMatches(word.word);
    for (const match of rootMatches) {
      const targetId = wordMap.get(match.toLowerCase());
      if (targetId) {
        edges.push({ sourceId: word.id, targetId, type: "root", weight: 0.7 });
      }
    }

    // Affix matches
    const affixMatches = findAffixMatches(word.word);
    for (const affixMatch of affixMatches) {
      for (const match of affixMatch.words) {
        const targetId = wordMap.get(match.toLowerCase());
        if (targetId) {
          edges.push({
            sourceId: word.id,
            targetId,
            type: "affix",
            weight: 0.6,
          });
        }
      }
    }
  }

  return edges;
}

async function saveEdges(
  edges: { sourceId: number; targetId: number; type: string; weight: number }[],
  source: string
): Promise<void> {
  if (edges.length === 0) return;

  await prisma.edge.createMany({
    data: edges.map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      type: e.type,
      weight: e.weight,
      source,
    })),
    skipDuplicates: true,
  });
}

async function saveLLMEdges(
  llmEdges: { source: string; target: string; type: EdgeType; weight: number }[],
  words: { id: number; word: string }[]
): Promise<void> {
  const wordMap = new Map(words.map((w) => [w.word.toLowerCase(), w.id]));

  const edges = llmEdges
    .map((e) => ({
      sourceId: wordMap.get(e.source.toLowerCase())!,
      targetId: wordMap.get(e.target.toLowerCase())!,
      type: e.type,
      weight: e.weight,
    }))
    .filter((e) => e.sourceId && e.targetId);

  await saveEdges(edges, "llm");
}

export async function getGraphData(
  wordbookId: number,
  types?: EdgeType[]
): Promise<GraphData> {
  const words = await prisma.word.findMany({
    where: { wordbookId },
  });

  const edges = await prisma.edge.findMany({
    where: {
      sourceWord: { wordbookId },
      ...(types?.length ? { type: { in: types } } : {}),
    },
  });

  const nodes: GraphNode[] = words.map((w) => ({
    id: String(w.id),
    label: w.word,
    definition: w.definition ?? undefined,
    phonetic: w.phonetic ?? undefined,
    tags: w.tags as any,
    size: 10,
    color: "#4f8cff",
  }));

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    id: String(e.id),
    source: String(e.sourceId),
    target: String(e.targetId),
    type: e.type as EdgeType,
    weight: e.weight,
    color: EDGE_COLORS[e.type as EdgeType] || "#999",
    size: e.weight * 2,
  }));

  return { nodes, edges: graphEdges };
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add graph data generation and query logic"
```

---

## Task 10: API 路由 - 单词书

**Files:**
- Create: `app/api/wordbooks/route.ts`, `app/api/wordbooks/[id]/route.ts`

- [ ] **Step 1: 创建单词书列表 API**

```typescript
// app/api/wordbooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseWordbook, detectFormat } from "@/lib/parser";
import { generateGraphData } from "@/lib/graph";

export async function GET() {
  const wordbooks = await prisma.wordbook.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { words: true } } },
  });

  return NextResponse.json({
    success: true,
    data: wordbooks.map((wb) => ({
      ...wb,
      wordCount: wb._count.words,
    })),
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const name = formData.get("name") as string;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "No file provided" },
      { status: 400 }
    );
  }

  const content = await file.text();
  const format = detectFormat(file.name, content);
  const parsed = parseWordbook(format, content);

  const wordbook = await prisma.wordbook.create({
    data: {
      name: name || parsed.name || file.name,
      source: format,
      words: {
        create: parsed.words.map((w) => ({
          word: w.word,
          definition: w.definition,
          phonetic: w.phonetic,
        })),
      },
    },
    include: { _count: { select: { words: true } } },
  });

  // Trigger graph generation in background
  generateGraphData(wordbook.id).catch(console.error);

  return NextResponse.json({
    success: true,
    data: { ...wordbook, wordCount: wordbook._count.words },
  });
}
```

- [ ] **Step 2: 创建单词书详情/删除 API**

```typescript
// app/api/wordbooks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  const wordbook = await prisma.wordbook.findUnique({
    where: { id },
    include: { _count: { select: { words: true } } },
  });

  if (!wordbook) {
    return NextResponse.json(
      { success: false, error: "Wordbook not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { ...wordbook, wordCount: wordbook._count.words },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  await prisma.wordbook.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add wordbook API routes"
```

---

## Task 11: API 路由 - 图谱

**Files:**
- Create: `app/api/graph/route.ts`, `app/api/graph/generate/route.ts`

- [ ] **Step 1: 创建图谱查询 API**

```typescript
// app/api/graph/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getGraphData } from "@/lib/graph";
import type { EdgeType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wordbookId = searchParams.get("wordbook_id");
  const typesParam = searchParams.get("types");

  if (!wordbookId) {
    return NextResponse.json(
      { success: false, error: "wordbook_id is required" },
      { status: 400 }
    );
  }

  const types = typesParam
    ? (typesParam.split(",") as EdgeType[])
    : undefined;

  const data = await getGraphData(parseInt(wordbookId), types);

  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 2: 创建图谱生成 API**

```typescript
// app/api/graph/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateGraphData } from "@/lib/graph";

export async function POST(request: NextRequest) {
  const { wordbookId } = await request.json();

  if (!wordbookId) {
    return NextResponse.json(
      { success: false, error: "wordbookId is required" },
      { status: 400 }
    );
  }

  try {
    await generateGraphData(wordbookId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Graph generation failed:", error);
    return NextResponse.json(
      { success: false, error: "Graph generation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add graph API routes"
```

---

## Task 12: API 路由 - 设置

**Files:**
- Create: `app/api/settings/route.ts`

- [ ] **Step 1: 创建设置 API**

```typescript
// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const settings = await prisma.userSettings.findFirst();

  return NextResponse.json({
    success: true,
    data: settings
      ? {
          provider: settings.provider,
          model: settings.model,
          hasApiKey: !!settings.apiKey,
        }
      : null,
  });
}

export async function PUT(request: NextRequest) {
  const { provider, apiKey, model } = await request.json();

  const encryptedKey = apiKey ? encrypt(apiKey) : null;

  const existing = await prisma.userSettings.findFirst();

  if (existing) {
    await prisma.userSettings.update({
      where: { id: existing.id },
      data: { provider, apiKey: encryptedKey, model },
    });
  } else {
    await prisma.userSettings.create({
      data: { provider, apiKey: encryptedKey, model },
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add settings API route"
```

---

## Task 13: 布局组件

**Files:**
- Create: `app/layout.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`

- [ ] **Step 1: 创建根布局**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Word Graph - 英语单词图谱",
  description: "通过多维度关联探索英语单词",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen bg-[#0f0f0f] text-white">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 创建 Header 组件**

```tsx
// components/layout/Header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/wordbooks", label: "单词书" },
  { href: "/graph", label: "图谱" },
  { href: "/settings", label: "设置" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          Word Graph
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-[#2a2a2a] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 添加 utils 工具**

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: 安装依赖**

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add layout components"
```

---

## Task 14: 首页

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 1: 创建首页**

```tsx
// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Word Graph</h1>
        <p className="text-gray-400 text-lg mb-8">
          通过多维度关联探索英语单词，让记忆更高效
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/wordbooks"
            className="px-6 py-3 bg-[#4f8cff] text-white rounded-lg hover:bg-[#3a7aee] transition-colors"
          >
            开始使用
          </Link>
          <Link
            href="/settings"
            className="px-6 py-3 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors"
          >
            配置设置
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">语义关联</h3>
          <p className="text-gray-400 text-sm">
            发现同义词、反义词和上下位词
          </p>
        </div>
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">场景关联</h3>
          <p className="text-gray-400 text-sm">
            按地点和场景组织单词
          </p>
        </div>
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">词根词缀</h3>
          <p className="text-gray-400 text-sm">
            通过构词法理解单词
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add homepage"
```

---

## Task 15: 单词书管理页

**Files:**
- Create: `app/wordbooks/page.tsx`

- [ ] **Step 1: 创建单词书管理页**

```tsx
// app/wordbooks/page.tsx
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
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add wordbook management page"
```

---

## Task 16: 设置页

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: 创建设置页**

```tsx
// app/settings/page.tsx
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
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: add settings page"
```

---

## Task 17: 图谱探索页

**Files:**
- Create: `app/graph/page.tsx`, `components/graph/GraphCanvas.tsx`, `components/graph/GraphFilters.tsx`, `components/graph/WordDetail.tsx`

- [ ] **Step 1: 创建图谱画布组件**

```tsx
// components/graph/GraphCanvas.tsx
"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { EdgeType, EDGE_COLORS, GraphData } from "@/lib/types";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
}

export function GraphCanvas({ data, onNodeClick, activeTypes }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph();

    // Add nodes
    data.nodes.forEach((node) => {
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 10,
        y: Math.random() * 10,
        size: node.size,
        color: node.color,
      });
    });

    // Add edges (filtered by active types)
    data.edges
      .filter((edge) => activeTypes.includes(edge.type))
      .forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            color: edge.color,
            size: edge.size,
          });
        }
      });

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeColor: "#333",
      labelColor: { color: "#fff" },
    });

    sigma.on("clickNode", ({ node }) => {
      onNodeClick(node);
    });

    sigmaRef.current = sigma;

    return () => {
      sigma.kill();
    };
  }, [data, activeTypes, onNodeClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: 创建筛选组件**

```tsx
// components/graph/GraphFilters.tsx
"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, EdgeType } from "@/lib/types";

interface GraphFiltersProps {
  activeTypes: EdgeType[];
  onToggle: (type: EdgeType) => void;
}

const allTypes: EdgeType[] = ["semantic", "location", "scene", "similar", "root", "affix"];

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {allTypes.map((type) => (
        <button
          key={type}
          onClick={() => onToggle(type)}
          className="px-3 py-1 rounded-full text-xs border transition-colors"
          style={{
            backgroundColor: activeTypes.includes(type)
              ? `${EDGE_COLORS[type]}22`
              : "transparent",
            borderColor: activeTypes.includes(type)
              ? `${EDGE_COLORS[type]}44`
              : "#3a3a3a",
            color: activeTypes.includes(type) ? EDGE_COLORS[type] : "#888",
          }}
        >
          {EDGE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 创建单词详情组件**

```tsx
// components/graph/WordDetail.tsx
"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, GraphData, EdgeType } from "@/lib/types";

interface WordDetailProps {
  nodeId: string;
  data: GraphData;
  onClose: () => void;
}

export function WordDetail({ nodeId, data, onClose }: WordDetailProps) {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const relatedEdges = data.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );

  const relatedWords = relatedEdges.map((edge) => {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = data.nodes.find((n) => n.id === otherId);
    return {
      word: otherNode?.label || "",
      type: edge.type as EdgeType,
    };
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{node.label}</h2>
          {node.phonetic && (
            <p className="text-gray-400 text-sm">{node.phonetic}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {node.definition && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">释义</p>
          <p className="text-sm">{node.definition}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <p className="text-xs text-gray-500 mb-2">关联单词</p>
        <div className="space-y-2">
          {relatedWords.map((word, i) => (
            <div
              key={i}
              className="flex justify-between items-center"
            >
              <span style={{ color: EDGE_COLORS[word.type] }}>
                ● {word.word}
              </span>
              <span className="text-xs text-gray-500">
                {EDGE_TYPE_LABELS[word.type]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
        <p className="text-xs text-gray-500 mb-2">学习状态</p>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded text-xs bg-[#43a04722] text-[#43a047] border border-[#43a04744]">
            已掌握
          </button>
          <button className="px-3 py-1 rounded text-xs bg-[#2a2a2a] text-gray-400 border border-[#3a3a3a]">
            未掌握
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建图谱页面**

```tsx
// app/graph/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphFilters } from "@/components/graph/GraphFilters";
import { WordDetail } from "@/components/graph/WordDetail";
import { GraphData, EdgeType } from "@/lib/types";

export default function GraphPage() {
  const searchParams = useSearchParams();
  const wordbookId = searchParams.get("wordbook");

  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<EdgeType[]>([
    "semantic", "location", "scene", "similar", "root", "affix",
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (wordbookId) {
      fetchGraphData();
    }
  }, [wordbookId, activeTypes]);

  async function fetchGraphData() {
    const typesParam = activeTypes.join(",");
    const res = await fetch(
      `/api/graph?wordbook_id=${wordbookId}&types=${typesParam}`
    );
    const result = await res.json();
    if (result.success) {
      setData(result.data);
    }
  }

  const handleToggleType = useCallback((type: EdgeType) => {
    setActiveTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  if (!wordbookId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">请先选择一本单词书</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">筛选关联</h3>
          <GraphFilters activeTypes={activeTypes} onToggle={handleToggleType} />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">搜索</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索单词..."
            className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        <GraphCanvas
          data={data}
          onNodeClick={handleNodeClick}
          activeTypes={activeTypes}
        />
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="w-72 bg-[#1a1a1a] border-l border-[#2a2a2a] p-4">
          <WordDetail
            nodeId={selectedNode}
            data={data}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add graph explorer page with Sigma.js"
```

---

## Task 18: 最终集成测试

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加测试脚本**

```json
// package.json (scripts section)
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: 运行所有测试**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 3: 启动开发服务器验证**

```bash
npm run dev
```

Expected: 访问 http://localhost:3000 可以正常使用

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: add test scripts and final integration"
```

---

## 自检清单

- [ ] 所有测试通过
- [ ] 可以导入单词书
- [ ] 可以生成图谱
- [ ] 可以配置 LLM API Key
- [ ] 图谱交互正常（点击、拖拽、缩放）
- [ ] 筛选关联类型正常工作
- [ ] 详情面板显示正确
