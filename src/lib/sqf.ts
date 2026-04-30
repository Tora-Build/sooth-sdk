export interface SQFRule {
  description?: string;
  [key: string]: string | undefined;
}

export interface SQFData {
  question: string;
  rule: SQFRule;
  event?: string;
  category?: string;
  meta?: Record<string, string>;
}

export function generateSQF(data: SQFData): string {
  const lines: string[] = [];
  lines.push("§question");
  lines.push(data.question);
  if (data.rule && Object.keys(data.rule).length > 0) {
    lines.push("§rule");
    if (data.rule.description) lines.push(data.rule.description);
    for (const [key, value] of Object.entries(data.rule)) {
      if (key !== "description" && value !== undefined)
        lines.push(`${key}:${value}`);
    }
  }
  if (data.event) {
    lines.push("§event");
    lines.push(data.event);
  }
  if (data.category) {
    lines.push("§category");
    lines.push(data.category);
  }
  if (data.meta && Object.keys(data.meta).length > 0) {
    lines.push("§meta");
    for (const [key, value] of Object.entries(data.meta))
      lines.push(`${key}:${value}`);
  }
  return lines.join("\n");
}
