/* ChapterOS — vanilla JS, no build step.
   Storage model:
     - Source of truth lives in localStorage (instant, always-on autosave).
     - Optionally "connect" a real .html file on disk; we mirror every autosave
       there too via the File System Access API (Chrome/Edge on localhost/https).
   Each chapter stores rich HTML (contenteditable output). Export converts to
   a single .html or .md document. */

const STORAGE_KEY = 'book-editor:v1';
const $ = (s) => document.querySelector(s);

const els = {
  bookTitle: $('#book-title'),
  bookStats: $('#book-stats'),
  list: $('#chapter-list'),
  addChapter: $('#add-chapter'),
  chapterTitle: $('#chapter-title'),
  titleMeta: $('#title-meta'),
  editor: $('#editor'),
  toolbar: $('#toolbar'),
  saveStatus: $('#save-status'),
  connectDisk: $('#connect-disk'),
  openFile: $('#open-file'),
  fileInput: $('#file-input'),
  exportMd: $('#export-md'),
  exportHtml: $('#export-html'),
  loadDemo: $('#load-demo'),
  toast: $('#toast'),
  linkTip: $('#link-tip'),
  // link modal
  linkModal: $('#link-modal'),
  linkModalTitle: $('#link-modal-title'),
  linkText: $('#link-text'),
  linkUrl: $('#link-url'),
  linkDesc: $('#link-desc'),
  linkSave: $('#link-save'),
  linkCancel: $('#link-cancel'),
  linkRemove: $('#link-remove'),
  btnLink: $('#btn-link'),
  btnUnlink: $('#btn-unlink'),
  // notes / footnotes panel
  btnFootnote: $('#btn-footnote'),
  toggleNotes: $('#toggle-notes'),
  notesChapterName: $('#notes-chapter-name'),
  chapterNote: $('#chapter-note'),
  footnoteList: $('#footnote-list'),
  fnEmpty: $('#fn-empty'),
  fnCount: $('#fn-count'),
  annotationList: $('#annotation-list'),
  linksEmpty: $('#links-empty'),
  linkCount: $('#link-count'),
  // versions
  rightPanel: $('#right-panel'),
  paneAnnotations: $('#pane-annotations'),
  paneVersions: $('#pane-versions'),
  versionList: $('#version-list'),
  versionsEmpty: $('#versions-empty'),
  versionsSub: $('#versions-sub'),
  saveVersionBtn: $('#save-version'),
};
const tabs = document.querySelectorAll('.rp-tab');

/* ---------------- State ---------------- */
let state = loadState();
let activeId = state.chapters[0] ? state.chapters[0].id : null;
let fileHandle = null;       // connected disk file (optional)
let saveTimer = null;
let savedSnapshot = '';      // to detect dirty for disk mirror

function uid() {
  return 'c' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

function migrateChapter(ch) {
  if (!Array.isArray(ch.footnotes)) ch.footnotes = [];
  if (typeof ch.note !== 'string') ch.note = '';
  return ch;
}

function migrateState(s) {
  if (!Array.isArray(s.chapters)) s.chapters = [];
  s.chapters.forEach(migrateChapter);
  if (!Array.isArray(s.versions)) s.versions = [];
  if (typeof s.versionCounter !== 'number') {
    s.versionCounter = s.versions.reduce((m, v) => Math.max(m, v.n || 0), 0);
  }
  return s;
}

// Public-domain demo content (Lewis Carroll, 1865 — Project Gutenberg #11).
// Ships with sample footnotes, annotated links, and a chapter note so a fresh
// install immediately shows off chapters + annotations.
function makeDemoBook() {
  return {
    title: 'Alice’s Adventures in Wonderland',
    chapters: [
      {
        id: 'demo-ch1', title: 'Down the Rabbit-Hole',
        note: 'Sample book loaded by ChapterOS. Try it out: hover a link to read its note, click a [1] marker to jump to its footnote, press ⌘/Ctrl + S to snapshot a version, then ⌘/Ctrl + Z to undo. Delete this note whenever you like.',
        footnotes: [{ id: 'd1f1', text: 'The waistcoat-watch is the story’s first true impossibility — the quiet signal that Alice has crossed from the ordinary world into Wonderland.' }],
        html:
          '<p>Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”</p>' +
          '<p>So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a <a href="https://en.wikipedia.org/wiki/White_Rabbit" title="One of Carroll’s most enduring creations — the waistcoated herald whose hurry lures Alice down the hole.">White Rabbit</a> with pink eyes ran close by her.</p>' +
          '<p>There was nothing so <em>very</em> remarkable in that; nor did Alice think it so <em>very</em> much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually <em>took a watch out of its waistcoat-pocket</em><sup class="footnote-ref" data-fn="d1f1" contenteditable="false">[1]</sup>, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.</p>' +
          '<p>In another moment down went Alice after it, never once considering how in the world she was to get out again.</p>' +
          '<p>The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.</p>',
      },
      {
        id: 'demo-ch2', title: 'The Pool of Tears', note: '',
        footnotes: [{ id: 'd2f1', text: 'Deliberately ungrammatical: Carroll lets Alice mangle her comparatives just as her body — and the logic of the world — stretches out of shape.' }],
        html:
          '<p>“Curiouser and curiouser!”<sup class="footnote-ref" data-fn="d2f1" contenteditable="false">[1]</sup> cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); “now I’m opening out like the largest telescope that ever was! Good-bye, feet!”</p>' +
          '<p>Just then her head struck against the roof of the hall: in fact she was now more than nine feet high, and she at once took up the little golden key and hurried off to the garden door.</p>',
      },
      {
        id: 'demo-ch3', title: 'A Caucus-Race and a Long Tale', note: '',
        footnotes: [{ id: 'd3f1', text: 'The “Long Tale” to come is Carroll’s famous shaped poem, printed in the wiggling form of the Mouse’s tail — a pun on tale / tail.' }],
        html:
          '<p>They were indeed a queer-looking party that assembled on the bank<sup class="footnote-ref" data-fn="d3f1" contenteditable="false">[1]</sup>—the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable.</p>' +
          '<p>The first question of course was, how to get dry again: they had a <a href="https://en.wikipedia.org/wiki/Caucus-race" title="A “Caucus-Race” follows — Carroll’s gentle mockery of political committees: much running in circles, no progress, and prizes for everyone.">consultation</a> about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life.</p>',
      },
    ],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateState(JSON.parse(raw));
  } catch (e) { /* ignore corrupt store */ }
  // fresh install -> seed with the public-domain demo book
  return migrateState(makeDemoBook());
}

/* ---------------- Persistence ---------------- */
function persist() {
  // pull current editor content into state before saving
  syncActiveFromDom();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('⚠ Local storage full — export your book');
  }
  renderStats();
  mirrorToDisk();
  flagSaved();
}

