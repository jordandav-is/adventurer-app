import { Die, roll } from "./dice.jsx";
import { Icon, T, btn } from "./ui.jsx";
import { useEffect, useState } from "react";

const STARS = [
  { top: "6%", left: "14%", size: 2, delay: "0.2s" },
  { top: "12%", left: "28%", size: 3, delay: "1.4s" },
  { top: "9%", left: "48%", size: 2, delay: "0.8s" },
  { top: "15%", left: "62%", size: 2.5, delay: "2.1s" },
  { top: "8%", left: "78%", size: 3, delay: "0.5s" },
  { top: "18%", left: "88%", size: 2, delay: "1.9s" },
  { top: "24%", left: "8%", size: 2.5, delay: "1.1s" },
  { top: "28%", left: "22%", size: 2, delay: "0.3s" },
  { top: "22%", left: "74%", size: 3.5, delay: "1.7s", cross: true },
  { top: "32%", left: "84%", size: 2, delay: "0.9s" },
  { top: "11%", left: "38%", size: 4, delay: "0s", cross: true },
  { top: "5%", left: "92%", size: 2, delay: "2.4s" },
  { top: "35%", left: "12%", size: 2, delay: "1.5s" },
  { top: "30%", left: "95%", size: 2.5, delay: "0.7s" },
];

const EMBERS = [
  { left: "34%", bottom: "6%", size: 3.5, delay: "0.1s", dur: "2.8s", dx: "24px", color: "#f59e0b" },
  { left: "40%", bottom: "10%", size: 2.5, delay: "0.7s", dur: "3.4s", dx: "-22px", color: "#ea580c" },
  { left: "45%", bottom: "4%", size: 4, delay: "0s", dur: "2.5s", dx: "14px", color: "#f97316" },
  { left: "48%", bottom: "8%", size: 3, delay: "1.2s", dur: "3.1s", dx: "-18px", color: "#fbbf24" },
  { left: "52%", bottom: "5%", size: 4.5, delay: "0.4s", dur: "2.7s", dx: "20px", color: "#f59e0b" },
  { left: "55%", bottom: "9%", size: 2.5, delay: "1.8s", dur: "3.5s", dx: "-26px", color: "#dc2626" },
  { left: "58%", bottom: "6%", size: 3, delay: "0.9s", dur: "3.0s", dx: "16px", color: "#f97316" },
  { left: "62%", bottom: "12%", size: 2, delay: "1.5s", dur: "2.9s", dx: "-14px", color: "#fbbf24" },
  { left: "38%", bottom: "14%", size: 3, delay: "2.2s", dur: "3.2s", dx: "18px", color: "#ea580c" },
  { left: "43%", bottom: "16%", size: 2.5, delay: "1.1s", dur: "2.6s", dx: "-10px", color: "#fde047" },
  { left: "50%", bottom: "18%", size: 3.5, delay: "1.6s", dur: "3.3s", dx: "12px", color: "#f97316" },
  { left: "56%", bottom: "15%", size: 2, delay: "0.3s", dur: "3.6s", dx: "-20px", color: "#f59e0b" },
];

