const state = {
  channels: [],
  messages: [],
  currentChannel: 'general',
  highlighted: new Set()
};

const nodes = {
  channels: document.getElementById('channels'),
  messages: document.getElementById('messages'),
  title: document.getElementById('channelTitle'),
  composer: document.getElementById('composer'),
  messageInput: document.getElementById('messageInput'),
  user: document.getElementById('user'),
  pinToggle: document.getElementById('pinToggle'),
  askForm: document.getElementById('askForm'),
  question: document.getElementById('question'),
  answer: document.getElementById('answer'),
  sources: document.getElementById('sources'),
  thinking: document.getElementById('thinking'),
  timewarp: document.getElementById('timewarp'),
  timewarpLabel: document.getElementById('timewarpLabel'),
  spark: document.getElementById('spark'),
  commandPalette: document.getElementById('commandPalette'),
  paletteInput: document.getElementById('paletteInput'),
  openCommand: document.getElementById('openCommand')
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderChannels() {
  nodes.channels.innerHTML = '';
  state.channels.forEach((channel) => {
    const button = document.createElement('button');
    button.textContent = channel.name;
    if (state.currentChannel === channel.id) button.classList.add('active');
    button.onclick = () => {
      state.currentChannel = channel.id;
      nodes.title.textContent = channel.name;
      nodes.messageInput.placeholder = `Message ${channel.name}`;
      renderChannels();
      renderMessages();
    };
    nodes.channels.appendChild(button);
  });
}

function renderMessages() {
  const filtered = state.messages.filter((message) => message.channel === state.currentChannel);
  nodes.messages.innerHTML = '';
  filtered.forEach((message) => {
    const row = document.createElement('article');
    row.className = 'msg';
    if (message.pinned) row.classList.add('pinned');
    if (state.highlighted.has(message.id)) row.classList.add('pulse');
    row.innerHTML = `
      <div class="meta">${message.user} • ${new Date(message.timestamp).toLocaleString()} ${message.pinned ? '📌' : ''}</div>
      <div>${message.text}</div>
    `;
    nodes.messages.appendChild(row);
  });
  nodes.messages.scrollTop = nodes.messages.scrollHeight;
}

function drawSparkline(points) {
  const ctx = nodes.spark.getContext('2d');
  ctx.clearRect(0, 0, nodes.spark.width, nodes.spark.height);
  if (!points?.length) return;

  ctx.strokeStyle = '#8f7dff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * (nodes.spark.width - 20) + 10;
    const y = nodes.spark.height - p.y * (nodes.spark.height - 12) - 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function confidenceMeter(confidence) {
  if (confidence === 'high') return '🟢 Strong confidence pattern';
  if (confidence === 'medium') return '🟡 Moderate confidence pattern';
  return '🔴 Low confidence pattern';
}

async function askOrg(question) {
  nodes.thinking.classList.remove('hidden');
  const maxAgeHours = Number(nodes.timewarp.value);
  try {
    const result = await api('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, maxAgeHours })
    });
    nodes.answer.textContent = `${result.answer}\n\n${confidenceMeter(result.confidence)}`;
    nodes.sources.innerHTML = '';
    result.sources.forEach((source) => {
      const card = document.createElement('div');
      card.className = 'source';
      card.innerHTML = `
        <strong>#${source.channel}</strong> • ${source.user}
        <div>${source.text}</div>
        <div class="score">Relevance ${source.score} • ${new Date(source.timestamp).toLocaleString()}</div>
      `;
      nodes.sources.appendChild(card);
    });
    drawSparkline(result.trend);
  } catch (error) {
    nodes.answer.textContent = `Could not fetch answer: ${error.message}`;
  } finally {
    nodes.thinking.classList.add('hidden');
  }
}

nodes.composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = nodes.messageInput.value.trim();
  if (!text) return;
  await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      channel: state.currentChannel,
      user: nodes.user.value.trim() || 'You',
      text,
      pinned: nodes.pinToggle.checked
    })
  });
  nodes.messageInput.value = '';
  nodes.pinToggle.checked = false;
});

nodes.askForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = nodes.question.value.trim();
  if (!question) return;
  askOrg(question);
});

nodes.timewarp.addEventListener('input', () => {
  nodes.timewarpLabel.textContent = `Using last ${nodes.timewarp.value} hours + pinned`;
});

nodes.openCommand.onclick = () => {
  nodes.commandPalette.classList.remove('hidden');
  nodes.paletteInput.focus();
};

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    nodes.commandPalette.classList.toggle('hidden');
    if (!nodes.commandPalette.classList.contains('hidden')) nodes.paletteInput.focus();
  }
  if (event.key === 'Escape') nodes.commandPalette.classList.add('hidden');
});

nodes.paletteInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    const raw = nodes.paletteInput.value.replace('/ask-org', '').trim();
    if (raw) {
      nodes.question.value = raw;
      nodes.commandPalette.classList.add('hidden');
      await askOrg(raw);
    }
  }
});

async function init() {
  const initial = await api('/api/state');
  state.channels = initial.channels;
  state.messages = initial.messages;
  renderChannels();
  renderMessages();

  const stream = new EventSource('/api/stream');
  stream.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    state.messages.push(payload);
    renderMessages();
  });
  stream.addEventListener('pulse', (event) => {
    const payload = JSON.parse(event.data);
    state.highlighted = new Set(payload.sourceIds);
    renderMessages();
    setTimeout(() => {
      state.highlighted.clear();
      renderMessages();
    }, 2600);
  });
}

init();