function scheduleSave() {
  flagDirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 600);
}

function flagDirty() {
  els.saveStatus.textContent = 'Saving…';
  els.saveStatus.classList.add('dirty');
}
function flagSaved() {
  els.saveStatus.textContent = fileHandle
    ? 'Saved · mirrored to ' + (fileHandle.name || 'file')
    : 'All changes saved locally';
  els.saveStatus.classList.remove('dirty');
}

/* ---------------- Chapters ---------------- */
function activeChapter() {
  return state.chapters.find((c) => c.id === activeId);
}

function syncActiveFromDom() {
  const ch = activeChapter();
  if (!ch) return;
  ch.html = els.editor.innerHTML;
  ch.title = els.chapterTitle.value.trim() || ch.title;
}

function selectChapter(id) {
  clearTimeout(snapTimer);
  commitSnapshot();           // checkpoint the outgoing chapter
  syncActiveFromDom();
  activeId = id;
  const ch = activeChapter();
  if (!ch) return;
  els.chapterTitle.value = ch.title;
  els.editor.innerHTML = ch.html;
  initHistory(activeId);      // baseline for the incoming chapter
  renderList();
  updateTitleMeta();
  renderNotes();
  els.editor.focus();
}

function addChapter() {
  syncActiveFromDom();
  const n = state.chapters.length + 1;
  const ch = migrateChapter({ id: uid(), title: 'Chapter ' + n, html: '' });
  state.chapters.push(ch);
  activeId = ch.id;
  els.chapterTitle.value = ch.title;
  els.editor.innerHTML = '';
  initHistory(activeId);
  renderList();
  renderNotes();
  persist();
  els.chapterTitle.focus();
  els.chapterTitle.select();
}

function deleteChapter(id) {
  const idx = state.chapters.findIndex((c) => c.id === id);
  if (idx === -1) return;
  if (state.chapters.length === 1) { toast('A book needs at least one chapter'); return; }
  const name = state.chapters[idx].title;
  if (!confirm('Delete “' + name + '”? This cannot be undone.')) return;
  state.chapters.splice(idx, 1);
  if (activeId === id) {
    activeId = state.chapters[Math.max(0, idx - 1)].id;
    selectChapter(activeId);
  }
  renderList();
  persist();
}

function countWords(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const text = (tmp.textContent || '').trim();
  return text ? text.split(/\s+/).length : 0;
}

/* ---------------- Rendering ---------------- */
function renderList() {
  els.list.innerHTML = '';
  state.chapters.forEach((ch, i) => {
    const li = document.createElement('li');
    li.className = 'chapter' + (ch.id === activeId ? ' active' : '');
    li.draggable = true;
    li.dataset.id = ch.id;

    const liveHtml = ch.id === activeId ? els.editor.innerHTML : ch.html;
    li.innerHTML =
      '<span class="grip">⠿</span>' +
      '<span class="name"></span>' +
      '<span class="wc">' + countWords(liveHtml) + 'w</span>' +
      '<button class="row-del" title="Delete chapter">✕</button>';
    li.querySelector('.name').textContent = (i + 1) + '. ' + ch.title;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-del')) return;
      selectChapter(ch.id);
    });
    li.querySelector('.row-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChapter(ch.id);
    });
    attachDrag(li);
    els.list.appendChild(li);
  });
  renderStats();
}

function renderStats() {
  const words = state.chapters.reduce(
    (sum, ch) => sum + countWords(ch.id === activeId ? els.editor.innerHTML : ch.html), 0);
  els.bookStats.textContent =
    state.chapters.length + ' chapter' + (state.chapters.length === 1 ? '' : 's') +
    ' · ' + words.toLocaleString() + ' words';
}

function updateTitleMeta() {
  const w = countWords(els.editor.innerHTML);
  els.titleMeta.textContent = w.toLocaleString() + ' words in this chapter';
}

/* ---------------- Drag reorder ---------------- */
let dragId = null;
function attachDrag(li) {
  li.addEventListener('dragstart', () => { dragId = li.dataset.id; li.classList.add('dragging'); });
  li.addEventListener('dragend', () => { dragId = null; li.classList.remove('dragging');
    els.list.querySelectorAll('.chapter').forEach((n) => n.classList.remove('drag-over')); });
  li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!dragId || dragId === li.dataset.id) return;
    const from = state.chapters.findIndex((c) => c.id === dragId);
    const to = state.chapters.findIndex((c) => c.id === li.dataset.id);
    const [moved] = state.chapters.splice(from, 1);
    state.chapters.splice(to, 0, moved);
    renderList();
    persist();
  });
}

/* ---------------- Formatting toolbar ---------------- */
els.toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tool');
  if (!btn || !btn.dataset.cmd) return;
  const cmd = btn.dataset.cmd;
  if (cmd === 'undo') { undo(); return; }
  if (cmd === 'redo') { redo(); return; }
  els.editor.focus();
  commitSnapshot();                       // capture pre-format state
  if (cmd === 'formatBlock') {
    document.execCommand('formatBlock', false, btn.dataset.val);
  } else {
    document.execCommand(cmd, false, null);
  }
  commitSnapshot();                       // capture post-format state
  refreshToolbarState();
  scheduleSave();
});

