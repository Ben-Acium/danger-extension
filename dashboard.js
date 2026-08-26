// ---- generic helpers (shared shape with permission-inspector) ----
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function out(id, html) {
  const el = document.getElementById("out-" + id);
  if (!el) return;
  el.innerHTML = html;
  makeTablesResizable(el);
}

function errOut(id, e) {
  out(id, `<div class="err">Error: ${esc(e?.message || e)}</div>`);
}

function pre(obj) {
  return `<pre>${esc(JSON.stringify(obj, null, 2))}</pre>`;
}

function unavailable(msg) {
  return `<div class="unavailable">${esc(msg)}</div>`;
}

function table(rows, columns) {
  if (!rows.length) return '<div class="muted">No results.</div>';
  const head = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${columns.map((c) => {
      const v = c.get(r);
      return `<td title="${esc(v)}">${esc(v)}</td>`;
    }).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function makeTablesResizable(container) {
  container.querySelectorAll("table").forEach((tableEl) => {
    tableEl.querySelectorAll("th").forEach((th) => {
      if (th.querySelector(".col-resize-handle")) return;
      const handle = document.createElement("div");
      handle.className = "col-resize-handle";
      th.appendChild(handle);
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startWidth = th.offsetWidth;
        handle.classList.add("active");
        const onMove = (ev) => {
          th.style.width = Math.max(40, startWidth + (ev.pageX - startX)) + "px";
        };
        const onUp = () => {
          handle.classList.remove("active");
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  });
}

function fmtTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

async function activeTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getNS(path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), chrome);
}

// Runs fn(namespace) if chrome.<nsPath> exists; otherwise shows a plain
// "not available on this platform/build" panel instead of faking a result.
async function nsCall(id, nsPath, fn, unavailableMsg) {
  const ns = getNS(nsPath);
  if (ns === undefined) {
    out(id, unavailable(unavailableMsg || `chrome.${nsPath} is undefined here — this API only exists in ChromeOS / enterprise-managed / platform-app contexts.`));
    return;
  }
  const html = await fn(ns);
  if (html !== undefined) out(id, html);
}

// ---- permission catalog ----
// group order matches the risk tiers as given: Critical, High, Medium, Standard.
const ITEMS = [];
function item(group, id, label, desc, run, extraHtml) {
  ITEMS.push({ group, id, label, desc, run, extraHtml });
}

// ===== CRITICAL =====

item("Critical", "cookies", "cookies",
  `Every cookie in the browser, for every domain — including session/auth cookies. Values are masked by default.
   Needs no per-site prompt because host access is already <code>&lt;all_urls&gt;</code>.`,
  null,
  `<div class="row">
     <input id="cookie-domain" type="text" placeholder="example.com (blank = active tab's domain)" />
     <button class="load" data-load="cookies-domain">List cookies for domain</button>
     <button class="load" data-load="cookies-all">Scan all cookies (cap 300)</button>
   </div>`
);

item("Critical", "debugger", "debugger",
  `Attaches Chrome DevTools Protocol to a real tab: full-page screenshot, arbitrary JS evaluation in page
   context, live localStorage keys — all bypassing content-script isolation and page CSP. Shows a visible
   "is debugging this browser" bar while attached (that visibility is the one safeguard). Switch to a normal
   website tab first, then click.`,
  async () => {
    const tab = await activeTabInfo();
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      return out("debugger", '<div class="err">Switch to a normal http(s) tab and make it active, then click again — the debugger can\'t attach to this extension page.</div>');
    }
    out("debugger", '<div class="muted">Attaching debugger…</div>');
    const target = { tabId: tab.id };
    await chrome.debugger.attach(target, "1.3");
    try {
      const evalResult = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
        expression: "JSON.stringify({title: document.title, url: location.href, localStorageKeys: Object.keys(localStorage)})",
        returnByValue: true
      });
      const shot = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", { format: "png" });
      out("debugger", `<div class="muted">Runtime.evaluate in page context:</div>${pre(JSON.parse(evalResult.result.value))}
        <div class="muted">Page.captureScreenshot:</div><img src="data:image/png;base64,${shot.data}">`);
    } finally {
      await chrome.debugger.detach(target);
    }
  }
);

item("Critical", "webRequest", "webRequest (live)",
  `Every outgoing request while this tab stays open, including request header <em>names</em>. Registered with
   &lt;all_urls&gt;.`,
  async () => {
    const { webRequestLog = [] } = await chrome.storage.session.get("webRequestLog");
    out("webRequest", `<div class="muted">${webRequestLog.length} buffered requests (most recent last)</div>` +
      table(webRequestLog.slice().reverse(), [
        { label: "Time", get: (r) => fmtTime(r.time) },
        { label: "Method", get: (r) => r.method },
        { label: "Type", get: (r) => r.type },
        { label: "URL", get: (r) => r.url },
        { label: "Header names", get: (r) => (r.requestHeaders || []).join(", ") }
      ]));
  }
);

// ===== HIGH =====

item("High", "browsingData", "browsingData",
  `Reads the current "clear browsing data" configuration and what time range/options it would apply to. The
   same API can also permanently delete history, cookies, cache, passwords, etc. — this demo only reads
   settings, it never calls <code>remove()</code>.`,
  async () => out("browsingData", pre(await chrome.browsingData.settings()))
);

item("High", "contentSettings", "contentSettings",
  `Per-site browser settings (cookies, JS, images, popups, location, notifications) for a URL you choose —
   defaults to your active tab.`,
  null,
  `<div class="row">
     <input id="cs-url" type="text" placeholder="https://example.com" />
     <button class="load" data-load="contentsettings">Read settings</button>
   </div>`
);

