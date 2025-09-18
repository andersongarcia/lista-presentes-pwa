// === CONFIG ===
// Cole aqui a URL publicada do seu Web App do GAS (termina com /exec).
// Ex.: const BASE_API = 'https://script.google.com/macros/s/AKfycbx.../exec';
const BASE_API = 'https://script.google.com/macros/s/AKfycbz2VBYYeDkpEJ9VZ7HaEgXFPzsJJShQCuVytknvJGbyGHcPVFFPw7CazZcUJ9pAlT7m/exec';

// (Opcional) use para restringir a origem no GAS (ALLOWED_ORIGIN)
const FRONT_ORIGIN_HINT = location.origin;

// === Token anônimo ===
const TOKEN_KEY = 'giftlist_token';

// === Tabs ===
const tabLista = document.getElementById('tab-lista');
const tabSobre = document.getElementById('tab-sobre');
const panelLista = document.getElementById('panel-lista');
const panelSobre = document.getElementById('panel-sobre');

// === UI elements ===
const cardsEl = document.getElementById('cards');
const statusEl = document.getElementById('status-area');

const dialogEl = document.getElementById('confirmDialog');
const formEl = document.getElementById('confirmForm');
const confirmTitleEl = document.getElementById('confirmTitle');
const confirmSubtitleEl = document.getElementById('confirmSubtitle');
const cancelBtn = document.getElementById('cancelBtn');

// estado atual
let currentConfirmId = null;
let itemsCache = [];

// Tabs behavior
tabLista.addEventListener('click', () => {
  tabLista.classList.add('active');
  tabSobre.classList.remove('active');
  panelLista.hidden = false;
  panelSobre.hidden = true;
  tabLista.setAttribute('aria-selected', 'true');
  tabSobre.setAttribute('aria-selected', 'false');
});
tabSobre.addEventListener('click', () => {
  tabSobre.classList.add('active');
  tabLista.classList.remove('active');
  panelSobre.hidden = false;
  panelLista.hidden = true;
  tabSobre.setAttribute('aria-selected', 'true');
  tabLista.setAttribute('aria-selected', 'false');
});

// gera UUID v4 simples
function uuidv4() {
  // fonte: RFC4122-like
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ensureToken() {
  let tok = localStorage.getItem(TOKEN_KEY);
  if (!tok) {
    tok = uuidv4();
    localStorage.setItem(TOKEN_KEY, tok);
  }
  return tok;
}

async function loadItems() {
  statusEl.textContent = 'Carregando presentes...';
  cardsEl.setAttribute('aria-busy', 'true');
  cardsEl.innerHTML = '';

  try {
    const url = `${BASE_API}?route=items&ts=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    itemsCache = Array.isArray(data.items) ? data.items : [];
    renderCards(itemsCache);
    statusEl.textContent = itemsCache.length ? `Exibindo ${itemsCache.length} itens.` : 'Nenhum item encontrado.';
  } catch (err) {
    statusEl.textContent = 'Não foi possível carregar os presentes (tente novamente).';
    console.error(err);
  } finally {
    cardsEl.setAttribute('aria-busy', 'false');
  }
}

function renderCards(list) {
  cardsEl.innerHTML = '';
  for (const item of list) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-id', item.id);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = '';
    img.src = item.imagem || './icons/gift-placeholder.svg';
    thumb.appendChild(img);

    const body = document.createElement('div');
    body.style.flex = '1';

    const h3 = document.createElement('h3');
    h3.textContent = item.nome || 'Presente';

    const desc = document.createElement('p');
    desc.textContent = item.descricao || '';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const badge = document.createElement('span');
    const isSold = item.status === 'presenteado';
    badge.className = 'badge ' + (isSold ? 'sold' : 'ok');
    badge.textContent = isSold ? 'Já presenteado' : 'Disponível';
    meta.appendChild(badge);

    if (isSold && item.presenteado_por) {
      const who = document.createElement('span');
      who.style.marginLeft = '8px';
      who.textContent = `Presenteado por ${item.presenteado_por}`;
      meta.appendChild(who);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Confirmar presente';
    btn.disabled = isSold;
    btn.addEventListener('click', () => confirmGift(item.id, item.nome));
    actions.appendChild(btn);

    body.appendChild(h3);
    if (desc.textContent) body.appendChild(desc);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(thumb);
    card.appendChild(body);

    cardsEl.appendChild(card);
  }
}

function confirmGift(id, label) {
  currentConfirmId = id;
  confirmSubtitleEl.textContent = `Você está confirmando: ${label || id}`;
  (dialogEl.showModal ? dialogEl.showModal() : alert('Seu navegador não suporta diálogos modais.')) ;
  document.getElementById('nomeInput').focus();
}

cancelBtn.addEventListener('click', () => {
  currentConfirmId = null;
  dialogEl.close();
});

formEl.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!currentConfirmId) return dialogEl.close();

  const nome = (document.getElementById('nomeInput').value || '').trim();
  const mensagem = (document.getElementById('mensagemInput').value || '').trim();
  const token = ensureToken();

  const payload = { id: currentConfirmId, nome, mensagem, token };
  const url = `${BASE_API}?route=confirm`;

  try {
    setBusy(true, 'Confirmando presente...');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'ok') {
      toast('Presente confirmado com sucesso! Obrigado 💚');
      dialogEl.close();
      await loadItems();
    } else if (data.status === 'ja_presenteado') {
      toast('Este item já foi presenteado. Obrigado mesmo assim!');
      dialogEl.close();
      await loadItems();
    } else if (data.status === 'duplicado_mesmo_token') {
      toast('Você já confirmou este item anteriormente com este dispositivo.');
      dialogEl.close();
      await loadItems();
    } else {
      toast('Não foi possível confirmar agora. Tente novamente mais tarde.');
    }
  } catch (err) {
    console.error(err);
    toast('Falha na confirmação. Verifique sua conexão.');
  } finally {
    setBusy(false);
  }
});

function setBusy(on, msg) {
  if (on) {
    statusEl.textContent = msg || 'Carregando...';
  }
}

function toast(msg) {
  statusEl.textContent = msg;
  // rola para o topo em telas pequenas
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// boot
ensureToken();
loadItems();