export function InitiativeOverlay({ value, rollId, onReroll, onClose }) {
  const [revealDone, setRevealDone] = useState(false);

  useEffect(() => {
    setRevealDone(false);
    const t = setTimeout(() => setRevealDone(true), 1300);
    return () => clearTimeout(t);
  }, [rollId]);

  const isCrit = value === 20;
  const isFumble = value === 1;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "nightSkyIn 500ms ease-out both",
        overflow: "hidden",
      }}
      onClick={onClose}>

      {/* Luminous twilight sky backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 25%, rgba(28, 20, 43, 0.9) 0%, rgba(18, 13, 28, 0.94) 45%, rgba(8, 6, 12, 0.97) 85%)",
      }} />

      {/* Twinkling star canopy */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute", top: s.top, left: s.left,
            width: s.size, height: s.size, borderRadius: "50%",
            background: "#fef3c7",
            boxShadow: s.cross ? "0 0 10px #fde68a, 0 0 2px #fff" : "0 0 4px #fde68a",
            animation: `starTwinkle 2.4s ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}

      {/* Campfire warmth radiating from the bottom horizon */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: "55vh",
        background: "radial-gradient(ellipse at 50% 100%, rgba(249, 115, 22, 0.45) 0%, rgba(201, 164, 76, 0.22) 30%, rgba(142, 59, 70, 0.12) 52%, transparent 76%)",
        animation: "campfireFlicker 2.8s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Floating embers rising past the card */}
      {EMBERS.map((e, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: e.left, bottom: e.bottom,
            width: e.size, height: e.size, borderRadius: "50%",
            background: e.color,
            boxShadow: `0 0 8px ${e.color}, 0 0 2px #fff`,
            "--dx": e.dx,
            animation: `emberRise ${e.dur} ease-out ${e.delay} infinite`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* The Initiative Relic Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", zIndex: 10,
          width: "min(92vw, 410px)",
          background: "linear-gradient(165deg, rgba(34, 28, 38, 0.94) 0%, rgba(22, 18, 25, 0.96) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${isCrit ? "#c9a44c" : isFumble ? "#8e3b46" : "rgba(201, 164, 76, 0.45)"}`,
          borderRadius: 20,
          padding: "26px 22px 22px",
          textAlign: "center",
          boxShadow: isCrit
            ? "0 0 45px rgba(201, 164, 76, 0.4), 0 24px 48px rgba(0, 0, 0, 0.85)"
            : isFumble
            ? "0 0 45px rgba(142, 59, 70, 0.5), 0 24px 48px rgba(0, 0, 0, 0.85)"
            : "0 0 35px rgba(201, 164, 76, 0.2), 0 24px 48px rgba(0, 0, 0, 0.85)",
          animation: isCrit ? "critPulse 2s ease-in-out infinite" : "none",
          boxSizing: "border-box",
        }}>

        {/* Top Header Filigree */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ color: T.gold, opacity: 0.6, fontSize: 13 }}>✦</span>
          <span style={{
            color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: 3,
            textTransform: "uppercase", fontFamily: "Georgia, serif",
          }}>
            Encounter Initiated
          </span>
          <span style={{ color: T.gold, opacity: 0.6, fontSize: 13 }}>✦</span>
        </div>

        <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: T.ink, fontWeight: 700, letterSpacing: 0.5 }}>
          Roll for Initiative
        </div>

        {/* Storytelling Note / Subtitle */}
        <div style={{ color: T.dim, fontSize: 13, marginTop: 6, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1.45 }}>
          {!revealDone ? (
            <span style={{ fontStyle: "italic", opacity: 0.9 }}>
              The tavern falls silent. The Dungeon Master clears their throat…
            </span>
          ) : isCrit ? (
            <span style={{ color: "#f7e6b5", fontWeight: 700, textShadow: "0 0 12px rgba(201, 164, 76, 0.6)" }}>
              ★ Natural 20! You move before thought forms. Strike first, adventurer.
            </span>
          ) : isFumble ? (
            <span style={{ color: "#e8808d", fontWeight: 700 }}>
              ☠ Natural 1! Caught completely flat-footed. The enemy moves first!
            </span>
          ) : (
            <span>
              Initiative <b style={{ color: T.gold }}>{value}</b>. Weapons cleared from scabbards. What do you do?
            </span>
          )}
        </div>

        {/* 3D Rolling Die */}
        <div style={{ padding: "16px 0 10px", display: "flex", justifyContent: "center" }}>
          <Die sides={20} final={value} delay={0} size={76} />
        </div>

        {/* Big Number Reveal */}
        <div style={{
          fontFamily: "Georgia, serif", fontSize: 44, fontWeight: 700,
          color: !revealDone ? T.dim : isCrit ? "#fef3c7" : isFumble ? "#e8808d" : T.ink,
          minHeight: 52,
          display: "flex", alignItems: "center", justifyContent: "center",
          textShadow: revealDone && isCrit ? "0 0 24px rgba(201, 164, 76, 0.8), 0 0 8px #fff" : "none",
          transition: "color 300ms, text-shadow 300ms",
        }}>
          {revealDone ? value : "…"}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
          <button
            style={{ ...btn(false), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={onReroll}>
            <Icon name="d20" size={15} /> Roll Again
          </button>
          <button
            style={{
              ...btn(true), flex: 1,
              background: isCrit
                ? "linear-gradient(150deg, #c9a44c, #a38234)"
                : `linear-gradient(150deg, #a44b57, ${T.blood} 46%, #612a33)`,
              borderColor: isCrit ? "#c9a44c" : T.blood,
              color: isCrit ? "#161219" : T.ink,
              fontWeight: 700,
            }}
            disabled={!revealDone}
            onClick={onClose}>
            Stand Ready
          </button>
        </div>
      </div>
    </div>
  );
}
export { roll };
