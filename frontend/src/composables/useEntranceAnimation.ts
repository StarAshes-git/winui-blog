const CARD_SELECTOR = ".anim-card:not(.anim-slide-left):not(.anim-slide-right)";

let animatedCount = 0;

export function useEntranceAnimation() {
  let sidebarAnimated = false;

  function animateSidebar(): void {
    if (sidebarAnimated) return;
    sidebarAnimated = true;
    const panel = document.querySelector<HTMLElement>(".win-nav-left-panel");
    if (panel) panel.classList.add("anim-nav-in");
  }

  function resetCounter(): void {
    animatedCount = 0;
  }

  function animateCards(container: ParentNode = document): void {
    const cards = Array.from(container.querySelectorAll<HTMLElement>(CARD_SELECTOR));
    cards.forEach((card) => {
      const i = animatedCount++;
      const dir = i % 2 === 0 ? "anim-slide-left" : "anim-slide-right";
      card.classList.add(dir);
      card.style.animationDelay = `${0.06 + i * 0.09}s`;
    });
  }

  function run(container?: ParentNode): void {
    animateSidebar();
    animateCards(container);
  }

  return { run, animateSidebar, animateCards, resetCounter };
}
