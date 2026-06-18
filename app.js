/**
 * Campus Lost & Found Registry
 * Dual flows: Found items (finder) + Lost reports (ticket)
 */

const STORAGE = {
  found: "campus_lost_found_items",
  lost: "campus_lost_found_tickets",
  legacy: "campus_lost_found_items",
};

const CATEGORIES = [
  { value: "keys", label: "Keys" },
  { value: "wallet", label: "Wallet / Cards" },
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "books", label: "Books / Supplies" },
  { value: "jewelry", label: "Jewelry / Accessories" },
  { value: "id", label: "ID / Documents" },
  { value: "other", label: "Other" },
];

const FOUND_STATUS = {
  unclaimed: "Awaiting pickup",
  claimed: "Returned to owner",
};

const LOST_STATUS = {
  open: "Open",
  investigating: "Under review",
  matched: "Possible match found",
  recovered: "Item recovered",
  closed: "Closed",
};

const CONDITION_LABELS = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair / worn",
  damaged: "Damaged",
};

const HANDED_TO_LABELS = {
  security: "Campus security office",
  building_desk: "Building front desk",
  student_union: "Student union / info desk",
  library: "Library circulation",
  other: "Other official desk",
};

const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const CATEGORY_ICONS = {
  keys: "key",
  wallet: "wallet",
  electronics: "laptop",
  clothing: "shirt",
  books: "book-open",
  jewelry: "gem",
  id: "credit-card",
  other: "box",
};

let foundItems = [];
let lostTickets = [];
let currentView = "found";
let viewingRecord = null;
let pendingDelete = null;

const els = {};

function cacheElements() {
  Object.assign(els, {
    pageEyebrow: document.getElementById("pageEyebrow"),
    pageTitle: document.getElementById("pageTitle"),
    heroLead: document.getElementById("heroLead"),
    statsRow: document.getElementById("statsRow"),
    tabFound: document.getElementById("tabFound"),
    tabLost: document.getElementById("tabLost"),
    panelFound: document.getElementById("panelFound"),
    panelLost: document.getElementById("panelLost"),
    btnReportLost: document.getElementById("btnReportLost"),
    btnRegisterFound: document.getElementById("btnRegisterFound"),
    searchFound: document.getElementById("searchFound"),
    searchLost: document.getElementById("searchLost"),
    filterFoundCategory: document.getElementById("filterFoundCategory"),
    filterFoundStatus: document.getElementById("filterFoundStatus"),
    filterFoundLocation: document.getElementById("filterFoundLocation"),
    filterLostCategory: document.getElementById("filterLostCategory"),
    filterLostStatus: document.getElementById("filterLostStatus"),
    filterLostLocation: document.getElementById("filterLostLocation"),
    foundGrid: document.getElementById("foundGrid"),
    lostGrid: document.getElementById("lostGrid"),
    foundEmpty: document.getElementById("foundEmpty"),
    lostEmpty: document.getElementById("lostEmpty"),
    foundResultCount: document.getElementById("foundResultCount"),
    lostResultCount: document.getElementById("lostResultCount"),
    foundModal: document.getElementById("foundModal"),
    foundForm: document.getElementById("foundForm"),
    foundModalTitle: document.getElementById("foundModalTitle"),
    lostModal: document.getElementById("lostModal"),
    lostForm: document.getElementById("lostForm"),
    lostModalTitle: document.getElementById("lostModalTitle"),
    viewModal: document.getElementById("viewModal"),
    viewBody: document.getElementById("viewBody"),
    viewTitle: document.getElementById("viewTitle"),
    viewTypeBadge: document.getElementById("viewTypeBadge"),
    viewAccent: document.getElementById("viewAccent"),
    confirmModal: document.getElementById("confirmModal"),
    confirmMessage: document.getElementById("confirmMessage"),
    toastContainer: document.getElementById("toastContainer"),
  });
}

