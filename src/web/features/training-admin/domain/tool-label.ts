/** How a tool is named on a row: short where the full name is long and well known. `full` is kept for hover and screen readers. */
export interface ToolLabel {
  label: string;
  full: string;
}

const SHORT: Record<string, string> = { powershell: 'PS' };

/** `PowerShell` → `PS` (any letter case); every other tool keeps its name. */
export function toolLabel(toolName: string): ToolLabel {
  return { label: SHORT[toolName.toLowerCase()] ?? toolName, full: toolName };
}
