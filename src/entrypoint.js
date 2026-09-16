/** @returns {boolean} */
function isUserscript() {
	return typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
}

/** THIS FILE IS RUN FIRST, ANY SETUP/INIT REQUIRED BELONGS HERE */
(async function entrypoint() {
	if (document.documentMode) return showAlert('EarthMC Dynmap+ has been disabled. Internet Explorer pleb detected.', null, false)

	/** @type {chrome.runtime.ManifestV3} */
	const manifest = isUserscript() ? MANIFEST : chrome.runtime.getManifest()
	if (!isUserscript()) {
		// Any scripts that need to be injected into the page context should be specified in 
		// manifest.json under 'web_accessible_resources' in order of least-dependent first.
		const resources = manifest.web_accessible_resources[0].resources
		const jsFiles = resources.filter(s => s.endsWith('.js'))
		for (const file of jsFiles) {
			await injectScript(file)
		}
	}

	// Modify map markers with our own. This fires after markers.json was successfully intercepted.
	document.addEventListener('EMCDYNMAPPLUS_INTERCEPT', async e => {
		const { url, data } = e.detail
		const evOpts = { url, data, wasModified: false }

		try {
			evOpts.data = await modifyMarkers(data)
			evOpts.wasModified = true
		} catch (err) {
			console.error(`Error modifying data of: ${url}\n`, err)
		}

		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_MODIFIED', { detail: evOpts }))
	})

	// If not 'complete' or 'interactive', defer init until DOM is ready.
    if (document.readyState !== 'loading') init(manifest)
    else document.addEventListener('DOMContentLoaded', _ => init(manifest))
})()

/** 
 * Injects a file into the page context given the path to it.
 * This is similar to adding \<script src="main.js"></script> to an HTML file.
 * @param {string} resource - The path/filename to/of the file to inject.
 * @param {string} local - Whether the file should be injected locally (text) or external (src).
 * @returns {Promise<void>}
 */
function injectScript(resource) {
	return new Promise(resolve => {
		const script = document.createElement('script')
		script.src = chrome.runtime.getURL(resource) // replaced at build time for userscript
		script.onload = () => { script.remove(); resolve() }
		(document.head || document.documentElement).appendChild(script)
	})
}

/** @param {chrome.runtime.ManifestV3} manifest */
async function init(manifest) {
	if (isUserscript()) GM_addStyle(GM_getResourceText("style-css"))
	else {
		const root = document.documentElement.style
		root.setProperty('--screenshot-bg-image', `url("${chrome.runtime.getURL('resources/img/icon-screenshot.png')}")`)
		root.setProperty('--show-icon', `url("${chrome.runtime.getURL('resources/img/icon-show.png')}")`)
		root.setProperty('--hide-icon', `url("${chrome.runtime.getURL('resources/img/icon-hide.png')}")`)
	}

	// Initialize localStorage values if they don't exist yet.
	Store.local.tryInit('mapmode', MapMode.MEGANATIONS.name)
	Store.local.tryInit('normalize-scroll', true)
	Store.local.tryInit('darkmode', true)
	Store.local.tryInit('darkened', true)
	Store.local.tryInit('serverinfo', true)
	Store.local.tryInit('playerlist', true)
	Store.local.tryInit('capital-stars', true)
	Store.local.tryInit('nation-claims-opaque-colors', true)
	Store.local.tryInit('nation-claims-show-excluded', true)

	//#region UI Elements
	console.log("emcdynmapplus: Initializing UI elements..")

	insertCustomStylesheets()
	await insertExtensionMenu()
	await insertMapModeSelector()
	updateServerInfo(await insertServerInfoPanel())
	await insertPlayerList()

    await editUILayout()
	await insertScreenshotBtn()

	const insertedPanel = await tryInsertNationClaimsPanel(MapMode.NATIONCLAIMS)
	if (insertedPanel) loadNationClaims(insertedPanel)

	initToggleOptions()
	//#endregion

	checkForUpdate(manifest)
}

/** @param {chrome.runtime.ManifestV3} manifest */
function checkForUpdate(manifest) {
    const latestVer = manifest.version
    const cachedVer = Store.local.get('version')
	
	console.log("emcdynmapplus: current version is: " + latestVer)
    if (cachedVer && cachedVer !== latestVer) {
        showAlert(`Extension has been automatically updated from v${cachedVer} to v${latestVer}.`)
    }

    Store.local.set('version', latestVer)
}