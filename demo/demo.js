const frame = document.getElementById("frame");
const tabs = Array.from(document.querySelectorAll(".tab"));

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const src = tab.dataset.src;
    if (!src || frame.getAttribute("src") === src) {
      tabs.forEach((item) => item.classList.toggle("on", item === tab));
      return;
    }
    tabs.forEach((item) => item.classList.toggle("on", item === tab));
    frame.style.opacity = "0";
    window.setTimeout(() => {
      frame.src = src;
    }, 110);
  });
});

frame.addEventListener("load", () => {
  frame.style.opacity = "1";
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const targets = document.querySelectorAll(".card, .badge-box, .spec > div");

if (!reduceMotion && "IntersectionObserver" in window) {
  targets.forEach((element) => {
    element.style.opacity = "0";
    element.style.transform = "translateY(10px)";
    element.style.transition = "opacity .5s ease, transform .5s ease";
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -60px 0px" },
  );

  targets.forEach((element) => observer.observe(element));
}
