import { Link } from "react-router";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12">
      <h1 className="text-5xl font-bold tracking-tight">🎉 Party Games</h1>

      <div className="flex flex-col sm:flex-row gap-6 flex-wrap justify-center">
        <Link
          to="/crocodile"
          className="flex flex-col items-center gap-4 px-12 py-10 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 transition-all group"
        >
          <span className="text-7xl group-hover:scale-110 transition-transform">🐊</span>
          <span className="text-2xl font-semibold">Crocodile</span>
        </Link>

        <Link
          to="/slopmachine"
          className="flex flex-col items-center gap-4 px-12 py-10 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 transition-all group"
        >
          <span className="text-7xl group-hover:scale-110 transition-transform">🎰</span>
          <span className="text-2xl font-semibold">SlopMachine</span>
        </Link>

        <Link
          to="/db"
          className="flex flex-col items-center gap-4 px-12 py-10 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 transition-all group"
        >
          <span className="text-7xl group-hover:scale-110 transition-transform">🗄️</span>
          <span className="text-2xl font-semibold">DB Viewer</span>
        </Link>
      </div>
    </div>
  );
}