item("High", "declarativeNetRequest", "declarativeNetRequest",
  `Rules this extension has installed to block/redirect/modify network requests, read-only here — the same
   mechanism could silently reroute or block any request.`,
  async () => {
    const [dynamic, session, enabled] = await Promise.all([
      chrome.declarativeNetRequest.getDynamicRules(),
      chrome.declarativeNetRequest.getSessionRules(),
      chrome.declarativeNetRequest.getEnabledRulesets()
    ]);
    out("declarativeNetRequest", `<div class="muted">Enabled static rulesets: ${esc(JSON.stringify(enabled))}</div>
      <div class="muted">Dynamic rules</div>${pre(dynamic)}
      <div class="muted">Session rules</div>${pre(session)}`);
  }
);

item("High", "declarativeNetRequestWithHostAccess", "declarativeNetRequestWithHostAccess",
  `The same rule engine, but with permission to see exactly which requests on a given tab matched a rule —
   URL, resource type, and which rule fired.`,
  async () => {
    const tab = await activeTabInfo();
    const matched = await chrome.declarativeNetRequest.getMatchedRules(tab?.id ? { tabId: tab.id } : undefined);
    out("declarativeNetRequestWithHostAccess", pre(matched));
  }
);

item("High", "declarativeNetRequestFeedback", "declarativeNetRequestFeedback",
  `Live feed of every request a declarativeNetRequest rule has matched, via
   <code>onRuleMatchedDebug</code>. Empty until a rule actually matches something — add one in the
   declarativeNetRequest panel, or just visit a page, then come back and reload this.`,
  async () => {
    const { ruleMatchLog = [] } = await chrome.storage.session.get("ruleMatchLog");
    out("declarativeNetRequestFeedback", `<div class="muted">${ruleMatchLog.length} buffered rule-match events</div>` + pre(ruleMatchLog));
  }
);

// ===== MEDIUM =====

item("Medium", "bookmarks", "bookmarks",
  `Your entire bookmark tree: every folder, title, and URL you've ever saved.`,
  async () => {
    const tree = await chrome.bookmarks.getTree();
    const rows = [];
    (function walk(nodes, path) {
      for (const n of nodes) {
        if (n.url) rows.push({ title: n.title, url: n.url, path, dateAdded: n.dateAdded });
        if (n.children) walk(n.children, path ? `${path}/${n.title}` : n.title);
      }
    })(tree, "");
    out("bookmarks", `<div class="muted">${rows.length} bookmarks</div>` + table(rows, [
      { label: "Folder", get: (r) => r.path },
      { label: "Title", get: (r) => r.title },
      { label: "URL", get: (r) => r.url },
      { label: "Added", get: (r) => fmtTime(r.dateAdded) }
    ]));
  }
);

item("Medium", "clipboardWrite", "clipboardWrite",
  `Writes to your system clipboard, silently, with no extra prompt — from an extension page, this permission
   removes the need for the page to even have focus in some contexts.`,
  async () => {
    const text = `This was written to your clipboard by "Permission Library Inspector" — clipboardWrite needs no prompt.`;
    await navigator.clipboard.writeText(text);
    out("clipboardWrite", `<div class="muted">Wrote to clipboard:</div><pre>${esc(text)}</pre>`);
  }
);

item("Medium", "downloads", "downloads",
  `Every downloaded file: filename, source URL, local file path, size, state — and the extension could delete
   the file from disk.`,
  async () => {
    const items = await chrome.downloads.search({ limit: 100, orderBy: ["-startTime"] });
    out("downloads", table(items, [
      { label: "Started", get: (i) => fmtTime(new Date(i.startTime).getTime()) },
      { label: "Filename", get: (i) => i.filename },
      { label: "Source URL", get: (i) => i.url },
      { label: "State", get: (i) => i.state },
      { label: "Bytes", get: (i) => i.fileSize }
    ]));
  }
);

item("Medium", "downloads.open", "downloads.open",
  `Lets the extension launch a downloaded file with its default OS handler — <code>chrome.downloads.open(id)</code>.
   Deliberately not wired to a real download here: calling it for real would execute whatever file it points
   at, at the OS level.`,
  async () => out("downloads.open", '<div class="muted">Not demoed — this call would actually launch a file on your machine. The other permissions here are safe to trigger; this one isn\'t.</div>')
);

item("Medium", "downloads.ui", "downloads.ui",
  `Controls the downloads shelf/bubble UI — can hide it entirely so a download completes with no visible
   indicator to you.`,
  async () => {
    await chrome.downloads.setShelfEnabled(true);
    out("downloads.ui", '<div class="muted">Called chrome.downloads.setShelfEnabled(true) — succeeded with no error. Calling it with false would hide the download UI entirely, silently.</div>');
  }
);

item("Medium", "fileSystemProvider", "fileSystemProvider",
  `Lets the extension mount a virtual filesystem into the Chrome OS Files app — ChromeOS only.`,
  async () => nsCall("fileSystemProvider", "fileSystemProvider", async (ns) => pre(await ns.getAll()))
);

item("Medium", "geolocation", "geolocation",
  `Precise device location via the standard Geolocation API: latitude, longitude, altitude, heading, speed,
   accuracy.`,
  () => new Promise((resolve) => {
    out("geolocation", '<div class="muted">Requesting location…</div>');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        out("geolocation", pre({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          time: new Date(pos.timestamp).toLocaleString()
        }));
        resolve();
      },
      (err) => { errOut("geolocation", err); resolve(); },
      { enableHighAccuracy: true }
    );
  })
);

item("Medium", "management", "management",
  `Every other installed extension: name, version, enabled state, and <strong>its</strong> granted permissions
   and host permissions.`,
  async () => {
    const exts = await chrome.management.getAll();
    out("management", table(exts, [
      { label: "Name", get: (e) => e.name },
      { label: "Version", get: (e) => e.version },
      { label: "Enabled", get: (e) => e.enabled },
      { label: "Type", get: (e) => e.installType },
      { label: "Permissions", get: (e) => (e.permissions || []).join(", ") },
      { label: "Host permissions", get: (e) => (e.hostPermissions || []).join(", ") }
    ]));
  }
);

