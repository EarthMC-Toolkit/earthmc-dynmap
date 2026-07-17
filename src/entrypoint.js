/** @returns {boolean} */
function isUserscript() {
	return typeof IS_USERSCRIPT !== 'undefined' && IS_USERSCRIPT
}

/** THIS FILE IS RUN FIRST, ANY SETUP/INIT REQUIRED BELONGS HERE */
(async function entrypoint() {
	if (window.L.Browser.ielt9) return showAlertNoDismiss('EarthMC Dynmap+ has been disabled. Internet Explorer pleb detected.')
	if (window.L.Browser.canvas) return showAlertNoDismiss('EarthMC Dynmap+ has been disabled. Internet Explorer pleb detected.')

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

/** @param {Manifest} manifest */
async function init(manifest) {
	if (isUserscript()) GM_addStyle(STYLE_CSS)
	else {
		const root = document.documentElement.style
		root.setProperty('--screenshot-bg-image', `url("${chrome.runtime.getURL('resources/img/icon-screenshot.png')}")`)
		root.setProperty('--show-icon', `url("${chrome.runtime.getURL('resources/img/icon-show.png')}")`)
		root.setProperty('--hide-icon', `url("${chrome.runtime.getURL('resources/img/icon-hide.png')}")`)
	}

    localStorage['emcdynmapplus-mapmode'] ??= MapMode.MEGANATIONS.name
	localStorage['emcdynmapplus-normalize-scroll'] ??= 'true'
    localStorage['emcdynmapplus-darkened'] ??= 'true'
	localStorage['emcdynmapplus-serverinfo'] ??= 'true'
	localStorage['emcdynmapplus-playerlist'] ??= 'true'
	localStorage['emcdynmapplus-capital-stars'] ??= 'true'

	localStorage['emcdynmapplus-nation-claims-opaque-colors'] ??= 'true'
	localStorage['emcdynmapplus-nation-claims-show-excluded'] ??= 'true'

	console.log("emcdynmapplus: Initializing UI elements..")

	insertCustomStylesheets()
    
	await insertExtensionMenu()
	await insertMapModeSelector()
	updateServerInfo(await insertServerInfoPanel())
	await insertPlayerList()

    await editUILayout()
	await insertScreenshotBtn()

	const insertedPanel = await tryInsertNationClaimsPanel(MapMode.NATION_CLAIMS)
	if (insertedPanel) loadNationClaims(insertedPanel)

	initToggleOptions()
	checkForUpdate(manifest)
}

/** @param {Manifest} manifest */
function checkForUpdate(manifest) {
    const latestVer = manifest.version
    const cachedVer = Store.local.get('version')
	
	console.log("emcdynmapplus: current version is: " + latestVer)
    if (cachedVer && cachedVer !== latestVer) {
        showAlert(`Extension has been automatically updated from v${cachedVer} to v${latestVer}.`)
    }

    Store.local.set('version', latestVer)
}