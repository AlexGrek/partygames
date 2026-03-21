import { Link } from "react-router";

export default function SlopMachine() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <span className="text-8xl">🎰</span>
      <h1 className="text-4xl font-bold">SlopMachine</h1>
      <p className="text-neutral-500 text-lg">Coming soon...</p>
      <Link to="/" className="mt-4 text-neutral-400 hover:text-white transition-colors">
        ← Back to menu
      </Link>
    </div>
  );
}