item("Medium", "nativeMessaging", "nativeMessaging",
  `Attempts to connect to a native host app via Chrome's Native Messaging protocol — the mechanism an
   extension uses to bridge into a locally-installed companion app.`,
  () => new Promise((resolve) => {
    out("nativeMessaging", '<div class="muted">Attempting connection…</div>');
    const port = chrome.runtime.connectNative("com.example.permission_library_demo_host");
    port.onDisconnect.addListener(() => {
      out("nativeMessaging", `<div class="err">Disconnected: ${esc(chrome.runtime.lastError?.message || "no native host registered")}</div>
        <div class="muted">Expected — no native host is installed for this demo. A real extension with this permission would pair with a registered native app manifest on disk.</div>`);
      resolve();
    });
  })
);

item("Medium", "processes", "processes",
  `Lists every OS process backing the browser — tabs, extensions, GPU, plugins — with memory/CPU usage per
   process.`,
  async () => nsCall("processes", "processes", async (ns) => pre(await ns.getProcessInfo([], true)))
);

item("Medium", "storage", "storage",
  `This extension's own local / sync / session storage — where an extension would cache tokens, user state,
   or telemetry.`,
  async () => {
    const [local, sync, session] = await Promise.all([
      chrome.storage.local.get(null),
      chrome.storage.sync.get(null),
      chrome.storage.session.get(null)
    ]);
    out("storage", `<div class="muted">local</div>${pre(local)}<div class="muted">sync</div>${pre(sync)}<div class="muted">session</div>${pre(session)}`.slice(0, 6000));
  }
);

item("Medium", "system.memory", "system.memory",
  `Total and available system RAM, in bytes.`,
  async () => {
    const info = await chrome.system.memory.getInfo();
    out("system.memory", pre({
      capacityGB: (info.capacity / 1e9).toFixed(2),
      availableCapacityGB: (info.availableCapacity / 1e9).toFixed(2)
    }));
  }
);

item("Medium", "system.storage", "system.storage",
  `Every storage device/volume attached to this machine, with type and capacity.`,
  async () => {
    const units = await chrome.system.storage.getInfo();
    out("system.storage", table(units, [
      { label: "Name", get: (u) => u.name },
      { label: "Type", get: (u) => u.type },
      { label: "Capacity (GB)", get: (u) => (u.capacity / 1e9).toFixed(1) }
    ]));
  }
);

item("Medium", "topSites", "topSites",
  `Your most-visited sites, as shown on the new-tab page — a ready-made summary of what you use most.`,
  async () => {
    const sites = await chrome.topSites.get();
    out("topSites", table(sites, [
      { label: "Title", get: (s) => s.title },
      { label: "URL", get: (s) => s.url }
    ]));
  }
);

item("Medium", "ttsEngine", "ttsEngine",
  `Lets the extension register itself as a text-to-speech <em>voice provider</em> — other apps' speech would
   route through it. There's no data to query directly; it's an event listener
   (<code>chrome.ttsEngine.onSpeak</code>), not a call.`,
  async () => out("ttsEngine", `<div class="muted">chrome.ttsEngine is ${typeof chrome.ttsEngine === "undefined" ? "not " : ""}present. Nothing to fetch here — this permission only matters once something else calls chrome.tts.speak() and picks this extension's voice.</div>`)
);

item("Medium", "webNavigation", "webNavigation",
  `Every top-level page navigation across every tab, with transition type (typed, link, reload...).`,
  async () => {
    const { webNavigationLog = [] } = await chrome.storage.session.get("webNavigationLog");
    out("webNavigation", `<div class="muted">${webNavigationLog.length} buffered navigations (most recent last)</div>` +
      table(webNavigationLog.slice().reverse(), [
        { label: "Time", get: (r) => fmtTime(r.time) },
        { label: "Tab", get: (r) => r.tabId },
        { label: "URL", get: (r) => r.url },
        { label: "Transition", get: (r) => r.transitionType }
      ]));
  }
);

// ===== STANDARD =====

const A11Y_FEATURES = ["spokenFeedback", "largeCursor", "stickyKeys", "highContrast", "screenMagnifier",
  "autoclick", "virtualKeyboard", "caretHighlight", "cursorHighlight", "focusHighlight", "selectToSpeak",
  "switchAccess", "animationPolicy"];

async function readA11y() {
  const rows = [];
  for (const f of A11Y_FEATURES) {
    try {
      const r = await chrome.accessibilityFeatures[f].get({});
      rows.push({ feature: f, value: r.value, levelOfControl: r.levelOfControl });
    } catch (e) {
      rows.push({ feature: f, value: `error: ${e.message}`, levelOfControl: "" });
    }
  }
  return rows;
}

item("Standard", "accessibilityFeatures.modify", "accessibilityFeatures.modify",
  `Read AND change system accessibility settings (spoken feedback, high contrast, sticky keys, etc). This
   demo only reads current values — it never calls <code>.set()</code>, to avoid changing your real system
   settings.`,
  async () => out("accessibilityFeatures.modify", table(await readA11y(), [
    { label: "Feature", get: (r) => r.feature },
    { label: "Value", get: (r) => r.value },
    { label: "Level of control", get: (r) => r.levelOfControl }
  ]))
);

item("Standard", "accessibilityFeatures.read", "accessibilityFeatures.read",
  `Same accessibility settings, read-only permission variant (no <code>.set()</code> capability at all).`,
  async () => out("accessibilityFeatures.read", table(await readA11y(), [
    { label: "Feature", get: (r) => r.feature },
    { label: "Value", get: (r) => r.value },
    { label: "Level of control", get: (r) => r.levelOfControl }
  ]))
);

