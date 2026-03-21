import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { Tally4, House } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { APPS } from "../apps";

const partyApps = APPS.filter((a) => a.category === "party");

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-50 p-3 pointer-events-none"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
        aria-label="App menu"
      >
        <Tally4 size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto mt-1 w-48 rounded-xl bg-black/40 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-amber-400 hover:bg-white/10 transition-colors border-b border-neutral-700/40"
            >
              <span className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-400/15">
                <House size={14} className="text-amber-400" />
              </span>
              Party Games
            </Link>
            {partyApps.map((app) => (
              <Link
                key={app.to}
                to={app.to}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/10 transition-colors"
              >
                <span className="w-6 h-6 flex items-center justify-center text-base leading-none">
                  {app.emoji}
                </span>
                {app.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
