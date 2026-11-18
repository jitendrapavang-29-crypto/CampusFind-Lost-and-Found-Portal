// Progressive motion: native scrolling stays in control on touch and desktop.
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const canvas = document.querySelector("#auroraParticles");
  const context = canvas?.getContext("2d");
  const heroArt = document.querySelector(".hero-art");
  let particleFrame = 0;
  let resizeFrame = 0;
  let pointerFrame = 0;
  let scrollFrame = 0;
  let lastParticleTime = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let latestPointer = null;
  let hoveredButton = null;
  let hoveredCard = null;
  let buttonBounds = null;
  let cardBounds = null;
  const particles = Array.from({ length: 32 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.4 + 0.5,
    vx: (Math.random() - 0.5) * 0.012,
    vy: (Math.random() - 0.5) * 0.012,
    alpha: Math.random() * 0.25 + 0.1
  }));

  function motionAllowed() {
    return !reducedMotion.matches && !document.hidden;
  }

  function clearCanvas() {
    context?.clearRect(0, 0, viewportWidth, viewportHeight);
  }

  function resizeCanvas() {
    resizeFrame = 0;
    if (!canvas || !context) return;
    viewportWidth = document.documentElement.clientWidth;
    viewportHeight = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, finePointer.matches ? 2 : 1.5);
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    lastParticleTime = 0;
  }

  function drawParticles(now) {
    particleFrame = 0;
    if (!motionAllowed() || !context) return;
    const elapsed = lastParticleTime ? now - lastParticleTime : 16.7;
    // Phones draw fewer particles at 30 fps, with time-based movement.
    if (!finePointer.matches && lastParticleTime && elapsed < 1000 / 30) {
      particleFrame = requestAnimationFrame(drawParticles);
      return;
    }
    lastParticleTime = now;
    const seconds = Math.min(elapsed, 50) / 1000;
    clearCanvas();
    const count = finePointer.matches ? particles.length : 16;
    for (let index = 0; index < count; index += 1) {
      const particle = particles[index];
      particle.x = (particle.x + particle.vx * seconds + 1) % 1;
      particle.y = (particle.y + particle.vy * seconds + 1) % 1;
      context.beginPath();
      context.arc(particle.x * viewportWidth, particle.y * viewportHeight, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(243, 223, 193, ${particle.alpha})`;
      context.fill();
    }
    particleFrame = requestAnimationFrame(drawParticles);
  }

  function resetButton() {
    if (hoveredButton) hoveredButton.style.removeProperty("transform");
    hoveredButton = null;
    buttonBounds = null;
  }

  function resetCard() {
    if (hoveredCard) {
      hoveredCard.style.removeProperty("transform");
      hoveredCard.style.removeProperty("--mx");
      hoveredCard.style.removeProperty("--my");
    }
    hoveredCard = null;
    cardBounds = null;
  }

  function resetPointerMotion() {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    latestPointer = null;
    resetButton();
    resetCard();
  }

  function updatePointerMotion() {
    pointerFrame = 0;
    if (!latestPointer || !motionAllowed() || !finePointer.matches) return;
    const { target, x, y } = latestPointer;
    if (!target.isConnected) {
      resetPointerMotion();
      return;
    }
    const candidateButton = target.closest(".btn-neon, .btn-glass");
    const button = candidateButton && !candidateButton.disabled ? candidateButton : null;
    const card = target.closest(".item-card");
    if (button !== hoveredButton) {
      resetButton();
      hoveredButton = button;
      buttonBounds = button?.getBoundingClientRect();
    }
    if (card !== hoveredCard) {
      resetCard();
      hoveredCard = card;
      cardBounds = card?.getBoundingClientRect();
    }
    // Bounds are captured once on entry so a moving button does not chase itself.
    if (button && buttonBounds) {
      const dx = Math.max(-5, Math.min(5, (x - buttonBounds.left - buttonBounds.width / 2) * 0.08));
      const dy = Math.max(-3, Math.min(3, (y - buttonBounds.top - buttonBounds.height / 2) * 0.08));
      button.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    }
    if (card && cardBounds?.width && cardBounds.height) {
      const px = Math.max(0, Math.min(100, (x - cardBounds.left) / cardBounds.width * 100));
      const py = Math.max(0, Math.min(100, (y - cardBounds.top) / cardBounds.height * 100));
      card.style.setProperty("--mx", `${px.toFixed(1)}%`);
      card.style.setProperty("--my", `${py.toFixed(1)}%`);
      card.style.transform = `perspective(900px) rotateX(${((py - 50) * -0.04).toFixed(2)}deg) rotateY(${((px - 50) * 0.04).toFixed(2)}deg) translateY(-3px)`;
    }
  }

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !finePointer.matches || !motionAllowed() || !(event.target instanceof Element)) return;
    latestPointer = { target: event.target, x: event.clientX, y: event.clientY };
    if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointerMotion);
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    const next = event.relatedTarget;
    if (hoveredButton && (!(next instanceof Node) || !hoveredButton.contains(next))) resetButton();
    if (hoveredCard && (!(next instanceof Node) || !hoveredCard.contains(next))) resetCard();
    // Do not reset when moving between an icon and its containing button/card.
    if (!next) resetPointerMotion();
  }, { passive: true });

  function updateParallax() {
    scrollFrame = 0;
    if (!heroArt) return;
    const offset = motionAllowed() && finePointer.matches ? Math.min(32, Math.max(0, window.scrollY) * 0.045) : 0;
    heroArt.style.setProperty("--hero-parallax", `${offset.toFixed(1)}px`);
  }

  window.addEventListener("scroll", () => {
    resetPointerMotion();
    if (!scrollFrame && motionAllowed() && finePointer.matches) scrollFrame = requestAnimationFrame(updateParallax);
  }, { passive: true });

  const revealTargets = Array.from(document.querySelectorAll(".section, .stats-row"));
  let revealObserver = null;
  function reveal(element) {
    element.classList.add("reveal-in");
    revealObserver?.unobserve(element);
  }
  function revealAll() {
    revealTargets.forEach(reveal);
    revealObserver?.disconnect();
  }
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px 40px 0px" });
    revealTargets.forEach((element) => {
      element.classList.add("reveal-section");
      revealObserver.observe(element);
    });
  } else {
    revealAll();
  }
  document.addEventListener("focusin", (event) => {
    if (!(event.target instanceof Element)) return;
    const section = event.target.closest(".reveal-section");
    if (section) reveal(section);
  });

  function syncMotionPreference() {
    cancelAnimationFrame(particleFrame);
    particleFrame = 0;
    lastParticleTime = 0;
    resetPointerMotion();
    updateParallax();
    if (reducedMotion.matches) {
      clearCanvas();
      revealAll();
    }
    if (context && motionAllowed()) particleFrame = requestAnimationFrame(drawParticles);
  }

  function listenToPreference(query, callback) {
    if (query.addEventListener) query.addEventListener("change", callback);
    else query.addListener(callback);
  }
  listenToPreference(reducedMotion, syncMotionPreference);
  listenToPreference(finePointer, () => {
    resizeCanvas();
    syncMotionPreference();
  });
  window.addEventListener("resize", () => {
    resetPointerMotion();
    if (!resizeFrame) resizeFrame = requestAnimationFrame(resizeCanvas);
  }, { passive: true });
  window.addEventListener("blur", resetPointerMotion);
  document.addEventListener("visibilitychange", syncMotionPreference);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(particleFrame);
    cancelAnimationFrame(resizeFrame);
    cancelAnimationFrame(scrollFrame);
    particleFrame = resizeFrame = scrollFrame = 0;
    resetPointerMotion();
  });
  window.addEventListener("pageshow", syncMotionPreference);
  resizeCanvas();
  syncMotionPreference();
})();
