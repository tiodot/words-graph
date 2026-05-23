# 英语单词图谱网站设计文档

## 概述

一个面向普通英语学习者的单词图谱网站，支持导入单词书，通过多维度关联（语义、地点、场景、字符相似度、词根、词缀）生成可视化图谱，帮助用户探索和记忆单词。

## 目标用户

普通英语学习者（备考四六级、雅思等）。

## 核心功能

1. **单词书导入** — 支持墨墨、不背单词等常见 App 导出格式，以及通用 CSV、JSON、纯文本
2. **图谱生成** — 基于多维度关联自动生成可视化图谱
3. **图谱探索** — 交互式浏览、搜索、筛选、标记单词
4. **LLM 分析** — 用户自配 API Key，调用 LLM 分析语义/地点/场景关联

## 关联类型

| 类型 | 说明 | 数据来源 |
|------|------|----------|
| semantic | 语义相关（同义、反义、上下位） | LLM |
| location | 地点相关（常一起出现的场所） | LLM |
| scene | 场景相关（常一起出现的活动场景） | LLM |
| similar | 字符相似度（编辑距离 ≤ 3） | 本地算法 |
| root | 词根关联 | 预置词库 |
| affix | 词缀关联 | 预置词库 |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + React 18 + TypeScript |
| 图谱渲染 | Sigma.js v2 + Graphology |
| UI 组件 | Tailwind CSS + shadcn/ui |
| 后端 | Next.js API Routes |
| 数据库 | PostgreSQL + Prisma ORM |
| LLM 集成 | Vercel AI SDK |

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Next.js App (React)                             │
│  ├── Word Book Import Page                       │
│  ├── Graph Explorer Page                         │
│  └── Settings Page (API Key config)              │
└─────────────────────┬───────────────────────────┘
                      │ API Routes
