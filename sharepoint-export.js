// sharepoint-export.js
// Ajoute l'envoi du rapport PDF vers une bibliothèque de documents SharePoint (Microsoft).
// Authentification via MSAL (OAuth, connexion Microsoft) + téléversement via Microsoft Graph.
// Toute la configuration reste sur l'appareil (localStorage). Aucun serveur intermédiaire.
(() => {
  if (window.__sharepointExportLoaded) return;
  window.__sharepointExportLoaded = true;

  const CLIENT_ID_KEY = 'SP_CLIENT_ID';
  const TENANT_KEY = 'SP_TENANT';
  const SITE_URL_KEY = 'SP_SITE_URL';
  const FOLDER_KEY = 'SP_FOLDER';

  // MSAL (Microsoft Authentication Library) chargé à la demande depuis un CDN.
  const MSAL_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/msal-browser/2.38.4/msal-browser.min.js';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPES = ['Sites.ReadWrite.All'];

  const $ = id => document.getElementById(id);
  const t = key => (typeof window.appT === 'function' ? window.appT(key) : key);

  // ---------- Config ----------
  function getConfig() {
    return {
      clientId: (localStorage.getItem(CLIENT_ID_KEY) || '').trim(),
      tenant: (localStorage.getItem(TENANT_KEY) || 'common').trim() || 'common',
      siteUrl: (localStorage.getItem(SITE_URL_KEY) || '').trim(),
      folder: (localStorage.getItem(FOLDER_KEY) || '').trim()
    };
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.clientId && c.siteUrl);
  }

  // "https://contoso.sharepoint.com/sites/Equipe/Documents" ->
  //   { host: "contoso.sharepoint.com", sitePath: "/sites/Equipe" }
  function parseSite(siteUrl) {
    let u;
    try { u = new URL(siteUrl); } catch { throw new Error('URL SharePoint invalide'); }
    const host = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);
    let sitePath = '';
    const idx = parts.findIndex(p => p === 'sites' || p === 'teams');
    if (idx !== -1 && parts[idx + 1]) {
      sitePath = '/' + parts[idx] + '/' + parts[idx + 1];
    }
    return { host, sitePath };
  }

  // ---------- MSAL ----------
  let msalScriptPromise = null;
  function loadMsal() {
    if (window.msal) return Promise.resolve();
    if (msalScriptPromise) return msalScriptPromise;
    msalScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MSAL_CDN;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Impossible de charger MSAL (connexion requise)'));
      document.head.appendChild(s);
    });
    return msalScriptPromise;
  }

  let msalInstance = null;
  let msalInstanceKey = '';
  async function getMsalInstance(cfg) {
    const key = cfg.clientId + '|' + cfg.tenant;
    if (msalInstance && msalInstanceKey === key) return msalInstance;
    await loadMsal();
    const redirectUri = window.location.href.split('#')[0].split('?')[0];
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: 'https://login.microsoftonline.com/' + cfg.tenant,
        redirectUri
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false }
    });
    // MSAL v3 exige initialize(); no-op en v2.
    if (typeof msalInstance.initialize === 'function') {
      try { await msalInstance.initialize(); } catch (e) { /* v2 */ }
    }
    msalInstanceKey = key;
    return msalInstance;
  }

  function isCanceled(err) {
    const code = err && (err.errorCode || err.code || '');
    return code === 'user_cancelled' || code === 'access_denied' ||
      /user_cancelled|popup_window_error|user cancelled/i.test((err && err.message) || '');
  }

  async function getToken(cfg) {
    const inst = await getMsalInstance(cfg);
    const request = { scopes: SCOPES };
    const account = inst.getAllAccounts()[0];
    try {
      if (account) {
        const res = await inst.acquireTokenSilent(Object.assign({}, request, { account }));
        return res.accessToken;
      }
      const res = await inst.loginPopup(request);
      return res.accessToken;
    } catch (err) {
      if (isCanceled(err)) { const e = new Error('canceled'); e.code = 'canceled'; throw e; }
      // Repli sur le popup si le silencieux échoue (consentement, session expirée…).
      try {
        const res = await inst.acquireTokenPopup(request);
        return res.accessToken;
      } catch (err2) {
        if (isCanceled(err2)) { const e = new Error('canceled'); e.code = 'canceled'; throw e; }
        throw err2;
      }
    }
  }

  // ---------- Graph ----------
  async function graph(token, path, opts) {
    const res = await fetch(GRAPH + path, Object.assign({
      headers: { Authorization: 'Bearer ' + token }
    }, opts || {}));
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch {}
      throw new Error('Graph ' + res.status + (detail ? ' – ' + detail : ''));
    }
    return res;
  }

  async function upload(blob, filename, options) {
    const onStatus = (options && options.onStatus) || function () {};
    const cfg = getConfig();
    if (!cfg.clientId || !cfg.siteUrl) {
      const e = new Error('not_configured'); e.code = 'not_configured'; throw e;
    }
    const { host, sitePath } = parseSite(cfg.siteUrl);

    onStatus('connecting');
    const token = await getToken(cfg);

    // 1) Résoudre l'ID du site.
    const siteRes = await graph(token, '/sites/' + host + ':' + sitePath);
    const site = await siteRes.json();

    // 2) Bibliothèque de documents par défaut du site.
    const driveRes = await graph(token, '/sites/' + site.id + '/drive');
    const drive = await driveRes.json();

    // 3) Téléverser le fichier (upload simple, adapté à un PDF de quelques Ko).
    onStatus('uploading');
    const folder = cfg.folder.replace(/^\/+|\/+$/g, '');
    const safeName = filename.replace(/[\\/:*?"<>|]+/g, '_');
    const itemPath = (folder ? folder + '/' : '') + safeName;
    const putRes = await graph(
      token,
      '/drives/' + drive.id + '/root:/' + encodeURI(itemPath) + ':/content',
      {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' },
        body: blob
      }
    );
    const item = await putRes.json();
    return { ok: true, webUrl: item.webUrl, name: item.name };
  }

  window.SharePointExport = { isConfigured, getConfig, upload };

  // ---------- Carte de réglages ----------
  function ensureStyles() {
    if ($('sharepointSettingsStyles')) return;
    const st = document.createElement('style');
    st.id = 'sharepointSettingsStyles';
    st.textContent = `
      .sp-status{font-size:12px;color:var(--text-dim);margin-top:10px;line-height:1.4}
      .sp-ok{color:var(--accent-text);font-weight:800}
      .sp-full{grid-column:1/-1}
      .sp-help{font-size:11px;color:var(--text-dim);margin-top:4px;line-height:1.4}
      .sp-danger{border-color:rgba(229,107,107,.45)!important;background:rgba(229,107,107,.08)!important;color:var(--danger)!important}
    `;
    document.head.appendChild(st);
  }

  function ensureCard() {
    ensureStyles();
    if ($('sharepointCard')) return;
    const view = $('payrollSettingsView');
    if (!view) return;

    const card = document.createElement('div');
    card.id = 'sharepointCard';
    card.className = 'card';
    card.innerHTML = `
      <div class="card-label">SharePoint (Microsoft)</div>
      <div class="pay-extra-row">
        <span>État</span>
        <strong id="spStatusLabel">Non configuré</strong>
      </div>
      <div class="pay-extra-inputs">
        <div class="sp-full">
          <label>Client ID (Azure)</label>
          <input id="spClientIdInput" type="text" autocomplete="off" placeholder="00000000-0000-0000-0000-000000000000">
        </div>
        <div class="sp-full">
          <label>Locataire (tenant)</label>
          <input id="spTenantInput" type="text" autocomplete="off" placeholder="common">
          <div class="sp-help">« common », « organizations », ou l'ID/domaine de ton organisation.</div>
        </div>
        <div class="sp-full">
          <label>URL du site SharePoint</label>
          <input id="spSiteInput" type="text" autocomplete="off" placeholder="https://contoso.sharepoint.com/sites/MonEquipe">
        </div>
        <div class="sp-full">
          <label>Dossier (optionnel)</label>
          <input id="spFolderInput" type="text" autocomplete="off" placeholder="Heures">
          <div class="sp-help">Sous-dossier dans la bibliothèque « Documents ». Laisse vide pour la racine.</div>
        </div>
      </div>
      <div class="pay-extra-actions">
        <button id="saveSharepointBtn" class="accent" type="button">Sauvegarder</button>
        <button id="removeSharepointBtn" class="sp-danger" type="button">Supprimer</button>
      </div>
      <div id="spStatusText" class="sp-status">
        La configuration reste sur cet appareil. Il te faut une inscription d'application Azure AD
        (type « Single-page application ») dont l'URI de redirection est l'adresse de cette app,
        avec la permission déléguée « Sites.ReadWrite.All ».
      </div>
    `;
    view.appendChild(card);
    render();
  }

  function render() {
    const cfg = getConfig();
    const label = $('spStatusLabel');
    if (label) {
      label.textContent = isConfigured() ? 'Configuré' : 'Non configuré';
      label.classList.toggle('sp-ok', isConfigured());
    }
    const clientInput = $('spClientIdInput');
    if (clientInput && !clientInput.value) clientInput.value = cfg.clientId;
    const tenantInput = $('spTenantInput');
    if (tenantInput && !tenantInput.value) tenantInput.value = cfg.tenant;
    const siteInput = $('spSiteInput');
    if (siteInput && !siteInput.value) siteInput.value = cfg.siteUrl;
    const folderInput = $('spFolderInput');
    if (folderInput && !folderInput.value) folderInput.value = cfg.folder;
  }

  function save() {
    const clientId = ($('spClientIdInput')?.value || '').trim();
    const tenant = ($('spTenantInput')?.value || '').trim() || 'common';
    const siteUrl = ($('spSiteInput')?.value || '').trim();
    const folder = ($('spFolderInput')?.value || '').trim();
    if (clientId) localStorage.setItem(CLIENT_ID_KEY, clientId);
    localStorage.setItem(TENANT_KEY, tenant);
    if (siteUrl) localStorage.setItem(SITE_URL_KEY, siteUrl);
    localStorage.setItem(FOLDER_KEY, folder);
    // Forcer la recréation de l'instance MSAL si l'identité a changé.
    msalInstance = null; msalInstanceKey = '';
    render();
    if (typeof window.showToast === 'function') window.showToast('SharePoint sauvegardé');
  }

  function remove() {
    [CLIENT_ID_KEY, TENANT_KEY, SITE_URL_KEY, FOLDER_KEY].forEach(k => localStorage.removeItem(k));
    ['spClientIdInput', 'spTenantInput', 'spSiteInput', 'spFolderInput'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    msalInstance = null; msalInstanceKey = '';
    render();
    if (typeof window.showToast === 'function') window.showToast('SharePoint supprimé');
  }

  function bind() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'saveSharepointBtn') save();
      if (btn.id === 'removeSharepointBtn') remove();
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
