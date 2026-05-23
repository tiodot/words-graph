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
  try {
    const items = JSON.parse(content);
    const words: ParsedWord[] = items.map((item: any) => ({
      word: item.word,
      definition: item.meaning || item.definition,
      phonetic: item.phonetic,
    }));
    return { name: "bubei", words };
  } catch {
    return { name: "bubei", words: [] };
  }
}

function parseGenericCsv(content: string, mapping?: CsvMapping): ParseResult {
  const lines = content.split("\n").filter((l) => l.trim());
  const wordCol = mapping?.wordColumn ?? 0;
  const defCol = mapping?.definitionColumn;
  const phonCol = mapping?.phoneticColumn;

  const words: ParsedWord[] = [];
  const startRow = mapping ? 1 : 0;
  for (let i = startRow; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
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
  try {
    const items = JSON.parse(content);
    const words: ParsedWord[] = items.map((item: any) => ({
      word: item.word || item.term,
      definition: item.definition || item.meaning || item.def,
      phonetic: item.phonetic || item.pronunciation,
    }));
    return { name: "json", words };
  } catch {
    return { name: "json", words: [] };
  }
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
