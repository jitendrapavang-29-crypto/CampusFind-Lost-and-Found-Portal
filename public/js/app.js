// CampusFind Futuristic Liquid Glass Frontend Application
const $ = (selector) => document.querySelector(selector);
let currentUser = null;
let authMode = "login";
let requestInProgress = false;
let sessionReady = false;
let authStateVersion = 0;
let itemRequestVersion = 0;
let browsePage = 1;
let itemsById = new Map();
let myItemsById = new Map();
let adminItemsById = new Map();
let selectedDetailItem = null;
let toastTimer = null;

const EYE_OPEN_SVG = `<svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_CLOSED_SVG = `<svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
const SEARCH_FALLBACK_SVG = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
const PIN_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

$("#authButton").disabled = true;
$("#authButton").textContent = "Checking account…";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let dashboardRequestVersion = 0;
let itemsController = null;
let toastHideTimer = null;
const scrollBehavior = () => reducedMotion.matches ? "instant" : "smooth";
function scrollToSection(element) {
  element?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
}
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Keep the background still while a native dialog owns focus.
const dialogs = Array.from(document.querySelectorAll("dialog"));
const syncModalState = () => document.body.classList.toggle("modal-open", dialogs.some(dialog => dialog.open));
const dialogObserver = new MutationObserver(syncModalState);
dialogs.forEach(dialog => {
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      if (dialog.id !== "authDialog" || !requestInProgress) dialog.close();
    }
  });
});
$("#authDialog").addEventListener("cancel", event => {
  if (requestInProgress) event.preventDefault();
});

// Mobile Navigation Toggle
$("#navToggle").addEventListener("click", () => {
  const nav = $("#mainNav");
  const open = nav.classList.toggle("open");
  $("#navToggle").setAttribute("aria-expanded", String(open));
});

$("#mainNav").addEventListener("click", (event) => {
  if (event.target.closest("a, button")) {
    $("#mainNav").classList.remove("open");
    $("#navToggle").setAttribute("aria-expanded", "false");
  }
});

// VisionOS Dynamic Island Toast
function showToast(text, isError = false) {
  const toast = $("#islandToast");
  const label = $("#islandToastText");
  if (!toast || !label) return;
  clearTimeout(toastHideTimer);
  label.textContent = text;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    toastHideTimer = setTimeout(() => { toast.hidden = true; }, 260);
  }, 3200);
}

// One API helper for every backend request. Keeps JSON headers and session cookies.
async function api(url, options = {}) {
  const requestAuthVersion = authStateVersion;
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin"
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };
  if (
    response.status === 401 &&
    currentUser &&
    !url.startsWith("/api/auth/") &&
    requestAuthVersion === authStateVersion
  ) {
    authStateVersion += 1;
    currentUser = null;
    updateAuthUI();
  }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function showMessage(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#fb7185" : "#34d399";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "—";
  // Incident dates are calendar dates, not UTC timestamps to shift across time zones.
  const day = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

function setButtonBusy(button, busy, label = "Please wait…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function animateCounter(element, target) {
  if (!element) return;
  cancelAnimationFrame(element._counterFrame);
  const end = Number(target);
  if (Number.isNaN(end)) {
    element.textContent = String(target);
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || end === 0) {
    element.textContent = String(end);
    return;
  }
  const duration = 420;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    element.textContent = String(Math.round(end * progress));
    if (progress < 1) element._counterFrame = requestAnimationFrame(frame);
  }
  element._counterFrame = requestAnimationFrame(frame);
}

function setPasswordVisibility(visible) {
  const input = $("#authPassword");
  const toggle = $("#togglePassword");
  if (!input || !toggle) return;
  input.type = visible ? "text" : "password";
  toggle.setAttribute("aria-pressed", String(visible));
  toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  toggle.title = visible ? "Hide password" : "Show password";
  toggle.innerHTML = visible ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
}

$("#togglePassword").addEventListener("click", () => {
  const isHidden = $("#authPassword").type === "password";
  setPasswordVisibility(isHidden);
  $("#authPassword").focus();
});