function refreshToolbarState() {
  const map = { bold: 'bold', italic: 'italic', underline: 'underline', strikeThrough: 'strikeThrough' };
  document.querySelectorAll('.tool[data-cmd]').forEach((btn) => {
    const cmd = btn.dataset.cmd;
    if (map[cmd]) {
      try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch (e) {}
    }
  });
}
document.addEventListener('selectionchange', () => {
  if (document.activeElement === els.editor) refreshToolbarState();
});

/* ---------------- Link feature (with description) ---------------- */
let savedRange = null;
let editingAnchor = null;

function getSelectionAnchor() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let node = sel.anchorNode;
  while (node && node !== els.editor) {
    if (node.nodeName === 'A') return node;
    node = node.parentNode;
  }
  return null;
}

function openLinkModal() {
  const sel = window.getSelection();
  savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  editingAnchor = getSelectionAnchor();

  if (editingAnchor) {
    els.linkModalTitle.textContent = 'Edit link';
    els.linkText.value = editingAnchor.textContent;
    els.linkUrl.value = editingAnchor.getAttribute('href') || '';
    els.linkDesc.value = editingAnchor.getAttribute('title') || '';
    els.linkRemove.style.display = '';
  } else {
    els.linkModalTitle.textContent = 'Insert link';
    els.linkText.value = savedRange ? savedRange.toString() : '';
    els.linkUrl.value = '';
    els.linkDesc.value = '';
    els.linkRemove.style.display = 'none';
  }
  els.linkModal.classList.add('show');
  (els.linkUrl.value ? els.linkDesc : els.linkUrl).focus();
}

function closeLinkModal() { els.linkModal.classList.remove('show'); }

function applyLink() {
  let url = els.linkUrl.value.trim();
  const text = els.linkText.value.trim();
  const desc = els.linkDesc.value.trim();
  if (!url) { toast('Enter a URL'); els.linkUrl.focus(); return; }
  // friendly: bare domains get https://, in-book/note refs (# or word) left as-is
  if (!/^([a-z]+:|#|\/|mailto:)/i.test(url) && /\./.test(url)) url = 'https://' + url;

  commitSnapshot();                       // pre-link history boundary
  if (editingAnchor) {
    editingAnchor.setAttribute('href', url);
    if (text) editingAnchor.textContent = text;
    if (desc) editingAnchor.setAttribute('title', desc);
    else editingAnchor.removeAttribute('title');
  } else {
    const a = document.createElement('a');
    a.href = url;
    if (desc) a.title = desc;
    a.textContent = text || url;
    els.editor.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
      savedRange.deleteContents();
      savedRange.insertNode(a);
      // place caret after inserted link
      const r = document.createRange();
      r.setStartAfter(a); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    } else {
      els.editor.appendChild(a);
    }
  }
  closeLinkModal();
  renderNotes();
  commitSnapshot();                       // post-link history boundary
  scheduleSave();
}

function removeLink() {
  if (editingAnchor) {
    commitSnapshot();
    const parent = editingAnchor.parentNode;
    while (editingAnchor.firstChild) parent.insertBefore(editingAnchor.firstChild, editingAnchor);
    parent.removeChild(editingAnchor);
    renderNotes();
    commitSnapshot();
    scheduleSave();
  }
  closeLinkModal();
}

els.btnLink.addEventListener('click', openLinkModal);
els.linkSave.addEventListener('click', applyLink);
els.linkCancel.addEventListener('click', closeLinkModal);
els.linkRemove.addEventListener('click', removeLink);
els.linkModal.addEventListener('click', (e) => { if (e.target === els.linkModal) closeLinkModal(); });
els.linkDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyLink(); });
els.linkUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.linkDesc.focus(); });

els.btnUnlink.addEventListener('click', () => {
  els.editor.focus();
  commitSnapshot();
  document.execCommand('unlink', false, null);
  commitSnapshot();
  renderNotes();
  scheduleSave();
});

/* Hover tooltip showing the link's description + url inside the editor */
els.editor.addEventListener('mouseover', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const desc = a.getAttribute('title');
  const href = a.getAttribute('href') || '';
  els.linkTip.innerHTML = (desc ? escapeHtml(desc) : '<i>No description</i>') +
    '<span class="u">' + escapeHtml(href) + '</span>';
  els.linkTip.style.display = 'block';
});
els.editor.addEventListener('mousemove', (e) => {
  if (els.linkTip.style.display === 'block') {
    els.linkTip.style.left = (e.clientX + 14) + 'px';
    els.linkTip.style.top = (e.clientY + 16) + 'px';
  }
});
els.editor.addEventListener('mouseout', (e) => {
  if (e.target.closest('a')) els.linkTip.style.display = 'none';
});
// Cmd/Ctrl+click a link to open it
els.editor.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (a && (e.metaKey || e.ctrlKey)) {
    const href = a.getAttribute('href');
    if (href && /^[a-z]+:/i.test(href)) window.open(href, '_blank');
  }
});

/* ---------------- Footnotes & notes panel ---------------- */
function fnId() { return 'fn' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }

function insertFootnote() {
  const ch = activeChapter();
  if (!ch) return;
  els.editor.focus();
  commitSnapshot();                       // pre-insert history boundary
  const sel = window.getSelection();
  // keep caret inside the editor
  if (!sel.rangeCount || !els.editor.contains(sel.anchorNode)) {
    const r = document.createRange();
    r.selectNodeContents(els.editor); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
  }
  const id = fnId();
  const sup = document.createElement('sup');
  sup.className = 'footnote-ref';
  sup.dataset.fn = id;
  sup.contentEditable = 'false';
  sup.textContent = '[*]';
  const range = sel.getRangeAt(0);
  range.collapse(false);
  range.insertNode(sup);
  // caret after the marker
  const after = document.createRange();
  after.setStartAfter(sup); after.collapse(true);
  sel.removeAllRanges(); sel.addRange(after);

  ch.footnotes.push({ id: id, text: '' });
  renderNotes();
  commitSnapshot();                       // post-insert history boundary
  scheduleSave();
  const ta = els.footnoteList.querySelector('[data-fn-text="' + id + '"]');
  if (ta) ta.focus();
}

