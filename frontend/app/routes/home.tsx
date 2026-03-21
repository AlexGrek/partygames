import { Link } from "react-router";
import { APPS } from "../apps";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 pt-12">
      <h1 className="text-5xl font-bold tracking-tight">🎉 Party Games</h1>

      <div className="flex flex-col sm:flex-row gap-6 flex-wrap justify-center">
        {APPS.map((app) => (
          <Link
            key={app.to}
            to={app.to}
            className="flex flex-col items-center gap-4 px-12 py-10 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all group shadow-xl"
          >
            <span className="text-7xl group-hover:scale-110 transition-transform">{app.emoji}</span>
            <span className="text-2xl font-semibold">{app.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
