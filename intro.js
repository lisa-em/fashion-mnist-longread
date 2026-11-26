"use strict";

// The opening's footprint follows the supplied Figma frame. Every visible
// garment is independently drawn from the real 70,000-image Fashion-MNIST atlas.
window.initIntro = async function initIntro(focus) {
  const section = document.getElementById("intro");
  const stage = document.getElementById("intro-stage");
  const canvas = document.getElementById("intro-cloud");
  const ctx = canvas.getContext("2d", { alpha: true });
  const grid = stage.querySelector(".intro-grid");
  const darkLabel = document.getElementById("intro-dark-label");
  const cue = document.getElementById("intro-scroll-cue");
  const progressBar = document.getElementById("intro-progress-bar");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const smooth = (a, b, n) => {
    const t = clamp((n - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const atlas = new Image();
  atlas.src = "./data/fashion-atlas.png";
  const [shapeResponse] = await Promise.all([fetch("./data/intro-shape.json"), atlas.decode()]);
  if (!shapeResponse.ok) throw new Error("Could not load the opening composition");
  const points = await shapeResponse.json();

  const focalImage = document.createElement("canvas");
  focalImage.width = focalImage.height = 28;
  const focalContext = focalImage.getContext("2d");
  const imageData = focalContext.createImageData(28, 28);
  focus.pixels.forEach((value, index) => {
    imageData.data[index * 4] = value;
    imageData.data[index * 4 + 1] = value;
    imageData.data[index * 4 + 2] = value;
    imageData.data[index * 4 + 3] = 255;
  });
  focalContext.putImageData(imageData, 0, 0);

  let width = 0;
  let height = 0;
  let ratio = 1;
  let progress = 0;
  let dirty = true;
  let previousDraw = 0;

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    updateScroll();
    dirty = true;
  }

  function updateScroll() {
    const rect = section.getBoundingClientRect();
    const stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
    const travel = Math.max(1, rect.height - height);
    progress = clamp((stickyTop - rect.top) / travel, 0, 1);
    const darkness = smooth(.70, .89, progress);
    const gray = Math.round(255 * (1 - darkness));
    stage.style.backgroundColor = `rgb(${gray},${gray},${gray})`;
    stage.classList.toggle("is-dark", darkness > .5);
    grid.style.opacity = String(smooth(.76, .95, progress));
    darkLabel.style.opacity = String(smooth(.83, .97, progress));
    cue.style.opacity = String(1 - smooth(.04, .17, progress));
    progressBar.style.width = `${Math.round(progress * 100)}%`;
    dirty = true;
  }

  function draw(now) {
    const visible = section.getBoundingClientRect().bottom > 0 && section.getBoundingClientRect().top < innerHeight;
    if (visible && (dirty || (!reducedMotion && now - previousDraw > 35))) {
      dirty = false;
      previousDraw = now;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      const cx = width / 2;
      const cy = height * .49;
      const fit = Math.min(width / 1200, height / 740) * (width < 700 ? 1.15 : .88);
      const plunge = smooth(.08, .76, progress);
      const zoom = 1 + plunge * 5.4;
      const yaw = reducedMotion ? 0 : Math.sin(now * .00012) * .13;
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const cloudAlpha = 1 - smooth(.67, .88, progress);
      const skip = width < 600 ? 2 : 1;

      if (cloudAlpha > .002) {
        for (let i = 0; i < points.length; i += skip) {
          const [u, v, z, index] = points[i];
          const dx = (u - .5) * 1200 * fit;
          const dy = (v - .5) * 740 * fit;
          const px = cx + (dx * cosine + z * 48 * fit * sine) * zoom;
          const py = cy + (dy + (reducedMotion ? 0 : Math.sin(now * .00037 + i * .71) * 1.2 * fit)) * zoom;
          const size = (width < 600 ? 19 : 15.8) * fit * zoom * (1 + z * .15);
          if (px < -size || px > width + size || py < -size || py > height + size) continue;
          ctx.globalAlpha = cloudAlpha * (.76 + z * .13);
          ctx.drawImage(atlas, index % 250 * 12, Math.floor(index / 250) * 12, 12, 12, px - size / 2, py - size / 2, size, size);
        }
      }

      // The small black square is the held-out item followed through the story.
      const focusOpacity = smooth(.30, .47, progress);
      if (focusOpacity > 0) {
        const focusScale = smooth(.34, .89, progress);
        const finalSize = Math.min(width * (width < 600 ? .44 : .25), height * .36);
        const size = 12 + (finalSize - 12) * focusScale;
        const x = cx - size / 2;
        const y = cy - size / 2;
        ctx.globalAlpha = focusOpacity;
        ctx.fillStyle = "#000";
        ctx.fillRect(x, y, size, size);
        ctx.drawImage(focalImage, x, y, size, size);
        ctx.strokeStyle = progress > .75 ? "#fff" : "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
        ctx.globalAlpha = 1;
      }
    }
    requestAnimationFrame(draw);
  }

  addEventListener("resize", resize);
  addEventListener("scroll", updateScroll, { passive: true });
  resize();
  requestAnimationFrame(draw);
};
