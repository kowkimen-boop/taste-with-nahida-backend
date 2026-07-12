const API = '/api';
let TOKEN = localStorage.getItem('twn_admin_token') || null;
let EMAIL = localStorage.getItem('twn_admin_email') || null;

// ---------------- Auth ----------------
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');

function showApp() {
  loginView.style.display = 'none';
  appView.style.display = 'flex';
  loadSettings().then(() => loadTab('recipes'));
}
function showLogin() {
  appView.style.display = 'none';
  loginView.style.display = 'flex';
}

if (TOKEN) showApp(); else showLogin();

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed'; return; }
    TOKEN = data.token; EMAIL = data.email;
    localStorage.setItem('twn_admin_token', TOKEN);
    localStorage.setItem('twn_admin_email', EMAIL);
    showApp();
  } catch (err) {
    errEl.textContent = 'Could not reach the server. Is it running?';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('twn_admin_token');
  localStorage.removeItem('twn_admin_email');
  TOKEN = null;
  showLogin();
});

// ---------------- API helper ----------------
async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  if (res.status === 401) { showLogin(); throw new Error('Session expired — please log in again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------------- Mobile sidebar toggle ----------------
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const menuToggle = document.getElementById('menu-toggle');

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}
function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('open');
}
if (menuToggle) menuToggle.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

// ---------------- Tabs ----------------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    loadTab(btn.dataset.tab);
    closeSidebar();
  });
});

function loadTab(name) {
  const loaders = { recipes: renderRecipes, reviews: renderReviews, blog: renderBlog,
    gallery: renderGallery, messages: renderMessages, subscribers: renderSubscribers,
    business: renderBusiness };
  loaders[name]();
}

// ---------------- Modal helper ----------------
function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