function renderItem(item) {
  const image = item.imageUrl
    ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" loading="lazy">`
    : SEARCH_FALLBACK_SVG;
  return `<article class="item-card">
    <button class="item-open" type="button" data-item-id="${escapeHTML(item._id)}" aria-label="View details for ${escapeHTML(item.title)}">
      <div class="item-image">${image}</div>
      <div class="item-content">
        <div class="item-meta">
          <span class="pill ${item.type === "found" ? "found" : ""}">${escapeHTML(item.type)}</span>
          <span class="muted">${formatDate(item.date)}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.description)}</p>
        <div class="item-foot"><span class="item-loc">${PIN_SVG} ${escapeHTML(item.location)}</span><span>${escapeHTML(item.category)}</span></div>
      </div>
    </button>
  </article>`;
}

function openItemDetails(item) {
  selectedDetailItem = item;
  const ownerId = item.createdBy && (item.createdBy._id || item.createdBy);
  const isOwner = currentUser && String(ownerId) === String(currentUser.id);
  const image = $("#detailImage");
  image.replaceChildren();
  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.title;
    img.addEventListener("error", () => {
      image.innerHTML = SEARCH_FALLBACK_SVG;
    }, { once: true });
    image.append(img);
  } else {
    image.innerHTML = SEARCH_FALLBACK_SVG;
  }

  $("#detailType").textContent = item.type;
  $("#detailType").classList.toggle("found", item.type === "found");
  $("#detailStatus").textContent = item.status;
  $("#detailTitle").textContent = item.title;
  $("#detailCategory").textContent = item.category;
  $("#detailDescription").textContent = item.description;
  $("#detailLocation").textContent = item.location;
  $("#detailDate").textContent = formatDate(item.date);
  $("#detailOwner").textContent = item.createdBy?.name || "CampusFind user";
  $("#detailClaimButton").hidden = Boolean(isOwner) || item.status !== "open";
  $("#detailClaimButton").textContent = currentUser ? "Submit a claim" : "Log in to claim";

  const dialog = $("#itemDetailsDialog");
  if (!dialog.open) dialog.showModal();
}

async function loadItems() {
  const requestVersion = ++itemRequestVersion;
  itemsController?.abort();
  itemsController = new AbortController();
  const params = new URLSearchParams();
  params.set("page", String(browsePage));
  const filters = [
    ["searchInput", "q"], ["categoryFilter", "category"],
    ["typeFilter", "type"], ["locationFilter", "location"],
    ["sortFilter", "sort"]
  ];
  filters.forEach(([id, key]) => {
    const value = $(`#${id}`).value.trim();
    if (value) params.set(key, value);
  });

  const grid = $("#itemGrid");
  grid.setAttribute("aria-busy", "true");
  $("#previousPage").disabled = true;
  $("#nextPage").disabled = true;
  $("#resultCount").textContent = "Loading…";
  grid.innerHTML = '<div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div>';
  try {
    const data = await api(`/api/items?${params.toString()}`, { signal: itemsController.signal });
    if (requestVersion !== itemRequestVersion) return;
    if (data.pages > 0 && browsePage > data.pages) {
      browsePage = data.pages;
      return loadItems();
    }
    browsePage = data.count === 0 ? 1 : data.page;
    itemsById = new Map(data.items.map((item) => [String(item._id), item]));
    grid.innerHTML = data.items.length
      ? data.items.map(renderItem).join("")
      : '<div class="empty-state">No matching items found. Try adjusting your filters or submit a new report.</div>';
    $("#resultCount").textContent = `${data.count} listing${data.count === 1 ? "" : "s"}`;
    animateCounter($("#statItems"), data.count);
    $("#itemPagination").hidden = data.pages <= 1;
    $("#previousPage").disabled = data.page <= 1;
    $("#nextPage").disabled = data.page >= data.pages;
    $("#pageInfo").textContent = `Page ${data.page} of ${data.pages}`;
  } catch (error) {
    if (requestVersion !== itemRequestVersion) return;
    itemsById.clear();
    $("#itemPagination").hidden = true;
    $("#resultCount").textContent = "Unavailable";
    cancelAnimationFrame($("#statItems")._counterFrame);
    $("#statItems").textContent = "—";
    grid.innerHTML = `<div class="empty-state"><p>Could not load listings: ${escapeHTML(error.message)}</p><button type="button" class="btn btn-glass" data-retry-items>Try again</button></div>`;
  } finally {
    if (requestVersion === itemRequestVersion) grid.setAttribute("aria-busy", "false");
  }
}