┌─────────────────────▼───────────────────────────┐
│                   Backend                        │
│  Next.js API Routes                              │
│  ├── /api/wordbooks — CRUD 单词书                 │
│  ├── /api/graph — 生成/查询图谱数据                │
│  ├── /api/llm — 调用 LLM 分析关联                 │
│  └── /api/settings — 用户设置（API Key 等）        │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                   Data Layer                     │
│  PostgreSQL                                      │
│  ├── wordbooks — 单词书                           │
│  ├── words — 单词（含释义、音标）                   │
│  ├── edges — 关联关系（类型、权重）                 │
│  └── user_settings — API Key、偏好设置            │
└─────────────────────────────────────────────────┘
```

## 数据库设计

### wordbooks 表

```sql
wordbooks (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  source      VARCHAR(50),
  word_count  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
)
```

### words 表

```sql
words (
  id          SERIAL PRIMARY KEY,
  wordbook_id INT REFERENCES wordbooks(id) ON DELETE CASCADE,
  word        VARCHAR(100) NOT NULL,
  definition  TEXT,
  phonetic    VARCHAR(100),
  tags        JSONB,              -- {"mastered": boolean, "starred": boolean}
  created_at  TIMESTAMP DEFAULT NOW()
)
```

### edges 表

```sql
edges (
  id          SERIAL PRIMARY KEY,
  source_id   INT REFERENCES words(id) ON DELETE CASCADE,
  target_id   INT REFERENCES words(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  weight      FLOAT DEFAULT 1.0,
  source      VARCHAR(20),           -- prebuilt | llm
  created_at  TIMESTAMP DEFAULT NOW()
)
```

### user_settings 表

```sql
user_settings (
  id          SERIAL PRIMARY KEY,
  provider    VARCHAR(50),
  api_key     TEXT,
  model       VARCHAR(100),
  updated_at  TIMESTAMP DEFAULT NOW()
)
```

### 索引策略

- `words.wordbook_id` — 快速查询某本书的所有单词
- `words.word` — 搜索定位
- `edges.source_id, edges.target_id` — 图谱遍历
- `edges.type` — 按关联类型筛选

## 页面设计

### 图谱探索页布局

- **左侧边栏**：单词书列表、关联类型筛选（6 种颜色标签）、布局模式切换（力导向/径向/层次）
- **主图谱区域**：Sigma.js 渲染的图谱，支持拖拽、缩放、搜索定位
- **右侧详情面板**：点击节点后展示单词释义、音标、关联列表、学习状态标记

### 节点交互

- 点击节点：展开详情面板
- 双击节点：以该词为中心重新布局
- 拖拽节点：调整位置
- 悬停：高亮关联路径

### 画布交互

- 滚轮：缩放
- 拖拽空白处：平移画布
- 搜索框：定位到指定单词
- 筛选标签：过滤关联类型

### 颜色编码

- 蓝色 (#4f8cff)：语义关联
- 绿色 (#43a047)：地点关联
- 橙色 (#ff9800)：场景关联
- 粉色 (#e91e63)：字符相似
- 紫色 (#9c27b0)：词根关联
- 青色 (#00bcd4)：词缀关联

### 节点大小

- 中心词：最大，主色
- 一级关联：中等，70% 透明度
- 二级关联：较小，50% 透明度
- 节点大小可按关联数量缩放

## API 路由

```
/api/wordbooks
  GET    /                    — 获取单词书列表
  POST   /import             — 导入单词书（上传文件）
  GET    /:id                 — 获取单词书详情
  DELETE /:id                 — 删除单词书

/api/words
  GET    /?wordbook_id=&search= — 获取单词列表（支持搜索）
  GET    /:id                   — 获取单词详情
  PATCH  /:id                   — 更新单词（标记掌握状态）

/api/graph
  GET    /?wordbook_id=&types= — 获取图谱数据（节点+边）
  POST   /generate             — 触发图谱生成
  GET    /progress/:job_id     — 查询生成进度

/api/settings
  GET    /                     — 获取用户设置
  PUT    /                     — 更新设置（API Key 等）
  POST   /test-connection     — 测试 LLM 连接

/api/llm
  POST   /analyze             — 调用 LLM 分析单词关联
```

### 响应格式

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 错误码

- 400 — 请求参数错误
- 401 — API Key 无效
- 429 — LLM 调用频率限制
- 500 — 服务器内部错误

## 单词书导入

### 支持格式

1. **墨墨单词导出** — CSV 格式，自动识别
2. **不背单词导出** — JSON 格式，自动识别
3. **通用 CSV** — 用户指定列映射（单词列、释义列）
4. **通用 JSON** — 自动识别字段名
5. **纯文本** — 每行一个单词，释义后续通过 LLM 补充

### 导入流程

```
用户上传文件 → 解析格式 → 提取单词 → 存入数据库 → 触发关联分析 → 生成图谱
```

## 关联分析

### 分析流程

```
单词入库后
  → 字符相似度（本地计算，编辑距离 ≤ 3）
  → 词根词缀（查预置词库，~500 词根，~100 词缀）
  → LLM 分析语义/地点/场景（每批 20-50 个单词）
  → 合并去重
  → 存入 edges 表
```

### LLM Prompt 模板

```
分析以下单词之间的关联关系，返回 JSON 格式：

单词列表：[word1, word2, ...]

请分析以下类型的关联：
1. semantic — 语义相关（同义、反义、上下位）
2. location — 地点相关（常一起出现的场所）
3. scene — 场景相关（常一起出现的活动场景）

返回格式：
{
  "edges": [
    {"source": "word1", "target": "word2", "type": "semantic", "weight": 0.8},
    ...
  ]
}
```

### 调用优化

- 分批处理，避免单次请求过大
- 重试机制：失败后指数退避重试
- 进度显示：前端实时显示分析进度
- 结果缓存：相同单词组合不重复调用

## LLM 集成

### 支持的提供商

| 提供商 | 模型 | API 格式 |
|--------|------|----------|
| OpenAI | GPT-4o / GPT-4 | OpenAI API |
| Anthropic | Claude 3.5 | Anthropic API |
| 自定义 | 兼容 OpenAI 格式的模型 | OpenAI API 兼容 |

### API Key 管理

- 用户在设置页配置 API Key
- 存储时 AES 加密，仅在调用时解密
- 支持多提供商切换

## 用户旅程

```
首次访问
  ↓
首页（了解功能）
  ↓
设置页（配置 API Key）
  ↓
单词书管理页（导入单词书）
  ↓
系统自动分析关联（显示进度）
  ↓
图谱探索页（开始学习）
  ↓
日常使用：直接进入图谱探索页
```

## 项目结构

```
words-graph/
├── app/
│   ├── page.tsx              — 首页
│   ├── wordbooks/page.tsx    — 单词书管理
│   ├── graph/page.tsx        — 图谱探索
│   ├── settings/page.tsx     — 设置
│   └── api/                  — API 路由
├── components/
│   ├── graph/                — 图谱组件
│   ├── ui/                   — 通用 UI 组件
│   └── layout/               — 布局组件
├── lib/
│   ├── db.ts                 — 数据库连接
│   ├── llm.ts                — LLM 调用
│   ├── graph.ts              — 图谱数据处理
│   └── parser.ts             — 单词书解析
├── prisma/
│   └── schema.prisma         — 数据库模型
└── public/
    └── data/                 — 预置词根词缀数据
```

## 规模预估

- 主要支持 1000-5000 词的中型单词书
- Sigma.js WebGL 渲染可轻松处理此规模
- PostgreSQL 支持后续扩展到更大规模
