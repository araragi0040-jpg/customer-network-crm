const STORAGE_KEY = "connect-crm-v001";

const priorityMeta = {
  high: { label: "高", className: "high" },
  medium: { label: "中", className: "medium" },
  low: { label: "低", className: "low" }
};

const seedData = {
  contacts: [
    {
      id: "c001",
      name: "田中 美咲",
      metDate: "2026-09-25",
      source: "交流会",
      referrer: "佐藤 健",
      note: "店舗運営。予約管理と顧客管理をもっと楽にしたいと話していた。",
      services: [
        { name: "業務改善・システム構築", priority: "high" },
        { name: "Web制作", priority: "medium" }
      ],
      nextAction: { date: "2026-10-03", text: "現状業務のヒアリングをLINEで打診", done: false },
      updatedAt: "2026-09-29"
    },
    {
      id: "c002",
      name: "佐藤 健",
      metDate: "2026-08-19",
      source: "知人紹介",
      referrer: "",
      note: "経営者コミュニティでつながりが広い。紹介をよくしてくれる。",
      services: [
        { name: "Web制作", priority: "low" }
      ],
      nextAction: { date: "2026-10-11", text: "近況共有を兼ねて食事に誘う", done: false },
      updatedAt: "2026-09-20"
    },
    {
      id: "c003",
      name: "中村 直樹",
      metDate: "2026-09-11",
      source: "SNS",
      referrer: "",
      note: "個人事業主。営業管理が属人的になっているとのこと。",
      services: [
        { name: "顧客管理アプリ", priority: "high" }
      ],
      nextAction: { date: "2026-10-01", text: "CRMモックを見せる", done: false },
      updatedAt: "2026-09-28"
    },
    {
      id: "c004",
      name: "鈴木 彩",
      metDate: "2026-07-03",
      source: "イベント",
      referrer: "田中 美咲",
      note: "イベント企画。サイトは既にあるが更新しにくい。",
      services: [
        { name: "Web制作", priority: "medium" }
      ],
      nextAction: { date: "", text: "", done: false },
      updatedAt: "2026-09-12"
    },
    {
      id: "c005",
      name: "山本 拓海",
      metDate: "2026-09-18",
      source: "仕事",
      referrer: "",
      note: "社内Excel整理の相談可能性あり。",
      services: [
        { name: "業務改善・システム構築", priority: "high" }
      ],
      nextAction: { date: "2026-10-07", text: "Excel運用の困りごとを確認", done: false },
      updatedAt: "2026-09-27"
    }
  ]
};

