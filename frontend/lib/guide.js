// Pure data computation for the door-to-table wayfinding guide, ported from
// public/checkin.js's renderGuide(). Kept separate from rendering so the
// component can draw real SVG elements instead of a string of markup.
export const TABLE_W = 170, TABLE_H = 170, RECT_W = 220, RECT_H = 110;
export const MARKER_W = 90, MARKER_H = 70;

export function computeGuide(eventData, tableNumber) {
  if (!eventData || !eventData.tables.length || !tableNumber) return null;

  const doorSet = eventData.event.door_x != null && eventData.event.door_y != null;
  const matchTable = eventData.tables.find((t) => String(t.table_number) === String(tableNumber));
  const matchPositioned = matchTable && matchTable.x != null && matchTable.y != null;

  // Only show the map once the host has placed both the door and this
  // guest's table on the floor plan.
  if (!doorSet || !matchPositioned) return { placeholder: true };

  const items = eventData.tables
    .filter((t) => t.x != null && t.y != null)
    .map((t) => {
      const shape = t.shape === "rectangle" ? "rectangle" : "round";
      const w = shape === "rectangle" ? RECT_W : TABLE_W;
      const h = shape === "rectangle" ? RECT_H : TABLE_H;
      return { t, shape, x: t.x, y: t.y, w, h, cx: t.x + w / 2, cy: t.y + h / 2 };
    });

  const doorPos = { x: eventData.event.door_x, y: eventData.event.door_y };
  const stageSet = eventData.event.stage_x != null && eventData.event.stage_y != null;
  const stagePos = stageSet ? { x: eventData.event.stage_x, y: eventData.event.stage_y } : null;
  const doorCenter = { x: doorPos.x + MARKER_W / 2, y: doorPos.y + MARKER_H / 2 };

  let minX = doorPos.x, minY = doorPos.y, maxX = doorPos.x + MARKER_W, maxY = doorPos.y + MARKER_H;
  const extend = (x, y, w, h) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  if (stagePos) extend(stagePos.x, stagePos.y, MARKER_W, MARKER_H);
  items.forEach((it) => extend(it.x, it.y, it.w, it.h));
  const pad = 50;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const match = items.find((it) => String(it.t.table_number) === String(tableNumber));

  return {
    placeholder: false,
    minX,
    minY,
    vw: maxX - minX,
    vh: maxY - minY,
    doorPos,
    doorCenter,
    stagePos,
    items,
    match,
  };
}
