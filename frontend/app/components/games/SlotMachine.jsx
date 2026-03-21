import React, { useState, useEffect, useCallback, useRef } from "react";
import "./SlotMachine.css";

const EMOJI_PACKS = [
  [
    // Slop classics
    "🚽",
    "🌚",
    "🎺",
    "🐸",
    "🗿",
    "🛸",
    "🍄",
    "🍖",
    "🦖",
    "🧿",
  ],
  [
    // Faces
    "🫠",
    "👽",
    "🤖",
    "🤡",
    "🤯",
    "🧐",
    "👺",
    "🤠",
    "😎",
    "🫥",
  ],
  [
    // Office
    "📎",
    "💾",
    "📠",
    "🖨️",
    "📉",
    "📈",
    "☕",
    "🗄️",
    "🖇️",
    "🗑️",
  ],
  [
    // Vibey office
    "🚀",
    "🔥",
    "🧠",
    "🍕",
    "🔋",
    "🎧",
    "🫠",
    "🥑",
    "💸",
    "🪴",
  ],
  [
    // Office signs
    "⛔",
    "⚠️",
    "📣",
    "💡",
    "🛑",
    "🔄",
    "🎯",
    "🆕",
    "🚧",
    "🆘",
  ],

  [
    // Medieval nonsense
    "⚔️",
    "🛡️",
    "🏰",
    "👑",
    "🧙",
    "🐉",
    "🕯️",
    "📜",
    "🪶",
    "🪦",
  ],
  [
    // Space chaos
    "🌌",
    "🪐",
    "☄️",
    "👾",
    "🛰️",
    "🌠",
    "🔭",
    "🌑",
    "🛸",
    "📡",
  ],
  [
    // Food crimes
    "🍟",
    "🍩",
    "🌮",
    "🍣",
    "🍪",
    "🧃",
    "🧂",
    "🍯",
    "🥫",
    "🫕",
  ],
  [
    // Nature but cursed
    "🌵",
    "🪵",
    "🕸️",
    "🦂",
    "🦠",
    "🍂",
    "🌪️",
    "🌫️",
    "🧊",
    "🪨",
  ],
  [
    // Party goblin
    "🎉",
    "🎊",
    "🍻",
    "🥳",
    "🎶",
    "🪩",
    "🎤",
    "🎸",
    "🎧",
    "💃",
  ],
  [
    // Tech gremlin
    "💻",
    "🧑‍💻",
    "🖥️",
    "⌨️",
    "🖱️",
    "🔌",
    "🧠",
    "💾",
    "📡",
    "🪫",
  ],
  [
    // Transportation weirdos
    "🛴",
    "🚲",
    "🛺",
    "🚜",
    "🚁",
    "⛵",
    "🚂",
    "🚀",
    "🛸",
    "🛵",
  ],
  [
    // Animal council
    "🦝",
    "🦦",
    "🦥",
    "🦨",
    "🦉",
    "🦈",
    "🦜",
    "🐢",
    "🐌",
    "🐓",
  ],
  [
    // Mystery / liminal
    "🚪",
    "🪞",
    "🕳️",
    "🧩",
    "🧠",
    "🔮",
    "📼",
    "📺",
    "⏳",
    "🗝️",
  ],
  [
    // Villain arc
    "😈",
    "💀",
    "🩸",
    "🕶️",
    "🔥",
    "⚡",
    "🦂",
    "🗡️",
    "🧨",
    "🧬",
  ],
];

const N = EMOJI_PACKS[0].length; // all packs are same size (10)
const STRIP_REPEATS = 20;
const STRIP_LEN = STRIP_REPEATS * N; // 200
const START_POS = N * 2; // 20
const DEFAULT_ADD_COUNTS = [3, 5, 10];
const DEFAULT_BIAS_INC = 0.15;
const INITIAL_SPINS = 0;

const randomPack = (excludePack) => {
  const options = EMOJI_PACKS.filter((p) => p !== excludePack);
  return options[Math.floor(Math.random() * options.length)];
};

const buildStrip = (pack) => Array(STRIP_REPEATS).fill(pack).flat();

const VICTORY_EXTRAS = ["✨", "🎊", "🎉", "⭐", "💫"];

const generateParticles = (winEmoji) =>
  Array.from({ length: 52 }, () => ({
    emoji: Math.random() < 0.72
      ? winEmoji
      : VICTORY_EXTRAS[Math.floor(Math.random() * VICTORY_EXTRAS.length)],
    style: {
      "--x":     `${(Math.random() * 96).toFixed(1)}vw`,
      "--y":     `${(Math.random() * 88).toFixed(1)}vh`,
      "--dx":    `${((Math.random() - 0.5) * 90).toFixed(1)}vw`,
      "--dy":    `${((Math.random() - 0.5) * 90).toFixed(1)}vh`,
      "--rot":   `${(Math.random() < 0.5 ? 1 : -1) * (180 + Math.floor(Math.random() * 3) * 180)}deg`,
      "--sway":  `${((Math.random() - 0.5) * 110).toFixed(0)}px`,
      "--delay": `${(Math.random() * 0.9).toFixed(2)}s`,
      "--dur":   `${(2.4 + Math.random() * 1.4).toFixed(2)}s`,
      "--size":  `${(1.6 + Math.random() * 2.4).toFixed(1)}rem`,
    },
  }));

