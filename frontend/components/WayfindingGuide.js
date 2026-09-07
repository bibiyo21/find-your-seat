import { useEffect, useRef, useState } from "react";
import { computeGuide } from "../lib/guide";

const GUIDE_ZOOM_MIN = 1, GUIDE_ZOOM_MAX = 4, GUIDE_ZOOM_STEP = 0.5;

export default function WayfindingGuide({ eventData, tableNumber, guestFirstName }) {
  const guide = computeGuide(eventData, tableNumber);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef(null);
  const pinchState = useRef({ dist: null, zoom: 1 });
  const lastTap = useRef(0);

  useEffect(() => {
    document.body.classList.toggle("guide-lock-scroll", expanded);
  }, [expanded]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        pinchState.current = { dist: touchDist(e.touches), zoom };
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && pinchState.current.dist) {
        e.preventDefault();
        const ratio = touchDist(e.touches) / pinchState.current.dist;
        setZoom(clampZoom(pinchState.current.zoom * ratio));
      }
    }
    function onTouchEnd(e) {
      if (e.touches.length < 2) pinchState.current.dist = null;
      if (e.changedTouches.length === 1 && !pinchState.current.dist) {
        const now = Date.now();
        if (now - lastTap.current < 300) setZoom((z) => (z > GUIDE_ZOOM_MIN ? 1 : 2.5));
        lastTap.current = now;
      }
    }
    function onDblClick() {
      setZoom((z) => (z > GUIDE_ZOOM_MIN ? 1 : 2.5));
    }

    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd);
    viewport.addEventListener("dblclick", onDblClick);
    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("dblclick", onDblClick);
    };
  }, [zoom]);

  function clampZoom(z) {
    return Math.min(GUIDE_ZOOM_MAX, Math.max(GUIDE_ZOOM_MIN, z));
  }

  if (!guide) return null;

  if (guide.placeholder) {
    return (
      <div className="floorplan-guide">
        <div className="guide-label">
          {guestFirstName || "Your"} table location will be posted here once the floor plan is finalized. Just ask a
          member of the wedding party for directions!
        </div>
      </div>
    );
  }

  const { minX, minY, vw, vh, doorPos, doorCenter, stagePos, items, match } = guide;

  return (
    <>
      <div className={`floorplan-guide ${expanded ? "expanded" : ""}`}>
        <div className="guide-header">
          <div className="guide-label">
            {guestFirstName ? `${guestFirstName}, follow` : "Follow"} the gold path from the entrance to your table
          </div>
          <button
            type="button"
            className="guide-expand-btn"
            title={expanded ? "Minimize" : "Expand for a bigger view"}
            onClick={() => {
              setExpanded((e) => !e);
              setZoom(1);
            }}
          >
            {expanded ? "⤡ Minimize" : "⤢ Expand"}
          </button>
        </div>
        <div className="guide-zoom-viewport" ref={viewportRef}>
          <div className="guide-zoom-content" style={{ transform: `scale(${zoom})` }}>
            <svg viewBox={`${minX} ${minY} ${vw} ${vh}`} className="guide-svg" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="guideArrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#c9a227" />
                </marker>
              </defs>
              <rect x={minX} y={minY} width={vw} height={vh} fill="#fffdf7" />
              <line
                x1={doorCenter.x}
                y1={doorCenter.y}
                x2={match.cx}
                y2={match.cy}
                className="guide-path"
                stroke="#c9a227"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="2 14"
                markerEnd="url(#guideArrow)"
              />
              {stagePos && (
                <>
                  <rect x={stagePos.x} y={stagePos.y} width="90" height="70" rx="10" fill="#6b0f1a" />
                  <text
                    x={stagePos.x + 45}
                    y={stagePos.y + 35 - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="18"
                  >
                    🎤
                  </text>
                  <text
                    x={stagePos.x + 45}
                    y={stagePos.y + 35 + 16}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="700"
                  >
                    Stage
                  </text>
                </>
              )}
              {items.map((it) => {
                const isMatch = it === match;
                const fill = isMatch ? "#c9a227" : "#ffffff";
                const stroke = isMatch ? "#6b0f1a" : "#d8c8a0";
                return (
                  <g key={it.t.id}>
                    {it.shape === "round" ? (
                      <circle
                        cx={it.cx}
                        cy={it.cy}
                        r={it.w / 2}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isMatch ? 4 : 2}
                        className={isMatch ? "guide-match-shape" : undefined}
                      />
                    ) : (
                      <rect
                        x={it.x}
                        y={it.y}
                        width={it.w}
                        height={it.h}
                        rx="12"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isMatch ? 4 : 2}
                        className={isMatch ? "guide-match-shape" : undefined}
                      />
                    )}
                    <text
                      x={it.cx}
                      y={it.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isMatch ? "#3d070d" : "#8a7a52"}
                      fontSize={isMatch ? 24 : 13}
                      fontWeight="700"
                    >
                      {it.t.table_number}
                    </text>
                  </g>
                );
              })}
              <rect x={doorPos.x} y={doorPos.y} width="90" height="70" rx="10" fill="#2a4f2a" />
              <text x={doorCenter.x} y={doorCenter.y - 4} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="18">
                🚪
              </text>
              <text x={doorCenter.x} y={doorCenter.y + 16} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="12" fontWeight="700">
                Entrance
              </text>
              <circle cx={doorCenter.x} cy={doorCenter.y} r="6" fill="#c9a227" className="guide-pulse" />
            </svg>
          </div>
        </div>
        <div className="guide-zoom-controls">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= GUIDE_ZOOM_MIN}
            onClick={() => setZoom((z) => clampZoom(z - GUIDE_ZOOM_STEP))}
          >
            −
          </button>
          <span className="guide-zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= GUIDE_ZOOM_MAX}
            onClick={() => setZoom((z) => clampZoom(z + GUIDE_ZOOM_STEP))}
          >
            +
          </button>
          <span className="guide-zoom-hint">pinch or double-tap the map to zoom</span>
        </div>
        <div className="guide-legend">
          <span>
            <i className="guide-swatch guide-swatch-match"></i> Your table
          </span>
          <span>
            <i className="guide-swatch guide-swatch-door"></i> Entrance
          </span>
          {stagePos && (
            <span>
              <i className="guide-swatch guide-swatch-stage"></i> Stage
            </span>
          )}
        </div>
      </div>
      {expanded && <div className="guide-backdrop" onClick={() => setExpanded(false)} />}
    </>
  );
}