item("Standard", "activeTab", "activeTab",
  `Injects a script into your <em>current</em> tab and reads page structure — title, meta tags, form field
   types, link count, and whether <code>document.cookie</code> is reachable.`,
  async () => {
    const tab = await activeTabInfo();
    if (!tab?.id) return out("activeTab", '<div class="err">No active tab.</div>');
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const inputs = Array.from(document.querySelectorAll("input")).map((i) => ({ type: i.type, name: i.name || i.id || null }));
        return {
          title: document.title, url: location.href,
          metaDescription: document.querySelector('meta[name="description"]')?.content || null,
          formCount: document.forms.length, inputFields: inputs, linkCount: document.links.length,
          visibleTextLength: document.body?.innerText?.length || 0,
          cookieAccessible: !!document.cookie, cookieLength: document.cookie.length
        };
      }
    });
    out("activeTab", pre(result));
  }
);

item("Standard", "alarms", "alarms",
  `Schedules periodic background work independent of any page being open.`,
  async () => {
    await chrome.alarms.create("demo-alarm", { delayInMinutes: 1 });
    const all = await chrome.alarms.getAll();
    out("alarms", table(all, [
      { label: "Name", get: (a) => a.name },
      { label: "Scheduled time", get: (a) => fmtTime(a.scheduledTime) },
      { label: "Period (min)", get: (a) => a.periodInMinutes || "" }
    ]));
  }
);

item("Standard", "audio", "audio",
  `Lists and controls system audio input/output devices — ChromeOS only.`,
  async () => nsCall("audio", "audio", async (ns) => pre(await ns.getDevices({})))
);

item("Standard", "background", "background",
  `Legacy permission that let a background page keep running after all windows closed. In Manifest V3 this
   mostly does nothing extra — service workers already run independent of open windows.`,
  async () => out("background", `<div class="muted">chrome.runtime.getManifest().background: ${esc(JSON.stringify(chrome.runtime.getManifest().background))}</div>`)
);

item("Standard", "certificateProvider", "certificateProvider",
  `Lets the extension supply client certificates for smart-card style authentication — ChromeOS managed only.`,
  async () => nsCall("certificateProvider", "certificateProvider", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "clipboardRead", "clipboardRead",
  `Reads whatever is currently on your system clipboard, on demand.`,
  async () => {
    try {
      const text = await navigator.clipboard.readText();
      out("clipboardRead", `<div class="muted">Length: ${text.length}</div><pre>${esc(text.slice(0, 500))}</pre>`);
    } catch (e) {
      errOut("clipboardRead", e);
    }
  }
);

item("Standard", "contextMenus", "contextMenus",
  `Adds items to your right-click menu — this extension registered one at install
   ("Permission Library Inspector: inspect this"). Clicking it hands the extension the page URL,
   link URL, image URL, and any selected text you right-clicked on.`,
  async () => {
    const { contextMenuLog = [] } = await chrome.storage.session.get("contextMenuLog");
    out("contextMenus", `<div class="muted">${contextMenuLog.length} logged clicks on the demo menu item — right-click anywhere and choose it, then reload this panel</div>` + pre(contextMenuLog));
  }
);

item("Standard", "declarativeContent", "declarativeContent",
  `Lets the extension react to page content (e.g. "this page has a password field") and change its own
   action/icon — without ever injecting a content script or needing host permissions for that page. A rule
   like that was registered at install.`,
  async () => out("declarativeContent", `<div class="muted">chrome.declarativeContent is ${typeof chrome.declarativeContent === "undefined" ? "not " : ""}present. A rule is registered: show this extension's action icon whenever the active page contains input[type=password] — visit a login page and watch the toolbar icon.</div>`)
);

item("Standard", "dns", "dns",
  `Resolves any hostname to an IP address directly from the browser's resolver.`,
  null,
  `<div class="row">
     <input id="dns-host" type="text" placeholder="example.com" value="example.com" />
     <button class="load" data-load="dns">Resolve</button>
   </div>`
);

item("Standard", "desktopCapture", "desktopCapture",
  `Opens Chrome's screen/window/tab picker, then captures a live video frame of whatever you choose — full
   screen recording capability, gated only by that one-time picker.`,
  async () => {
    out("desktopCapture", '<div class="muted">Opening picker — choose a screen, window, or tab…</div>');
    const streamId = await new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], (id) => {
        if (!id) return reject(new Error("Picker cancelled."));
        resolve(id);
      });
    });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } }
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 200));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    stream.getTracks().forEach((t) => t.stop());
    out("desktopCapture", `<img src="${dataUrl}">`);
  }
);

item("Standard", "documentScan", "documentScan",
  `Drives an attached physical document scanner — ChromeOS only.`,
  async () => nsCall("documentScan", "documentScan", async (ns) => pre(await ns.getScannerList({})))
);

item("Standard", "enterprise.deviceAttributes", "enterprise.deviceAttributes",
  `Reads managed-device identifiers (asset ID, annotated location, directory device ID) — populated only on
   an enterprise-enrolled ChromeOS device.`,
  async () => nsCall("enterprise.deviceAttributes", "enterprise.deviceAttributes", async (ns) => pre({
    directoryDeviceId: await ns.getDirectoryDeviceId(),
    serialNumber: await ns.getDeviceSerialNumber(),
    assetId: await ns.getDeviceAssetId(),
    annotatedLocation: await ns.getDeviceAnnotatedLocation()
  }))
);

item("Standard", "enterprise.hardwarePlatform", "enterprise.hardwarePlatform",
  `Manufacturer and model of the physical machine — works outside ChromeOS too.`,
  async () => nsCall("enterprise.hardwarePlatform", "enterprise.hardwarePlatform", async (ns) => pre(await ns.getHardwarePlatformInfo()))
);

item("Standard", "enterprise.networkingAttributes", "enterprise.networkingAttributes",
  `Reads the device's network config (MAC address, IP, gateway) — ChromeOS managed only.`,
  async () => nsCall("enterprise.networkingAttributes", "enterprise.networkingAttributes", async (ns) => pre(await ns.getNetworkDetails()))
);

