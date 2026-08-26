const MAX_LOG_ENTRIES = 150;

let webRequestBuffer = [];
let webNavigationBuffer = [];
let contextMenuBuffer = [];
let ruleMatchBuffer = [];
let flushScheduled = false;

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

chrome.runtime.onInstalled.addListener(() => {
  openDashboard();

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "permission-library-demo",
      title: 'Danger Extension: inspect this',
      contexts: ["all"]
    });
  });

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        id: "password-field-rule",
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            css: ["input[type='password']"]
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});

chrome.action.onClicked.addListener(openDashboard);

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(async () => {
    flushScheduled = false;
    try {
      await chrome.storage.session.set({
        webRequestLog: webRequestBuffer.slice(-MAX_LOG_ENTRIES),
        webNavigationLog: webNavigationBuffer.slice(-MAX_LOG_ENTRIES),
        contextMenuLog: contextMenuBuffer.slice(-MAX_LOG_ENTRIES),
        ruleMatchLog: ruleMatchBuffer.slice(-MAX_LOG_ENTRIES)
      });
    } catch (e) {
      // storage.session may be briefly unavailable during SW startup; next flush will retry
    }
  }, 750);
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    webRequestBuffer.push({
      time: details.timeStamp,
      method: details.method,
      type: details.type,
      url: details.url,
      tabId: details.tabId,
      requestHeaders: (details.requestHeaders || []).map((h) => h.name)
    });
    if (webRequestBuffer.length > MAX_LOG_ENTRIES * 2) {
      webRequestBuffer = webRequestBuffer.slice(-MAX_LOG_ENTRIES);
    }
    scheduleFlush();
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  webNavigationBuffer.push({
    time: details.timeStamp,
    tabId: details.tabId,
    url: details.url,
    transitionType: details.transitionType
  });
  if (webNavigationBuffer.length > MAX_LOG_ENTRIES * 2) {
    webNavigationBuffer = webNavigationBuffer.slice(-MAX_LOG_ENTRIES);
  }
  scheduleFlush();
});

chrome.idle.onStateChanged.addListener((state) => {
  chrome.storage.session.set({ idleState: { state, time: Date.now() } });
});

chrome.contextMenus.onClicked.addListener((info) => {
  contextMenuBuffer.push({
    time: Date.now(),
    pageUrl: info.pageUrl,
    linkUrl: info.linkUrl,
    srcUrl: info.srcUrl,
    selectionText: info.selectionText,
    mediaType: info.mediaType
  });
  scheduleFlush();
});

if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    ruleMatchBuffer.push({ time: Date.now(), ...info });
    if (ruleMatchBuffer.length > MAX_LOG_ENTRIES * 2) {
      ruleMatchBuffer = ruleMatchBuffer.slice(-MAX_LOG_ENTRIES);
    }
    scheduleFlush();
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ensure-offscreen") {
    (async () => {
      const has = await chrome.offscreen.hasDocument?.();
      if (!has) {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["DOM_PARSER", "CLIPBOARD"],
          justification: "Demonstrate offscreen-document capability for the permission library demo"
        });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