// Keep the chapter's footnote array in sync with the markers actually in the prose,
// in document order, and renumber the visible [n] markers.
function reconcileFootnotes() {
  const ch = activeChapter();
  if (!ch) return [];
  const markers = Array.from(els.editor.querySelectorAll('sup.footnote-ref'));
  const order = markers.map((m) => m.dataset.fn);
  const byId = {};
  ch.footnotes.forEach((f) => { byId[f.id] = f; });
  // rebuild in DOM order, dropping orphans (markers the user deleted)
  ch.footnotes = order.map((id) => byId[id] || { id: id, text: '' });
  markers.forEach((m, i) => { m.textContent = '[' + (i + 1) + ']'; });
  return markers;
}

function renderNotes() {
  const ch = activeChapter();
  if (!ch) return;
  const markers = reconcileFootnotes();
  els.notesChapterName.textContent = ch.title;

  // don't rebuild fields the user is currently editing in the panel
  const editingPanel = document.activeElement &&
    document.activeElement.closest && document.activeElement.closest('#right-panel');

  // chapter note
  if (document.activeElement !== els.chapterNote) els.chapterNote.value = ch.note || '';

  // footnotes
  els.fnCount.textContent = ch.footnotes.length;
  els.fnEmpty.style.display = ch.footnotes.length ? 'none' : '';
  if (!editingPanel) {
    els.footnoteList.innerHTML = '';
    ch.footnotes.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'fn-item';
      item.innerHTML =
        '<div class="fn-num" title="Jump to marker in text">' + (i + 1) + '.</div>' +
        '<div class="fn-body"><textarea class="fn-text" data-fn-text="' + f.id +
        '" placeholder="Footnote text…"></textarea></div>' +
        '<button class="fn-del" title="Delete footnote">✕</button>';
      const ta = item.querySelector('.fn-text');
      ta.value = f.text;
      ta.addEventListener('input', () => { f.text = ta.value; scheduleSave(); });
      item.querySelector('.fn-num').addEventListener('click', () => jumpToMarker(f.id));
      item.querySelector('.fn-del').addEventListener('click', () => deleteFootnote(f.id));
      els.footnoteList.appendChild(item);
    });
  }

  // links collected from the prose (with their descriptions)
  const links = Array.from(els.editor.querySelectorAll('a[href]'));
  els.linkCount.textContent = links.length;
  els.linksEmpty.style.display = links.length ? 'none' : '';
  if (!editingPanel) {
    els.annotationList.innerHTML = '';
    links.forEach((a) => {
      const desc = a.getAttribute('title');
      const href = a.getAttribute('href') || '';
      const item = document.createElement('div');
      item.className = 'ann-item';
      item.innerHTML =
        '<div class="ann-text"></div>' +
        (desc ? '<div class="ann-desc"></div>' : '<div class="ann-nodesc">no description</div>') +
        '<div class="ann-url"></div>';
      item.querySelector('.ann-text').textContent = a.textContent;
      if (desc) item.querySelector('.ann-desc').textContent = '“' + desc + '”';
      item.querySelector('.ann-url').textContent = href;
      item.addEventListener('click', () => { a.scrollIntoView({ block: 'center', behavior: 'smooth' });
        flashEl(a); });
      els.annotationList.appendChild(item);
    });
  }
}

function deleteFootnote(id) {
  const ch = activeChapter();
  if (!ch) return;
  commitSnapshot();
  const m = els.editor.querySelector('sup.footnote-ref[data-fn="' + id + '"]');
  if (m) m.remove();
  ch.footnotes = ch.footnotes.filter((f) => f.id !== id);
  renderNotes();
  commitSnapshot();
  scheduleSave();
}

function jumpToMarker(id) {
  const m = els.editor.querySelector('sup.footnote-ref[data-fn="' + id + '"]');
  if (!m) return;
  m.scrollIntoView({ block: 'center', behavior: 'smooth' });
  m.classList.add('fn-active');
  setTimeout(() => m.classList.remove('fn-active'), 1200);
}

function flashEl(el) {
  const old = el.style.backgroundColor;
  el.style.backgroundColor = 'rgba(201,163,104,.4)';
  setTimeout(() => { el.style.backgroundColor = old; }, 900);
}

// click a footnote marker in the prose -> reveal its entry in the panel
els.editor.addEventListener('click', (e) => {
  const sup = e.target.closest('sup.footnote-ref');
  if (!sup) return;
  document.body.classList.remove('notes-hidden');
  const ta = els.footnoteList.querySelector('[data-fn-text="' + sup.dataset.fn + '"]');
  if (ta) { ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); flashEl(ta.closest('.fn-item')); ta.focus(); }
});

els.chapterNote.addEventListener('input', () => {
  const ch = activeChapter();
  if (ch) { ch.note = els.chapterNote.value; scheduleSave(); }
});
els.btnFootnote.addEventListener('click', insertFootnote);
els.toggleNotes.addEventListener('click', () => {
  document.body.classList.toggle('notes-hidden');
  els.toggleNotes.classList.toggle('active', !document.body.classList.contains('notes-hidden'));
});

/* ---------------- Undo / redo history (per chapter) ---------------- */
const undoStacks = new Map();   // chapterId -> { stack: [{html, caret}], index }
let applyingHistory = false;
let snapTimer = null;