item("Standard", "enterprise.platformKeys", "enterprise.platformKeys",
  `Manages device-wide client certificates for enterprise auth — ChromeOS managed only.`,
  async () => nsCall("enterprise.platformKeys", "enterprise.platformKeys", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "favicon", "favicon",
  `Fetches any site's favicon straight from Chrome's internal favicon cache — no host permission, no network
   request, just a peek at what Chrome already knows you've visited.`,
  null,
  `<div class="row">
     <input id="favicon-domain" type="text" placeholder="https://example.com" value="https://example.com" />
     <button class="load" data-load="favicon">Fetch favicon</button>
   </div>`
);

item("Standard", "fileBrowserHandler", "fileBrowserHandler",
  `Adds custom actions to the ChromeOS Files app file picker — ChromeOS only.`,
  async () => nsCall("fileBrowserHandler", "fileBrowserHandler", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "fontSettings", "fontSettings",
  `Reads (and can change) your browser's default fonts and sizes for every script/generic family.`,
  async () => {
    const [font, size, fixedSize] = await Promise.all([
      chrome.fontSettings.getFont({ genericFamily: "standard" }),
      chrome.fontSettings.getDefaultFontSize(),
      chrome.fontSettings.getDefaultFixedFontSize()
    ]);
    out("fontSettings", pre({ standardFont: font, defaultFontSize: size, defaultFixedFontSize: fixedSize }));
  }
);

item("Standard", "gcm", "gcm",
  `Lets the extension register for and receive push messages via Google Cloud Messaging/Firebase. No data to
   read without a registered sender project — this just confirms the API surface exists.`,
  async () => out("gcm", `<div class="muted">chrome.gcm is ${typeof chrome.gcm === "undefined" ? "not " : ""}present. MAX_MESSAGE_SIZE: ${chrome.gcm?.MAX_MESSAGE_SIZE ?? "n/a"}</div>`)
);

item("Standard", "history", "history",
  `Full browsing history: URL, title, visit count, last visit time.`,
  async () => {
    const items = await chrome.history.search({ text: "", maxResults: 200, startTime: 0 });
    out("history", table(items, [
      { label: "Visited", get: (i) => fmtTime(i.lastVisitTime) },
      { label: "Title", get: (i) => i.title },
      { label: "URL", get: (i) => i.url },
      { label: "Visits", get: (i) => i.visitCount }
    ]));
  }
);

item("Standard", "identity", "identity",
  `Your Chrome-signed-in profile: account id.`,
  async () => out("identity", pre(await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" })))
);

item("Standard", "identity.email", "identity.email",
  `Same call as identity, but this permission additionally grants the emailAddress field.`,
  async () => out("identity.email", pre(await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" })))
);

item("Standard", "idle", "idle",
  `Whether the system is active, idle, or locked. Updates live as your idle state changes.`,
  async () => {
    const state = await chrome.idle.queryState(15);
    out("idle", `<div>Current state: <strong>${esc(state)}</strong></div>`);
  }
);

item("Standard", "loginState", "loginState",
  `Reads the ChromeOS login/session state (locked, in-session, login-screen) — ChromeOS only.`,
  async () => nsCall("loginState", "loginState", async (ns) => pre({ profileType: await ns.getProfileType(), sessionState: await ns.getSessionState() }))
);

item("Standard", "notifications", "notifications",
  `Fires an OS-level notification.`,
  async () => {
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "https://www.google.com/favicon.ico",
      title: "Permission Library Inspector",
      message: "This is what a notifications-permission extension can push to your OS, any time it wants."
    });
    out("notifications", '<div class="muted">Notification fired.</div>');
  }
);

item("Standard", "offscreen", "offscreen",
  `Gives the background service worker access to DOM-only APIs, like reading the clipboard, without opening
   any visible page. This manifest also has clipboardRead, so this should actually succeed.`,
  () => new Promise(async (resolve) => {
    out("offscreen", '<div class="muted">Creating offscreen document…</div>');
    await chrome.runtime.sendMessage({ type: "ensure-offscreen" });
    chrome.runtime.sendMessage({ type: "offscreen-clipboard-check" }, (resp) => {
      if (resp?.ok) {
        out("offscreen", `<div>Clipboard read succeeded via offscreen doc — length ${resp.length}, preview: "${esc(resp.preview)}"</div>`);
      } else {
        out("offscreen", `<div class="err">Blocked: ${esc(resp?.error || "unknown error")}</div>`);
      }
      resolve();
    });
  })
);

item("Standard", "pageCapture", "pageCapture",
  `Saves the entire active tab — fully rendered HTML, CSS, and images — as one MHTML snapshot. This bypasses
   normal host-permission scoping entirely; that's the whole point of the permission.`,
  async () => {
    const tab = await activeTabInfo();
    if (!tab?.id) return out("pageCapture", '<div class="err">No active tab.</div>');
    const blob = await chrome.pageCapture.saveAsMHTML({ tabId: tab.id });
    const preview = await blob.slice(0, 600).text();
    out("pageCapture", `<div class="muted">Captured ${(blob.size / 1024).toFixed(1)} KB MHTML snapshot of the active tab.</div><pre>${esc(preview)}</pre>`);
  }
);

item("Standard", "platformKeys", "platformKeys",
  `Lets the extension use client certificates installed on this machine for authentication (smart-card style
   login) — not invoked here since it would open a real certificate picker.`,
  async () => out("platformKeys", `<div class="muted">chrome.platformKeys is ${typeof chrome.platformKeys === "undefined" ? "not " : ""}present. Not invoked — selectClientCertificates() would open a real certificate-selection prompt tied to your installed certs.</div>`)
);

item("Standard", "power", "power",
  `Can keep your system/display awake indefinitely, overriding your power settings.`,
  async () => {
    chrome.power.requestKeepAwake("display");
    chrome.power.releaseKeepAwake();
    out("power", '<div class="muted">Called requestKeepAwake("display") then releaseKeepAwake() — both succeeded with no error. Left running, the first call alone would stop your screen from ever sleeping.</div>');
  }
);

item("Standard", "printerProvider", "printerProvider",
  `Lets the extension act as a printer driver, seeing every print job's content — ChromeOS only.`,
  async () => nsCall("printerProvider", "printerProvider", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "printing", "printing",
  `Lists configured printers and can submit print jobs directly — ChromeOS only.`,
  async () => nsCall("printing", "printing", async (ns) => pre(await ns.getPrinters()))
);

item("Standard", "printingMetrics", "printingMetrics",
  `Sees a history of every print job on this device, including document titles — ChromeOS only.`,
  async () => nsCall("printingMetrics", "printingMetrics", async (ns) => pre(await ns.getPrintJobs()))
);

item("Standard", "privacy", "privacy",
  `Reads (and can change) your privacy/security toggles — third-party cookies, network prediction, WebRTC IP
   handling, autofill, password saving.`,
  async () => {
    const paths = [
      "network.networkPredictionEnabled", "network.webRTCIPHandlingPolicy",
      "websites.hyperlinkAuditingEnabled", "websites.thirdPartyCookiesAllowed",
      "services.autofillAddressEnabled", "services.passwordSavingEnabled"
    ];
    const rows = [];
    for (const p of paths) {
      const ns = getNS(`privacy.${p}`);
      if (!ns) { rows.push({ setting: p, value: "not available in this Chrome build" }); continue; }
      try {
        const r = await ns.get({});
        rows.push({ setting: p, value: JSON.stringify(r.value) });
      } catch (e) {
        rows.push({ setting: p, value: `error: ${e.message}` });
      }
    }
    out("privacy", table(rows, [{ label: "Setting", get: (r) => r.setting }, { label: "Value", get: (r) => r.value }]));
  }
);

item("Standard", "proxy", "proxy",
  `Reads the browser's current proxy configuration — read-only here, but the same API can silently redirect
   ALL of your traffic through an attacker-controlled proxy. That call is never made in this demo.`,
  async () => out("proxy", pre(await chrome.proxy.settings.get({ incognito: false })))
);

item("Standard", "readingList", "readingList",
  `Everything saved to your browser's reading list.`,
  async () => {
    const entries = await chrome.readingList.query({});
    out("readingList", table(entries, [
      { label: "Title", get: (e) => e.title },
      { label: "URL", get: (e) => e.url },
      { label: "Read?", get: (e) => e.hasBeenRead }
    ]));
  }
);

item("Standard", "runtime", "runtime",
  `The baseline permission every extension has. Its own manifest and identity.`,
  async () => out("runtime", `<div class="muted">Extension ID: ${esc(chrome.runtime.id)}</div>${pre(chrome.runtime.getManifest())}`)
);

item("Standard", "scripting", "scripting",
  `Injects a script into every currently open tab matching its host permissions — not just the active one,
   and with no user click required per tab.`,
  async () => {
    const tabs = (await chrome.tabs.query({})).filter((t) => /^https?:/.test(t.url || "")).slice(0, 20);
    const rows = [];
    for (const t of tabs) {
      try {
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => document.title });
        rows.push({ tabId: t.id, url: t.url, title: result });
      } catch (e) {
        rows.push({ tabId: t.id, url: t.url, title: `error: ${e.message}` });
      }
    }
    out("scripting", `<div class="muted">Scripted ${rows.length} open tabs silently</div>` + table(rows, [
      { label: "Tab", get: (r) => r.tabId }, { label: "URL", get: (r) => r.url }, { label: "document.title read", get: (r) => r.title }
    ]));
  }
);

item("Standard", "search", "search",
  `Can trigger a search with your default search engine directly — this opens a new tab.`,
  null,
  `<div class="row">
     <input id="search-text" type="text" placeholder="search text" value="permission library inspector demo" />
     <button class="load" data-load="search">Run search (opens new tab)</button>
   </div>`
);

item("Standard", "sessions", "sessions",
  `Every recently closed tab and window, with enough info to restore them.`,
  async () => {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
    const rows = sessions.map((s) => s.tab || s.window || {});
    out("sessions", pre(rows));
  }
);

item("Standard", "sidePanel", "sidePanel",
  `Can open and control a persistent side panel next to any page.`,
  async () => {
    try {
      const opts = await chrome.sidePanel.getOptions({});
      out("sidePanel", pre(opts));
    } catch (e) {
      errOut("sidePanel", e);
    }
  }
);

item("Standard", "system.cpu", "system.cpu",
  `CPU model, architecture, and core count of this machine.`,
  async () => out("system.cpu", pre(await chrome.system.cpu.getInfo()))
);

item("Standard", "system.display", "system.display",
  `Every monitor attached to this machine — resolution, position, and layout. Reveals your exact physical
   multi-monitor setup.`,
  async () => out("system.display", pre(await chrome.system.display.getInfo()))
);

item("Standard", "tabCapture", "tabCapture",
  `Captures a live video frame from a tab's rendered content. Can only be demoed here capturing this very
   page, since triggering it requires this tab to be the active one — in a real extension the same call fires
   on whatever tab is active when a background event triggers it.`,
  async () => {
    const stream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ video: true, audio: false }, (s) => {
        if (!s) return reject(new Error(chrome.runtime.lastError?.message || "capture failed"));
        resolve(s);
      });
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 200));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    stream.getTracks().forEach((t) => t.stop());
    out("tabCapture", `<img src="${dataUrl}">`);
  }
);

