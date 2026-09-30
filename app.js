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
  networkMapEmpty: document.querySelector("#networkMapEmpty")
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

function ancestorChain(contact, maxDepth = 5) {
  const chain = [];
  const visited = new Set();
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

function buildReferralTree(contact, visited = new Set(), depth = 0, maxDepth = 4) {
  if (!contact || visited.has(contact.id) || depth > maxDepth) {
    return null;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(contact.id);
  const children = directChildrenOf(contact)
    .filter(child => !nextVisited.has(child.id))
    .map(child => buildReferralTree(child, nextVisited, depth + 1, maxDepth))
    .filter(Boolean);
  return { contact, children };
}

function leafCount(tree) {
  if (!tree) return 0;
  if (!tree.children.length) return 1;
  return tree.children.reduce((sum, child) => sum + leafCount(child), 0);
}

function layoutTree(tree, xStart, yStart, yEnd, xStep, level = 0, positions = []) {
  if (!tree) return positions;
  const y = (yStart + yEnd) / 2;
  const x = xStart + level * xStep;
  positions.push({ id: tree.contact.id, contact: tree.contact, x, y, type: level === 0 ? "center" : "child" });

  if (!tree.children.length) return positions;

  const totalLeaves = tree.children.reduce((sum, child) => sum + leafCount(child), 0);
  let cursor = yStart;
  tree.children.forEach(child => {
    const childLeaves = leafCount(child);
    const slice = ((yEnd - yStart) * childLeaves) / totalLeaves;
    layoutTree(child, xStart, cursor, cursor + slice, xStep, level + 1, positions);
    cursor += slice;
  });
  return positions;
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
  els.networkStats.innerHTML = `
    <span class="stat-chip">紹介元チェーン: ${parentChain.length}人</span>
    <span class="stat-chip">直接の紹介先: ${directChildren.length}人</span>
    <span class="stat-chip">紹介先合計: ${totalDescendants}人</span>
  `;

  drawNetworkMap(focus, parentChain);
}

function drawNetworkMap(focus, parentChain) {
  const svg = els.networkMapSvg;
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";

  const width = 1000;
  const height = 540;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const center = { x: 410, y: height / 2 };
  const parentStep = parentChain.length > 2 ? 100 : 120;
  const xChildStart = 610;
  const xChildStep = 150;

  const tree = buildReferralTree(focus) || { contact: focus, children: [] };
  const positions = layoutTree(tree, xChildStart, 55, height - 55, xChildStep).filter(node => node.id !== focus.id);
  const positionMap = Object.fromEntries(positions.map(pos => [pos.id, pos]));

  const parentPositions = parentChain.map((contact, index) => ({
    id: contact.id,
    contact,
    x: center.x - (parentChain.length - index) * parentStep,
    y: center.y,
    type: "parent"
  }));

  const allNodeRects = [];

  function add(el) { svg.appendChild(el); }

  function drawLine(x1, y1, x2, y2, color, dash = false) {
    const path = document.createElementNS(NS, "path");
    const midX = (x1 + x2) / 2;
    path.setAttribute("d", `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    if (dash) path.setAttribute("stroke-dasharray", "5 5");
    add(path);
  }

  function makeNode(x, y, contact, role, note = "") {
    const g = document.createElementNS(NS, "g");
    const isCenter = role === "center";
    const w = isCenter ? 170 : 150;
    const h = isCenter ? 72 : 62;
    const rx = 18;
    const colors = role === "center"
      ? { fill: "#1e5b43", text: "#ffffff", meta: "#d8ebe2", stroke: "#1e5b43" }
      : role === "parent"
        ? { fill: "#edf5f0", text: "#27493c", meta: "#5c7267", stroke: "#d1e2d8" }
        : { fill: "#fbf3e5", text: "#714918", meta: "#8d6b41", stroke: "#efdcb7" };

    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x - w / 2);
    rect.setAttribute("y", y - h / 2);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("rx", rx);
    rect.setAttribute("fill", colors.fill);
    rect.setAttribute("stroke", colors.stroke);
    rect.setAttribute("stroke-width", isCenter ? "0" : "1.5");
    g.appendChild(rect);

    const name = document.createElementNS(NS, "text");
    name.setAttribute("x", x);
    name.setAttribute("y", y - 4);
    name.setAttribute("text-anchor", "middle");
    name.setAttribute("font-size", isCenter ? "18" : "15");
    name.setAttribute("font-weight", "800");
    name.setAttribute("fill", colors.text);
    name.textContent = contact.name;
    g.appendChild(name);

    const meta = document.createElementNS(NS, "text");
    meta.setAttribute("x", x);
    meta.setAttribute("y", y + 18);
    meta.setAttribute("text-anchor", "middle");
    meta.setAttribute("font-size", "11");
    meta.setAttribute("fill", colors.meta);
    meta.textContent = note || (contact.source || (role === "parent" ? "紹介元" : "紹介先"));
    g.appendChild(meta);

    add(g);
    allNodeRects.push({ x, y, w, h, role, id: contact.id });
  }

  // background caption
  const caption = document.createElementNS(NS, "text");
  caption.setAttribute("x", 20);
  caption.setAttribute("y", 28);
  caption.setAttribute("font-size", "12");
  caption.setAttribute("fill", "#6a726b");
  caption.textContent = `${focus.name} さんの紹介元と紹介先のつながり`;
  add(caption);

  // draw parent chain lines and nodes
  parentPositions.forEach((pos, index) => {
    const next = index === parentPositions.length - 1 ? center : parentPositions[index + 1];
    drawLine(pos.x + 76, pos.y, next.x - 85, next.y, "#79a18f");
  });

  parentPositions.forEach((pos, index) => {
    const note = index === parentPositions.length - 1 ? "直接の紹介元" : "紹介元";
    makeNode(pos.x, pos.y, pos.contact, "parent", note);
  });

  // draw child lines recursively
  function drawChildConnections(node) {
    if (!node?.children?.length) return;
    const parentPos = node.contact.id === focus.id ? center : positionMap[node.contact.id];
    node.children.forEach(child => {
      const childPos = positionMap[child.contact.id];
      if (parentPos && childPos) {
        const startX = node.contact.id === focus.id ? center.x + 90 : parentPos.x + 76;
        const startY = parentPos.y;
        const endX = childPos.x - 76;
        const endY = childPos.y;
        drawLine(startX, startY, endX, endY, "#d1a158");
      }
      drawChildConnections(child);
    });
  }
  drawChildConnections(tree);

  // center node
  makeNode(center.x, center.y, focus, "center", focus.source || "選択中の人物");

  // child nodes
  positions.forEach(pos => {
    const children = directChildrenOf(pos.contact).length;
    const note = children ? `紹介先 ${children}人` : (pos.contact.source || "紹介先");
    makeNode(pos.x, pos.y, pos.contact, "child", note);
  });

  // helper: if no parent/no child, show hints
  if (!parentChain.length) {
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", 120);
    text.setAttribute("y", center.y - 54);
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#91a097");
    text.textContent = "紹介元の登録はありません";
    add(text);
  }

  if (!positions.length) {
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", 660);
    text.setAttribute("y", center.y - 54);
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#9a8b73");
    text.textContent = "紹介先の登録はありません";
    add(text);
  }
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