// ================= RECIPES =================
async function renderRecipes() {
  const el = document.getElementById('tab-recipes');
  el.innerHTML = `<div class="tab-head"><h2>Recipes</h2><button class="btn-primary" id="add-recipe">+ Add Recipe</button></div><div id="recipes-list">Loading…</div>`;
  document.getElementById('add-recipe').onclick = () => recipeForm();
  const rows = await api('/recipes/admin/all');
  const list = document.getElementById('recipes-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No recipes yet.</div>'; return; }
  list.innerHTML = `<table><tr><th>Title</th><th>Category</th><th>Status</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td><span class="badge ${r.published ? 'pub' : 'unpub'}">${r.published ? 'Published' : 'Draft'}</span></td>
      <td>
        <button class="btn-secondary" data-edit="${r.id}">Edit</button>
        <button class="btn-danger" data-del="${r.id}">Delete</button>
      </td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => recipeForm(rows.find(r => r.id == b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/recipes/' + b.dataset.del, renderRecipes));
}

function recipeForm(existing) {
  const isEdit = !!existing;
  const overlay = openModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Recipe</h3>
    <div class="field"><label>Title</label><input id="f-title" value="${existing ? escapeAttr(existing.title) : ''}"></div>
    <div class="field"><label>Category</label>
      <select id="f-category">
        ${['bangladeshi','cakes','pizza','snacks'].map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Summary</label><textarea id="f-summary">${existing ? escapeHtml(existing.summary||'') : ''}</textarea></div>
    <div class="field"><label>Ingredients (one per line)</label><textarea id="f-ingredients">${existing ? (existing.ingredients||[]).join('\n') : ''}</textarea></div>
    <div class="field"><label>Steps (one per line)</label><textarea id="f-steps">${existing ? (existing.steps||[]).join('\n') : ''}</textarea></div>
    <div class="field"><label>Image</label><input type="file" id="f-image" accept="image/*"><input type="hidden" id="f-image-url" value="${existing?.image_url||''}"></div>
    <div class="field"><label><input type="checkbox" id="f-published" ${!existing || existing.published ? 'checked' : ''}> Published</label></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const imageFile = overlay.querySelector('#f-image').files[0];
      let image_url = overlay.querySelector('#f-image-url').value;
      if (imageFile) image_url = await uploadImage(imageFile);

      const payload = {
        title: overlay.querySelector('#f-title').value,
        category: overlay.querySelector('#f-category').value,
        summary: overlay.querySelector('#f-summary').value,
        ingredients: overlay.querySelector('#f-ingredients').value.split('\n').map(s => s.trim()).filter(Boolean),
        steps: overlay.querySelector('#f-steps').value.split('\n').map(s => s.trim()).filter(Boolean),
        image_url,
        published: overlay.querySelector('#f-published').checked
      };
      if (isEdit) await api(`/recipes/${existing.id}`, { method: 'PUT', body: payload });
      else await api('/recipes', { method: 'POST', body: payload });
      overlay.remove();
      toast('Recipe saved');
      renderRecipes();
    } catch (err) { alert(err.message); }
  };
}

// ================= REVIEWS =================
async function renderReviews() {
  const el = document.getElementById('tab-reviews');
  el.innerHTML = `<div class="tab-head"><h2>Restaurant Reviews</h2><button class="btn-primary" id="add-review">+ Add Review</button></div><div id="reviews-list">Loading…</div>`;
  document.getElementById('add-review').onclick = () => reviewForm();
  const rows = await api('/reviews/admin/all');
  const list = document.getElementById('reviews-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No reviews yet.</div>'; return; }
  list.innerHTML = `<table><tr><th>Restaurant</th><th>Country</th><th>Rating</th><th>Status</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.restaurant_name)}</td>
      <td>${escapeHtml(r.country)}</td>
      <td>${'★'.repeat(Math.round(r.rating))}${'☆'.repeat(5-Math.round(r.rating))}</td>
      <td><span class="badge ${r.published ? 'pub' : 'unpub'}">${r.published ? 'Published' : 'Draft'}</span></td>
      <td>
        <button class="btn-secondary" data-edit="${r.id}">Edit</button>
        <button class="btn-danger" data-del="${r.id}">Delete</button>
      </td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => reviewForm(rows.find(r => r.id == b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/reviews/' + b.dataset.del, renderReviews));
}

function reviewForm(existing) {
  const isEdit = !!existing;
  const overlay = openModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Review</h3>
    <div class="field"><label>Restaurant Name</label><input id="f-name" value="${existing ? escapeAttr(existing.restaurant_name) : ''}"></div>
    <div class="field"><label>Country</label>
      <select id="f-country">
        ${['bangladesh','india','singapore','malaysia'].map(c => `<option value="${c}" ${existing?.country===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Location</label><input id="f-location" value="${existing ? escapeAttr(existing.location||'') : ''}"></div>
    <div class="field"><label>Rating (0-5)</label><input type="number" min="0" max="5" step="0.5" id="f-rating" value="${existing?existing.rating:4}"></div>
    <div class="field"><label>Review</label><textarea id="f-body">${existing ? escapeHtml(existing.body||'') : ''}</textarea></div>
    <div class="field"><label>Image</label><input type="file" id="f-image" accept="image/*"><input type="hidden" id="f-image-url" value="${existing?.image_url||''}"></div>
    <div class="field"><label><input type="checkbox" id="f-published" ${!existing || existing.published ? 'checked' : ''}> Published</label></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const imageFile = overlay.querySelector('#f-image').files[0];
      let image_url = overlay.querySelector('#f-image-url').value;
      if (imageFile) image_url = await uploadImage(imageFile);

      const payload = {
        restaurant_name: overlay.querySelector('#f-name').value,
        country: overlay.querySelector('#f-country').value,
        location: overlay.querySelector('#f-location').value,
        rating: parseFloat(overlay.querySelector('#f-rating').value),
        body: overlay.querySelector('#f-body').value,
        image_url,
        published: overlay.querySelector('#f-published').checked
      };
      if (isEdit) await api(`/reviews/${existing.id}`, { method: 'PUT', body: payload });
      else await api('/reviews', { method: 'POST', body: payload });
      overlay.remove();
      toast('Review saved');
      renderReviews();
    } catch (err) { alert(err.message); }
  };
}

// ================= BLOG =================
async function renderBlog() {
  const el = document.getElementById('tab-blog');
  el.innerHTML = `<div class="tab-head"><h2>Travel Blog</h2><button class="btn-primary" id="add-post">+ Write Post</button></div><div id="blog-list">Loading…</div>`;
  document.getElementById('add-post').onclick = () => blogForm();
  const rows = await api('/blog/admin/all');
  const list = document.getElementById('blog-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No posts yet.</div>'; return; }
  list.innerHTML = `<table><tr><th>Title</th><th>Country</th><th>Status</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.country||'—')}</td>
      <td><span class="badge ${r.published ? 'pub' : 'unpub'}">${r.published ? 'Published' : 'Draft'}</span></td>
      <td>
        <button class="btn-secondary" data-edit="${r.id}">Edit</button>
        <button class="btn-danger" data-del="${r.id}">Delete</button>
      </td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => blogForm(rows.find(r => r.id == b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/blog/' + b.dataset.del, renderBlog));
}

function blogForm(existing) {
  const isEdit = !!existing;
  const overlay = openModal(`
    <h3>${isEdit ? 'Edit' : 'Write'} Travel Post</h3>
    <div class="field"><label>Title</label><input id="f-title" value="${existing ? escapeAttr(existing.title) : ''}"></div>
    <div class="field"><label>Country</label>
      <select id="f-country">
        ${['bangladesh','india','singapore','malaysia',''].map(c => `<option value="${c}" ${existing?.country===c?'selected':''}>${c||'other'}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Story</label><textarea id="f-body" style="min-height:160px;">${existing ? escapeHtml(existing.body||'') : ''}</textarea></div>
    <div class="field"><label>Image</label><input type="file" id="f-image" accept="image/*"><input type="hidden" id="f-image-url" value="${existing?.image_url||''}"></div>
    <div class="field"><label><input type="checkbox" id="f-published" ${!existing || existing.published ? 'checked' : ''}> Published</label></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const imageFile = overlay.querySelector('#f-image').files[0];
      let image_url = overlay.querySelector('#f-image-url').value;
      if (imageFile) image_url = await uploadImage(imageFile);

      const payload = {
        title: overlay.querySelector('#f-title').value,
        country: overlay.querySelector('#f-country').value,
        body: overlay.querySelector('#f-body').value,
        image_url,
        published: overlay.querySelector('#f-published').checked
      };
      if (isEdit) await api(`/blog/${existing.id}`, { method: 'PUT', body: payload });
      else await api('/blog', { method: 'POST', body: payload });
      overlay.remove();
      toast('Post saved');
      renderBlog();
    } catch (err) { alert(err.message); }
  };
}

// ================= GALLERY =================
async function renderGallery() {
  const el = document.getElementById('tab-gallery');
  el.innerHTML = `<div class="tab-head"><h2>Gallery</h2><button class="btn-primary" id="add-image">+ Upload Image</button></div>
    <div id="gallery-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px;"></div>`;
  document.getElementById('add-image').onclick = () => galleryUploadForm();
  const rows = await api('/gallery');
  const grid = document.getElementById('gallery-grid');
  if (!rows.length) { grid.innerHTML = '<div class="empty">No images yet.</div>'; return; }
  grid.innerHTML = rows.map(r => `
    <div style="position:relative;">
      <img src="${r.image_url}" style="width:100%; height:140px; object-fit:cover; border-radius:10px;">
      <button class="btn-danger" data-del="${r.id}" style="position:absolute; top:6px; right:6px;">✕</button>
    </div>
  `).join('');
  grid.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/gallery/' + b.dataset.del, renderGallery));
}

function galleryUploadForm() {
  const overlay = openModal(`
    <h3>Upload Image</h3>
    <div class="field"><label>Image file</label><input type="file" id="f-image" accept="image/*"></div>
    <div class="field"><label>Caption (optional)</label><input id="f-caption"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Upload</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    const file = overlay.querySelector('#f-image').files[0];
    if (!file) return alert('Choose an image file first');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('addToGallery', 'true');
      fd.append('caption', overlay.querySelector('#f-caption').value);
      await api('/uploads', { method: 'POST', body: fd, isForm: true });
      overlay.remove();
      toast('Image uploaded');
      renderGallery();
    } catch (err) { alert(err.message); }
  };
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const data = await api('/uploads', { method: 'POST', body: fd, isForm: true });
  return data.image_url;
}

// ================= MESSAGES =================
async function renderMessages() {
  const el = document.getElementById('tab-messages');
  el.innerHTML = `<div class="tab-head"><h2>Contact Messages</h2></div><div id="messages-list">Loading…</div>`;
  const rows = await api('/contact');
  const list = document.getElementById('messages-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No messages yet.</div>'; return; }
  list.innerHTML = `<table><tr><th>From</th><th>Subject</th><th>Message</th><th>Date</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.name)}<br><small>${escapeHtml(r.email)}</small></td>
      <td>${escapeHtml(r.subject||'—')}</td>
      <td style="max-width:280px;">${escapeHtml(r.message)}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td><button class="btn-danger" data-del="${r.id}">Delete</button></td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/contact/' + b.dataset.del, renderMessages));
}

// ================= SUBSCRIBERS =================
async function renderSubscribers() {
  const el = document.getElementById('tab-subscribers');
  el.innerHTML = `<div class="tab-head"><h2>Newsletter Subscribers</h2><a class="btn-secondary" href="${API}/newsletter/export.csv?token=${TOKEN}" id="export-link">Export CSV</a></div><div id="subs-list">Loading…</div>`;
  // Note: export link needs Authorization header, so wire a click handler instead of relying on href auth
  document.getElementById('export-link').onclick = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/newsletter/export.csv`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click();
  };
  const rows = await api('/newsletter');
  const list = document.getElementById('subs-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No subscribers yet.</div>'; return; }
  list.innerHTML = `<table><tr><th>Email</th><th>Subscribed</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.email)}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td><button class="btn-danger" data-del="${r.id}">Remove</button></td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmDelete('/newsletter/' + b.dataset.del, renderSubscribers));
}

