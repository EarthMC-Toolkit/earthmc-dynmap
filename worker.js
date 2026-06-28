chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
	if (msg?.type !== 'fetch') return

	fetch(msg.url)
		.then(r => r.text())
		.then(text => sendResponse({ ok: true, text }))
		.catch(err => sendResponse({ ok: false, error: String(err) }))

	return true
})