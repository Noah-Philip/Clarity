const canvas = document.getElementById('riverCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const chipLayer = document.getElementById('chipLayer');
const questionInput = document.getElementById('heroQuestion');
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
  { text: 'Pinned threads drive confidence', tags: ['rag', 'confidence', 'pinned'] },
  { text: 'Cross-team updates are merged hourly', tags: ['cross-team', 'sync', 'hourly'] },
  { text: 'Source chain includes owners + timestamps', tags: ['source', 'owner', 'timestamp'] }
];

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  isMobile: window.matchMedia('(max-width: 768px)').matches,
  particles: [],
  chips: [],
  dots: [],
  matchedChipIds: new Set(),
  absorbedCount: 0,
  expanded: false,
  asking: false,
  riverAbsorption: 0,
  mouse: { x: -1000, y: -1000, active: false },
  lastTs: performance.now()
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
  const ix0 = v00 + (v10 - v00) * sx;
  const ix1 = v01 + (v11 - v01) * sx;
  return ix0 + (ix1 - ix0) * sy;
}

function flowAngle(x, y, t) {
  const scale = 0.0025;
  const n1 = valueNoise(x * scale + t * 0.06, y * scale);
  const n2 = valueNoise(x * scale * 1.6, y * scale * 0.7 + t * 0.04);
  return (n1 * 0.9 + n2 * 0.5) * Math.PI * 1.8 - Math.PI * 0.4;
}

function resetParticle(particle) {
  particle.x = Math.random() * state.width;
  particle.y = Math.random() * state.height;
  particle.vx = 0;
  particle.vy = 0;
  particle.size = Math.random() * 1.6 + 0.6;
  particle.alpha = Math.random() * 0.7 + 0.2;
}

function initParticles() {
  const count = state.isMobile ? 260 : 760;
  state.particles = Array.from({ length: count }, () => {
    const particle = {};
    resetParticle(particle);
    return particle;
  });
}

function createChip(blueprint, index) {
  const el = document.createElement('div');
  el.className = 'message-chip';
  el.innerHTML = `${blueprint.text}<div class="tags">${blueprint.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>`;
  chipLayer.appendChild(el);

  const spreadY = Math.max(120, state.height - 260);
  return {
    id: index,
    el,
    tags: blueprint.tags,
    text: blueprint.text,
    x: 36 + Math.random() * Math.max(0, state.width - 300),
    y: 110 + Math.random() * spreadY,
    drift: Math.random() * 2 - 1,
    phase: Math.random() * Math.PI * 2,
    baseV: 8 + Math.random() * 10,
    absorbed: false,
    absorption: null
  };
}

function initChips() {
  chipLayer.innerHTML = '';
  state.chips = chipBlueprints.map((blueprint, i) => createChip(blueprint, i));
}

