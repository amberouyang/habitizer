/** First-paint splash overlay (`#bootSplash` in index.html). */

let hideTimerId = null;

export function hideBootSplash() {
  const splash = document.getElementById("bootSplash");
  if (!splash || splash.classList.contains("is-done")) return;

  splash.classList.add("is-done");
  splash.setAttribute("aria-hidden", "true");

  const remove = () => {
    splash.remove();
  };

  splash.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 400);
}

/** Safety net if boot hangs before init finishes. */
export function armBootSplashTimeout(ms = 5000) {
  if (hideTimerId != null) return;
  hideTimerId = window.setTimeout(() => {
    hideBootSplash();
  }, ms);
}
