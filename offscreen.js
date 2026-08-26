chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "offscreen-clipboard-check") {
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        sendResponse({ ok: true, length: text.length, preview: text.slice(0, 40) });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});
