// Typing effect
const lines = [
  "Head of DevOps @ EUFS",
  "Computer Science @ Edinburgh",
  "Security-minded dev tooling",
];
const el = document.getElementById("typed");
let line = 0, char = 0, deleting = false;

function tick() {
  const text = lines[line];
  el.textContent = deleting ? text.slice(0, --char) : text.slice(0, ++char);
  let delay = deleting ? 35 : 70;
  if (!deleting && char === text.length) { delay = 1400; deleting = true; }
  else if (deleting && char === 0) { deleting = false; line = (line + 1) % lines.length; delay = 300; }
  setTimeout(tick, delay);
}
tick();

// Fade-in on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll("section, .card, .timeline article").forEach((n) => {
  n.classList.add("reveal");
  io.observe(n);
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();