item("Standard", "tabGroups", "tabGroups",
  `Every tab group you've created — title, color, which tabs are in it.`,
  async () => {
    const groups = await chrome.tabGroups.query({});
    out("tabGroups", table(groups, [
      { label: "Title", get: (g) => g.title }, { label: "Color", get: (g) => g.color }, { label: "Window", get: (g) => g.windowId }
    ]));
  }
);

item("Standard", "tabs", "tabs",
  `Lists every open tab across all windows: URL, title, favicon, audio/pinned state.`,
  async () => {
    const tabs = await chrome.tabs.query({});
    out("tabs", `<div class="muted">${tabs.length} open tabs</div>` + table(tabs, [
      { label: "Title", get: (t) => t.title }, { label: "URL", get: (t) => t.url },
      { label: "Window", get: (t) => t.windowId }, { label: "Pinned", get: (t) => t.pinned }, { label: "Audible", get: (t) => t.audible }
    ]));
  }
);

item("Standard", "tts", "tts",
  `Speaks arbitrary text out loud through your speakers, unprompted.`,
  async () => {
    chrome.tts.speak('This is Permission Library Inspector, talking through your speakers, using nothing but the tts permission.');
    out("tts", '<div class="muted">chrome.tts.speak() called.</div>');
  }
);

item("Standard", "unlimitedStorage", "unlimitedStorage",
  `Removes the quota cap on this extension's local storage / IndexedDB — normally capped at a few MB.`,
  async () => {
    const bytes = await chrome.storage.local.getBytesInUse(null);
    out("unlimitedStorage", `<div class="muted">Current chrome.storage.local usage: ${bytes} bytes, with no cap enforced because of this permission.</div>`);
  }
);