function updateAuthUI() {
  const loggedIn = Boolean(currentUser);
  $("#dashboardLink").hidden = !loggedIn;
  $("#dashboard").hidden = !loggedIn;
  $("#adminLoginButton").hidden = currentUser?.role === "admin";
  $("#authButton").disabled = !sessionReady;
  $("#authButton").textContent = !sessionReady
    ? "Checking account…"
    : loggedIn
      ? `Account: ${currentUser.name.split(" ")[0]}`
      : "Login / Register";
  if (loggedIn) {
    $("#profileForm").elements.name.value = currentUser.name;
    loadDashboard();
  } else {
    dashboardRequestVersion += 1;
    myItemsById.clear();
    adminItemsById.clear();
    ["myListings", "myClaims", "adminStats", "adminItems", "adminClaims"].forEach(id => $(`#${id}`).replaceChildren());
    $("#profileForm").reset();
    $("#adminPanel").hidden = true;
    $("#adminItemDialog").close();
    $("#claimDialog").close();
  }
  if ($("#itemDetailsDialog").open && selectedDetailItem) openItemDetails(selectedDetailItem);
  window.dispatchEvent(new Event("campus:authchange"));
}

async function checkSession() {
  const version = authStateVersion;
  try {
    const data = await api("/api/auth/me");
    if (version === authStateVersion) currentUser = data.user || null;
  } catch (error) {
    showMessage($("#globalMessage"), "Your session could not be checked. You can retry signing in.", true);
    if (version === authStateVersion) currentUser = null;
  }
  sessionReady = true;
  updateAuthUI();
}

function openAuth(mode = "login") {
  if (requestInProgress) return;
  authMode = mode;
  $("#authTitle").textContent = mode === "register"
    ? "Create your account"
    : mode === "admin"
      ? "Administrator sign in"
      : "Welcome back";
  $("#authSubmit").textContent = mode === "register" ? "Create account" : "Login";
  $("#nameWrap").hidden = mode !== "register";
  $("#nameWrap input").required = mode === "register";
  $("#authPassword").minLength = mode === "register" ? 8 : 1;
  $("#authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("#authMessage").textContent = "";
  $("#authForm").reset();
  setPasswordVisibility(false);
  document.querySelectorAll(".auth-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  if (!$("#authDialog").open) $("#authDialog").showModal();
}

$("#authButton").addEventListener("click", () => {
  if (currentUser) scrollToSection($("#dashboard"));
  else openAuth("login");
});

$("#adminLoginButton").addEventListener("click", () => openAuth("admin"));

document.querySelectorAll(".auth-tabs button").forEach((button) => {
  button.addEventListener("click", () => openAuth(button.dataset.mode));
});

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (requestInProgress) return;
  const form = event.currentTarget;
  requestInProgress = true;
  const modeButtons = document.querySelectorAll(".auth-tabs button, #authDialog .dialog-close button");
  modeButtons.forEach(button => { button.disabled = true; });
  const button = $("#authSubmit");
  setButtonBusy(button, true, authMode === "register" ? "Creating account…" : "Logging in…");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const endpoint = authMode === "register"
      ? "/api/auth/register"
      : authMode === "admin"
        ? "/api/auth/admin/login"
        : "/api/auth/login";
    const data = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    authStateVersion += 1;
    currentUser = data.user;
    $("#authDialog").close();
    form.reset();
    setPasswordVisibility(false);
    updateAuthUI();
    const welcome = `Welcome, ${data.user.name}. You are signed in.`;
    await loadItems();
    showMessage($("#globalMessage"), welcome);
    showToast(welcome);
  } catch (error) {
    showMessage($("#authMessage"), error.message, true);
  } finally {
    requestInProgress = false;
    modeButtons.forEach(button => { button.disabled = false; });
    setButtonBusy(button, false);
  }
});

$("#logoutButton").addEventListener("click", async () => {
  const button = $("#logoutButton");
  if (button.disabled) return;
  setButtonBusy(button, true, "Signing out…");
  try {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    authStateVersion += 1;
    currentUser = null;
    $("#globalMessage").textContent = "";
    $("#reportMessage").textContent = "";
    $("#profileMessage").textContent = "";
    updateAuthUI();
    await loadItems();
    showToast("Signed out safely.");
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  } catch (error) {
    showToast(`Logout failed: ${error.message}`, true);
  } finally {
    setButtonBusy(button, false);
  }
});

function searchFromFirstPage() {
  browsePage = 1;
  loadItems();
}