function getUndo(id) {
  if (!undoStacks.has(id)) undoStacks.set(id, { stack: [], index: -1 });
  return undoStacks.get(id);
}
function initHistory(id) {
  const u = getUndo(id);
  if (u.stack.length === 0) { u.stack.push({ html: els.editor.innerHTML, caret: null }); u.index = 0; }
}
function caretOffset() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !els.editor.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(els.editor);
  try { pre.setEnd(r.endContainer, r.endOffset); } catch (e) { return null; }
  return pre.toString().length;
}
function setCaretOffset(offset) {
  if (offset == null) return;
  const walker = document.createTreeWalker(els.editor, NodeFilter.SHOW_TEXT, null);
  let remaining = offset, node, last = null;
  while ((node = walker.nextNode())) {
    last = node;
    if (node.textContent.length >= remaining) {
      const sel = window.getSelection();
      const r = document.createRange();
      r.setStart(node, Math.max(0, remaining)); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      return;
    }
    remaining -= node.textContent.length;
  }
  if (last) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(last, last.textContent.length); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  }
}
// Capture current editor state as a history step (deduped against the last one).
function commitSnapshot() {
  if (applyingHistory || !activeId) return;
  const u = getUndo(activeId);
  const html = els.editor.innerHTML;
  if (u.index >= 0 && u.stack[u.index].html === html) { u.stack[u.index].caret = caretOffset(); return; }
  u.stack = u.stack.slice(0, u.index + 1);
  u.stack.push({ html: html, caret: caretOffset() });
  u.index = u.stack.length - 1;
  if (u.stack.length > 250) { u.stack.shift(); u.index--; }
}
function scheduleSnapshot() {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(commitSnapshot, 450);
}
function applySnapshot(s) {
  applyingHistory = true;
  els.editor.innerHTML = s.html;
  setCaretOffset(s.caret);
  applyingHistory = false;
  syncActiveFromDom();
  renderNotes();
  refreshListWordcount();
  updateTitleMeta();
  scheduleSave();
}
function undo() {
  els.editor.focus();
  const u = getUndo(activeId);
  if (u.stack.length === 0) { initHistory(activeId); return; }
  clearTimeout(snapTimer);
  // commit any just-typed (uncaptured) edits so redo can return to them
  if (els.editor.innerHTML !== u.stack[u.index].html) commitSnapshot();
  if (u.index <= 0) { toast('Nothing to undo'); return; }
  u.index--;
  applySnapshot(u.stack[u.index]);
}
function redo() {
  els.editor.focus();
  const u = getUndo(activeId);
  if (u.index >= u.stack.length - 1) { toast('Nothing to redo'); return; }
  u.index++;
  applySnapshot(u.stack[u.index]);
}

/* ---------------- Versions (manual snapshots of the whole book) ---------------- */
function snapshotBook() {
  syncActiveFromDom();
  return {
    title: state.title,
    chapters: state.chapters.map((c) => ({
      id: c.id, title: c.title, html: c.html, note: c.note,
      footnotes: (c.footnotes || []).map((f) => ({ id: f.id, text: f.text })),
    })),
  };
}
function bookSignature(snap) { return JSON.stringify(snap); }
function bookWordCount(snap) { return snap.chapters.reduce((s, c) => s + countWords(c.html), 0); }
function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined,
      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

function createVersion() {
  const snap = snapshotBook();
  const sig = bookSignature(snap);
  const last = state.versions[0];
  if (last && last.sig === sig) { toast('No changes since v' + last.n); return last; }
  state.versionCounter += 1;
  const v = {
    id: uid(), n: state.versionCounter, t: new Date().toISOString(), sig: sig,
    words: bookWordCount(snap), chapterCount: snap.chapters.length,
    title: snap.title, label: '', chapters: snap.chapters,
  };
  state.versions.unshift(v);
  if (state.versions.length > 50) state.versions.length = 50;  // cap: each is a full book copy
  persist();
  renderVersions();
  toast('Saved v' + v.n + ' · ' + v.words.toLocaleString() + ' words');
  return v;
}

function restoreVersion(v) {
  if (!confirm('Restore v' + v.n + (v.label ? ' (' + v.label + ')' : '') +
    '?\nYour current text is saved as a new version first, so this is reversible.')) return;
  createVersion(); // preserve current state (deduped if unchanged)
  state.title = v.title || 'Untitled Book';
  state.chapters = v.chapters.map((c) => migrateChapter({
    id: c.id || uid(), title: c.title, html: c.html, note: c.note,
    footnotes: (c.footnotes || []).map((f) => ({ id: f.id, text: f.text })),
  }));
  activeId = state.chapters[0] ? state.chapters[0].id : null;
  undoStacks.clear();
  els.bookTitle.value = state.title;
  const ch = activeChapter();
  if (ch) { els.chapterTitle.value = ch.title; els.editor.innerHTML = ch.html; }
  if (activeId) initHistory(activeId);
  renderList(); updateTitleMeta(); renderNotes(); renderVersions();
  persist();
  toast('Restored v' + v.n);
}

function deleteVersion(v) {
  if (!confirm('Delete v' + v.n + '? This snapshot will be gone for good.')) return;
  state.versions = state.versions.filter((x) => x.id !== v.id);
  persist();
  renderVersions();
}

function renderVersions() {
  const n = state.versions.length;
  els.versionsEmpty.style.display = n ? 'none' : '';
  els.versionsSub.textContent = n ? (n + ' snapshot' + (n === 1 ? '' : 's')) : 'Snapshots of the whole book';
  const currentSig = bookSignature(snapshotBook());
  els.versionList.innerHTML = '';
  state.versions.forEach((v) => {
    const isCurrent = v.sig === currentSig;
    const item = document.createElement('div');
    item.className = 'ver-item' + (isCurrent ? ' current' : '');
    item.innerHTML =
      '<div class="ver-top"><span class="ver-tag">v' + v.n +
      (isCurrent ? ' <span class="ver-current-badge">current</span>' : '') +
      '</span><span class="ver-time"></span></div>' +
      '<div class="ver-meta"></div>' +
      '<input class="ver-label-input" placeholder="Label this version (optional)…">' +
      '<div class="ver-actions">' +
      '<button class="ver-btn" data-act="restore">Restore</button>' +
      '<button class="ver-btn danger" data-act="delete">Delete</button></div>';
    item.querySelector('.ver-time').textContent = fmtTime(v.t);
    item.querySelector('.ver-meta').textContent =
      v.chapterCount + ' chapter' + (v.chapterCount === 1 ? '' : 's') + ' · ' + (v.words || 0).toLocaleString() + ' words';
    const label = item.querySelector('.ver-label-input');
    label.value = v.label || '';
    label.addEventListener('input', () => { v.label = label.value; scheduleSave(); });
    item.querySelector('[data-act="restore"]').addEventListener('click', () => restoreVersion(v));
    item.querySelector('[data-act="delete"]').addEventListener('click', () => deleteVersion(v));
    els.versionList.appendChild(item);
  });
}

els.saveVersionBtn.addEventListener('click', createVersion);