// ================= BUSINESS (Ingredients / Products / Sales) =================
let businessSubTab = 'products';

async function renderBusiness() {
  await loadSettings();
  const el = document.getElementById('tab-business');
  el.innerHTML = `
    <div class="tab-head">
      <h2>Business</h2>
      <button class="btn-secondary" id="change-currency">Currency: ${CURRENCY_SYMBOL} — Change</button>
    </div>
    <div class="filter-row" style="justify-content:flex-start; margin-bottom:20px;">
      <button class="filter-chip biz-sub ${businessSubTab === 'products' ? 'active' : ''}" data-sub="products">Products</button>
      <button class="filter-chip biz-sub ${businessSubTab === 'ingredients' ? 'active' : ''}" data-sub="ingredients">Ingredients</button>
      <button class="filter-chip biz-sub ${businessSubTab === 'sales' ? 'active' : ''}" data-sub="sales">Sales &amp; Profit</button>
    </div>
    <div id="biz-content">Loading…</div>
  `;
  el.querySelector('#change-currency').onclick = () => currencyForm();
  el.querySelectorAll('.biz-sub').forEach(btn => btn.onclick = () => {
    businessSubTab = btn.dataset.sub;
    renderBusiness();
  });

  if (businessSubTab === 'ingredients') await renderIngredientsSub();
  else if (businessSubTab === 'sales') await renderSalesSub();
  else await renderProductsSub();
}

