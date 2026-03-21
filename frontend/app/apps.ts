export interface AppEntry {
  to: string;
  label: string;
  emoji: string;
}

export const APPS: AppEntry[] = [
  { to: "/crocodile", label: "Crocodile", emoji: "🐊" },
  { to: "/slopmachine", label: "SlopMachine", emoji: "🎰" },
  { to: "/db", label: "DB Viewer", emoji: "🗄️" },
  { to: "/files", label: "Files", emoji: "📁" },
];
