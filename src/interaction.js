/** ANY CODE RELATING TO ONSCREEN INTERACTION GOES HERE IF IT DOES NOT HAVE ITS OWN FILE */

/** @param {boolean} boxTicked */
function toggleDarkened(boxTicked) {
	const element = document.querySelector('.leaflet-tile-pane')
	if (!element) return showAlert('Failed to toggle brightness. Cannot apply filter to non-existent tile pane.', 4)

	Store.local.set('darkened', boxTicked)
	element.style.filter = boxTicked ? getTilePaneFilter() : ''
}

/** @param {boolean} boxTicked */
function toggleServerInfo(boxTicked) {
	Store.local.set('serverinfo', boxTicked)

	/** @type {HTMLElement} */
	const serverInfoPanel = document.querySelector('#server-info')
	serverInfoPanel.style.display = boxTicked ? 'block' : 'none'

	if (!boxTicked) {
		if (serverInfoScheduler != null) clearTimeout(serverInfoScheduler) // stop future runs
		serverInfoScheduler = null
		return
	}

	if (serverInfoScheduler == null) updateServerInfo(serverInfoPanel) // immediate fetch without spam
}

/** @param {boolean} boxTicked */
function togglePlayerList(boxTicked) {
	Store.local.set('playerlist', boxTicked)
	const playerList = document.getElementById('players')

	const isVisible = boxTicked ? 'grid' : 'none'
	playerList?.setAttribute('style', `display: ${isVisible};`)

	if (boxTicked) showAlert('If the player tracking functionality breaks, just hit refresh :)', 1.5)
}

/** @param {boolean} boxTicked */
async function toggleShowCapitalStars(boxTicked) {
	Store.local.set('capital-stars', boxTicked)
	
	/** @type {Array<HTMLImageElement>} */
	const icons = await waitForElement("img[src*='towny_capital_icon.png']", true)
	icons.forEach(img => boxTicked ? img.style.removeProperty("display") : img.style.setProperty("display", "none", "important"))
}

//#region Dark Mode
/** @param {boolean} boxTicked */
function toggleDarkMode(boxTicked) {
	Store.local.set('darkmode', boxTicked)
	return boxTicked ? loadDarkMode() : unloadDarkMode()
}

function loadDarkMode() {
	// tell browser not to apply its auto dark mode.
	// this fixes some inverted elements when both are enabled.
	document.documentElement.style.colorScheme = 'dark'
	document.head.insertAdjacentHTML('beforeend', INSERTABLE_HTML.darkMode)
}

function unloadDarkMode() {
	document.documentElement.style.removeProperty('color-scheme')

	const darkModeEl = document.querySelector('#dark-mode')
	if (darkModeEl) darkModeEl.remove()
	waitForElement('.leaflet-map-pane').then(el => el.style.filter = '')
}
//#endregion

//#region Scroll normalization
let scrollListener = null

/** @param {HTMLElement} mapEl */
function addScrollNormalizer(mapEl) {
    scrollListener = e => {
        e.preventDefault()  // Prevent default scroll behavior (so Leaflet doesn't zoom immediately)
        triggerScrollEvent(e.deltaY)
    }

    mapEl.addEventListener('wheel', scrollListener, { passive: false })
}

/** @param {HTMLElement} mapEl */
function removeScrollNormalizer(mapEl) {
	mapEl.removeEventListener('wheel', scrollListener)

	const eventData = { detail: { pxPerZoomLevel: 60 } }
	document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADJUST_SCROLL', eventData))
}

/** @param {boolean} boxTicked */
function toggleScrollNormalize(boxTicked) {
	Store.local.set('normalize-scroll', boxTicked)

	const el = window.document.querySelector('#map')
	return boxTicked ? addScrollNormalizer(el) : removeScrollNormalizer(el)
}
//#endregion

/** @param {string} date */
function searchArchive(date) {
	if (date == '') return

    // In case 'change' event doesn't already update it
	Store.local.set('archive-date', date.replaceAll('-', ''))
	Store.local.set('mapmode', MapMode.ARCHIVE.name)

	location.reload()
}

/**
 * Updates the address bar / href with the specified coords and zoom.
 * @param {Vertex} coords
 * @param {number} zoom
 */
function updateUrlLocation(coords, zoom = 4) {
	location.href = `${MAPI_BASE}?zoom=${zoom}&x=${coords.x}&z=${coords.z}`
}