item("Standard", "vpnProvider", "vpnProvider",
  `Lets the extension implement a full VPN client, seeing and routing all network traffic — ChromeOS only.`,
  async () => nsCall("vpnProvider", "vpnProvider", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "wallpaper", "wallpaper",
  `Can set the ChromeOS desktop wallpaper — ChromeOS kiosk/managed only, deprecated for regular extensions.`,
  async () => nsCall("wallpaper", "wallpaper", async (ns) => pre(Object.keys(ns)))
);

item("Standard", "webAuthenticationProxy", "webAuthenticationProxy",
  `Can intercept every WebAuthn/passkey request in the browser — logins, security key prompts — before the OS
   ever sees them. Deliberately not attached here: doing so would actually start intercepting your real
   passkey flows for this browser profile.`,
  async () => out("webAuthenticationProxy", `<div class="muted">chrome.webAuthenticationProxy is ${typeof chrome.webAuthenticationProxy === "undefined" ? "not " : ""}present. attach()/detach() exist but are not called by this demo.</div>`)
);

item("Standard", "webRequestBlocking", "webRequestBlocking",
  `In Manifest V2 this let an extension synchronously block/modify every request. Manifest V3 restricts it to
   force-installed (policy-managed) extensions — this button shows what happens when a normal extension tries
   anyway.`,
  async () => {
    try {
      chrome.webRequest.onBeforeRequest.addListener(() => {}, { urls: ["<all_urls>"] }, ["blocking"]);
      out("webRequestBlocking", '<div class="muted">Listener registered with no error — this Chrome build allowed it.</div>');
    } catch (e) {
      errOut("webRequestBlocking", e);
    }
  }
);

// ---- custom multi-button loaders (referenced by extraHtml above) ----
const AUTH_COOKIE_RE = /(sess|auth|token|jwt|^sid$|sid$|id_token|access_token|refresh_token|connect\.sid|jsessionid|__secure|__host|casdoor|okta|saml|login)/i;

let lastCookies = [];
let lastCookiesLabel = "";
let revealCookies = false;

function maskValue(value, reveal) {
  if (reveal) return esc(value);
  if (value.length <= 8) return "•".repeat(value.length);
  return esc(`${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`);
}

function downloadCookie(c) {
  const record = {
    domain: c.domain, name: c.name, value: c.value, path: c.path,
    httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
    session: c.session, expirationDate: c.expirationDate ?? null,
    expires: c.session ? "session" : fmtTime(c.expirationDate * 1000),
    curlCookieHeader: `${c.name}=${c.value}`
  };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safe = (s) => String(s).replace(/[^a-z0-9_.-]/gi, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `cookie_${safe(c.domain)}_${safe(c.name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderCookies() {
  const rows = lastCookies.slice().sort((a, b) => a.domain === b.domain ? a.name.localeCompare(b.name) : a.domain.localeCompare(b.domain));
  if (!rows.length) {
    out("cookies", `<div class="muted">${esc(lastCookiesLabel)}</div><div class="muted">No cookies found.</div>`);
    return;
  }
  const flaggedCount = rows.filter((c) => AUTH_COOKIE_RE.test(c.name)).length;
  const body = rows.map((c, i) => {
    const flagged = AUTH_COOKIE_RE.test(c.name);
    const expires = c.session ? "session" : fmtTime(c.expirationDate * 1000);
    return `<tr class="${flagged ? "flagged" : ""}">
      <td title="${esc(c.domain)}">${esc(c.domain)}</td>
      <td title="${esc(c.name)}">${esc(c.name)}${flagged ? '<span class="flag-badge">LIKELY AUTH</span>' : ""}</td>
      <td title="${revealCookies ? esc(c.value) : "hidden — check Reveal full values"}">${maskValue(c.value, revealCookies)}</td>
      <td>${c.httpOnly}</td><td>${c.secure}</td><td title="${esc(c.sameSite)}">${esc(c.sameSite)}</td>
      <td title="${esc(expires)}">${esc(expires)}</td><td title="${esc(c.path)}">${esc(c.path)}</td>
      <td><button type="button" class="load cookie-download" data-idx="${i}" style="margin:0;padding:4px 10px;">Download</button></td>
    </tr>`;
  }).join("");
  out("cookies", `<div class="muted">${esc(lastCookiesLabel)} — ${rows.length} cookies, ${flaggedCount} flagged as likely auth/session
    &nbsp;<label class="reveal-toggle" style="display:inline"><input type="checkbox" id="cookie-reveal-inline" ${revealCookies ? "checked" : ""}> Reveal full values</label></div>
    <table><thead><tr><th>Domain</th><th>Name</th><th>Value</th><th>HttpOnly</th><th>Secure</th><th>SameSite</th><th>Expires</th><th>Path</th><th>Download</th></tr></thead><tbody>${body}</tbody></table>`);
  document.getElementById("cookie-reveal-inline")?.addEventListener("change", (e) => {
    revealCookies = e.target.checked;
    renderCookies();
  });
  document.getElementById("out-cookies")?.querySelectorAll(".cookie-download").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadCookie(rows[Number(btn.dataset.idx)]);
    });
  });
}

const customLoaders = {
  async "cookies-domain"() {
    let domain = document.getElementById("cookie-domain").value.trim();
    if (!domain) {
      const tab = await activeTabInfo();
      try { domain = new URL(tab?.url || "").hostname; } catch { domain = ""; }
    }
    if (!domain) return out("cookies", '<div class="err">Enter a domain, or open a normal web page as the active tab.</div>');
    lastCookies = await chrome.cookies.getAll({ domain });
    lastCookiesLabel = `Cookies for domain: ${domain} (includes subdomains)`;
    renderCookies();
  },
  async "cookies-all"() {
    const all = await chrome.cookies.getAll({});
    lastCookies = all.slice(0, 300);
    lastCookiesLabel = `All cookies in the default cookie store (capped at 300 of ${all.length} total)`;
    renderCookies();
  },
  async "contentsettings"() {
    let url = document.getElementById("cs-url").value.trim();
    if (!url) {
      const tab = await activeTabInfo();
      url = tab?.url || "";
    }
    if (!url || !/^https?:\/\//.test(url)) {
      return out("contentSettings", '<div class="err">Enter a valid http(s) URL, or open a normal web page as the active tab.</div>');
    }
    const settings = ["cookies", "images", "javascript", "popups", "notifications", "location"];
    const rows = [];
    for (const key of settings) {
      try {
        const r = await chrome.contentSettings[key].get({ primaryUrl: url });
        rows.push({ key, setting: r.setting });
      } catch (e) {
        rows.push({ key, setting: `error: ${e.message}` });
      }
    }
    out("contentSettings", `<div class="muted">Settings for ${esc(url)}</div>` + table(rows, [{ label: "Setting", get: (r) => r.key }, { label: "Value", get: (r) => r.setting }]));
  },
  async "dns"() {
    const host = document.getElementById("dns-host").value.trim() || "example.com";
    const result = await chrome.dns.resolve(host);
    out("dns", pre(result));
  },
  async "favicon"() {
    const pageUrl = document.getElementById("favicon-domain").value.trim() || "https://example.com";
    const src = `chrome://favicon2/?size=32&scale_factor=1x&page_url=${encodeURIComponent(pageUrl)}&allow_google_server_fallback=0`;
    out("favicon", `<div class="muted">Requested favicon for ${esc(pageUrl)} straight from Chrome's cache — no network request, no host permission needed for this specific site.</div><img src="${src}">`);
  },
  async "search"() {
    const text = document.getElementById("search-text").value.trim() || "test";
    await chrome.search.query({ text, disposition: "NEW_TAB" });
    out("search", `<div class="muted">Ran chrome.search.query({text: "${esc(text)}"}) — check the new tab it opened.</div>`);
  }
};

// ---- assemble loaders: item.run (if present) plus any custom ones ----
const loaders = {};
for (const it of ITEMS) {
  if (it.run) loaders[it.id] = it.run;
}
Object.assign(loaders, customLoaders);

// ---- render nav + panels ----
const GROUP_CLASS = { Critical: "critical", High: "high", Medium: "medium", Standard: "standard" };
const navGroupsEl = document.getElementById("nav-groups");
const panelsEl = document.getElementById("panels");

let currentGroup = null;
for (const it of ITEMS) {
  if (it.group !== currentGroup) {
    currentGroup = it.group;
    const sep = document.createElement("div");
    sep.className = "navsep";
    sep.innerHTML = `<span class="risk-dot ${GROUP_CLASS[it.group]}"></span>${esc(it.group)}`;
    navGroupsEl.appendChild(sep);
  }
  const btn = document.createElement("button");
  btn.className = "navbtn";
  btn.dataset.target = it.id;
  btn.innerHTML = `<span>${esc(it.label)}</span>`;
  navGroupsEl.appendChild(btn);

  const section = document.createElement("section");
  section.className = "panel";
  section.id = it.id;
  section.innerHTML = `
    <h1>${esc(it.label)} <span class="risk-tag ${GROUP_CLASS[it.group]}">${esc(it.group)}</span></h1>
    <p class="desc">${it.desc}</p>
    ${it.extraHtml || `<button class="load" data-load="${it.id}">Load</button>`}
    <div class="out" id="out-${it.id}"></div>
  `;
  panelsEl.appendChild(section);
}

document.querySelectorAll(".navbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target)?.classList.add("active");
  });
});

document.getElementById("search-box").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll(".navbtn").forEach((btn) => {
    if (btn.dataset.target === "overview") return;
    const match = !q || btn.dataset.target.toLowerCase().includes(q);
    btn.style.display = match ? "" : "none";
  });
  document.querySelectorAll(".navsep").forEach((sep) => {
    let sib = sep.nextElementSibling;
    let anyVisible = false;
    while (sib && sib.classList.contains("navbtn")) {
      if (sib.style.display !== "none") anyVisible = true;
      sib = sib.nextElementSibling;
    }
    sep.style.display = anyVisible ? "" : "none";
  });
});

document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest(".load");
  if (!btn) return;
  const key = btn.dataset.load;
  if (!loaders[key]) return;
  btn.disabled = true;
  try {
    await loaders[key]();
  } catch (err) {
    const panel = btn.closest(".panel");
    errOut(panel ? panel.id : key, err);
  } finally {
    btn.disabled = false;
  }
});
