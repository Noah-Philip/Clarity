const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

const channels = [
  { id: 'general', name: '#general' },
  { id: 'propulsion', name: '#propulsion' },
  { id: 'guidance', name: '#guidance' },
  { id: 'ops', name: '#ops' },
  { id: 'ask-org', name: '#ask-org-ai' }
];

let nextId = 9;
const messages = [
  { id: 1, channel: 'general', user: 'Maya', text: 'Decision: hotfire checklist ownership moves to Ops for launch week.', timestamp: Date.now() - 1000 * 60 * 60 * 3, pinned: true },
  { id: 2, channel: 'propulsion', user: 'Ari', text: 'We resolved injector anomaly by switching to rev-C manifold. Document update pending.', timestamp: Date.now() - 1000 * 60 * 60 * 22, pinned: true },
  { id: 3, channel: 'guidance', user: 'Noah', text: 'Who owns Monte Carlo reruns? I can cover this sprint but need backup.', timestamp: Date.now() - 1000 * 60 * 60 * 32, pinned: false },
  { id: 4, channel: 'general', user: 'Lena', text: 'Final call: avionics thermal tests are due Thursday 4 PM, owner is Lena.', timestamp: Date.now() - 1000 * 60 * 60 * 26, pinned: true },
  { id: 5, channel: 'ops', user: 'Sam', text: 'Cross-team note: product asked same staging telemetry question last week.', timestamp: Date.now() - 1000 * 60 * 60 * 2, pinned: false },
  { id: 6, channel: 'propulsion', user: 'Maya', text: 'Clarification: tank pressure limits unchanged, only sensor calibration offsets changed.', timestamp: Date.now() - 1000 * 60 * 60 * 8, pinned: false },
  { id: 7, channel: 'guidance', user: 'Noah', text: 'Decision made: Priya owns guidance fault-tree signoff.', timestamp: Date.now() - 1000 * 60 * 30, pinned: true },
  { id: 8, channel: 'ops', user: 'Priya', text: 'If asked about launch rehearsal runbook, reference the Jan 12 thread summary in #ops.', timestamp: Date.now() - 1000 * 60 * 120, pinned: false }
];

const clients = new Set();

function writeJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function vectorize(tokens) {
  const vec = Object.create(null);
  for (const token of tokens) vec[token] = (vec[token] || 0) + 1;
  return vec;
}

function cosineSim(a, b) {
  const tokens = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const token of tokens) {
    const av = a[token] || 0;
    const bv = b[token] || 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function scoreMessage(questionVec, message, now, maxAgeHours) {
  const ageHours = (now - message.timestamp) / (1000 * 60 * 60);
  if (ageHours > maxAgeHours && !message.pinned) return 0;
  const messageVec = vectorize(tokenize(`${message.channel} ${message.user} ${message.text}`));
  const semantic = cosineSim(questionVec, messageVec);
  const recencyBoost = Math.max(0.1, 1 - ageHours / maxAgeHours);
  const pinBoost = message.pinned ? 1.2 : 1;
  return semantic * recencyBoost * pinBoost;
}

function synthesizeAnswer(question, top) {
  if (!top.length) {
    return {
      answer: 'I could not find enough recent or pinned signal in chat. Try widening the Timewarp slider or marking key messages as relevant.',
      confidence: 'low',
      trend: []
    };
  }

  const lowered = question.toLowerCase();
  const ownerHint = top.find((m) => /owner|owns|ownership|decisio/.test(m.text.toLowerCase()));
  const decided = top.find((m) => /decision|final call|resolved|made/.test(m.text.toLowerCase()));

  let answer = `Based on ${top.length} high-signal chat messages, `;
  if (/who owns|owner/.test(lowered) && ownerHint) {
    answer += `the latest ownership update is: "${ownerHint.text}"`;
  } else if (/what did we decide|decision|resolved/.test(lowered) && decided) {
    answer += `the most relevant decision appears to be: "${decided.text}"`;
  } else {
    answer += `here is the current synthesis: ${top.map((m) => m.text).slice(0, 2).join(' ')}.`;
  }

  const confidence = top[0].score > 0.4 ? 'high' : top[0].score > 0.2 ? 'medium' : 'low';
  const trend = top
    .slice(0, 5)
    .map((m) => ({ x: new Date(m.timestamp).toISOString().slice(11, 16), y: Math.min(1, Number((m.score * 2).toFixed(2))) }));

  return { answer, confidence, trend };
}

function runRag(question, maxAgeHours = 72) {
  const questionVec = vectorize(tokenize(question));
  const now = Date.now();
  const scored = messages
    .map((m) => ({ ...m, score: scoreMessage(questionVec, m, now, maxAgeHours) }))
    .filter((m) => m.score > 0.01)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 6);
  const synthesis = synthesizeAnswer(question, top);

  return {
    ...synthesis,
    sources: top.map((m) => ({
      id: m.id,
      channel: m.channel,
      user: m.user,
      text: m.text,
      score: Number(m.score.toFixed(3)),
      timestamp: m.timestamp,
      pinned: m.pinned
    }))
  };
}

function broadcast(event, payload) {
  const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(body);
}

function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, 'public', filePath);
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return writeJson(res, 200, {});

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return writeJson(res, 200, { channels, messages: messages.slice(-200) });
  }

  if (url.pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: ready\ndata: {}\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        if (!parsed.text || !parsed.channel || !parsed.user) {
          return writeJson(res, 400, { error: 'Missing text/channel/user' });
        }
        const msg = {
          id: nextId++,
          channel: parsed.channel,
          user: parsed.user,
          text: parsed.text.trim(),
          timestamp: Date.now(),
          pinned: Boolean(parsed.pinned)
        };
        messages.push(msg);
        broadcast('message', msg);
        return writeJson(res, 201, msg);
      } catch (err) {
        return writeJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (url.pathname === '/api/ask' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        if (!parsed.question) return writeJson(res, 400, { error: 'Missing question' });
        const maxAgeHours = Number(parsed.maxAgeHours || 72);
        const rag = runRag(parsed.question, maxAgeHours);
        broadcast('pulse', { sourceIds: rag.sources.map((s) => s.id) });
        writeJson(res, 200, rag);
      } catch (err) {
        writeJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Clarity workspace running on http://localhost:${PORT}`);
});
