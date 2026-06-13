const API = 'http://localhost:3000';
const userId = 'user_' + Math.random().toString(36).slice(2, 8);
let isLoading = false;

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(text, role) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="msg-avatar ${role === 'ai' ? 'ai-av' : 'user-av'}">${role === 'ai' ? 'S' : 'U'}</div>
    <div class="msg-wrapper">
      <div class="msg-bubble">${text}</div>
      <div class="msg-time">${formatTime()}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message ai';
  div.id = 'typing';
  div.innerHTML = `
    <div class="msg-avatar ai-av">S</div>
    <div class="typing-bubble">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text || isLoading) return;
  input.value = '';
  isLoading = true;
  document.getElementById('send-btn').disabled = true;
  addMessage(text, 'user');
  showTyping();
  try {
    const res = await fetch(`${API}/api/shield/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message: text, sessionId: userId })
    });
    const data = await res.json();
    removeTyping();
    addMessage(data.response || data.text || data.output || JSON.stringify(data), 'ai');
  } catch (e) {
    removeTyping();
    addMessage('Could not reach the Project O.S.S. server. Make sure your mini app is running on port 3000.', 'ai');
  }
  isLoading = false;
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

function sendQuick(text) {
  document.getElementById('user-input').value = text;
  sendMessage();
}

document.getElementById('user-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function pollStatus() {
  try {
    const res = await fetch(`${API}/api/incident/active`);
    const data = await res.json();
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    const detail = document.getElementById('status-detail');
    const eta = document.getElementById('eta-badge');
    const details = document.getElementById('incident-details');

    if (data.active && data.incident) {
      dot.className = 'status-dot active';
      label.textContent = 'Incident Active';
      detail.textContent = '· ' + (data.incident.type || '').replace(/_/g, ' ');
      
      let etaVal = '—';
      try {
        etaVal = data.incident.etaMinutes || '—';
      } catch(e) {}
      
      eta.textContent = 'ETA: ' + etaVal + ' min';
      eta.classList.add('visible');
      const sev = data.incident.severity || 'high';
      details.innerHTML = `
        <div class="incident-card active-incident">
          <div class="incident-field">
            <div class="field-label">Type</div>
            <div class="field-value">${(data.incident.type || 'Unknown').replace(/_/g, ' ')}</div>
          </div>
          <div class="incident-field">
            <div class="field-label">Severity</div>
            <div class="field-value"><span class="severity-badge severity-${sev}">${sev.toUpperCase()}</span></div>
          </div>
          <div class="incident-field">
            <div class="field-label">Root Cause</div>
            <div class="field-value" style="font-size:12px;font-weight:400">${data.incident.rootCause || 'Analyzing...'}</div>
          </div>
          <div class="incident-field">
            <div class="field-label">ETA</div>
            <div class="field-value">${data.incident.etaMinutes || '—'} minutes</div>
          </div>
          <div class="incident-field">
            <div class="field-label">Started</div>
            <div class="field-value" style="font-size:12px">${new Date(data.incident.startedAt).toLocaleTimeString()}</div>
          </div>
        </div>`;
    } else {
      dot.className = 'status-dot clear';
      label.textContent = 'All Systems Operational';
      detail.textContent = '';
      eta.classList.remove('visible');
      details.innerHTML = `
        <div class="no-incident">
          <div style="font-size:22px;color:var(--success)">&#10003;</div>
          <div>No active incidents</div>
        </div>`;
    }
  } catch (e) {
    document.getElementById('status-dot').className = 'status-dot active';
    document.getElementById('status-label').textContent = 'Cannot reach Project O.S.S. server';
  }
}

pollStatus();
setInterval(pollStatus, 5000);