// Right-panel tab switching
tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((t) => t.classList.toggle('active', t === tab));
  const name = tab.dataset.tab;
  els.paneAnnotations.hidden = name !== 'annotations';
  els.paneVersions.hidden = name !== 'versions';
  if (name === 'versions') renderVersions();
}));

/* ---------------- Editor input wiring ---------------- */
els.editor.addEventListener('input', () => { updateTitleMeta(); scheduleSave(); refreshListWordcount(); renderNotes(); scheduleSnapshot(); });
els.chapterTitle.addEventListener('input', () => {
  const ch = activeChapter();
  if (ch) ch.title = els.chapterTitle.value;
  refreshListTitle();
  scheduleSave();
});
els.bookTitle.addEventListener('input', () => { state.title = els.bookTitle.value; scheduleSave(); });

function refreshListWordcount() {
  const li = els.list.querySelector('.chapter.active .wc');
  if (li) li.textContent = countWords(els.editor.innerHTML) + 'w';
}
function refreshListTitle() {
  const li = els.list.querySelector('.chapter.active .name');
  if (li) {
    const idx = state.chapters.findIndex((c) => c.id === activeId);
    li.textContent = (idx + 1) + '. ' + els.chapterTitle.value;
  }
}

els.addChapter.addEventListener('click', addChapter);

/* Keyboard shortcuts */
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openLinkModal(); }
  if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); insertFootnote(); }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); createVersion(); }
  // Undo / redo — own the stack so programmatic edits stay reversible.
  // Only hijack when editing prose; let inputs/textareas keep native undo.
  const inEditor = document.activeElement === els.editor;
  if (inEditor && mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (inEditor && mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
  if (e.key === 'Escape' && els.linkModal.classList.contains('show')) closeLinkModal();
});

/* ---------------- Markdown / HTML export ---------------- */
function htmlToMarkdown(root, fnMap) {
  fnMap = fnMap || {};
  let out = '';
  const inline = (node) => {
    let s = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { s += n.textContent; return; }
      const tag = n.nodeName.toLowerCase();
      if (tag === 'sup' && n.classList && n.classList.contains('footnote-ref')) {
        s += '[^' + (fnMap[n.dataset.fn] || '?') + ']';
        return;
      }
      const inner = inline(n);
      if (tag === 'strong' || tag === 'b') s += '**' + inner + '**';
      else if (tag === 'em' || tag === 'i') s += '*' + inner + '*';
      else if (tag === 'u') s += '<u>' + inner + '</u>';
      else if (tag === 's' || tag === 'strike' || tag === 'del') s += '~~' + inner + '~~';
      else if (tag === 'a') {
        const href = n.getAttribute('href') || '';
        const title = n.getAttribute('title');
        s += '[' + inner + '](' + href + (title ? ' "' + title.replace(/"/g, '\\"') + '"' : '') + ')';
      }
      else if (tag === 'br') s += '  \n';
      else s += inner;
    });
    return s;
  };
  const block = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.textContent.trim()) out += n.textContent.trim() + '\n\n'; return; }
      const tag = n.nodeName.toLowerCase();
      if (tag === 'h1') out += '# ' + inline(n) + '\n\n';
      else if (tag === 'h2') out += '## ' + inline(n) + '\n\n';
      else if (tag === 'h3') out += '### ' + inline(n) + '\n\n';
      else if (tag === 'blockquote') out += '> ' + inline(n).replace(/\n/g, '\n> ') + '\n\n';
      else if (tag === 'ul') { n.querySelectorAll(':scope > li').forEach((li) => out += '- ' + inline(li) + '\n'); out += '\n'; }
      else if (tag === 'ol') { let i = 1; n.querySelectorAll(':scope > li').forEach((li) => out += (i++) + '. ' + inline(li) + '\n'); out += '\n'; }
      else if (tag === 'hr') out += '---\n\n';
      else if (tag === 'p' || tag === 'div') { const t = inline(n).trim(); if (t) out += t + '\n\n'; }
      else { const t = inline(n).trim(); if (t) out += t + '\n\n'; }
    });
  };
  block(root);
  return out;
}

// Number footnote markers in a temp container in document order; returns id->number.
function footnoteMap(container) {
  const map = {};
  Array.from(container.querySelectorAll('sup.footnote-ref')).forEach((m, i) => { map[m.dataset.fn] = i + 1; });
  return map;
}

function buildMarkdown() {
  syncActiveFromDom();
  let md = '# ' + (state.title || 'Untitled Book') + '\n\n';
  state.chapters.forEach((ch) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = ch.html;
    const map = footnoteMap(tmp);
    md += '## ' + ch.title + '\n\n' + htmlToMarkdown(tmp, map) + '\n';
    // footnote definitions, ordered by appearance
    const ordered = ch.footnotes.filter((f) => map[f.id]).sort((a, b) => map[a.id] - map[b.id]);
    if (ordered.length) {
      ordered.forEach((f) => {
        md += '[^' + map[f.id] + ']: ' + (f.text || '').replace(/\n/g, ' ') + '\n';
      });
      md += '\n';
    }
  });
  return md.trim() + '\n';
}