function orbCenter() {
  const rect = orb.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function beginAbsorption(chip) {
  const center = orbCenter();
  const startX = chip.x;
  const startY = chip.y;
  const ctrlX = (startX + center.x) / 2 + (Math.random() * 120 - 60);
  const ctrlY = Math.min(startY, center.y) - (Math.random() * 80 + 40);

  chip.absorption = {
    t: 0,
    duration: 1.2 + Math.random() * 0.5,
    startX,
    startY,
    ctrlX,
    ctrlY,
    endX: center.x,
    endY: center.y
  };
}

function absorbChip(chip) {
  chip.absorbed = true;
  chip.el.style.opacity = '0';
  state.absorbedCount += 1;

  state.dots.push({
    angle: Math.random() * Math.PI * 2,
    radius: 28 + Math.random() * 22,
    speed: 0.8 + Math.random() * 1.2,
    size: 2 + Math.random() * 2,
    hue: 220 + Math.random() * 30
  });

}

function renderAnswerCard() {
  answerCard.classList.remove('hidden');
  const query = questionInput.value.trim() || 'your question';
  answerCard.innerHTML = `
    <h2>Synthesis for: “${query}”</h2>
    <ul>
      <li>Operational ownership converges around <strong>#ops</strong> for runbook and launch rehearsals.</li>
      <li>Recent decisions emphasize pinned updates for higher confidence and faster retrieval.</li>
      <li>Guidance and propulsion notes indicate stable limits with explicit signoff accountability.</li>
    </ul>
    <div class="pills">
      <span>#ops-summary</span>
      <span>#guidance-signoff</span>
      <span>#propulsion-rev-c</span>
      <span>pinned-thread-index</span>
    </div>
  `;
}

function bezierPoint(t, p0, p1, p2) {
  const inv = 1 - t;
  return inv * inv * p0 + 2 * inv * t * p1 + t * t * p2;
}

function updateChips(dt, nowSec) {
  const center = orbCenter();
  for (const chip of state.chips) {
    if (chip.absorbed) continue;

    if (chip.absorption) {
      chip.absorption.t += dt / chip.absorption.duration;
      const t = Math.min(1, chip.absorption.t);
      const eased = 1 - Math.pow(1 - t, 3);
      chip.x = bezierPoint(eased, chip.absorption.startX, chip.absorption.ctrlX, chip.absorption.endX);
      chip.y = bezierPoint(eased, chip.absorption.startY, chip.absorption.ctrlY, chip.absorption.endY);
      chip.el.style.opacity = String(1 - eased);
      chip.el.style.transform = `translate3d(${chip.x}px, ${chip.y}px, 0) scale(${1 - eased * 0.75})`;
      if (t >= 1) absorbChip(chip);
      continue;
    }

    chip.x += chip.baseV * dt * 0.75;
    chip.y += chip.drift * dt * 10 + Math.sin(nowSec * 0.7 + chip.phase) * 0.22;

    if (chip.x > state.width + 120) chip.x = -240;
    if (chip.y < 84) chip.y = 84;
    if (chip.y > state.height - 60) chip.y = state.height - 60;

    chip.el.style.transform = `translate3d(${chip.x}px, ${chip.y}px, 0)`;
  }

  state.dots.forEach((dot) => {
    dot.angle += dt * dot.speed;
    const x = center.x + Math.cos(dot.angle) * dot.radius;
    const y = center.y + Math.sin(dot.angle) * dot.radius;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${dot.hue} 100% 80% / 0.85)`;
    ctx.arc(x, y, dot.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function askQuestion() {
  const question = questionInput.value.trim();
  if (!question || state.asking || state.expanded) return;

  state.asking = true;
  state.riverAbsorption = 0.001;
  state.matchedChipIds.clear();

  for (const chip of state.chips) {
    chip.el.classList.remove('matching');
    if (!chip.absorbed && !chip.absorption) beginAbsorption(chip);
  }
}

function maybeRevealAnswer() {
  const allChipsAbsorbed = state.chips.every((chip) => chip.absorbed);
  if (!state.expanded && allChipsAbsorbed && state.riverAbsorption >= 0.98) {
    state.expanded = true;
    orb.classList.add('expanded');
    setTimeout(renderAnswerCard, 320);
  }
}

function updateParticles(dt, nowSec) {
  const swirlRadius = 120;
  const center = orbCenter();

  if (state.asking && state.riverAbsorption < 1) {
    state.riverAbsorption = Math.min(1, state.riverAbsorption + dt * 0.85);
  }

  for (const p of state.particles) {
    if (state.asking) {
      const dx = center.x - p.x;
      const dy = center.y - p.y;
      const pull = 0.045 + state.riverAbsorption * 0.24;
      p.vx = p.vx * 0.85 + dx * pull * dt * 60;
      p.vy = p.vy * 0.85 + dy * pull * dt * 60;
    } else {
      const angle = flowAngle(p.x, p.y, nowSec);
      const baseX = 38 + Math.cos(angle) * 10;
      const baseY = Math.sin(angle) * 8;

      p.vx = p.vx * 0.92 + baseX * dt;
      p.vy = p.vy * 0.92 + baseY * dt;
    }

    if (!state.asking && state.mouse.active) {
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

    ctx.beginPath();
    const fade = 1 - state.riverAbsorption;
    ctx.fillStyle = `rgba(160, 182, 255, ${Math.max(0, p.alpha * fade)})`;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function frame(ts) {
  const nowSec = ts * 0.001;
  const dt = Math.min(0.033, (ts - state.lastTs) * 0.001);
  state.lastTs = ts;

  if (state.isMobile) {
    ctx.clearRect(0, 0, state.width, state.height);
  } else {
    ctx.fillStyle = 'rgba(7, 10, 18, 0.26)';
    ctx.fillRect(0, 0, state.width, state.height);
  }

  updateParticles(dt, nowSec);
  updateChips(dt, nowSec);
  maybeRevealAnswer();
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
  initParticles();
}

questionInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  askQuestion();
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
initChips();
requestAnimationFrame((ts) => {
  state.lastTs = ts;
  frame(ts);
});
