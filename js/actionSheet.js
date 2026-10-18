import { t } from "./i18n.js";
import { createIcon } from "./icons.js";

const CLOSE_DELAY_MS = 260;

let activeSheet = null;

export function closeActionSheet() {
  if (!activeSheet) return;
  const { overlay, onKeydown, returnFocus } = activeSheet;
  activeSheet = null;
  document.removeEventListener("keydown", onKeydown);
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  window.setTimeout(() => overlay.remove(), CLOSE_DELAY_MS);
  returnFocus?.focus?.({ preventScroll: true });
}

/**
 * Bottom sheet menu. Each action: { label, icon?, danger?, onSelect }.
 * The sheet closes before onSelect runs so follow-up modals can open cleanly.
 */
export function openActionSheet({ title, actions }) {
  closeActionSheet();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay action-sheet-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");

  const sheet = document.createElement("div");
  sheet.className = "action-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");

  const group = document.createElement("div");
  group.className = "action-sheet-group";

  if (title) {
    const heading = document.createElement("p");
    heading.className = "action-sheet-title";
    heading.id = "actionSheetTitle";
    heading.textContent = title;
    sheet.setAttribute("aria-labelledby", heading.id);
    group.appendChild(heading);
  }

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-sheet-btn";
    if (action.danger) button.classList.add("is-danger");
    if (action.icon) button.appendChild(createIcon(action.icon, { size: 18 }));
    const label = document.createElement("span");
    label.textContent = action.label;
    button.appendChild(label);
    button.addEventListener("click", () => {
      closeActionSheet();
      action.onSelect?.();
    });
    group.appendChild(button);
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "action-sheet-btn action-sheet-cancel";
  cancel.textContent = t("app.cancel");
  cancel.addEventListener("click", closeActionSheet);

  sheet.append(group, cancel);
  overlay.appendChild(sheet);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeActionSheet();
  });

  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeActionSheet();
    }
  };

  activeSheet = { overlay, onKeydown, returnFocus: document.activeElement };
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    group.querySelector(".action-sheet-btn")?.focus({ preventScroll: true });
  });
}
