/**
 * The app scrolls inside the phone frame, not the window, so advancing to a new
 * screen leaves the container at its previous offset — you land halfway down the
 * next page. Every navigation should reset it.
 */
export function scrollPhoneToTop(smooth = false) {
  // Run after paint so the new screen has rendered before we scroll it.
  requestAnimationFrame(() => {
    const el = document.getElementById("phone-scroll-area");
    if (el) el.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  });
}