function syncQuickPills(value) {
  document.querySelectorAll("#quickTypePills .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.typePill === value);
    btn.setAttribute("aria-pressed", String(btn.dataset.typePill === value));
  });
}

$("#quickTypePills").addEventListener("click", (event) => {
  const pill = event.target.closest("[data-type-pill]");
  if (!pill) return;
  const val = pill.dataset.typePill;
  $("#typeFilter").value = val;
  syncLiquidSelects();
  syncQuickPills(val);
  searchFromFirstPage();
});

$("#typeFilter").addEventListener("change", () => {
  syncQuickPills($("#typeFilter").value);
  searchFromFirstPage();
});

$("#searchButton").addEventListener("click", searchFromFirstPage);
$("#searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchFromFirstPage();
});
["categoryFilter", "sortFilter"].forEach((id) => {
  $(`#${id}`).addEventListener("change", searchFromFirstPage);
});
$("#locationFilter").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchFromFirstPage();
});
$("#locationFilter").addEventListener("change", searchFromFirstPage);
$("#previousPage").addEventListener("click", () => {
  if (browsePage > 1) {
    browsePage -= 1;
    loadItems().then(() => scrollToSection($("#browse")));
  }
});
$("#nextPage").addEventListener("click", () => {
  browsePage += 1;
  loadItems().then(() => scrollToSection($("#browse")));
});

$("#reportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!currentUser) {
    openAuth("login");
    showMessage($("#authMessage"), "Please log in to submit a report.");
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  setButtonBusy(button, true, "Submitting…");
  const payload = new FormData(form);
  try {
    await api("/api/items", { method: "POST", body: payload });
    form.reset();
    $("#reportForm [name=date]").value = localDate();
    clearImagePreview();
    showMessage($("#reportMessage"), "Your item report was published successfully.");
    showToast("Item report published to CampusFind.");
    browsePage = 1;
    await loadItems();
    await loadDashboard();
  } catch (error) {
    showMessage($("#reportMessage"), error.message, true);
    showToast(error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
});

function clearImagePreview() {
  const preview = $("#imagePreview");
  const image = preview.querySelector("img");
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  image.onerror = null;
  image.removeAttribute("src");
  image.hidden = false;
  delete image.dataset.objectUrl;
  preview.querySelector(".image-preview-name").textContent = "";
  preview.hidden = true;
}

$("#imageInput").addEventListener("change", (event) => {
  const file = event.currentTarget.files[0];
  clearImagePreview();
  if (!file) return;
  const supported = /\.(jpe?g|png|webp|gif|tiff?|heic|heif|avif)$/i.test(file.name) || /^image\/(jpeg|png|webp|gif|tiff|heic|heif|avif)$/i.test(file.type);
  if (file.size > 5 * 1024 * 1024 || !supported) {
    const message = file.size > 5 * 1024 * 1024 ? "Image must be 5 MB or smaller." : "Choose a JPEG, PNG, WebP, GIF, TIFF, HEIC, HEIF or AVIF image.";
    event.currentTarget.value = "";
    showMessage($("#reportMessage"), message, true);
    showToast(message, true);
    return;
  }
  $("#reportMessage").textContent = "";
  const preview = $("#imagePreview");
  const image = preview.querySelector("img");
  const objectUrl = URL.createObjectURL(file);
  image.onerror = () => {
    image.hidden = true;
    preview.querySelector(".image-preview-name").textContent = `${file.name} — preview unavailable; photo is ready to upload.`;
  };
  image.src = objectUrl;
  image.dataset.objectUrl = objectUrl;
  preview.querySelector(".image-preview-name").textContent = file.name;
  preview.hidden = false;
});

$("#clearImageButton").addEventListener("click", () => {
  $("#imageInput").value = "";
  clearImagePreview();
});

$("#itemGrid").addEventListener("click", (event) => {
  if (event.target.closest("[data-retry-items]")) { loadItems(); return; }
  const detailButton = event.target.closest("[data-item-id]");
  const item = detailButton && itemsById.get(detailButton.dataset.itemId);
  if (item) openItemDetails(item);
});

$("#itemDetailsDialog").addEventListener("click", (event) => {
  if (event.target.closest(".item-details-close")) {
    $("#itemDetailsDialog").close();
  }
});

$("#detailClaimButton").addEventListener("click", () => {
  if (!selectedDetailItem) return;
  if (!currentUser) {
    $("#itemDetailsDialog").close();
    openAuth("login");
    showMessage($("#authMessage"), "Sign in, then reopen the item to submit your claim.");
    return;
  }
  $("#claimForm").reset();
  $("#claimForm [name=itemId]").value = selectedDetailItem._id;
  $("#claimMessage").textContent = "";
  $("#itemDetailsDialog").close();
  $("#claimDialog").showModal();
});

$("#claimForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit], button:not([type])");
  if (button.disabled) return;
  setButtonBusy(button, true, "Sending…");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/claims", { method: "POST", body: JSON.stringify(payload) });
    showMessage($("#claimMessage"), "Claim submitted. Track its status in your dashboard.");
    showToast("Ownership claim submitted for review.");
    form.reset();
    await loadDashboard();
    $("#claimDialog").close();
  } catch (error) {
    showMessage($("#claimMessage"), error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
});

