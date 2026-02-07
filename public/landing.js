const canvas = document.getElementById('riverCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const chipLayer = document.getElementById('chipLayer');
const landing = document.getElementById('landing');
const heroForm = document.getElementById('heroForm');
const questionInput = document.getElementById('heroQuestion');
const askButton = document.getElementById('heroAsk');
const orb = document.getElementById('orb');
const answerCard = document.getElementById('answerCard');

const chipBlueprints = [
  { text: 'Ops owns launch rehearsal runbook updates', tags: ['ops', 'launch', 'runbook', 'owner'] },
  { text: 'Thermal gate due Thursday 4 PM', tags: ['thermal', 'deadline', 'avionics'] },
  { text: 'Fault-tree signoff reassigned to Priya', tags: ['guidance', 'signoff', 'owner'] },
  { text: 'Staging telemetry asked by product', tags: ['telemetry', 'staging', 'product'] },
  { text: 'Injector rev-C manifold solved anomaly', tags: ['propulsion', 'injector', 'resolved'] },
  { text: 'Checklist ownership moved to Ops', tags: ['ownership', 'decision', 'ops'] },
  { text: 'Tank pressure limits unchanged', tags: ['propulsion', 'limits', 'calibration'] },
  { text: 'Monte Carlo reruns need backup', tags: ['guidance', 'monte', 'rerun'] },
  { text: 'Reference Jan 12 #ops summary', tags: ['ops', 'summary', 'source'] },
  { text: 'Pinned threads drive confidence', tags: ['rag', 'confidence', 'pinned'] }
];

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  isMobile: window.matchMedia('(max-width: 768px)').matches,
  phase: 'idle',
  particles: [],
  chips: [],
  mouse: { x: -1000, y: -1000, active: false },
  absorbProgress: 0,
  lastTs: performance.now(),
  question: '',
  ragResult: null
};

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function hash2d(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const v00 = hash2d(xi, yi);
  const v10 = hash2d(xi + 1, yi);
  const v01 = hash2d(xi, yi + 1);
  const v11 = hash2d(xi + 1, yi + 1);
  const sx = smoothstep(tx);
  const sy = smoothstep(ty);
  return (v00 + (v10 - v00) * sx) + ((v01 + (v11 - v01) * sx) - (v00 + (v10 - v00) * sx)) * sy;
}

function flowAngle(x, y, t) {
  const scale = 0.0025;
  const n1 = valueNoise(x * scale + t * 0.06, y * scale);
  const n2 = valueNoise(x * scale * 1.6, y * scale * 0.7 + t * 0.04);
  return (n1 * 0.9 + n2 * 0.5) * Math.PI * 1.8 - Math.PI * 0.4;
}

