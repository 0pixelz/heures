// gemini-key-settings.js
// Ajoute les clés IA dans Paramètres paie pour configurer l'assistant localement.
(() => {
  if (window.__geminiKeySettingsLoaded) return;
  window.__geminiKeySettingsLoaded = true;

  const GEMINI_KEY = 'GEMINI_BROWSER_KEY';
  const GROQ_KEY = 'GROQ_BROWSER_KEY';
  const GROQ_MODEL_KEY = 'GROQ_SELECTED_MODEL';
  const $ = id => document.getElementById(id);

  function maskKey(value) {
    if (!value) return '';
    if (value.length <= 10) return '••••••';
    return value.slice(0, 6) + '••••••••' + value.slice(-4);
  }

  function ensureStyles() {
    if ($('geminiKeySettingsStyles')) return;
    const st = document.createElement('style');
    st.id = 'geminiKeySettingsStyles';
    st.textContent = `
      .gemini-key-status{font-size:12px;color:var(--text-dim);margin-top:10px;line-height:1.4}
      .gemini-key-ok{color:var(--accent-text);font-weight:800}
      .gemini-key-danger{border-color:rgba(229,107,107,.45)!important;background:rgba(229,107,107,.08)!important;color:var(--danger)!important}
      .gemini-key-full{grid-column:1/-1}
    `;
    document.head.appendChild(st);
  }

  function ensureCard() {
    ensureStyles();
    if ($('geminiKeyCard')) return;
    const view = $('payrollSettingsView');
    if (!view) return;

    const card = document.createElement('div');
    card.id = 'geminiKeyCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="card-label">Assistant IA</div>
      <div class="pay-extra-row">
        <span>Provider actif</span>
        <strong id="aiProviderStatusLabel">Local seulement</strong>
      </div>
      <div class="pay-extra-row">
        <span>Groq</span>
        <strong id="groqKeyStatusLabel">Non configuré</strong>
      </div>
      <div class="pay-extra-inputs">
        <div class="gemini-key-full">
          <label>Clé API Groq</label>
          <input id="groqBrowserKeyInput" type="password" autocomplete="off" placeholder="Colle ta clé Groq ici">
        </div>
        <div class="gemini-key-full">
          <label>Modèle Groq</label>
          <input id="groqModelInput" type="text" autocomplete="off" placeholder="llama-3.1-8b-instant">
        </div>
      </div>
      <div class="pay-extra-actions">
        <button id="saveGroqKeyBtn" class="accent" type="button">Sauvegarder Groq</button>
        <button id="removeGroqKeyBtn" class="gemini-key-danger" type="button">Supprimer Groq</button>
      </div>
      <div class="pay-extra-row">
        <span>Gemini</span>
        <strong id="geminiKeyStatusLabel">Non configuré</strong>
      </div>
      <div class="pay-extra-inputs">
        <div class="gemini-key-full">
          <label>Clé API Gemini</label>
          <input id="geminiBrowserKeyInput" type="password" autocomplete="off" placeholder="Colle ta clé Gemini ici">
        </div>
      </div>
      <div class="pay-extra-actions">
        <button id="saveGeminiKeyBtn" class="accent" type="button">Sauvegarder Gemini</button>
        <button id="removeGeminiKeyBtn" class="gemini-key-danger" type="button">Supprimer Gemini</button>
      </div>
      <div id="geminiKeyStatusText" class="gemini-key-status">
        Les clés sont sauvegardées seulement sur cet appareil dans le navigateur.
      </div>
    `;

    view.appendChild(card);
    render();
  }

  function render() {
    const geminiKey = localStorage.getItem(GEMINI_KEY) || '';
    const groqKey = localStorage.getItem(GROQ_KEY) || '';
    const groqModel = localStorage.getItem(GROQ_MODEL_KEY) || 'llama-3.1-8b-instant';

    const providerLabel = $('aiProviderStatusLabel');
    if (providerLabel) {
      providerLabel.textContent = groqKey ? 'Groq' : geminiKey ? 'Gemini' : 'Local seulement';
      providerLabel.classList.toggle('gemini-key-ok', !!(groqKey || geminiKey));
    }

    const groqLabel = $('groqKeyStatusLabel');
    if (groqLabel) {
      groqLabel.textContent = groqKey ? 'Configuré' : 'Non configuré';
      groqLabel.classList.toggle('gemini-key-ok', !!groqKey);
    }

    const geminiLabel = $('geminiKeyStatusLabel');
    if (geminiLabel) {
      geminiLabel.textContent = geminiKey ? 'Configuré' : 'Non configuré';
      geminiLabel.classList.toggle('gemini-key-ok', !!geminiKey);
    }

    const groqInput = $('groqBrowserKeyInput');
    if (groqInput) groqInput.placeholder = groqKey ? maskKey(groqKey) : 'Colle ta clé Groq ici';

    const geminiInput = $('geminiBrowserKeyInput');
    if (geminiInput) geminiInput.placeholder = geminiKey ? maskKey(geminiKey) : 'Colle ta clé Gemini ici';

    const modelInput = $('groqModelInput');
    if (modelInput && !modelInput.value) modelInput.value = groqModel;

    const text = $('geminiKeyStatusText');
    if (text) {
      text.textContent = groqKey
        ? `Groq est activé avec la clé ${maskKey(groqKey)}. Les questions ouvertes utiliseront Groq.`
        : geminiKey
          ? `Gemini direct est activé avec la clé ${maskKey(geminiKey)}. Les questions ouvertes utiliseront Gemini.`
          : 'Entre une clé Groq ou Gemini pour activer les réponses IA directes sans Render. Groq est prioritaire si les deux clés sont présentes.';
    }
  }

  function saveGroqKey() {
    const input = $('groqBrowserKeyInput');
    const model = $('groqModelInput');
    const value = (input?.value || '').trim();
    const modelValue = (model?.value || '').trim();
    if (value) localStorage.setItem(GROQ_KEY, value);
    if (modelValue) localStorage.setItem(GROQ_MODEL_KEY, modelValue);
    if (input) input.value = '';
    render();
  }

  function removeGroqKey() {
    localStorage.removeItem(GROQ_KEY);
    localStorage.removeItem(GROQ_MODEL_KEY);
    const input = $('groqBrowserKeyInput');
    if (input) input.value = '';
    const model = $('groqModelInput');
    if (model) model.value = 'llama-3.1-8b-instant';
    render();
  }

  function saveGeminiKey() {
    const input = $('geminiBrowserKeyInput');
    const value = (input?.value || '').trim();
    if (value) localStorage.setItem(GEMINI_KEY, value);
    if (input) input.value = '';
    render();
  }

  function removeGeminiKey() {
    localStorage.removeItem(GEMINI_KEY);
    localStorage.removeItem('GEMINI_SELECTED_MODEL');
    const input = $('geminiBrowserKeyInput');
    if (input) input.value = '';
    render();
  }

  function bind() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'saveGroqKeyBtn') saveGroqKey();
      if (btn.id === 'removeGroqKeyBtn') removeGroqKey();
      if (btn.id === 'saveGeminiKeyBtn') saveGeminiKey();
      if (btn.id === 'removeGeminiKeyBtn') removeGeminiKey();
    });
  }

  function watchSettings() {
    setInterval(() => {
      if ($('payrollSettingsView')?.classList.contains('show')) {
        ensureCard();
        render();
      }
    }, 500);
  }

  function init() {
    bind();
    watchSettings();
    ensureCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