async function loadDashboard() {
  const user = currentUser;
  if (!user) return;
  const version = ++dashboardRequestVersion;
  const authVersion = authStateVersion;
  const isCurrent = () => version === dashboardRequestVersion && authVersion === authStateVersion && currentUser?.id === user.id;
  $("#myListings").setAttribute("aria-busy", "true");
  $("#myClaims").setAttribute("aria-busy", "true");
  try {
    const data = await api("/api/items/mine");
    if (!isCurrent()) return;
    myItemsById = new Map(data.items.map((item) => [String(item._id), item]));
    $("#myListings").innerHTML = data.items.length
      ? data.items.map((item) => `<div class="mini-row listing-row"><span><strong>${escapeHTML(item.title)}</strong><br><span class="muted">${escapeHTML(item.type)} · ${escapeHTML(item.location)}</span></span><span class="listing-actions"><span class="pill ${item.type === "found" ? "found" : ""}">${escapeHTML(item.status)}</span><button class="btn btn-glass" type="button" data-my-edit="${escapeHTML(item._id)}">Edit</button><button class="btn btn-danger-glass" type="button" data-my-delete="${escapeHTML(item._id)}">Delete</button></span></div>`).join("")
      : '<p class="muted">You have not reported any items yet.</p>';
    $("#myClaims").innerHTML = data.claims.length
      ? data.claims.map((claim) => `<div class="mini-row"><span><strong>${escapeHTML(claim.item?.title || "Item")}</strong><br><span class="muted">${escapeHTML(claim.message)}</span></span><span class="pill ${claim.status === "approved" ? "found" : ""}">${escapeHTML(claim.status)}</span></div>`).join("")
      : '<p class="muted">You have not submitted any claims yet.</p>';
    if (user.role === "admin") await loadAdmin(isCurrent);
    else $("#adminPanel").hidden = true;

  } catch (error) {
    if (isCurrent()) {
      myItemsById.clear();
      adminItemsById.clear();
      $("#adminPanel").hidden = true;
      $("#myListings").innerHTML = `<p>Could not load your dashboard: ${escapeHTML(error.message)}</p><button class="btn btn-glass" type="button" data-retry-dashboard>Try again</button>`;
      $("#myClaims").replaceChildren();
    }
  } finally {
    if (isCurrent()) {
      $("#myListings").setAttribute("aria-busy", "false");
      $("#myClaims").setAttribute("aria-busy", "false");
    }
  }
}

