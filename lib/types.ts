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