let state = loadState();
let currentPriorityFilter = "";
let currentActionFilter = "open";
let selectedNetworkContactId = state.contacts[0]?.id || "";
let networkBaseViewBox = { x: 0, y: 0, w: 1000, h: 620 };
let networkCurrentViewBox = { ...networkBaseViewBox };
let networkDragState = null;

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  addContactBtn: document.querySelector("#addContactBtn"),
  dialog: document.querySelector("#contactDialog"),
  contactForm: document.querySelector("#contactForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  contactId: document.querySelector("#contactId"),
  nameInput: document.querySelector("#nameInput"),
  metDateInput: document.querySelector("#metDateInput"),
  sourceInput: document.querySelector("#sourceInput"),
  referrerInput: document.querySelector("#referrerInput"),
  noteInput: document.querySelector("#noteInput"),
  nextActionDateInput: document.querySelector("#nextActionDateInput"),
  nextActionInput: document.querySelector("#nextActionInput"),
  contactNames: document.querySelector("#contactNames"),
  serviceRows: document.querySelector("#serviceRows"),
  serviceTemplate: document.querySelector("#serviceRowTemplate"),
  addServiceRowBtn: document.querySelector("#addServiceRowBtn"),
  deleteContactBtn: document.querySelector("#deleteContactBtn"),
  cancelDialogBtn: document.querySelector("#cancelDialogBtn"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  contactSearch: document.querySelector("#contactSearch"),
  sourceFilter: document.querySelector("#sourceFilter"),
  serviceFilter: document.querySelector("#serviceFilter"),
  prioritySegment: document.querySelector("#prioritySegment"),
  actionSegment: document.querySelector("#actionSegment"),
  networkContactSelect: document.querySelector("#networkContactSelect"),
  networkStats: document.querySelector("#networkStats"),
  networkMapSvg: document.querySelector("#networkMapSvg"),
  networkMapWrap: document.querySelector("#networkMapWrap"),
  networkMapEmpty: document.querySelector("#networkMapEmpty"),
  networkZoomIn: document.querySelector("#networkZoomIn"),
  networkZoomOut: document.querySelector("#networkZoomOut"),
  networkFit: document.querySelector("#networkFit")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("保存データを読み込めませんでした。初期データを使用します。", error);
    }
  }
  return structuredClone(seedData);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(dateString) {
  if (!dateString) return "未設定";
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function safeText(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initial(name) {
  const clean = (name || "?").trim();
  return clean.charAt(0).toUpperCase();
}

function priorityBadge(priority) {
  const meta = priorityMeta[priority] || priorityMeta.medium;
  return `<span class="priority-badge ${meta.className}">${meta.label}</span>`;
}

function contactById(id) {
  return state.contacts.find(c => c.id === id);
}

function contactByName(name) {
  if (!name) return null;
  return state.contacts.find(c => c.name === name) || null;
}

function directChildrenOf(contact) {
  if (!contact) return [];
  return state.contacts.filter(c => c.referrer?.trim() === contact.name);
}

function countDescendants(contact, visited = new Set()) {
  if (!contact || visited.has(contact.id)) return 0;
  visited.add(contact.id);
  const children = directChildrenOf(contact).filter(child => !visited.has(child.id));
  return children.reduce((sum, child) => sum + 1 + countDescendants(child, new Set(visited)), 0);
}

function ancestorChain(contact, maxDepth = 12) {
  const chain = [];
  const visited = new Set([contact?.id].filter(Boolean));
  let current = contact;
  let depth = 0;
  while (current?.referrer && depth < maxDepth) {
    const parent = contactByName(current.referrer);
    if (!parent || visited.has(parent.id)) break;
    chain.unshift(parent);
    visited.add(parent.id);
    current = parent;
    depth += 1;
  }
  return chain;
}

function referralRoot(contact) {
  if (!contact) return null;
  const visited = new Set([contact.id]);
  let current = contact;
  while (current?.referrer) {
    const parent = contactByName(current.referrer);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    current = parent;
  }
  return current;
}

function buildReferralTree(contact, visited = new Set(), depth = 0, maxDepth = 8) {
  if (!contact || visited.has(contact.id) || depth > maxDepth) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(contact.id);
  const children = directChildrenOf(contact)
    .filter(child => !nextVisited.has(child.id))
    .map(child => buildReferralTree(child, nextVisited, depth + 1, maxDepth))
    .filter(Boolean);
  return { contact, children, depth };
}

function treeSize(tree) {
  if (!tree) return 0;
  return 1 + tree.children.reduce((sum, child) => sum + treeSize(child), 0);
}

function leafCount(tree) {
  if (!tree) return 0;
  if (!tree.children.length) return 1;
  return tree.children.reduce((sum, child) => sum + leafCount(child), 0);
}

function depthCounts(tree, counts = [], depth = 0) {
  if (!tree) return counts;
  counts[depth] = (counts[depth] || 0) + 1;
  tree.children.forEach(child => depthCounts(child, counts, depth + 1));
  return counts;
}

function layoutRadialTree(tree, hasExternalParent = false) {
  if (!tree) return [];
  const counts = depthCounts(tree);
  const radii = [0];
  for (let depth = 1; depth < counts.length; depth += 1) {
    const circumferenceRadius = ((counts[depth] || 1) * 195) / (Math.PI * 2) + 55;
    radii[depth] = Math.max((radii[depth - 1] || 0) + 245, circumferenceRadius);
  }

  const positions = [{
    id: tree.contact.id,
    contact: tree.contact,
    x: 0,
    y: 0,
    depth: 0,
    parentId: null
  }];

  function placeChildren(node, parentAngle, startAngle, endAngle, depth) {
    if (!node.children.length) return;
    const totalWeight = node.children.reduce((sum, child) => sum + leafCount(child), 0);
    let cursor = startAngle;

    node.children.forEach((child, index) => {
      const weight = leafCount(child);
      const slice = (endAngle - startAngle) * (weight / totalWeight);
      let angle = cursor + slice / 2;

      // A single branch should continue outward, while multiple branches fan out.
      if (node.children.length === 1 && Number.isFinite(parentAngle)) {
        angle = parentAngle;
      }

      const radius = radii[depth] || depth * 245;
      positions.push({
        id: child.contact.id,
        contact: child.contact,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        depth,
        angle,
        parentId: node.contact.id
      });

      const maxHalfSpan = depth === 1 ? 1.22 : 0.95;
      const naturalHalf = Math.max(0.32, slice * 0.46);
      const halfSpan = Math.min(maxHalfSpan, naturalHalf);
      placeChildren(child, angle, angle - halfSpan, angle + halfSpan, depth + 1);
      cursor += slice;
    });
  }

  // If an unregistered introducer exists, keep some space on the left side for it.
  const start = hasExternalParent ? -2.42 : -Math.PI;
  const end = hasExternalParent ? 2.42 : Math.PI;
  placeChildren(tree, 0, start, end, 1);
  return positions;
}

function applyNetworkViewBox() {
  if (!els.networkMapSvg) return;
  const v = networkCurrentViewBox;
  els.networkMapSvg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function fitNetworkMap() {
  networkCurrentViewBox = { ...networkBaseViewBox };
  applyNetworkViewBox();
}

function zoomNetworkMap(multiplier) {
  const current = networkCurrentViewBox;
  const base = networkBaseViewBox;
  const minW = Math.max(260, base.w * 0.18);
  const maxW = base.w * 3.2;
  const nextW = Math.min(maxW, Math.max(minW, current.w * multiplier));
  const ratio = nextW / current.w;
  const nextH = current.h * ratio;
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  networkCurrentViewBox = {
    x: cx - nextW / 2,
    y: cy - nextH / 2,
    w: nextW,
    h: nextH
  };
  applyNetworkViewBox();
}

function switchView(viewName) {
  els.views.forEach(view => view.classList.toggle("active", view.id === `${viewName}View`));
  els.navItems.forEach(item => item.classList.toggle("active", item.dataset.view === viewName));

  const titles = {
    dashboard: "ホーム",
    contacts: "つながり",
    prospects: "クライアント候補",
    actions: "次回アクション",
    network: "関係マップ"
  };
  els.pageTitle.textContent = titles[viewName] || "Connect CRM";
  renderAll();
}

function renderAll() {
  if (!contactById(selectedNetworkContactId) && state.contacts[0]) {
    selectedNetworkContactId = state.contacts[0].id;
  }
  renderFilters();
  renderMetrics();
  renderDashboard();
  renderContacts();
  renderProspects();
  renderActions();
  renderContactNameList();
  renderNetworkView();
}

function renderFilters() {
  const sources = [...new Set(state.contacts.map(c => c.source).filter(Boolean))].sort();
  const currentSource = els.sourceFilter.value;
  els.sourceFilter.innerHTML = `<option value="">すべての出会い</option>` +
    sources.map(s => `<option value="${safeText(s)}">${safeText(s)}</option>`).join("");
  els.sourceFilter.value = sources.includes(currentSource) ? currentSource : "";

  const services = [...new Set(state.contacts.flatMap(c => c.services || []).map(s => s.name).filter(Boolean))].sort();
  const currentService = els.serviceFilter.value;
  els.serviceFilter.innerHTML = `<option value="">すべてのサービス</option>` +
    services.map(s => `<option value="${safeText(s)}">${safeText(s)}</option>`).join("");
  els.serviceFilter.value = services.includes(currentService) ? currentService : "";
}

function renderMetrics() {
  const highCount = state.contacts.flatMap(c => c.services || []).filter(s => s.priority === "high").length;
  const actionCount = state.contacts.filter(c => c.nextAction?.text && !c.nextAction.done).length;
  const introducedCount = state.contacts.filter(c => c.referrer?.trim()).length;

  document.querySelector("#metricContacts").textContent = state.contacts.length;
  document.querySelector("#metricHigh").textContent = highCount;
  document.querySelector("#metricActions").textContent = actionCount;
  document.querySelector("#metricIntroduced").textContent = introducedCount;
}

function renderDashboard() {
  const upcoming = [...state.contacts]
    .filter(c => c.nextAction?.text && !c.nextAction.done)
    .sort((a, b) => (a.nextAction.date || "9999").localeCompare(b.nextAction.date || "9999"))
    .slice(0, 5);

  document.querySelector("#upcomingActions").innerHTML = upcoming.length
    ? upcoming.map(c => `
      <button class="stack-item clickable-card" data-edit-id="${c.id}" style="border:none;background:transparent;width:100%;text-align:left">
        <span class="person-dot">${safeText(initial(c.name))}</span>
        <span class="stack-main">
          <strong>${safeText(c.nextAction.text)}</strong>
          <span>${safeText(c.name)}</span>
        </span>
        <span class="date-chip">${safeText(formatDate(c.nextAction.date))}</span>
      </button>
    `).join("")
    : `<div class="empty-state">未完了のアクションはありません。</div>`;

  const high = state.contacts.flatMap(contact =>
    (contact.services || [])
      .filter(service => service.priority === "high")
      .map(service => ({ contact, service }))
  ).slice(0, 5);

  document.querySelector("#highPriorityList").innerHTML = high.length
    ? high.map(({ contact, service }) => `
      <button class="stack-item clickable-card" data-map-id="${contact.id}" style="border:none;background:transparent;width:100%;text-align:left">
        <span class="person-dot">${safeText(initial(contact.name))}</span>
        <span class="stack-main">
          <strong>${safeText(contact.name)}</strong>
          <span>${safeText(service.name)}</span>
        </span>
        ${priorityBadge("high")}
      </button>
    `).join("")
    : `<div class="empty-state">高優先度の候補はまだありません。</div>`;

  const recent = [...state.contacts]
    .sort((a, b) => (b.metDate || "").localeCompare(a.metDate || ""))
    .slice(0, 5);

  document.querySelector("#recentContactsTable").innerHTML = recent.length
    ? recent.map(c => `
      <tr class="clickable">
        <td>
          <div class="person-cell">
            <span class="person-dot">${safeText(initial(c.name))}</span>
            <span><strong>${safeText(c.name)}</strong><span>${safeText(c.note || "メモなし")}</span></span>
          </div>
        </td>
        <td>${c.source ? `<span class="source-chip">${safeText(c.source)}</span>` : '<span class="muted">—</span>'}</td>
        <td>${safeText(c.referrer || "—")}</td>
        <td>${safeText(formatDate(c.updatedAt))}</td>
        <td>${safeText(c.nextAction?.text || "—")}</td>
        <td>
          <div class="row-actions">
            <button class="action-link" data-edit-id="${c.id}">編集</button>
            <button class="action-link" data-map-id="${c.id}">マップ</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">まだ人物が登録されていません。</div></td></tr>`;
}

function renderContacts() {
  const q = els.contactSearch.value.trim().toLowerCase();
  const source = els.sourceFilter.value;

  const contacts = state.contacts.filter(c => {
    const searchable = [
      c.name,
      c.source,
      c.referrer,
      c.note,
      ...(c.services || []).map(s => s.name)
    ].join(" ").toLowerCase();

    return (!q || searchable.includes(q)) && (!source || c.source === source);
  });

  document.querySelector("#contactsCountLabel").textContent = `${contacts.length}人`;
  document.querySelector("#contactsTable").innerHTML = contacts.length
    ? contacts.map(c => `
      <tr class="clickable">
        <td>
          <div class="person-cell">
            <span class="person-dot">${safeText(initial(c.name))}</span>
            <span>
              <strong>${safeText(c.name)}</strong>
              <span>${c.metDate ? `${safeText(formatDate(c.metDate))} に接点` : "接点日未設定"}</span>
            </span>
          </div>
        </td>
        <td>${c.source ? `<span class="source-chip">${safeText(c.source)}</span>` : '<span class="muted">—</span>'}</td>
        <td>${safeText(c.referrer || "—")}</td>
        <td>${(c.services || []).length ? c.services.map(s => `<span class="service-chip">${safeText(s.name)} ${priorityBadge(s.priority)}</span>`).join("") : '<span class="muted">—</span>'}</td>
        <td>
          ${c.nextAction?.text
            ? `<strong>${safeText(c.nextAction.text)}</strong><br><span class="muted">${safeText(formatDate(c.nextAction.date))}</span>`
            : '<span class="muted">未設定</span>'}
        </td>
        <td>
          <div class="row-actions">
            <button class="action-link" data-edit-id="${c.id}">編集</button>
            <button class="action-link" data-map-id="${c.id}">マップ</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">条件に合う人物がいません。</div></td></tr>`;
}

function renderProspects() {
  const selectedService = els.serviceFilter.value;

  const prospects = state.contacts.flatMap(contact =>
    (contact.services || []).map(service => ({ contact, service }))
  ).filter(({ service }) => {
    return (!currentPriorityFilter || service.priority === currentPriorityFilter)
      && (!selectedService || service.name === selectedService);
  }).sort((a, b) => {
    const weight = { high: 0, medium: 1, low: 2 };
    return weight[a.service.priority] - weight[b.service.priority];
  });

  document.querySelector("#prospectGrid").innerHTML = prospects.length
    ? prospects.map(({ contact, service }) => `
      <article class="prospect-card">
        <div class="topline">
          <span class="service-chip">${safeText(service.name)}</span>
          ${priorityBadge(service.priority)}
        </div>
        <h3>${safeText(contact.name)}</h3>
        <p>${safeText(contact.note || "人物メモはまだありません。")}</p>
        <div class="meta">
          <div><span class="muted">出会い</span><strong>${safeText(contact.source || "—")}</strong></div>
          <div><span class="muted">紹介元</span><strong>${safeText(contact.referrer || "—")}</strong></div>
          <div><span class="muted">次回</span><strong>${safeText(contact.nextAction?.text || "未設定")}</strong></div>
        </div>
        <div class="row-actions" style="margin-top:14px; justify-content:space-between;">
          <button class="secondary-btn" data-edit-id="${contact.id}" style="flex:1">人物詳細を編集</button>
          <button class="subtle-btn" data-map-id="${contact.id}">マップ</button>
        </div>
      </article>
    `).join("")
    : `<article class="panel" style="grid-column:1/-1"><div class="empty-state">条件に合う候補はありません。</div></article>`;
}

function renderActions() {
  let contacts = state.contacts.filter(c => c.nextAction?.text);

  if (currentActionFilter === "open") {
    contacts = contacts.filter(c => !c.nextAction.done);
  } else if (currentActionFilter === "done") {
    contacts = contacts.filter(c => c.nextAction.done);
  }

  contacts.sort((a, b) => (a.nextAction.date || "9999").localeCompare(b.nextAction.date || "9999"));

  document.querySelector("#actionsCountLabel").textContent = `${contacts.length}件`;
  document.querySelector("#actionsList").innerHTML = contacts.length
    ? contacts.map(c => `
      <div class="action-row ${c.nextAction.done ? "done" : ""}">
        <input class="action-check" type="checkbox" data-action-toggle="${c.id}" ${c.nextAction.done ? "checked" : ""} />
        <div class="action-main">
          <strong>${safeText(c.nextAction.text)}</strong>
          <span>${safeText(c.name)} ・ ${safeText(c.source || "接点不明")}</span>
        </div>
        <div style="text-align:right">
          <div class="date-chip">${safeText(formatDate(c.nextAction.date))}</div>
          <div class="row-actions" style="justify-content:flex-end; margin-top:4px;">
            <button class="action-link" data-edit-id="${c.id}">編集</button>
            <button class="action-link" data-map-id="${c.id}">マップ</button>
          </div>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">表示するアクションはありません。</div>`;
}

function renderContactNameList() {
  els.contactNames.innerHTML = state.contacts
    .map(c => `<option value="${safeText(c.name)}"></option>`)
    .join("");
}

function renderNetworkView() {
  if (!els.networkContactSelect) return;

  if (!state.contacts.length) {
    els.networkContactSelect.innerHTML = "";
    els.networkMapSvg.innerHTML = "";
    els.networkMapEmpty.classList.remove("hidden");
    els.networkStats.innerHTML = "";
    return;
  }

  els.networkMapEmpty.classList.add("hidden");
  els.networkContactSelect.innerHTML = state.contacts
    .map(c => `<option value="${c.id}" ${c.id === selectedNetworkContactId ? "selected" : ""}>${safeText(c.name)}</option>`)
    .join("");

  const focus = contactById(selectedNetworkContactId) || state.contacts[0];
  if (!focus) return;

  const parentChain = ancestorChain(focus);
  const directChildren = directChildrenOf(focus);
  const totalDescendants = countDescendants(focus);
  const root = referralRoot(focus);
  const tree = buildReferralTree(root);
  const visibleCount = treeSize(tree);

  els.networkStats.innerHTML = `
    <span class="stat-chip">紹介元: ${focus.referrer ? safeText(focus.referrer) : "なし"}</span>
    <span class="stat-chip">直接の紹介先: ${directChildren.length}人</span>
    <span class="stat-chip">紹介先合計: ${totalDescendants}人</span>
    <span class="stat-chip">表示ネットワーク: ${visibleCount}人</span>
  `;

  drawNetworkMap(focus, root, tree, parentChain);
}

function drawNetworkMap(focus, root, tree, parentChain) {
  const svg = els.networkMapSvg;
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";

  const externalReferrer = root?.referrer && !contactByName(root.referrer) ? root.referrer : "";
  const positions = layoutRadialTree(tree, Boolean(externalReferrer));
  const positionMap = Object.fromEntries(positions.map(pos => [pos.id, pos]));

  if (externalReferrer) {
    positions.push({
      id: "__external_referrer__",
      contact: { id: "__external_referrer__", name: externalReferrer, source: "未登録の紹介元" },
      x: -285,
      y: 0,
      depth: -1,
      angle: Math.PI,
      parentId: null,
      external: true
    });
  }

  const defs = document.createElementNS(NS, "defs");
  const marker = document.createElementNS(NS, "marker");
  marker.setAttribute("id", "referralArrow");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "3.5");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");
  const markerPath = document.createElementNS(NS, "path");
  markerPath.setAttribute("d", "M0,0 L0,7 L9,3.5 z");
  markerPath.setAttribute("fill", "#74867b");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  function add(el) { svg.appendChild(el); }

  function nodeHalfWidth(pos) {
    if (pos.external) return 84;
    if (pos.id === focus.id) return 92;
    return 84;
  }

  function nodeHalfHeight(pos) {
    if (pos.id === focus.id) return 38;
    return 34;
  }

  function drawArrow(source, target, subtle = false) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const sourcePad = Math.min(nodeHalfWidth(source), 46 + Math.abs(ux) * 38);
    const targetPad = Math.min(nodeHalfWidth(target), 50 + Math.abs(ux) * 38);
    const x1 = source.x + ux * sourcePad;
    const y1 = source.y + uy * Math.min(nodeHalfHeight(source), sourcePad * .55);
    const x2 = target.x - ux * targetPad;
    const y2 = target.y - uy * Math.min(nodeHalfHeight(target), targetPad * .55);

    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", subtle ? "#9ba8a0" : "#74867b");
    line.setAttribute("stroke-width", subtle ? "2" : "2.6");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("marker-end", "url(#referralArrow)");
    if (subtle) line.setAttribute("stroke-dasharray", "5 5");
    add(line);
  }

  // Draw all referral arrows first so nodes sit cleanly above them.
  positions.filter(pos => !pos.external && pos.parentId).forEach(pos => {
    const parent = positionMap[pos.parentId];
    if (parent) drawArrow(parent, pos);
  });

  if (externalReferrer && root) {
    const external = positions.find(pos => pos.external);
    const rootPos = positionMap[root.id];
    if (external && rootPos) drawArrow(external, rootPos, true);
  }

  function makeNode(pos) {
    const { contact } = pos;
    const isSelected = contact.id === focus.id;
    const isRoot = contact.id === root?.id;
    const isExternal = Boolean(pos.external);
    const childrenCount = isExternal ? 0 : directChildrenOf(contact).length;

    const g = document.createElementNS(NS, "g");
    g.classList.add("network-svg-node");
    if (!isExternal) {
      g.dataset.contactId = contact.id;
      g.addEventListener("click", event => {
        event.stopPropagation();
        selectedNetworkContactId = contact.id;
        renderNetworkView();
      });
    }

    const w = isSelected ? 184 : 168;
    const h = isSelected ? 76 : 68;
    const fill = isSelected ? "#1e5b43" : isExternal ? "#f1f3f0" : "#ffffff";
    const stroke = isSelected ? "#1e5b43" : isRoot ? "#718278" : isExternal ? "#b6beb9" : "#d8ded8";
    const strokeWidth = isSelected ? 0 : isRoot ? 2.5 : 1.5;
    const textColor = isSelected ? "#ffffff" : "#263029";
    const metaColor = isSelected ? "#d7e9df" : "#768078";

    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", pos.x - w / 2);
    rect.setAttribute("y", pos.y - h / 2);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("rx", "18");
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", strokeWidth);
    if (isExternal) rect.setAttribute("stroke-dasharray", "5 4");
    g.appendChild(rect);

    const name = document.createElementNS(NS, "text");
    name.setAttribute("x", pos.x);
    name.setAttribute("y", pos.y - 5);
    name.setAttribute("text-anchor", "middle");
    name.setAttribute("font-size", isSelected ? "17" : "14");
    name.setAttribute("font-weight", "800");
    name.setAttribute("fill", textColor);
    name.textContent = contact.name;
    g.appendChild(name);

    const meta = document.createElementNS(NS, "text");
    meta.setAttribute("x", pos.x);
    meta.setAttribute("y", pos.y + 17);
    meta.setAttribute("text-anchor", "middle");
    meta.setAttribute("font-size", "10.5");
    meta.setAttribute("fill", metaColor);
    if (isExternal) {
      meta.textContent = "未登録の紹介元";
    } else if (isSelected) {
      meta.textContent = "選択中";
    } else if (isRoot) {
      meta.textContent = childrenCount ? `起点 ・ 紹介先 ${childrenCount}人` : "ネットワークの起点";
    } else {
      meta.textContent = childrenCount ? `紹介先 ${childrenCount}人` : (contact.source || "紹介先");
    }
    g.appendChild(meta);

    if (isSelected || isRoot) {
      const tag = document.createElementNS(NS, "text");
      tag.setAttribute("x", pos.x);
      tag.setAttribute("y", pos.y - h / 2 - 10);
      tag.setAttribute("text-anchor", "middle");
      tag.setAttribute("font-size", "10");
      tag.setAttribute("font-weight", "800");
      tag.setAttribute("fill", isSelected ? "#1e5b43" : "#6b786f");
      tag.textContent = isSelected ? "SELECTED" : "START";
      g.appendChild(tag);
    }

    add(g);
  }

  positions.forEach(makeNode);

  // A compact title inside the canvas reinforces how to read the graph.
  const title = document.createElementNS(NS, "text");
  const rawXs = positions.map(p => p.x);
  const rawYs = positions.map(p => p.y);
  const minX = Math.min(...rawXs) - 120;
  const minY = Math.min(...rawYs) - 105;
  title.setAttribute("x", minX + 8);
  title.setAttribute("y", minY + 24);
  title.setAttribute("font-size", "12");
  title.setAttribute("font-weight", "700");
  title.setAttribute("fill", "#667168");
  title.textContent = `${focus.name} さんを含む紹介ネットワーク`;
  add(title);

  const margin = 150;
  const maxX = Math.max(...rawXs) + 120;
  const maxY = Math.max(...rawYs) + 95;
  let x = minX - margin;
  let y = minY - margin;
  let w = (maxX - minX) + margin * 2;
  let h = (maxY - minY) + margin * 2;

  // Keep small networks comfortably sized without making nodes enormous.
  if (w < 980) {
    const diff = 980 - w;
    x -= diff / 2;
    w = 980;
  }
  if (h < 620) {
    const diff = 620 - h;
    y -= diff / 2;
    h = 620;
  }

  networkBaseViewBox = { x, y, w, h };
  networkCurrentViewBox = { ...networkBaseViewBox };
  applyNetworkViewBox();
}

function addServiceRow(data = { name: "", priority: "medium" }) {
  const node = els.serviceTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".service-name").value = data.name || "";
  node.querySelector(".service-priority").value = data.priority || "medium";
  node.querySelector(".remove-service-btn").addEventListener("click", () => node.remove());
  els.serviceRows.appendChild(node);
}

function openContactDialog(contactId = null) {
  const contact = contactId ? state.contacts.find(c => c.id === contactId) : null;

  els.contactForm.reset();
  els.serviceRows.innerHTML = "";

  els.contactId.value = contact?.id || "";
  els.dialogTitle.textContent = contact ? contact.name : "人を追加";
  els.nameInput.value = contact?.name || "";
  els.metDateInput.value = contact?.metDate || "";
  els.sourceInput.value = contact?.source || "";
  els.referrerInput.value = contact?.referrer || "";
  els.noteInput.value = contact?.note || "";
  els.nextActionDateInput.value = contact?.nextAction?.date || "";
  els.nextActionInput.value = contact?.nextAction?.text || "";

  if (contact?.services?.length) {
    contact.services.forEach(addServiceRow);
  } else {
    addServiceRow();
  }

  els.deleteContactBtn.classList.toggle("hidden", !contact);
  els.dialog.showModal();
}

function closeContactDialog() {
  if (els.dialog.open) els.dialog.close();
}

function handleSave(event) {
  event.preventDefault();

  const name = els.nameInput.value.trim();
  if (!name) return;

  const services = [...els.serviceRows.querySelectorAll(".service-row")]
    .map(row => ({
      name: row.querySelector(".service-name").value.trim(),
      priority: row.querySelector(".service-priority").value
    }))
    .filter(s => s.name);

  const id = els.contactId.value || `c${Date.now()}`;
  const existing = state.contacts.find(c => c.id === id);

  const payload = {
    id,
    name,
    metDate: els.metDateInput.value,
    source: els.sourceInput.value.trim(),
    referrer: els.referrerInput.value.trim(),
    note: els.noteInput.value.trim(),
    services,
    nextAction: {
      date: els.nextActionDateInput.value,
      text: els.nextActionInput.value.trim(),
      done: existing?.nextAction?.done || false
    },
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.contacts.unshift(payload);
  }

  if (!selectedNetworkContactId) selectedNetworkContactId = id;

  saveState();
  closeContactDialog();
  renderAll();
}

function deleteCurrentContact() {
  const id = els.contactId.value;
  if (!id) return;
  const contact = state.contacts.find(c => c.id === id);
  const ok = confirm(`${contact?.name || "この人物"}を削除しますか？`);
  if (!ok) return;

  state.contacts = state.contacts.filter(c => c.id !== id);
  if (selectedNetworkContactId === id) {
    selectedNetworkContactId = state.contacts[0]?.id || "";
  }
  saveState();
  closeContactDialog();
  renderAll();
}

function openNetworkForContact(contactId) {
  selectedNetworkContactId = contactId;
  switchView("network");
}

document.addEventListener("click", event => {
  const editTarget = event.target.closest("[data-edit-id]");
  if (editTarget) {
    openContactDialog(editTarget.dataset.editId);
    return;
  }

  const mapTarget = event.target.closest("[data-map-id]");
  if (mapTarget) {
    openNetworkForContact(mapTarget.dataset.mapId);
    return;
  }

  const jumpTarget = event.target.closest("[data-jump]");
  if (jumpTarget) {
    switchView(jumpTarget.dataset.jump);
  }
});

els.navItems.forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

els.addContactBtn.addEventListener("click", () => openContactDialog());
els.addServiceRowBtn.addEventListener("click", () => addServiceRow());
els.cancelDialogBtn.addEventListener("click", closeContactDialog);
els.closeDialogBtn.addEventListener("click", closeContactDialog);
els.deleteContactBtn.addEventListener("click", deleteCurrentContact);
els.contactForm.addEventListener("submit", handleSave);
els.contactSearch.addEventListener("input", renderContacts);
els.sourceFilter.addEventListener("change", renderContacts);
els.serviceFilter.addEventListener("change", renderProspects);

if (els.networkContactSelect) {
  els.networkContactSelect.addEventListener("change", event => {
    selectedNetworkContactId = event.target.value;
    renderNetworkView();
  });
}

if (els.networkZoomIn) {
  els.networkZoomIn.addEventListener("click", () => zoomNetworkMap(0.78));
  els.networkZoomOut.addEventListener("click", () => zoomNetworkMap(1.28));
  els.networkFit.addEventListener("click", fitNetworkMap);
}

if (els.networkMapSvg) {
  els.networkMapSvg.addEventListener("wheel", event => {
    event.preventDefault();
    zoomNetworkMap(event.deltaY < 0 ? 0.88 : 1.14);
  }, { passive: false });

  els.networkMapSvg.addEventListener("pointerdown", event => {
    if (event.target.closest?.(".network-svg-node")) return;
    networkDragState = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox: { ...networkCurrentViewBox }
    };
    els.networkMapSvg.setPointerCapture?.(event.pointerId);
    els.networkMapSvg.classList.add("dragging");
  });

  els.networkMapSvg.addEventListener("pointermove", event => {
    if (!networkDragState || networkDragState.pointerId !== event.pointerId) return;
    const rect = els.networkMapSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = event.clientX - networkDragState.clientX;
    const dy = event.clientY - networkDragState.clientY;
    const scaleX = networkDragState.viewBox.w / rect.width;
    const scaleY = networkDragState.viewBox.h / rect.height;
    networkCurrentViewBox = {
      ...networkDragState.viewBox,
      x: networkDragState.viewBox.x - dx * scaleX,
      y: networkDragState.viewBox.y - dy * scaleY
    };
    applyNetworkViewBox();
  });

  const endNetworkDrag = event => {
    if (!networkDragState || networkDragState.pointerId !== event.pointerId) return;
    networkDragState = null;
    els.networkMapSvg.classList.remove("dragging");
  };
  els.networkMapSvg.addEventListener("pointerup", endNetworkDrag);
  els.networkMapSvg.addEventListener("pointercancel", endNetworkDrag);
}

els.prioritySegment.addEventListener("click", event => {
  const button = event.target.closest("[data-priority]");
  if (!button) return;
  currentPriorityFilter = button.dataset.priority;
  els.prioritySegment.querySelectorAll("button").forEach(btn => btn.classList.toggle("active", btn === button));
  renderProspects();
});

els.actionSegment.addEventListener("click", event => {
  const button = event.target.closest("[data-action-filter]");
  if (!button) return;
  currentActionFilter = button.dataset.actionFilter;
  els.actionSegment.querySelectorAll("button").forEach(btn => btn.classList.toggle("active", btn === button));
  renderActions();
});

document.querySelector("#actionsList").addEventListener("change", event => {
  const checkbox = event.target.closest("[data-action-toggle]");
  if (!checkbox) return;
  const contact = state.contacts.find(c => c.id === checkbox.dataset.actionToggle);
  if (!contact?.nextAction) return;

  contact.nextAction.done = checkbox.checked;
  saveState();
  renderAll();
});

renderAll();