async function loadAdmin(isCurrent) {
  $("#adminPanel").hidden = false;
  try {
    const [stats, claimsData, itemsData] = await Promise.all([
      api("/api/admin/stats"),
      api("/api/claims"),
      api("/api/admin/items")
    ]);
    if (!isCurrent()) return;
    adminItemsById = new Map(itemsData.items.map((item) => [String(item._id), item]));
    $("#adminStats").innerHTML = Object.entries(stats).map(([key, value]) => `<div class="admin-stat"><strong>${Number(value)}</strong><span>${escapeHTML(key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))}</span></div>`).join("");
    $("#adminItems").innerHTML = "<h3 class='admin-section-title'>Manage reports</h3>" + (itemsData.items.length
      ? itemsData.items.map((item) => `<div class="mini-row admin-item-row">
          <span><strong>${escapeHTML(item.title)}</strong><br><span class="muted">${escapeHTML(item.type)} · ${escapeHTML(item.location)} · ${escapeHTML(item.createdBy?.name || "User")} · ${escapeHTML(item.status)}</span></span>
          <span class="admin-item-actions"><button class="btn btn-glass" type="button" data-admin-edit="${escapeHTML(item._id)}">Edit</button><button class="btn btn-danger-glass" type="button" data-admin-delete="${escapeHTML(item._id)}">Delete</button></span>
        </div>`).join("")
      : '<p class="muted">No reports to manage.</p>');
    const pending = claimsData.claims.filter((claim) => claim.status === "pending");
    $("#adminClaims").innerHTML = "<h3 class='admin-section-title'>Pending claims</h3>" + (pending.length
      ? pending.map((claim) => `<div class="mini-row"><span><strong>${escapeHTML(claim.item?.title || "Item")}</strong> — ${escapeHTML(claim.claimant?.name || "User")}<br><span class="muted">${escapeHTML(claim.message)}</span></span><span class="listing-actions"><button class="btn btn-neon" type="button" data-review="${escapeHTML(claim._id)}" data-status="approved">Approve</button><button class="btn btn-danger-glass" type="button" data-review="${escapeHTML(claim._id)}" data-status="rejected">Reject</button></span></div>`).join("")
      : '<p class="muted">No pending claims.</p>');
  } catch (error) {
    if (!isCurrent()) return;
    adminItemsById.clear();
    $("#adminStats").replaceChildren();
    $("#adminItems").replaceChildren();
    $("#adminClaims").textContent = `Admin data could not load: ${error.message}`;
  }
}