// --- Utilities ---

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function refreshIcons() {
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function populateCategorySelects() {
  const optionsHtml =
    '<option value="">All categories</option>' +
    CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");

  const requiredHtml =
    '<option value="" disabled selected>Select category</option>' +
    CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join("");

  document.querySelectorAll(".filter-category").forEach((sel) => {
    sel.innerHTML = optionsHtml;
  });
  document.querySelectorAll(".input-category").forEach((sel) => {
    sel.innerHTML = requiredHtml;
  });
}

// --- Storage ---

function loadData() {
  try {
    const rawFound = localStorage.getItem(STORAGE.found);
    foundItems = rawFound ? JSON.parse(rawFound) : [];
    if (!Array.isArray(foundItems)) foundItems = [];
  } catch {
    foundItems = [];
  }

  try {
    const rawLost = localStorage.getItem(STORAGE.lost);
    lostTickets = rawLost ? JSON.parse(rawLost) : [];
    if (!Array.isArray(lostTickets)) lostTickets = [];
  } catch {
    lostTickets = [];
  }

  migrateLegacyRecords();
}

function migrateLegacyRecords() {
  let changed = false;

  foundItems = foundItems.map((item) => {
    const next = {
      ...item,
      condition: item.condition ?? "good",
      handedTo: item.handedTo ?? "building_desk",
      finderName: item.finderName ?? item.loggedBy ?? "Not recorded",
      finderEmail: item.finderEmail ?? "",
      finderPhone: item.finderPhone ?? "",
      deskContact: item.deskContact ?? item.contact ?? "",
      notes: item.notes ?? "",
      timeFound: item.timeFound ?? "",
    };

    if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
    return next;
  });

  if (changed) saveFound();
}

function saveFound() {
  localStorage.setItem(STORAGE.found, JSON.stringify(foundItems));
}

function saveLost() {
  localStorage.setItem(STORAGE.lost, JSON.stringify(lostTickets));
}

function seedSampleData() {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  if (foundItems.length === 0) {
    foundItems = [
      {
        id: generateId("found"),
        title: "Silver key ring with 3 keys",
        category: "keys",
        description: "Three brass keys on a silver ring. No identifying tags attached.",
        condition: "good",
        foundLocation: "Science Building, Room 204 hallway",
        storageLocation: "Science Building Front Desk",
        dateFound: daysAgo(2),
        timeFound: "14:30",
        handedTo: "building_desk",
        finderName: "Alex Morgan",
        finderEmail: "alex.morgan@campus.edu",
        finderPhone: "555-0101",
        deskContact: "science-desk@campus.edu",
        status: "unclaimed",
        notes: "Found under a bench near the lab entrance.",
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 172800000,
      },
      {
        id: generateId("found"),
        title: "Black wireless earbuds case",
        category: "electronics",
        description: "Small black charging case only. Minor scratch on lid.",
        condition: "fair",
        foundLocation: "Student Union, Food Court",
        storageLocation: "Student Union Information Desk",
        dateFound: daysAgo(5),
        timeFound: "12:15",
        handedTo: "student_union",
        finderName: "Jordan Lee",
        finderEmail: "jordan.lee@campus.edu",
        finderPhone: "",
        deskContact: "union-info@campus.edu",
        status: "unclaimed",
        notes: "",
        createdAt: Date.now() - 432000000,
        updatedAt: Date.now() - 432000000,
      },
    ];
    saveFound();
  }

  if (lostTickets.length === 0) {
    lostTickets = [
      {
        id: generateId("lost"),
        title: "MacBook Pro 14-inch in gray sleeve",
        category: "electronics",
        description: "Space gray laptop in a neoprene sleeve with a small tear on the corner.",
        distinctive: "Sticker of campus map on the lid. Charger was not with the bag.",
        lostLocation: "Library, 2nd floor study tables near window",
        building: "Main Library",
        dateLost: daysAgo(1),
        timeLost: "16:45",
        status: "open",
        reporterName: "Sam Rivera",
        studentId: "S204891",
        email: "sam.rivera@campus.edu",
        phone: "555-0182",
        alternateContact: "",
        notes: "Checked with library desk in person already.",
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
      },
      {
        id: generateId("lost"),
        title: "Brown leather wallet",
        category: "wallet",
        description: "Bifold wallet, dark brown, contains campus ID and one credit card.",
        distinctive: "Initials S.R. embossed inside. No cash reported.",
        lostLocation: "Gym locker room area",
        building: "Recreation Center",
        dateLost: daysAgo(3),
        timeLost: "18:00",
        status: "investigating",
        reporterName: "Sam Rivera",
        studentId: "S204891",
        email: "sam.rivera@campus.edu",
        phone: "555-0182",
        alternateContact: "Roommate: 555-0199",
        notes: "",
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 86400000,
      },
    ];
    saveLost();
  }
}

// --- CRUD Found ---

function createFound(data) {
  const now = Date.now();
  const item = { id: generateId("found"), ...data, createdAt: now, updatedAt: now };
  foundItems.unshift(item);
  saveFound();
  return item;
}

function updateFound(id, data) {
  const i = foundItems.findIndex((x) => x.id === id);
  if (i === -1) return null;
  foundItems[i] = { ...foundItems[i], ...data, id, updatedAt: Date.now() };
  saveFound();
  return foundItems[i];
}

function deleteFound(id) {
  const i = foundItems.findIndex((x) => x.id === id);
  if (i === -1) return false;
  foundItems.splice(i, 1);
  saveFound();
  return true;
}

function getFound(id) {
  return foundItems.find((x) => x.id === id) ?? null;
}

// --- CRUD Lost ---

function createLost(data) {
  const now = Date.now();
  const ticket = { id: generateId("lost"), ...data, createdAt: now, updatedAt: now };
  lostTickets.unshift(ticket);
  saveLost();
  return ticket;
}

function updateLost(id, data) {
  const i = lostTickets.findIndex((x) => x.id === id);
  if (i === -1) return null;
  lostTickets[i] = { ...lostTickets[i], ...data, id, updatedAt: Date.now() };
  saveLost();
  return lostTickets[i];
}

function deleteLost(id) {
  const i = lostTickets.findIndex((x) => x.id === id);
  if (i === -1) return false;
  lostTickets.splice(i, 1);
  saveLost();
  return true;
}

function getLost(id) {
  return lostTickets.find((x) => x.id === id) ?? null;
}

// --- View switching ---

function setView(view) {
  currentView = view;
  const isFound = view === "found";

  document.body.dataset.view = view;

  els.tabFound.classList.toggle("is-active", isFound);
  els.tabLost.classList.toggle("is-active", !isFound);
  els.tabFound.setAttribute("aria-selected", String(isFound));
  els.tabLost.setAttribute("aria-selected", String(!isFound));
  els.panelFound.hidden = !isFound;
  els.panelLost.hidden = isFound;

  els.btnRegisterFound.hidden = !isFound;
  els.btnReportLost.hidden = isFound;

  if (isFound) {
    els.pageEyebrow.textContent = "Found items registry";
    els.pageTitle.textContent = "Search everything turned in on campus";
    els.heroLead.textContent =
      "Browse items registered by finders. Add new entries so owners can locate them without visiting every desk.";
  } else {
    els.pageEyebrow.textContent = "Lost item reports";
    els.pageTitle.textContent = "Report and track what you have lost";
    els.heroLead.textContent =
      "Submit a ticket with where and when you last had your item, plus contact details so staff can reach you.";
  }

  renderStats();
  if (isFound) renderFound();
  else renderLost();
  refreshIcons();
}

// --- Stats ---

function renderStats() {
  if (currentView === "found") {
    const unclaimed = foundItems.filter((i) => i.status === "unclaimed").length;
    const claimed = foundItems.filter((i) => i.status === "claimed").length;
    els.statsRow.innerHTML = `
      <div class="stat-pill"><strong>${foundItems.length}</strong><span>Total</span></div>
      <div class="stat-pill"><strong>${unclaimed}</strong><span>Awaiting pickup</span></div>
      <div class="stat-pill"><strong>${claimed}</strong><span>Returned</span></div>
    `;
  } else {
    const open = lostTickets.filter((t) => t.status === "open" || t.status === "investigating").length;
    const resolved = lostTickets.filter((t) => t.status === "recovered" || t.status === "closed").length;
    els.statsRow.innerHTML = `
      <div class="stat-pill"><strong>${lostTickets.length}</strong><span>Reports</span></div>
      <div class="stat-pill"><strong>${open}</strong><span>Active</span></div>
      <div class="stat-pill"><strong>${resolved}</strong><span>Resolved</span></div>
    `;
  }
}

// --- Filtering ---

function getFilteredFound() {
  const q = els.searchFound.value.trim().toLowerCase();
  const cat = els.filterFoundCategory.value;
  const status = els.filterFoundStatus.value;
  const loc = els.filterFoundLocation.value;

  return foundItems.filter((item) => {
    if (cat && item.category !== cat) return false;
    if (status && item.status !== status) return false;
    if (loc && item.storageLocation !== loc) return false;
    if (!q) return true;
    const hay = [
      item.title,
      item.description,
      item.foundLocation,
      item.storageLocation,
      item.finderName,
      item.finderEmail,
      item.notes,
      categoryLabel(item.category),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function getFilteredLost() {
  const q = els.searchLost.value.trim().toLowerCase();
  const cat = els.filterLostCategory.value;
  const status = els.filterLostStatus.value;
  const loc = els.filterLostLocation.value;

  return lostTickets.filter((ticket) => {
    if (cat && ticket.category !== cat) return false;
    if (status && ticket.status !== status) return false;
    if (loc && ticket.lostLocation !== loc) return false;
    if (!q) return true;
    const hay = [
      ticket.title,
      ticket.description,
      ticket.distinctive,
      ticket.lostLocation,
      ticket.building,
      ticket.reporterName,
      ticket.studentId,
      ticket.email,
      categoryLabel(ticket.category),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function updateFoundLocationFilter() {
  const locs = [...new Set(foundItems.map((i) => i.storageLocation).filter(Boolean))].sort();
  const cur = els.filterFoundLocation.value;
  els.filterFoundLocation.innerHTML = '<option value="">All desks</option>';
  locs.forEach((l) => {
    const o = document.createElement("option");
    o.value = l;
    o.textContent = l;
    els.filterFoundLocation.appendChild(o);
  });
  if (locs.includes(cur)) els.filterFoundLocation.value = cur;
}

function updateLostLocationFilter() {
  const locs = [...new Set(lostTickets.map((t) => t.lostLocation).filter(Boolean))].sort();
  const cur = els.filterLostLocation.value;
  els.filterLostLocation.innerHTML = '<option value="">All locations</option>';
  locs.forEach((l) => {
    const o = document.createElement("option");
    o.value = l;
    o.textContent = l;
    els.filterLostLocation.appendChild(o);
  });
  if (locs.includes(cur)) els.filterLostLocation.value = cur;
}

// --- Card rendering ---

function statusBadgeFound(status) {
  const claimed = status === "claimed";
  return {
    class: claimed ? "status-claimed" : "status-unclaimed",
    icon: claimed ? "check-circle" : "clock",
    label: FOUND_STATUS[status] ?? status,
  };
}

function statusBadgeLost(status) {
  const map = {
    open: { class: "status-open", icon: "circle-dot" },
    investigating: { class: "status-review", icon: "search" },
    matched: { class: "status-matched", icon: "link" },
    recovered: { class: "status-recovered", icon: "check-circle" },
    closed: { class: "status-closed", icon: "archive" },
  };
  const s = map[status] ?? map.open;
  return { ...s, label: LOST_STATUS[status] ?? status };
}

function categoryIcon(cat) {
  return CATEGORY_ICONS[cat] ?? "box";
}

function bindCardEvents(card, type, id) {
  card.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    openView(type, id);
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openView(type, id);
    }
  });
  card.querySelector(".btn-view").addEventListener("click", (e) => {
    e.stopPropagation();
    openView(type, id);
  });
  card.querySelector(".btn-edit").addEventListener("click", (e) => {
    e.stopPropagation();
    if (type === "found") openFoundEdit(id);
    else openLostEdit(id);
  });
}

function renderFound() {
  const filtered = getFilteredFound();
  renderStats();
  updateFoundLocationFilter();

  els.foundResultCount.textContent =
    filtered.length === 1 ? "1 item" : `${filtered.length} items`;

  els.foundGrid.innerHTML = "";

  if (filtered.length === 0) {
    const empty = foundItems.length === 0;
    els.foundEmpty.querySelector("h3").textContent = empty
      ? "No found items yet"
      : "No items match your search";
    els.foundEmpty.querySelector("p").textContent = empty
      ? "If you found something on campus, register it with full details so the owner can find it here."
      : "Try adjusting filters or register a new found item.";
    els.foundEmpty.hidden = false;
    refreshIcons();
    return;
  }

  els.foundEmpty.hidden = true;

  filtered.forEach((item, index) => {
    const badge = statusBadgeFound(item.status);
    const icon = categoryIcon(item.category);
    const card = document.createElement("article");
    card.className = "record-card card-found";
    card.setAttribute("role", "listitem");
    card.tabIndex = 0;
    card.style.animationDelay = `${index * 40}ms`;

    const timePart = item.timeFound ? ` · ${formatTime(item.timeFound)}` : "";

    card.innerHTML = `
      <div class="record-card-top">
        <div class="record-icon"><i data-lucide="${icon}"></i></div>
        <div class="record-card-top-right">
          <span class="status-badge ${badge.class}"><i data-lucide="${badge.icon}"></i>${escapeHtml(badge.label)}</span>
          <span class="cat-label">${escapeHtml(categoryLabel(item.category))}</span>
        </div>
      </div>
      <div class="record-card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="record-desc">${escapeHtml(item.description)}</p>
      </div>
      <div class="record-meta">
        <span class="meta-chip"><i data-lucide="map-pin"></i>${escapeHtml(item.foundLocation)}</span>
        <span class="meta-chip"><i data-lucide="building-2"></i>${escapeHtml(item.storageLocation)}</span>
        <span class="meta-chip"><i data-lucide="calendar"></i>${formatDate(item.dateFound)}${timePart}</span>
      </div>
      <div class="record-card-foot">
        <button type="button" class="btn-card btn-view">View</button>
        <button type="button" class="btn-card btn-card-primary btn-edit">Edit</button>
      </div>
    `;

    bindCardEvents(card, "found", item.id);
    els.foundGrid.appendChild(card);
  });
  refreshIcons();
}

function renderLost() {
  const filtered = getFilteredLost();
  renderStats();
  updateLostLocationFilter();

  els.lostResultCount.textContent =
    filtered.length === 1 ? "1 ticket" : `${filtered.length} tickets`;

  els.lostGrid.innerHTML = "";

  if (filtered.length === 0) {
    const empty = lostTickets.length === 0;
    els.lostEmpty.querySelector("h3").textContent = empty
      ? "No lost reports yet"
      : "No tickets match your search";
    els.lostEmpty.querySelector("p").textContent = empty
      ? "Lost something? Submit a ticket with where and when you last had it, plus your contact details."
      : "Try adjusting filters or submit a new lost item report.";
    els.lostEmpty.hidden = false;
    refreshIcons();
    return;
  }

  els.lostEmpty.hidden = true;

  filtered.forEach((ticket, index) => {
    const badge = statusBadgeLost(ticket.status);
    const icon = categoryIcon(ticket.category);
    const card = document.createElement("article");
    card.className = "record-card card-lost";
    card.setAttribute("role", "listitem");
    card.tabIndex = 0;
    card.style.animationDelay = `${index * 40}ms`;

    const timePart = ticket.timeLost ? ` · ${formatTime(ticket.timeLost)}` : "";

    card.innerHTML = `
      <div class="record-card-top">
        <div class="record-icon"><i data-lucide="${icon}"></i></div>
        <div class="record-card-top-right">
          <span class="status-badge ${badge.class}"><i data-lucide="${badge.icon}"></i>${escapeHtml(badge.label)}</span>
          <span class="cat-label">${escapeHtml(categoryLabel(ticket.category))}</span>
        </div>
      </div>
      <div class="record-card-body">
        <h3>${escapeHtml(ticket.title)}</h3>
        <p class="record-desc">${escapeHtml(ticket.description)}</p>
      </div>
      <div class="record-meta">
        <span class="meta-chip"><i data-lucide="map-pin"></i>${escapeHtml(ticket.lostLocation)}</span>
        <span class="meta-chip"><i data-lucide="calendar"></i>${formatDate(ticket.dateLost)}${timePart}</span>
        <span class="meta-chip"><i data-lucide="user"></i>${escapeHtml(ticket.reporterName)}</span>
      </div>
      <div class="record-card-foot">
        <button type="button" class="btn-card btn-view">View</button>
        <button type="button" class="btn-card btn-card-primary btn-edit">Edit</button>
      </div>
    `;

    bindCardEvents(card, "lost", ticket.id);
    els.lostGrid.appendChild(card);
  });
  refreshIcons();
}

// --- Found form ---

function openFoundCreate() {
  els.foundModalTitle.textContent = "Register found item";
  els.foundForm.reset();
  document.getElementById("foundId").value = "";
  document.getElementById("foundDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("foundStatus").value = "unclaimed";
  document.getElementById("foundCondition").value = "good";
  els.foundModal.showModal();
  document.getElementById("foundTitle").focus();
  refreshIcons();
}

function openFoundEdit(id) {
  const item = getFound(id);
  if (!item) return showToast("Item not found.", "error");

  els.viewModal.close();
  els.foundModalTitle.textContent = "Edit found item";
  document.getElementById("foundId").value = item.id;
  document.getElementById("foundTitle").value = item.title;
  document.getElementById("foundCategory").value = item.category;
  document.getElementById("foundDescription").value = item.description;
  document.getElementById("foundCondition").value = item.condition ?? "good";
  document.getElementById("foundStatus").value = item.status;
  document.getElementById("foundLocation").value = item.foundLocation;
  document.getElementById("foundStorage").value = item.storageLocation;
  document.getElementById("foundDate").value = item.dateFound;
  document.getElementById("foundTime").value = item.timeFound ?? "";
  document.getElementById("foundHandedTo").value = item.handedTo ?? "building_desk";
  document.getElementById("foundFinderName").value = item.finderName ?? "";
  document.getElementById("foundFinderEmail").value = item.finderEmail ?? "";
  document.getElementById("foundFinderPhone").value = item.finderPhone ?? "";
  document.getElementById("foundDeskContact").value = item.deskContact ?? "";
  document.getElementById("foundNotes").value = item.notes ?? "";
  els.foundModal.showModal();
  refreshIcons();
}

function getFoundFormData() {
  return {
    title: document.getElementById("foundTitle").value.trim(),
    category: document.getElementById("foundCategory").value,
    description: document.getElementById("foundDescription").value.trim(),
    condition: document.getElementById("foundCondition").value,
    status: document.getElementById("foundStatus").value,
    foundLocation: document.getElementById("foundLocation").value.trim(),
    storageLocation: document.getElementById("foundStorage").value.trim(),
    dateFound: document.getElementById("foundDate").value,
    timeFound: document.getElementById("foundTime").value,
    handedTo: document.getElementById("foundHandedTo").value,
    finderName: document.getElementById("foundFinderName").value.trim(),
    finderEmail: document.getElementById("foundFinderEmail").value.trim(),
    finderPhone: document.getElementById("foundFinderPhone").value.trim(),
    deskContact: document.getElementById("foundDeskContact").value.trim(),
    notes: document.getElementById("foundNotes").value.trim(),
  };
}

function handleFoundSubmit(e) {
  e.preventDefault();
  const data = getFoundFormData();
  const id = document.getElementById("foundId").value;

  if (id) {
    updateFound(id, data);
    showToast("Found item updated.", "success");
  } else {
    createFound(data);
    showToast("Found item registered.", "success");
  }

  els.foundModal.close();
  renderFound();
}

// --- Lost form ---

function openLostCreate() {
  els.lostModalTitle.textContent = "Report lost item";
  els.lostForm.reset();
  document.getElementById("lostId").value = "";
  document.getElementById("lostDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("lostStatus").value = "open";
  els.lostModal.showModal();
  document.getElementById("lostTitle").focus();
  refreshIcons();
}

function openLostEdit(id) {
  const ticket = getLost(id);
  if (!ticket) return showToast("Ticket not found.", "error");

  els.viewModal.close();
  els.lostModalTitle.textContent = "Edit lost report";
  document.getElementById("lostId").value = ticket.id;
  document.getElementById("lostTitle").value = ticket.title;
  document.getElementById("lostCategory").value = ticket.category;
  document.getElementById("lostDescription").value = ticket.description;
  document.getElementById("lostDistinctive").value = ticket.distinctive ?? "";
  document.getElementById("lostLocation").value = ticket.lostLocation;
  document.getElementById("lostBuilding").value = ticket.building ?? "";
  document.getElementById("lostDate").value = ticket.dateLost;
  document.getElementById("lostTime").value = ticket.timeLost ?? "";
  document.getElementById("lostStatus").value = ticket.status;
  document.getElementById("lostReporterName").value = ticket.reporterName;
  document.getElementById("lostStudentId").value = ticket.studentId;
  document.getElementById("lostEmail").value = ticket.email;
  document.getElementById("lostPhone").value = ticket.phone;
  document.getElementById("lostAlternate").value = ticket.alternateContact ?? "";
  document.getElementById("lostNotes").value = ticket.notes ?? "";
  els.lostModal.showModal();
  refreshIcons();
}

function getLostFormData() {
  return {
    title: document.getElementById("lostTitle").value.trim(),
    category: document.getElementById("lostCategory").value,
    description: document.getElementById("lostDescription").value.trim(),
    distinctive: document.getElementById("lostDistinctive").value.trim(),
    lostLocation: document.getElementById("lostLocation").value.trim(),
    building: document.getElementById("lostBuilding").value.trim(),
    dateLost: document.getElementById("lostDate").value,
    timeLost: document.getElementById("lostTime").value,
    status: document.getElementById("lostStatus").value,
    reporterName: document.getElementById("lostReporterName").value.trim(),
    studentId: document.getElementById("lostStudentId").value.trim(),
    email: document.getElementById("lostEmail").value.trim(),
    phone: document.getElementById("lostPhone").value.trim(),
    alternateContact: document.getElementById("lostAlternate").value.trim(),
    notes: document.getElementById("lostNotes").value.trim(),
  };
}

function handleLostSubmit(e) {
  e.preventDefault();
  const data = getLostFormData();
  const id = document.getElementById("lostId").value;

  if (id) {
    updateLost(id, data);
    showToast("Lost report updated.", "success");
  } else {
    createLost(data);
    showToast("Lost report submitted.", "success");
  }

  els.lostModal.close();
  renderLost();
}

// --- View modal ---

function detailBlock(label, value, muted = false) {
  return `<div class="detail-block"><dt>${escapeHtml(label)}</dt><dd class="${muted ? "muted" : ""}">${value}</dd></div>`;
}

function openView(type, id) {
  viewingRecord = { type, id };

  if (type === "found") {
    const item = getFound(id);
    if (!item) return showToast("Item not found.", "error");
    const badge = statusBadgeFound(item.status);

    els.viewModal.classList.remove("lost-view");
    els.viewTypeBadge.className = "type-label found";
    els.viewTypeBadge.innerHTML = `<i data-lucide="package"></i> Found item`;
    els.viewTitle.textContent = item.title;

    const timePart = item.timeFound ? ` at ${formatTime(item.timeFound)}` : "";

    els.viewBody.innerHTML = `
      <div class="view-status-row">
        <span class="status-badge ${badge.class}"><i data-lucide="${badge.icon}"></i>${escapeHtml(badge.label)}</span>
      </div>
      <div class="detail-grid">
        ${detailBlock("Category", escapeHtml(categoryLabel(item.category)))}
        ${detailBlock("Description", escapeHtml(item.description), true)}
        ${detailBlock("Condition", escapeHtml(CONDITION_LABELS[item.condition] ?? item.condition))}
        ${detailBlock("Where found", escapeHtml(item.foundLocation))}
        ${detailBlock("Pickup desk", escapeHtml(item.storageLocation))}
        ${detailBlock("Left at", escapeHtml(HANDED_TO_LABELS[item.handedTo] ?? item.handedTo))}
        ${detailBlock("Date found", escapeHtml(formatDate(item.dateFound) + timePart))}
        ${detailBlock("Finder", escapeHtml(item.finderName))}
        ${detailBlock("Email", `<a href="mailto:${escapeHtml(item.finderEmail)}">${escapeHtml(item.finderEmail)}</a>`)}
        ${detailBlock("Phone", escapeHtml(item.finderPhone || "—"))}
        ${detailBlock("Desk contact", escapeHtml(item.deskContact))}
        ${item.notes ? detailBlock("Notes", escapeHtml(item.notes), true) : ""}
        ${detailBlock("Registry ID", `<code class="registry-id">${escapeHtml(item.id)}</code>`)}
      </div>
    `;
  } else {
    const ticket = getLost(id);
    if (!ticket) return showToast("Ticket not found.", "error");
    const badge = statusBadgeLost(ticket.status);

    els.viewModal.classList.add("lost-view");
    els.viewTypeBadge.className = "type-label lost";
    els.viewTypeBadge.innerHTML = `<i data-lucide="ticket"></i> Lost report`;
    els.viewTitle.textContent = ticket.title;

    const timePart = ticket.timeLost ? ` at ${formatTime(ticket.timeLost)}` : "";

    els.viewBody.innerHTML = `
      <div class="view-status-row">
        <span class="status-badge ${badge.class}"><i data-lucide="${badge.icon}"></i>${escapeHtml(badge.label)}</span>
      </div>
      <div class="detail-grid">
        ${detailBlock("Category", escapeHtml(categoryLabel(ticket.category)))}
        ${detailBlock("Description", escapeHtml(ticket.description), true)}
        ${ticket.distinctive ? detailBlock("Distinctive features", escapeHtml(ticket.distinctive), true) : ""}
        ${detailBlock("Last seen", escapeHtml(ticket.lostLocation))}
        ${ticket.building ? detailBlock("Building", escapeHtml(ticket.building)) : ""}
        ${detailBlock("Date last seen", escapeHtml(formatDate(ticket.dateLost) + timePart))}
        ${detailBlock("Reporter", escapeHtml(ticket.reporterName))}
        ${detailBlock("Campus ID", escapeHtml(ticket.studentId))}
        ${detailBlock("Email", `<a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a>`)}
        ${detailBlock("Phone", escapeHtml(ticket.phone))}
        ${detailBlock("Alternate contact", escapeHtml(ticket.alternateContact || "—"))}
        ${ticket.notes ? detailBlock("Notes", escapeHtml(ticket.notes), true) : ""}
        ${detailBlock("Ticket ID", `<code class="registry-id">${escapeHtml(ticket.id)}</code>`)}
      </div>
    `;
  }

  els.viewModal.showModal();
  refreshIcons();
}

// --- Delete ---

function openDeleteConfirm() {
  if (!viewingRecord) return;
  const { type, id } = viewingRecord;
  pendingDelete = viewingRecord;

  els.confirmMessage.textContent =
    type === "found"
      ? "This found item will be permanently removed from the registry."
      : "This lost report ticket will be permanently removed.";

  els.confirmModal.showModal();
  refreshIcons();
}

function handleConfirmDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  let ok = false;

  if (type === "found") ok = deleteFound(id);
  else ok = deleteLost(id);

  pendingDelete = null;
  viewingRecord = null;
  els.confirmModal.close();
  els.viewModal.close();

  if (ok) {
    showToast(type === "found" ? "Found item deleted." : "Lost report deleted.", "info");
    if (type === "found") renderFound();
    else renderLost();
  } else {
    showToast("Could not delete record.", "error");
  }
}

// --- Toast ---

function showToast(message, type = "info") {
  const icons = { success: "check-circle", error: "alert-circle", info: "info" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<i data-lucide="${icons[type] ?? "info"}"></i><span>${escapeHtml(message)}</span>`;
  els.toastContainer.appendChild(toast);
  refreshIcons();
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// --- Events ---

function initEvents() {
  els.tabFound.addEventListener("click", () => setView("found"));
  els.tabLost.addEventListener("click", () => setView("lost"));

  els.btnRegisterFound.addEventListener("click", openFoundCreate);
  els.btnReportLost.addEventListener("click", openLostCreate);
  document.getElementById("btnAddFoundEmpty").addEventListener("click", openFoundCreate);
  document.getElementById("btnAddLostEmpty").addEventListener("click", openLostCreate);

  document.getElementById("btnCloseFound").addEventListener("click", () => els.foundModal.close());
  document.getElementById("btnCancelFound").addEventListener("click", () => els.foundModal.close());
  document.getElementById("btnCloseLost").addEventListener("click", () => els.lostModal.close());
  document.getElementById("btnCancelLost").addEventListener("click", () => els.lostModal.close());
  document.getElementById("btnCloseView").addEventListener("click", () => els.viewModal.close());

  els.foundForm.addEventListener("submit", handleFoundSubmit);
  els.lostForm.addEventListener("submit", handleLostSubmit);

  document.getElementById("btnEditRecord").addEventListener("click", () => {
    if (!viewingRecord) return;
    if (viewingRecord.type === "found") openFoundEdit(viewingRecord.id);
    else openLostEdit(viewingRecord.id);
  });

  document.getElementById("btnDeleteRecord").addEventListener("click", openDeleteConfirm);
  document.getElementById("btnCancelDelete").addEventListener("click", () => {
    pendingDelete = null;
    els.confirmModal.close();
  });
  document.getElementById("btnConfirmDelete").addEventListener("click", handleConfirmDelete);

  els.searchFound.addEventListener("input", renderFound);
  els.filterFoundCategory.addEventListener("change", renderFound);
  els.filterFoundStatus.addEventListener("change", renderFound);
  els.filterFoundLocation.addEventListener("change", renderFound);
  document.getElementById("btnClearFoundFilters").addEventListener("click", () => {
    els.searchFound.value = "";
    els.filterFoundCategory.value = "";
    els.filterFoundStatus.value = "";
    els.filterFoundLocation.value = "";
    renderFound();
  });

  els.searchLost.addEventListener("input", renderLost);
  els.filterLostCategory.addEventListener("change", renderLost);
  els.filterLostStatus.addEventListener("change", renderLost);
  els.filterLostLocation.addEventListener("change", renderLost);
  document.getElementById("btnClearLostFilters").addEventListener("click", () => {
    els.searchLost.value = "";
    els.filterLostCategory.value = "";
    els.filterLostStatus.value = "";
    els.filterLostLocation.value = "";
    renderLost();
  });

  [els.foundModal, els.lostModal, els.viewModal, els.confirmModal].forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });

  els.confirmModal.addEventListener("close", () => {
    if (!els.confirmModal.returnValue) pendingDelete = null;
  });
}

function init() {
  cacheElements();
  populateCategorySelects();
  loadData();
  seedSampleData();
  initEvents();
  els.btnRegisterFound.hidden = false;
  els.btnReportLost.hidden = true;
  setView("found");
}

document.addEventListener("DOMContentLoaded", init);
