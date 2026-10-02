/** Inline SVG empty-state illustrations (decorative). */

const ART = {
  routines: `
    <svg viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect class="empty-art-glow" x="28" y="18" width="104" height="76" rx="22"/>
      <rect class="empty-art-surface" x="42" y="28" width="76" height="64" rx="14"/>
      <path class="empty-art-line" d="M58 48h44M58 62h32M58 76h38"/>
      <circle class="empty-art-badge" cx="108" cy="34" r="16"/>
      <path class="empty-art-badge-mark" d="M108 26v16M100 34h16"/>
    </svg>
  `,
  history: `
    <svg viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect class="empty-art-glow" x="24" y="16" width="112" height="80" rx="24"/>
      <circle class="empty-art-surface" cx="80" cy="56" r="34"/>
      <circle class="empty-art-ring" cx="80" cy="56" r="24"/>
      <path class="empty-art-accent" d="M80 42v16l12 8"/>
      <path class="empty-art-line" d="M52 88c8 6 18 10 28 10s20-4 28-10"/>
    </svg>
  `,
  weekly: `
    <svg viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect class="empty-art-glow" x="22" y="20" width="116" height="72" rx="20"/>
      <rect class="empty-art-bar" x="40" y="58" width="14" height="22" rx="5"/>
      <rect class="empty-art-bar" x="62" y="46" width="14" height="34" rx="5"/>
      <rect class="empty-art-bar empty-art-bar-strong" x="84" y="36" width="14" height="44" rx="5"/>
      <rect class="empty-art-bar" x="106" y="52" width="14" height="28" rx="5"/>
      <path class="empty-art-accent" d="M38 78h84"/>
    </svg>
  `,
  hidden: `
    <svg viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect class="empty-art-glow" x="26" y="18" width="108" height="76" rx="22"/>
      <path class="empty-art-surface" d="M40 56c12-18 28-28 40-28s28 10 40 28c-12 18-28 28-40 28s-28-10-40-28z"/>
      <circle class="empty-art-ring" cx="80" cy="56" r="12"/>
      <path class="empty-art-accent" d="M52 34l56 44"/>
    </svg>
  `,
  activities: `
    <svg viewBox="0 0 160 112" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect class="empty-art-glow" x="30" y="16" width="100" height="80" rx="22"/>
      <rect class="empty-art-surface" x="46" y="26" width="68" height="60" rx="14"/>
      <rect class="empty-art-check" x="56" y="40" width="14" height="14" rx="4"/>
      <rect class="empty-art-check" x="56" y="60" width="14" height="14" rx="4"/>
      <path class="empty-art-line" d="M78 47h26M78 67h20"/>
      <path class="empty-art-accent" d="M59 47l3.5 3.5L69 44"/>
    </svg>
  `,
};

/**
 * @param {"routines"|"history"|"weekly"|"hidden"|"activities"} kind
 * @returns {HTMLElement}
 */
export function createEmptyArt(kind = "routines") {
  const wrap = document.createElement("div");
  wrap.className = `empty-art empty-art--${kind}`;
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = ART[kind] || ART.routines;
  return wrap;
}