$("#adminPanel").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-review], [data-admin-edit], [data-admin-delete]");
  if (!button || button.disabled) return;
  if (button.hasAttribute("data-admin-edit")) {
    const item = adminItemsById.get(button.dataset.adminEdit);
    if (!item) {
      showToast("That report could not be found. Refresh the dashboard.", true);
      return;
    }
    openItemEditor(item);
    return;
  }
  if (button.hasAttribute("data-admin-delete")) {
    if (!window.confirm("Delete this report and its associated claims? This cannot be undone.")) return;
    button.disabled = true;
    try {
      await api(`/api/items/${button.dataset.adminDelete}`, { method: "DELETE" });
      showToast("Report deleted.");
      await Promise.all([loadDashboard(), loadItems()]);
    } catch (error) {
      showToast(`Could not delete report: ${error.message}`, true);
      button.disabled = false;
    }
    return;
  }
  button.disabled = true;
  try {
    await api(`/api/claims/${button.dataset.review}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) });
    showToast(`Claim ${button.dataset.status}.`);
    await loadDashboard();
    await loadItems();
  } catch (error) {
    showToast(`Could not update claim: ${error.message}`, true);
    button.disabled = false;
  }
});

function openItemEditor(item) {
  const form = $("#adminItemForm");
  form.elements.id.value = item._id;
  form.elements.title.value = item.title;
  form.elements.type.value = item.type;
  form.elements.category.value = item.category;
  form.elements.location.value = item.location;
  const parsedDate = item.date ? new Date(item.date) : null;
  form.elements.date.value = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : "";
  form.elements.status.value = item.status;
  form.elements.description.value = item.description;
  syncLiquidSelects();
  $("#adminItemMessage").textContent = "";
  $("#adminItemDialog").showModal();
}

$("#myListings").addEventListener("click", async (event) => {
  if (event.target.closest("[data-retry-dashboard]")) { loadDashboard(); return; }
  const button = event.target.closest("[data-my-edit], [data-my-delete]");
  if (!button || button.disabled) return;
  const id = button.dataset.myEdit || button.dataset.myDelete;
  const item = myItemsById.get(id);
  if (!item) {
    showMessage($("#globalMessage"), "That listing could not be found. Refresh your dashboard and try again.", true);
    return;
  }
  if (button.hasAttribute("data-my-edit")) {
    openItemEditor(item);
    return;
  }
  if (!window.confirm("Delete this listing and its associated claims? This cannot be undone.")) return;
  button.disabled = true;
  try {
    await api(`/api/items/${id}`, { method: "DELETE" });
    showToast("Listing deleted.");
    await Promise.all([loadDashboard(), loadItems()]);
  } catch (error) {
    showMessage($("#globalMessage"), `Could not delete listing: ${error.message}`, true);
    button.disabled = false;
  }
});

$("#adminItemForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  setButtonBusy(button, true, "Saving…");
  const values = Object.fromEntries(new FormData(form).entries());
  const id = values.id;
  delete values.id;
  try {
    await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(values) });
    $("#adminItemDialog").close();
    showToast("Report updated.");
    await Promise.all([loadDashboard(), loadItems()]);
  } catch (error) {
    showMessage($("#adminItemMessage"), error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
});

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  setButtonBusy(button, true, "Saving…");
  const version = authStateVersion;
  try {
    const data = await api("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: form.elements.name.value })
    });
    if (version !== authStateVersion || !currentUser) return;
    currentUser = data.user;
    $("#profileForm").elements.name.value = currentUser.name;
    showMessage($("#profileMessage"), "Your profile was updated.");
    showToast("Profile updated.");
    updateAuthUI();
  } catch (error) {
    showMessage($("#profileMessage"), error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
});

$("#itemGrid").addEventListener("error", (event) => {
  if (event.target.matches(".item-image img")) event.target.parentElement.innerHTML = SEARCH_FALLBACK_SVG;
}, true);

$("#reportForm [name=date]").value = localDate();
checkSession();
loadItems();
syncQuickPills($("#typeFilter").value);

// Mobile dock: smooth navigation, keyboard activation, and scroll tracking.
(function initLiquidDock() {
  const dock = $("#liquidDock"), lens = $("#liquidLens");
  const tabs = [...dock.querySelectorAll(".dock-tab")];
  let active = 0, scheduled = false;
  function move(index, instant = false) {
    active = index;
    const width = (dock.clientWidth - 12) / tabs.length;
    if (instant) lens.style.transition = "none";
    lens.style.width = `${width}px`;
    lens.style.transform = `translateX(${index * width}px)`;
    tabs.forEach((tab, i) => { tab.classList.toggle("active", i === index); if (i === index) tab.setAttribute("aria-current", "location"); else tab.removeAttribute("aria-current"); });
    if (instant) requestAnimationFrame(() => { lens.style.transition = ""; });
  }
  function activate(index) {
    if (index === 2 && !currentUser) { openAuth("login"); return; }
    move(index);
    scrollToSection(document.getElementById(tabs[index].dataset.target));
  }
  tabs.forEach((tab, i) => tab.addEventListener("click", e => { e.preventDefault(); activate(i); }));
  let start = null, dragging = false;
  dock.addEventListener("pointerdown", e => { if (e.isPrimary && e.button === 0) start = { x: e.clientX, id: e.pointerId }; });
  dock.addEventListener("pointermove", e => {
    if (!start || e.pointerId !== start.id || Math.abs(e.clientX - start.x) < 8) return;
    dragging = true; dock.classList.add("is-scrubbing"); dock.setPointerCapture(e.pointerId);
    const r = dock.getBoundingClientRect(), width = (r.width - 12) / tabs.length;
    lens.style.transform = `translateX(${Math.max(0, Math.min(r.width - 12 - width, e.clientX - r.left - 6 - width / 2))}px)`;
  });
  dock.addEventListener("pointerup", e => {
    if (dragging) { const r = dock.getBoundingClientRect(); const i = Math.max(0, Math.min(tabs.length - 1, Math.floor((e.clientX - r.left - 6) / ((r.width - 12) / tabs.length)))); activate(i); }
    start = null; dock.classList.remove("is-scrubbing");
  });
  dock.addEventListener("click", e => { if (dragging) { e.preventDefault(); e.stopPropagation(); dragging = false; } }, true);
  dock.addEventListener("pointercancel", () => { start = null; dragging = false; dock.classList.remove("is-scrubbing"); move(active); });
  function spy() {
    scheduled = false;
    if (dragging) return;
    const marker = window.innerHeight * .35;
    let i = 0;
    tabs.forEach((tab, index) => { const section = document.getElementById(tab.dataset.target); if (section && !section.hidden && section.getBoundingClientRect().top <= marker) i = index; });
    if (i !== active) move(i);
  }
  window.addEventListener("scroll", () => { if (!scheduled) { scheduled = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener("resize", () => move(active, true));
  $("#dockSearchBtn").addEventListener("click", () => { scrollToSection($("#browse")); $("#searchInput").focus({ preventScroll: true }); });
  requestAnimationFrame(() => { move(0, true); spy(); });
})();

// Native selects preserve keyboard, touch, screen reader and form behavior.
function syncLiquidSelects() {}
