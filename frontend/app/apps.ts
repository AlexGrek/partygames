export interface AppEntry {
  to: string;
  label: string;
  emoji: string;
  category: "party" | "utils";
}

export const APPS: AppEntry[] = [
  { to: "/crocodile", label: "Crocodile", emoji: "🐊", category: "party" },
  { to: "/slopmachine", label: "SlopMachine", emoji: "🎰", category: "party" },
  { to: "/db", label: "DB Viewer", emoji: "🗄️", category: "utils" },
  { to: "/files", label: "Files", emoji: "📁", category: "utils" },
  { to: "/croc-editor", label: "Croc Editor", emoji: "✏️", category: "utils" },
];