const SlotMachine = () => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [jackpot, setJackpot] = useState(false);
  const [victoryAnim, setVictoryAnim] = useState(null);
  const [victoryParticles, setVictoryParticles] = useState([]);
  const [shakeClass, setShakeClass] = useState("");
  // endStateActive gates pack-swap + button reveal; delayed for jackpot
  const [endStateActive, setEndStateActive] = useState(false);
  const victoryPlayingRef = useRef(false);
  const [spins, setSpins] = useState(INITIAL_SPINS);
  const [addCounts, setAddCounts] = useState(DEFAULT_ADD_COUNTS);
  const biasRef = useRef(0);
  const [bias, setBias] = useState(0);
  const biasIncRef = useRef(DEFAULT_BIAS_INC);
  const [showFreeSpin, setShowFreeSpin] = useState(false);

  // Active emoji pack — ref for callbacks, state for rendering
  const activePackRef = useRef(EMOJI_PACKS[0]);
  const [activePack, setActivePack] = useState(EMOJI_PACKS[0]);

  const posRef = useRef([START_POS, START_POS, START_POS]);
  const [displayPos, setDisplayPos] = useState([
    START_POS,
    START_POS,
    START_POS,
  ]);
  const [stepMs, setStepMs] = useState([65, 65, 65]);

  // Fetch slop config — backend seeds defaults on startup
  useEffect(() => {
    Promise.all([
      fetch("/api/v1/keys/slop%3A%3Aspin-add-count").then((r) => r.json()),
      fetch("/api/v1/keys/slop%3A%3Abias-factor-inc").then((r) => r.json()),
    ])
      .then(([addData, incData]) => {
        if (Array.isArray(addData.value) && addData.value.length > 0) {
          setAddCounts(addData.value);
        }
        if (typeof incData.value === "number" && incData.value > 0) {
          biasIncRef.current = incData.value;
        }
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const updateReel = (ri, pos, ms) => {
    posRef.current[ri] = pos;
    setDisplayPos((prev) => {
      const n = [...prev];
      n[ri] = pos;
      return n;
    });
    setStepMs((prev) => {
      const n = [...prev];
      n[ri] = ms;
      return n;
    });
  };

  const stopReel = useCallback((ri, targetEmoji, onDone) => {
    const strip = buildStrip(activePackRef.current);
    const cur = posRef.current[ri];
    let targetPos = cur + N;
    for (let i = cur + 3; i <= cur + N + 3; i++) {
      if (strip[i] === targetEmoji) {
        targetPos = i;
        break;
      }
    }

    const totalSteps = targetPos - cur;
    let step = 0;

    const doStep = () => {
      if (step >= totalSteps) {
        onDone();
        return;
      }
      step++;
      const progress = step / totalSteps;
      const delay = 65 + progress * progress * 215;
      updateReel(ri, cur + step, delay);
      setTimeout(doStep, delay);
    };

    doStep();
  }, []);

  const spin = useCallback(() => {
    if (isSpinning || spins <= 0) return;
    setIsSpinning(true);
    setJackpot(false);
    setShowFreeSpin(false);
    setSpins((s) => s - 1);

    const pack = activePackRef.current;
    const anchor = pack[Math.floor(Math.random() * N)];
    const pick = () =>
      Math.random() < biasRef.current
        ? anchor
        : pack[Math.floor(Math.random() * N)];
    const finalEmojis = [anchor, pick(), pick()];
    const intervals = [null, null, null];
    const SPIN_MS = 65;

    for (let i = 0; i < 3; i++) {
      const ri = i;
      setStepMs((prev) => {
        const n = [...prev];
        n[ri] = SPIN_MS;
        return n;
      });
      intervals[ri] = setInterval(() => {
        let next = posRef.current[ri] + 1;
        if (next >= STRIP_LEN - N * 3) next = START_POS;
        posRef.current[ri] = next;
        setDisplayPos((prev) => {
          const n = [...prev];
          n[ri] = next;
          return n;
        });
      }, 70);
    }

    const stopDelays = [700, 1050, 1400];
    let doneCount = 0;

    stopDelays.forEach((delay, ri) => {
      setTimeout(() => {
        clearInterval(intervals[ri]);
        stopReel(ri, finalEmojis[ri], () => {
          doneCount++;
          if (doneCount === 3) {
            setIsSpinning(false);
            const counts = {};
            finalEmojis.forEach((e) => {
              counts[e] = (counts[e] || 0) + 1;
            });
            const vals = Object.values(counts);
            if (vals.includes(3)) {
              setJackpot(true);
              setSpins(0); // jackpot = end state, triggers outOfSpins
              const anim = Math.floor(Math.random() * 4) + 1;
              setVictoryAnim(anim);
              setVictoryParticles(generateParticles(finalEmojis[0]));
              setShakeClass("shake-heavy");
              setTimeout(() => setShakeClass(""), 700);
              // delay end-state (pack swap + buttons) until animation finishes
              victoryPlayingRef.current = true;
              setTimeout(() => {
                victoryPlayingRef.current = false;
                setVictoryAnim(null);
                setEndStateActive(true);
              }, 4000);
            } else if (vals.includes(2)) {
              setSpins((s) => s + 1);
              setShowFreeSpin(true);
              setTimeout(() => setShowFreeSpin(false), 2200);
              setShakeClass("shake-light");
              setTimeout(() => setShakeClass(""), 400);
            } else {
              const next = Math.min(biasRef.current + biasIncRef.current, 0.85);
              biasRef.current = next;
              setBias(next);
            }
          }
        });
      }, delay);
    });
  }, [isSpinning, spins, stopReel]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        spin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spin]);

  const outOfSpins = spins <= 0 && !isSpinning;

  // Activate end-state immediately for normal out-of-spins; jackpot defers via victoryPlayingRef
  useEffect(() => {
    if (!outOfSpins) { setEndStateActive(false); return; }
    if (!victoryPlayingRef.current) setEndStateActive(true);
  }, [outOfSpins]);

  // When end-state activates: halve bias, swap pack, animate reels
  useEffect(() => {
    if (!endStateActive) return;

    const halfBias = biasRef.current / 2;
    biasRef.current = halfBias;
    setBias(halfBias);

    const next = randomPack(activePackRef.current);
    activePackRef.current = next;
    setActivePack(next);

    posRef.current = [START_POS, START_POS, START_POS];
    setDisplayPos([START_POS, START_POS, START_POS]);
    setStepMs([0, 0, 0]);

    const SPIN_STEPS = 18;
    const startReelAnim = (ri, startDelay) => {
      setTimeout(() => {
        let step = 0;
        const doStep = () => {
          if (step >= SPIN_STEPS) return;
          step++;
          const progress = step / SPIN_STEPS;
          const delay = 40 + progress * progress * 200;
          let next = posRef.current[ri] + 1;
          if (next >= STRIP_LEN - N * 3) next = START_POS;
          posRef.current[ri] = next;
          setDisplayPos((prev) => { const n = [...prev]; n[ri] = next; return n; });
          setStepMs((prev) => { const n = [...prev]; n[ri] = delay; return n; });
          setTimeout(doStep, delay);
        };
        doStep();
      }, startDelay);
    };

    startReelAnim(0, 50);
    startReelAnim(1, 220);
    startReelAnim(2, 390);
  }, [endStateActive]);

  // 2s delay then staggered reveal of add-spins buttons (starts after end-state activates)
  const [visibleButtons, setVisibleButtons] = useState([]);
  useEffect(() => {
    if (!endStateActive) { setVisibleButtons([]); return; }
    const timers = addCounts.map((_, i) =>
      setTimeout(
        () => setVisibleButtons((prev) => [...prev, i]),
        2000 + i * 200,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [endStateActive, addCounts]);

  const strip = buildStrip(activePack);

  return (
    <div className={`machine-container ${shakeClass}`}>
      {victoryAnim && (
        <div className={`victory-overlay victory-anim-${victoryAnim}`}>
          {victoryParticles.map((p, i) => (
            <span key={i} className="victory-particle" style={p.style}>{p.emoji}</span>
          ))}
        </div>
      )}
      <span className="bias-indicator">bias {Math.round(bias * 100)}%</span>
      <h1 className="title">SLOP MACHINE</h1>

      <div className="slot-row">
        {[0, 1, 2].map((ri) => (
          <div key={ri} className="slot-card">
            <div
              className="slot-reel"
              style={{
                transform: `translateY(-${displayPos[ri] * 120}px)`,
                transition: `transform ${stepMs[ri]}ms linear`,
              }}
            >
              {strip.map((emoji, idx) => (
                <div key={idx} className="slot-item">
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        className={`spin-button ${isSpinning ? "disabled" : ""}`}
        style={outOfSpins ? { visibility: "hidden" } : undefined}
        onClick={spin}
        disabled={isSpinning || outOfSpins}
      >
        {isSpinning ? "SPINNING..." : "PULL LEVER"}
      </button>

      <div className="message-zone">
        {showFreeSpin && (
          <h2 className="free-spin-text">✨ FREE SPIN! ✨</h2>
        )}

        {!outOfSpins && !showFreeSpin && (
          <p className="spin-count">
            {spins} spin{spins !== 1 ? "s" : ""} left
          </p>
        )}

        {outOfSpins && (
          <div className="add-spins-zone">
            {jackpot
              ? <h2 className="victory-text">🎊 JACKPOT! 🎊</h2>
              : <p className="out-of-spins-text">No spins left</p>
            }
            <div className="add-spins-buttons">
              {addCounts.map((n, i) => (
                <button
                  key={n}
                  className={`add-spins-button ${visibleButtons.includes(i) ? "visible" : ""}`}
                  onClick={() => {
                    setSpins((s) => s + n);
                    setJackpot(false);
                  }}
                >
                  Add {n} spins
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlotMachine;
