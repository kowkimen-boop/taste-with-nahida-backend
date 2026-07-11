const API = '/api';
let TOKEN = localStorage.getItem('twn_admin_token') || null;
let EMAIL = localStorage.getItem('twn_admin_email') || null;

// ---------------- Auth ----------------
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');

function showApp() {
  loginView.style.display = 'none';
  appView.style.display = 'flex';
  loadTab('recipes');
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

// ---------------- Tabs ----------------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    loadTab(btn.dataset.tab);
  });
});

function loadTab(name) {
  const loaders = { recipes: renderRecipes, reviews: renderReviews, blog: renderBlog,
    gallery: renderGallery, messages: renderMessages, subscribers: renderSubscribers };
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