function currencyForm() {
  const overlay = openModal(`
    <h3>Change Currency</h3>
    <p style="color:rgba(18,58,52,.7); font-size:.9rem;">This changes how amounts are displayed everywhere in the dashboard — past numbers aren't converted, just relabeled. Switch back anytime, e.g. when Muna moves to the US.</p>
    <div class="field"><label>Symbol</label><input id="f-symbol" value="${CURRENCY_SYMBOL}" placeholder="e.g. ৳, $, £, €"></div>
    <div class="field"><label>Currency code (optional label)</label><input id="f-code" placeholder="e.g. BDT, USD"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      await api('/settings', { method: 'PUT', body: {
        currency_symbol: overlay.querySelector('#f-symbol').value,
        currency_code: overlay.querySelector('#f-code').value
      }});
      overlay.remove();
      toast('Currency updated');
      renderBusiness();
    } catch (err) { alert(err.message); }
  };
}

let CURRENCY_SYMBOL = '৳'; // updated from server settings once loaded

async function loadSettings() {
  try {
    const settings = await fetch(`${API}/settings`).then(r => r.json());
    if (settings.currency_symbol) CURRENCY_SYMBOL = settings.currency_symbol;
  } catch (err) { /* fall back to default symbol */ }
}

function money(n) {
  return CURRENCY_SYMBOL + (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Ingredients ----------
async function renderIngredientsSub() {
  const box = document.getElementById('biz-content');
  box.innerHTML = `<div class="tab-head"><h3 style="margin:0;">Ingredients</h3><button class="btn-primary" id="add-ingredient">+ Add Ingredient</button></div><div id="ingredients-list">Loading…</div>`;
  document.getElementById('add-ingredient').onclick = () => ingredientForm();
  const rows = await api('/ingredients');
  const list = document.getElementById('ingredients-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No ingredients yet — add flour, sugar, eggs, whatever she uses most.</div>'; return; }
  list.innerHTML = `<table><tr><th>Name</th><th>Unit</th><th>Cost per unit</th><th></th></tr>
    ${rows.map(i => `<tr>
      <td>${escapeHtml(i.name)}</td>
      <td>${escapeHtml(i.unit)}</td>
      <td>${money(i.cost_per_unit)}</td>
      <td>
        <button class="btn-secondary" data-edit="${i.id}">Edit</button>
        <button class="btn-danger" data-del="${i.id}">Delete</button>
      </td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => ingredientForm(rows.find(i => i.id == b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this ingredient?')) return;
    try { await api('/ingredients/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); renderIngredientsSub(); }
    catch (err) { alert(err.message); }
  });
}

function ingredientForm(existing) {
  const isEdit = !!existing;
  const overlay = openModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Ingredient</h3>
    <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. All-purpose flour" value="${existing ? escapeAttr(existing.name) : ''}"></div>
    <div class="field"><label>Unit</label><input id="f-unit" placeholder="e.g. g, kg, pcs, cup" value="${existing ? escapeAttr(existing.unit) : ''}"></div>
    <div class="field"><label>Cost per unit ($)</label><input type="number" step="0.001" id="f-cost" placeholder="e.g. 0.002 per gram" value="${existing ? existing.cost_per_unit : ''}"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);
  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const payload = {
        name: overlay.querySelector('#f-name').value,
        unit: overlay.querySelector('#f-unit').value,
        cost_per_unit: parseFloat(overlay.querySelector('#f-cost').value)
      };
      if (isEdit) await api(`/ingredients/${existing.id}`, { method: 'PUT', body: payload });
      else await api('/ingredients', { method: 'POST', body: payload });
      overlay.remove();
      toast('Ingredient saved');
      renderIngredientsSub();
    } catch (err) { alert(err.message); }
  };
}

// ---------- Products ----------
async function renderProductsSub() {
  const box = document.getElementById('biz-content');
  box.innerHTML = `<div class="tab-head"><h3 style="margin:0;">Products</h3><button class="btn-primary" id="add-product">+ Add Product</button></div><div id="products-list">Loading…</div>`;
  document.getElementById('add-product').onclick = () => productForm();
  const rows = await api('/products');
  const list = document.getElementById('products-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No products yet — add a cake, cupcake, or biryani to start tracking cost and profit.</div>'; return; }
  list.innerHTML = `<table><tr><th>Product</th><th>Sell Price</th><th>Cost to Make</th><th>Profit/unit</th><th>Margin</th><th></th></tr>
    ${rows.map(p => `<tr>
      <td>${escapeHtml(p.name)}${p.category ? `<br><small>${escapeHtml(p.category)}</small>` : ''}</td>
      <td>${money(p.selling_price)}</td>
      <td>${money(p.cost_to_make)}</td>
      <td style="color:${p.profit_per_unit >= 0 ? '#1F5F55' : '#c0392b'}; font-weight:600;">${money(p.profit_per_unit)}</td>
      <td>${p.margin_percent === null ? '—' : p.margin_percent.toFixed(0) + '%'}</td>
      <td>
        <button class="btn-secondary" data-edit="${p.id}">Edit</button>
        <button class="btn-danger" data-del="${p.id}">Delete</button>
      </td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => {
    const full = await api('/products/' + b.dataset.edit);
    productForm(full);
  });
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this product? Past sales records will stay, but you won\'t be able to log new sales for it.')) return;
    try { await api('/products/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); renderProductsSub(); }
    catch (err) { alert(err.message); }
  });
}

async function productForm(existing) {
  const isEdit = !!existing;
  const allIngredients = await api('/ingredients');
  if (!allIngredients.length && !isEdit) {
    alert('Add at least one ingredient first (Ingredients tab), then come back to build a product from it.');
    return;
  }

  let rows = existing ? existing.ingredients.map(i => ({ ingredient_id: i.ingredient_id, quantity: i.quantity })) : [];
  if (!rows.length) rows = [{ ingredient_id: allIngredients[0]?.id || '', quantity: '' }];

  const overlay = openModal(`
    <h3>${isEdit ? 'Edit' : 'Add'} Product</h3>
    <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. Chocolate Birthday Cake" value="${existing ? escapeAttr(existing.name) : ''}"></div>
    <div class="field"><label>Category</label><input id="f-category" placeholder="e.g. Cake, Cupcake, Biryani" value="${existing ? escapeAttr(existing.category || '') : ''}"></div>
    <div class="field"><label>Selling Price ($)</label><input type="number" step="0.01" id="f-price" value="${existing ? existing.selling_price : ''}"></div>
    <div class="field"><label>Notes</label><textarea id="f-notes">${existing ? escapeHtml(existing.notes || '') : ''}</textarea></div>
    <div class="field">
      <label>Ingredients used (per 1 unit made)</label>
      <div id="ingredient-rows"></div>
      <button type="button" class="btn-secondary" id="add-row" style="margin-top:8px; align-self:flex-start;">+ Add ingredient</button>
    </div>
    <div class="field">
      <label>Estimated cost to make: <span id="cost-preview" style="font-weight:700;">$0.00</span></label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save</button>
    </div>
  `);

  const rowsContainer = overlay.querySelector('#ingredient-rows');

  function ingredientOptions(selectedId) {
    return allIngredients.map(i => `<option value="${i.id}" ${i.id == selectedId ? 'selected' : ''}>${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`).join('');
  }

  function updateCostPreview() {
    let total = 0;
    rowsContainer.querySelectorAll('.ing-row').forEach(rowEl => {
      const select = rowEl.querySelector('.ing-select');
      const qtyInput = rowEl.querySelector('.ing-qty');
      const ing = allIngredients.find(i => i.id == select.value);
      const qty = parseFloat(qtyInput.value) || 0;
      if (ing) total += ing.cost_per_unit * qty;
    });
    overlay.querySelector('#cost-preview').textContent = money(total);
  }

  function drawRows() {
    rowsContainer.innerHTML = rows.map((r, idx) => `
      <div class="ing-row" data-idx="${idx}" style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
        <select class="ing-select" style="flex:2; padding:8px; border-radius:8px; border:1.5px solid var(--border);">${ingredientOptions(r.ingredient_id)}</select>
        <input class="ing-qty" type="number" step="0.01" placeholder="qty" value="${r.quantity}" style="flex:1; padding:8px; border-radius:8px; border:1.5px solid var(--border);">
        <button type="button" class="btn-danger row-remove" style="flex-shrink:0;">✕</button>
      </div>
    `).join('');
    rowsContainer.querySelectorAll('.ing-select, .ing-qty').forEach(inp => inp.addEventListener('input', updateCostPreview));
    rowsContainer.querySelectorAll('.row-remove').forEach(btn => btn.addEventListener('click', (e) => {
      const idx = e.target.closest('.ing-row').dataset.idx;
      rows.splice(idx, 1);
      if (!rows.length) rows = [{ ingredient_id: allIngredients[0]?.id || '', quantity: '' }];
      drawRows();
      updateCostPreview();
    }));
    updateCostPreview();
  }
  drawRows();

  overlay.querySelector('#add-row').onclick = () => {
    rows.push({ ingredient_id: allIngredients[0]?.id || '', quantity: '' });
    drawRows();
  };

  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const ingredientPayload = [];
      rowsContainer.querySelectorAll('.ing-row').forEach(rowEl => {
        const ingredient_id = parseInt(rowEl.querySelector('.ing-select').value, 10);
        const quantity = parseFloat(rowEl.querySelector('.ing-qty').value);
        if (ingredient_id && quantity > 0) ingredientPayload.push({ ingredient_id, quantity });
      });

      const payload = {
        name: overlay.querySelector('#f-name').value,
        category: overlay.querySelector('#f-category').value,
        selling_price: parseFloat(overlay.querySelector('#f-price').value),
        notes: overlay.querySelector('#f-notes').value,
        ingredients: ingredientPayload
      };
      if (isEdit) await api(`/products/${existing.id}`, { method: 'PUT', body: payload });
      else await api('/products', { method: 'POST', body: payload });
      overlay.remove();
      toast('Product saved');
      renderProductsSub();
    } catch (err) { alert(err.message); }
  };
}

// ---------- Sales ----------
async function renderSalesSub() {
  const box = document.getElementById('biz-content');
  box.innerHTML = `<div class="tab-head"><h3 style="margin:0;">Sales &amp; Profit</h3><button class="btn-primary" id="log-sale">+ Log a Sale</button></div><div id="sales-summary"></div><div id="monthly-report" style="margin-top:32px;"></div><div id="sales-list" style="margin-top:24px;">Loading…</div>`;
  document.getElementById('log-sale').onclick = () => saleForm();

  const [summary, rows] = await Promise.all([api('/sales/summary'), api('/sales')]);

  const s = summary.totals;
  document.getElementById('sales-summary').innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:10px;">
      <div class="info-card" style="flex-direction:column; align-items:flex-start;"><small>Total Revenue</small><h3 style="margin:4px 0 0;">${money(s.revenue)}</h3></div>
      <div class="info-card" style="flex-direction:column; align-items:flex-start;"><small>Total Ingredient Cost</small><h3 style="margin:4px 0 0;">${money(s.cost)}</h3></div>
      <div class="info-card" style="flex-direction:column; align-items:flex-start;"><small>Total Profit</small><h3 style="margin:4px 0 0; color:${s.profit >= 0 ? '#1F5F55' : '#c0392b'};">${money(s.profit)}</h3></div>
      <div class="info-card" style="flex-direction:column; align-items:flex-start;"><small>Units Sold</small><h3 style="margin:4px 0 0;">${s.units}</h3></div>
    </div>
    ${summary.byProduct.length ? `<table style="margin-top:10px;"><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th></tr>
      ${summary.byProduct.map(p => `<tr><td>${escapeHtml(p.product_name)}</td><td>${p.units}</td><td>${money(p.revenue)}</td><td style="color:${p.profit>=0?'#1F5F55':'#c0392b'};">${money(p.profit)}</td></tr>`).join('')}
    </table>` : ''}
  `;

  await renderMonthlyReport();

  const list = document.getElementById('sales-list');
  if (!rows.length) { list.innerHTML = '<div class="empty">No sales logged yet.</div>'; return; }
  list.innerHTML = `<h3>All Sales</h3><table><tr><th>Date</th><th>Product</th><th>Qty</th><th>Sale Price</th><th>Profit</th><th></th></tr>
    ${rows.map(r => `<tr>
      <td>${escapeHtml(r.sale_date)}</td>
      <td>${escapeHtml(r.product_name)}</td>
      <td>${r.quantity_sold}</td>
      <td>${money(r.sale_price_per_unit)}</td>
      <td style="color:${r.profit_total>=0?'#1F5F55':'#c0392b'}; font-weight:600;">${money(r.profit_total)}</td>
      <td><button class="btn-danger" data-del="${r.id}">Delete</button></td>
    </tr>`).join('')}
  </table>`;
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this sale record?')) return;
    try { await api('/sales/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); renderSalesSub(); }
    catch (err) { alert(err.message); }
  });
}

async function renderMonthlyReport(selectedYear) {
  const box = document.getElementById('monthly-report');
  const years = await api('/sales/years');
  const year = selectedYear || years[0] || String(new Date().getFullYear());
  const data = await api(`/sales/monthly?year=${year}`);

  box.innerHTML = `
    <div class="tab-head">
      <h3 style="margin:0;">Monthly Report</h3>
      <select id="year-picker" style="padding:8px 12px; border-radius:8px; border:1.5px solid var(--border);">
        ${years.map(y => `<option value="${y}" ${y == year ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>
    <table>
      <tr><th>Month</th><th>Units Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr>
      ${data.months.map(m => `
        <tr style="${m.saleCount === 0 ? 'opacity:.45;' : ''}">
          <td>${m.name}</td>
          <td>${m.units}</td>
          <td>${money(m.revenue)}</td>
          <td>${money(m.cost)}</td>
          <td style="color:${m.profit>=0?'#1F5F55':'#c0392b'}; font-weight:600;">${money(m.profit)}</td>
        </tr>
      `).join('')}
      <tr style="background:#EAF6F1; font-weight:700;">
        <td>Year Total (${year})</td>
        <td>${data.yearTotal.units}</td>
        <td>${money(data.yearTotal.revenue)}</td>
        <td>${money(data.yearTotal.cost)}</td>
        <td style="color:${data.yearTotal.profit>=0?'#1F5F55':'#c0392b'};">${money(data.yearTotal.profit)}</td>
      </tr>
    </table>
  `;
  box.querySelector('#year-picker').addEventListener('change', (e) => renderMonthlyReport(e.target.value));
}

async function saleForm() {
  const products = await api('/products');
  if (!products.length) {
    alert('Add a product first (Products tab), then come back to log a sale.');
    return;
  }
  const overlay = openModal(`
    <h3>Log a Sale</h3>
    <div class="field"><label>Product</label>
      <select id="f-product">${products.map(p => `<option value="${p.id}" data-price="${p.selling_price}">${escapeHtml(p.name)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Quantity Sold</label><input type="number" step="1" id="f-qty" value="1"></div>
    <div class="field"><label>Sale Price per Unit ($)</label><input type="number" step="0.01" id="f-price"></div>
    <div class="field"><label>Date</label><input type="date" id="f-date" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="field"><label>Notes (optional)</label><input id="f-notes" placeholder="e.g. birthday order for the Rahman family"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cancel">Cancel</button>
      <button class="btn-primary" id="save">Save Sale</button>
    </div>
  `);

  const productSelect = overlay.querySelector('#f-product');
  const priceInput = overlay.querySelector('#f-price');
  const fillDefaultPrice = () => {
    const opt = productSelect.options[productSelect.selectedIndex];
    priceInput.value = opt.dataset.price;
  };
  fillDefaultPrice();
  productSelect.addEventListener('change', fillDefaultPrice);

  overlay.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.querySelector('#save').onclick = async () => {
    try {
      const payload = {
        product_id: parseInt(productSelect.value, 10),
        quantity_sold: parseFloat(overlay.querySelector('#f-qty').value),
        sale_price_per_unit: parseFloat(priceInput.value),
        sale_date: overlay.querySelector('#f-date').value,
        notes: overlay.querySelector('#f-notes').value
      };
      await api('/sales', { method: 'POST', body: payload });
      overlay.remove();
      toast('Sale logged');
      renderSalesSub();
    } catch (err) { alert(err.message); }
  };
}

// ================= Shared helpers =================
async function confirmDelete(path, refresh) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try { await api(path, { method: 'DELETE' }); toast('Deleted'); refresh(); }
  catch (err) { alert(err.message); }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str) { return escapeHtml(str); }