function buildHtmlDoc() {
  syncActiveFromDom();
  let body = '<h1>' + escapeHtml(state.title || 'Untitled Book') + '</h1>\n';
  state.chapters.forEach((ch) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = ch.html || '';
    const map = footnoteMap(tmp);
    body += '<section>\n<h2>' + escapeHtml(ch.title) + '</h2>\n' + tmp.innerHTML + '\n';
    const ordered = ch.footnotes.filter((f) => map[f.id]).sort((a, b) => map[a.id] - map[b.id]);
    if (ordered.length) {
      body += '<hr>\n<ol class="footnotes">\n';
      ordered.forEach((f) => { body += '<li>' + escapeHtml(f.text || '') + '</li>\n'; });
      body += '</ol>\n';
    }
    body += '</section>\n';
  });
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>' +
    escapeHtml(state.title || 'Untitled Book') +
    '</title>\n<style>body{font-family:Georgia,serif;max-width:740px;margin:40px auto;' +
    'padding:0 20px;line-height:1.75;font-size:18px;color:#2b2722;' +
    'text-align:justify;hyphens:auto;-webkit-hyphens:auto}' +
    'h1,h2,h3{text-align:left;hyphens:none}' +
    'a{color:#8a5a1e}blockquote{border-left:3px solid #c9a368;margin:1em 0;padding:.2em 1.2em;' +
    'font-style:italic;color:#555}section{margin-bottom:3em}' +
    'sup.footnote-ref{color:#8a5a1e;font-weight:700}' +
    'ol.footnotes{font-size:14px;color:#555;line-height:1.6;border-top:0;margin-top:1.5em}' +
    'hr{border:none;border-top:1px solid #ddd;margin:2em 0}</style>\n</head>\n<body>\n' +
    body + '</body>\n</html>\n';
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug() {
  return (state.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book';
}

els.exportMd.addEventListener('click', () => { download(slug() + '.md', buildMarkdown(), 'text/markdown'); toast('Exported Markdown'); });
els.exportHtml.addEventListener('click', () => { download(slug() + '.html', buildHtmlDoc(), 'text/html'); toast('Exported HTML'); });

/* ---------------- Disk auto-save (File System Access API) ---------------- */
async function connectDisk() {
  if (!window.showSaveFilePicker) {
    toast('Disk auto-save needs Chrome/Edge on localhost. Use ↓ export instead.');
    return;
  }
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: slug() + '.html',
      types: [{ description: 'Book', accept: { 'text/html': ['.html'] } }],
    });
    savedSnapshot = '';
    await mirrorToDisk(true);
    els.connectDisk.textContent = '⛁ ' + fileHandle.name;
    flagSaved();
    toast('Auto-saving to ' + fileHandle.name);
  } catch (e) { /* user cancelled */ }
}

async function mirrorToDisk(force) {
  if (!fileHandle) return;
  const doc = buildHtmlDoc();
  if (!force && doc === savedSnapshot) return;
  try {
    const w = await fileHandle.createWritable();
    await w.write(doc);
    await w.close();
    savedSnapshot = doc;
  } catch (e) {
    toast('Could not write to file — permission lost');
    fileHandle = null;
    els.connectDisk.textContent = '⛁ Save to file';
  }
}
els.connectDisk.addEventListener('click', connectDisk);

/* ---------------- Open / import from file ---------------- */
// Open a book file from disk. With the File System Access API we keep the
// handle so an opened .html keeps auto-saving back to the same file.
async function openFile() {
  if (window.showOpenFilePicker) {
    let handle;
    try {
      [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Book', accept: { 'text/html': ['.html', '.htm'], 'text/markdown': ['.md', '.markdown'] } }],
      });
    } catch (e) { return; } // user cancelled
    const file = await handle.getFile();
    const isMd = /\.(md|markdown)$/i.test(file.name);
    const text = await file.text();
    // only an .html handle is a valid mirror target (the mirror writes HTML)
    loadBook(isMd ? parseMarkdownDoc(text) : parseHtmlDoc(text), isMd ? null : handle);
  } else {
    els.fileInput.click();
  }
}

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  const text = await file.text();
  const isMd = /\.(md|markdown)$/i.test(file.name);
  loadBook(isMd ? parseMarkdownDoc(text) : parseHtmlDoc(text), null);
  els.fileInput.value = '';
});

// Replace the current book with a parsed one. The current book is snapshotted
// as a version first, so opening is always reversible.
function loadBook(parsed, handle) {
  if (!parsed || !parsed.chapters.length) { toast('Couldn’t find a book in that file'); return; }
  if (!confirm('Open “' + (parsed.title || 'book') + '” (' + parsed.chapters.length +
    ' chapter' + (parsed.chapters.length === 1 ? '' : 's') + ')?\n' +
    'This replaces your current book. It’s saved as a version first, so you can restore it.')) return;
  createVersion(); // preserve current state (deduped if unchanged)
  state.title = parsed.title || 'Untitled Book';
  state.chapters = parsed.chapters.map(migrateChapter);
  activeId = state.chapters[0] ? state.chapters[0].id : null;
  undoStacks.clear();
  if (handle) {
    fileHandle = handle;
    savedSnapshot = '';
    els.connectDisk.textContent = '⛁ ' + fileHandle.name;
  }
  els.bookTitle.value = state.title;
  const ch = activeChapter();
  if (ch) { els.chapterTitle.value = ch.title; els.editor.innerHTML = ch.html; }
  if (activeId) initHistory(activeId);
  renderList(); updateTitleMeta(); renderNotes(); renderVersions();
  persist();
  toast('Opened ' + (handle ? handle.name : (parsed.title || 'book')));
}

// Reassign fresh ids to every footnote marker in a container, in document
// order, pairing each with its text. Returns the chapter's footnotes array.
function linkFootnotes(container, texts) {
  texts = texts || [];
  return Array.from(container.querySelectorAll('sup.footnote-ref')).map((m, i) => {
    const id = fnId();
    m.dataset.fn = id;
    m.setAttribute('contenteditable', 'false');
    return { id: id, text: texts[i] || '' };
  });
}

/* Parse the editor's own exported HTML (lossless), or fall back to best-effort
   for foreign HTML (whole body becomes one chapter). */
function parseHtmlDoc(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const h1 = doc.body.querySelector('h1');
  const title = ((h1 ? h1.textContent : doc.title) || 'Untitled Book').trim() || 'Untitled Book';
  const sections = Array.from(doc.body.querySelectorAll('section'));
  let chapters;
  if (sections.length) {
    chapters = sections.map(parseSection);
  } else {
    const clone = doc.body.cloneNode(true);
    if (h1 && h1.textContent.trim() === title) { const dup = clone.querySelector('h1'); if (dup) dup.remove(); }
    clone.querySelectorAll('script,style').forEach((n) => n.remove());
    const footnotes = linkFootnotes(clone, []);
    chapters = [migrateChapter({ id: uid(), title: title, html: clone.innerHTML.trim(), note: '', footnotes: footnotes })];
  }
  return { title: title, chapters: chapters };
}

