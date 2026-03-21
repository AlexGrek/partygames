import { Link } from "react-router";
import { APPS } from "../apps";

const partyApps = APPS.filter((a) => a.category === "party");
const utilApps = APPS.filter((a) => a.category === "utils");

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16 pt-12 px-4">
      {/* Party apps */}
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-5xl font-bold tracking-tight">🎉 Party Games</h1>
        <div className="flex flex-col sm:flex-row gap-6 flex-wrap justify-center">
          {partyApps.map((app) => (
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

      {/* Utils */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs uppercase tracking-widest text-neutral-600 font-semibold">Utilities</p>
        <div className="flex gap-3 flex-wrap justify-center">
          {utilApps.map((app) => (
            <Link
              key={app.to}
              to={app.to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/3 hover:bg-white/8 border border-white/8 hover:border-white/15 transition-all text-neutral-400 hover:text-neutral-200 text-sm"
            >
              <span className="text-base leading-none">{app.emoji}</span>
              {app.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
