const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_PATHS = {
  plus: ["M12 5v14", "M5 12h14"],
  back: ["M15 18l-6-6 6-6"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  play: ["M8 5.5v13l10.5-6.5z"],
  pause: ["M9 6v12", "M15 6v12"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  copy: [
    "M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 19v-8.5",
    "M15.5 9V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5H8.5",
  ],
  edit: ["M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z", "M13.5 6.5l4 4"],
  trash: [
    "M4 7h16",
    "M10 11v6",
    "M14 11v6",
    "M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7",
    "M9 7V4.5h6V7",
  ],
  close: ["M6 6l12 12", "M18 6L6 18"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 7.5V12l3 2"],
  palette: [
    "M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.7 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6h1.9a4.4 4.4 0 0 0 4.4-4.4C20.5 6.9 16.7 3.5 12 3.5z",
    "M7.5 11.5h.01",
    "M10 7.5h.01",
    "M14.5 7.5h.01",
  ],
  calendar: ["M5.5 5.5h13a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5z", "M8 3.5v4", "M16 3.5v4", "M4 10h16"],
  chevronLeft: ["M15 18l-6-6 6-6"],
  chevronRight: ["M9 18l6-6-6-6"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  globe: [
    "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z",
    "M3.5 12h17",
    "M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z",
  ],
  layers: ["M12 4l8.5 4.5L12 13 3.5 8.5z", "M3.5 12.5L12 17l8.5-4.5", "M3.5 16.5L12 21l8.5-4.5"],
  sound: ["M4.5 9.5h3l4.5-4v13l-4.5-4h-3z", "M15.5 9a4 4 0 0 1 0 6", "M18 6.5a7.5 7.5 0 0 1 0 11"],
  vibrate: [
    "M9 4.5h6a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 18V6A1.5 1.5 0 0 1 9 4.5z",
    "M4 9v6",
    "M20 9v6",
  ],
  bell: ["M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  download: ["M12 4v11", "M7.5 10.5L12 15l4.5-4.5", "M5 19.5h14"],
  upload: ["M12 15V4", "M7.5 8.5L12 4l4.5 4.5", "M5 19.5h14"],
  chart: ["M5 19.5V13", "M10 19.5V8", "M15 19.5v-9", "M20 19.5V5"],
  list: ["M9 7h11", "M9 12h11", "M9 17h11", "M4.5 7h.01", "M4.5 12h.01", "M4.5 17h.01"],
};

const FILLED_ICONS = new Set(["play"]);
const STROKE_WIDTHS = { more: "3", pause: "2.6", check: "2.4", list: "2.2" };

export function createIcon(name, { size = 18 } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("ui-icon");

  const filled = FILLED_ICONS.has(name);
  svg.setAttribute("fill", filled ? "currentColor" : "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", STROKE_WIDTHS[name] || (filled ? "1.5" : "1.9"));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  (ICON_PATHS[name] || []).forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
}

/** Replace a button's contents with an icon; the label stays available to screen readers. */
export function setIcon(element, name, options) {
  if (!element) return;
  if (!element.getAttribute("aria-label") && element.title) {
    element.setAttribute("aria-label", element.title);
  }
  element.replaceChildren(createIcon(name, options));
  element.classList.add("has-icon");
}