function orbCenter() {
  const rect = orb.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function resetParticle(p) {
  p.x = Math.random() * state.width;
  p.y = Math.random() * state.height;
  p.vx = 0;
  p.vy = 0;
  p.size = Math.random() * 1.6 + 0.6;
  p.alpha = Math.random() * 0.65 + 0.2;
  p.absorbed = false;
}

function initParticles() {
  const count = state.isMobile ? 240 : 720;
  state.particles = Array.from({ length: count }, () => {
    const p = {};
    resetParticle(p);
    return p;
  });
}

function createChip(blueprint, index) {
  const el = document.createElement('div');
  el.className = 'message-chip';
  el.innerHTML = `${blueprint.text}<div class="tags">${blueprint.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>`;
  chipLayer.appendChild(el);
  return {
    id: index,
    el,
    x: 36 + Math.random() * Math.max(0, state.width - 300),
    y: 110 + Math.random() * Math.max(120, state.height - 260),
    vx: 8 + Math.random() * 10,
    drift: Math.random() * 2 - 1,
    phase: Math.random() * Math.PI * 2,
    scale: 1,
    opacity: 1,
    absorbed: false
  };
}

function initChips() {
  chipLayer.innerHTML = '';
  state.chips = chipBlueprints.map(createChip);
}

function absorbToOrb(entity, center, strength) {
  const dx = center.x - entity.x;
  const dy = center.y - entity.y;
  entity.x += dx * strength;
  entity.y += dy * strength;
}

function updateChips(dt, t) {
  const center = orbCenter();
  const absorbing = state.phase === 'absorbing';

  for (const chip of state.chips) {
    if (chip.absorbed) continue;

    if (!absorbing) {
      chip.x += chip.vx * dt * 0.75;
      chip.y += chip.drift * dt * 10 + Math.sin(t * 0.7 + chip.phase) * 0.24;
      if (chip.x > state.width + 140) chip.x = -260;
      if (chip.y < 84) chip.y = 84;
      if (chip.y > state.height - 60) chip.y = state.height - 60;
    } else {
      absorbToOrb(chip, center, 0.06 + state.absorbProgress * 0.08);
      chip.scale = Math.max(0.08, chip.scale - dt * 0.85);
      chip.opacity = Math.max(0, chip.opacity - dt * 1.2);
      if (chip.opacity <= 0.01) chip.absorbed = true;
    }

    chip.el.style.opacity = String(chip.opacity);
    chip.el.style.transform = `translate3d(${chip.x}px, ${chip.y}px, 0) scale(${chip.scale})`;
  }
}

function updateParticles(dt, t) {
  const center = orbCenter();
  const swirlRadius = 120;

  for (const p of state.particles) {
    if (p.absorbed) continue;

    if (state.phase !== 'absorbing') {
      const angle = flowAngle(p.x, p.y, t);
      const baseX = 38 + Math.cos(angle) * 10;
      const baseY = Math.sin(angle) * 8;
      p.vx = p.vx * 0.92 + baseX * dt;
      p.vy = p.vy * 0.92 + baseY * dt;

      if (state.mouse.active) {
        const dx = p.x - state.mouse.x;
        const dy = p.y - state.mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < swirlRadius * swirlRadius && d2 > 8) {
          const dist = Math.sqrt(d2);
          const tangentX = -dy / dist;
          const tangentY = dx / dist;
          const force = ((swirlRadius - dist) / swirlRadius) * 42;
          p.vx += tangentX * force * dt;
          p.vy += tangentY * force * dt;
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      if (p.x > state.width + 20 || p.y < -20 || p.y > state.height + 20) {
        p.x = -10;
        p.y = Math.random() * state.height;
        p.vx = Math.random() * 0.8;
        p.vy = 0;
      }
    } else {
      absorbToOrb(p, center, 0.04 + state.absorbProgress * 0.07);
      p.alpha = Math.max(0, p.alpha - dt * 0.9);
      p.size = Math.max(0.2, p.size - dt * 0.45);
      if (p.alpha <= 0.02) p.absorbed = true;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(160, 182, 255, ${p.alpha})`;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderAnswer() {
  const result = state.ragResult;
  const bullets = result?.sources?.slice(0, 3).map((source) => source.text) || [
    'Recent operational threads point to Ops ownership for launch rehearsal updates.',
    'Pinned decisions carry the strongest confidence in synthesis.',
    'Cross-team telemetry and signoff notes remain linked to latest sources.'
  ];
  const pills = result?.sources?.slice(0, 4).map((source) => `#${source.channel}`) || ['#ops', '#guidance', '#propulsion'];
  const answerText = result?.answer || 'Signals converged. This is the clearest synthesis from recent context.';

  answerCard.classList.remove('hidden');
  answerCard.innerHTML = `
    <h2>Synthesis for: “${state.question}”</h2>
    <ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
    <p>${answerText}</p>
    <div class="pills">${pills.map((p) => `<span>${p}</span>`).join('')}</div>
  `;
}

async function fetchSynthesis(question) {
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, maxAgeHours: 96 })
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function startSynthesis() {
  const question = questionInput.value.trim();
  if (!question || state.phase !== 'idle') return;

  state.phase = 'absorbing';
  state.question = question;
  state.absorbProgress = 0;
  questionInput.disabled = true;
  askButton.disabled = true;
  landing.classList.add('clarity-mode');

  const resultPromise = fetchSynthesis(question);

  setTimeout(async () => {
    state.phase = 'revealed';
    orb.classList.add('expanded');
    state.ragResult = await resultPromise;
    renderAnswer();
  }, 2200);
}

function frame(ts) {
  const nowSec = ts * 0.001;
  const dt = Math.min(0.033, (ts - state.lastTs) * 0.001);
  state.lastTs = ts;

  if (state.phase === 'absorbing') state.absorbProgress = Math.min(1, state.absorbProgress + dt / 2.2);

  if (state.isMobile) {
    ctx.clearRect(0, 0, state.width, state.height);
  } else {
    const fade = state.phase === 'absorbing' ? 0.45 : 0.26;
    ctx.fillStyle = `rgba(7, 10, 18, ${fade})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  updateParticles(dt, nowSec);
  updateChips(dt, nowSec);
  requestAnimationFrame(frame);
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.isMobile = window.matchMedia('(max-width: 768px)').matches;
  canvas.width = Math.floor(state.width * devicePixelRatio);
  canvas.height = Math.floor(state.height * devicePixelRatio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  if (state.phase === 'idle') {
    initParticles();
    initChips();
  }
}

heroForm.addEventListener('submit', (event) => {
  event.preventDefault();
  startSynthesis();
});

window.addEventListener('pointermove', (event) => {
  state.mouse.x = event.clientX;
  state.mouse.y = event.clientY;
  state.mouse.active = true;
});

window.addEventListener('pointerleave', () => {
  state.mouse.active = false;
});

window.addEventListener('resize', resize);

resize();
requestAnimationFrame((ts) => {
  state.lastTs = ts;
  frame(ts);
});