function parseSection(sec) {
  const h2 = sec.querySelector('h2');
  const title = ((h2 ? h2.textContent : 'Chapter').trim()) || 'Chapter';
  const clone = sec.cloneNode(true);
  const ch2 = clone.querySelector('h2'); if (ch2) ch2.remove();
  // pull footnote texts, then strip the footnotes block and its leading <hr>
  const ol = clone.querySelector('ol.footnotes');
  const fnTexts = ol ? Array.from(ol.querySelectorAll(':scope > li')).map((li) => li.textContent.trim()) : [];
  if (ol) {
    const prev = ol.previousElementSibling;
    if (prev && prev.tagName === 'HR') prev.remove();
    ol.remove();
  }
  clone.querySelectorAll('script,style').forEach((n) => n.remove());
  const footnotes = linkFootnotes(clone, fnTexts);
  return migrateChapter({ id: uid(), title: title, html: clone.innerHTML.trim(), note: '', footnotes: footnotes });
}

/* Parse Markdown — the inverse of buildMarkdown(). Best-effort: covers the
   constructs the exporter emits (headings, bold/italic/underline/strike,
   links with titles, lists, blockquotes, rules, footnotes). */
function parseMarkdownDoc(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let title = 'Untitled Book';
  let i = 0;
  for (; i < lines.length; i++) {
    const m = /^#\s+(.*)$/.exec(lines[i]);
    if (m) { title = m[1].trim() || title; i++; break; }
  }
  const chapters = [];
  let cur = null;
  for (; i < lines.length; i++) {
    const m = /^##\s+(.*)$/.exec(lines[i]);
    if (m) { cur = { title: m[1].trim(), lines: [] }; chapters.push(cur); }
    else if (cur) { cur.lines.push(lines[i]); }
    else if (lines[i].trim()) { cur = { title: 'Chapter 1', lines: [lines[i]] }; chapters.push(cur); }
  }
  if (!chapters.length) chapters.push({ title: 'Chapter 1', lines: [] });
  return { title: title, chapters: chapters.map((c) => mdChapter(c.title, c.lines)) };
}

function mdChapter(title, lines) {
  const defs = {};
  const body = [];
  lines.forEach((ln) => {
    const m = /^\[\^([^\]]+)\]:\s?(.*)$/.exec(ln);
    if (m) defs[m[1]] = m[2];
    else body.push(ln);
  });
  const container = document.createElement('div');
  container.innerHTML = mdBlocksToHtml(body.join('\n'));
  // turn [^key] placeholders into real footnote markers, ordered by appearance
  const footnotes = [];
  Array.from(container.querySelectorAll('sup.footnote-ref[data-fnkey]')).forEach((m) => {
    const key = m.getAttribute('data-fnkey');
    const id = fnId();
    m.dataset.fn = id;
    m.removeAttribute('data-fnkey');
    m.setAttribute('contenteditable', 'false');
    m.textContent = '[*]';
    footnotes.push({ id: id, text: defs[key] || '' });
  });
  return migrateChapter({ id: uid(), title: title || 'Chapter', html: container.innerHTML.trim(), note: '', footnotes: footnotes });
}

function mdBlocksToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    let m;
    if (!ln.trim()) { i++; }
    else if ((m = /^###\s+(.*)$/.exec(ln))) { html += '<h3>' + mdInline(m[1]) + '</h3>'; i++; }
    else if ((m = /^##\s+(.*)$/.exec(ln))) { html += '<h2>' + mdInline(m[1]) + '</h2>'; i++; }
    else if ((m = /^#\s+(.*)$/.exec(ln))) { html += '<h1>' + mdInline(m[1]) + '</h1>'; i++; }
    else if (/^(---|\*\*\*|___)\s*$/.test(ln)) { html += '<hr>'; i++; }
    else if (/^>\s?/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      html += '<blockquote>' + mdInline(buf.join(' ')) + '</blockquote>';
    } else if (/^[-*+]\s+/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) { buf.push('<li>' + mdInline(lines[i].replace(/^[-*+]\s+/, '')) + '</li>'); i++; }
      html += '<ul>' + buf.join('') + '</ul>';
    } else if (/^\d+\.\s+/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push('<li>' + mdInline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>'); i++; }
      html += '<ol>' + buf.join('') + '</ol>';
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() &&
        !/^(#{1,3}\s|>\s?|[-*+]\s|\d+\.\s|---\s*$|\*\*\*\s*$|___\s*$)/.test(lines[i])) { buf.push(lines[i]); i++; }
      html += '<p>' + mdInline(buf.join('\n').replace(/\n/g, ' ')) + '</p>';
    }
  }
  return html;
}

function mdInline(s) {
  s = escapeHtml(s);
  // footnote references -> placeholder carrying the source key (resolved later)
  s = s.replace(/\[\^([^\]]+)\]/g, (m, k) => '<sup class="footnote-ref" data-fnkey="' + escapeHtml(k) + '"></sup>');
  // links: [text](url "title") — note title quotes were html-escaped above
  s = s.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([\s\S]*?)&quot;)?\)/g,
    (m, t, u, ti) => '<a href="' + u + '"' + (ti ? ' title="' + ti + '"' : '') + '>' + (t || u) + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\\*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // underline round-trips as a literal <u> tag, now escaped — restore it
  s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>');
  return s;
}

els.openFile.addEventListener('click', openFile);
els.loadDemo.addEventListener('click', () => loadBook(makeDemoBook(), null));

/* ---------------- Misc helpers ---------------- */
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

window.addEventListener('beforeunload', () => { try { syncActiveFromDom(); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} });

/* ---------------- Boot ---------------- */
function boot() {
  els.bookTitle.value = state.title || 'Untitled Book';
  if (!activeId && state.chapters[0]) activeId = state.chapters[0].id;
  const ch = activeChapter();
  if (ch) { els.chapterTitle.value = ch.title; els.editor.innerHTML = ch.html; }
  if (activeId) initHistory(activeId);
  renderList();
  updateTitleMeta();
  renderNotes();
  renderVersions();
  els.toggleNotes.classList.add('active');
  flagSaved();
}
boot();
