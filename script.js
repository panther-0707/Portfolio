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

// Theme toggle (remembers choice)
const root = document.documentElement;
try {
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
} catch (e) {}
document.getElementById("theme").addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

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
