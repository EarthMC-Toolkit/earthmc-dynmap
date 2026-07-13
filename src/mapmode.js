/** ANY CODE RELATING TO MAP MODES / SELECTION LOGIC GOES HERE */
/// <reference types="./types.d.ts"/>
/// <reference path="./httputil.js"/>
/// <reference path="./store.js"/>
/// <reference path="./marker.js"/>

const preloadTowns = async () => {
    /** @type {Array<OAPITown>} */
    const cached = await Store.opfs.cache("api-towns", 3*60*1000, async () => {
        const alert = showAlertNoDismiss('Querying the EMC API for extra town info...', 30)

        const url = `${currentMapApiUrl()}/towns`
        const tlist = await fetchJSON(url)
        const towns = await queryConcurrent(url, tlist)
        
        alert.remove()
        return towns
    })

    cachedApiTowns = new Map(cached.map(t => [t.name.toLowerCase(), t]))
}

/** @type {MapModeType} */ const ARCHIVE = { name: "archive", img: null }
/** @type {MapModeType} */ const DEFAULT = { name: "default", img: "resources/img/map-mode-default.png" }
/** @type {MapModeType} */
const MEGANATIONS = {
    name: "meganations", img: "resources/img/map-mode-meganations.png",
    preload: async data => { if (cachedAlliances == null) cachedAlliances = await fetchAlliances() },
    apply: async (marker, parsed, context) => colourMarkerMeganations(marker, parsed)
}

/** @type {MapModeType} */
const ALLIANCES = {
    name: "alliances", img: "resources/img/map-mode-alliances.png",
    preload: async data => { if (cachedAlliances == null) cachedAlliances = await fetchAlliances() },
    apply: async(marker, parsed, context) => colourMarkerAlliances(marker, parsed)
}

/** @type {MapModeType} */
const NATION_CLAIMS = {
    name: "nationclaims", img: "resources/img/map-mode-nationclaims.png",
    apply: async (marker, parsed, context) => {
        if (!this.cache) {
            /** @type {Array<NationClaimsEntry>} */ 
            const nationClaimsInfo = Store.local.get('nation-claims-info', [])
            const nationClaimsEntries = nationClaimsInfo.filter(o => !!o.input).map(o => [o.input?.toLowerCase(), o.color])
            this.cache = {
                entries: new Map(nationClaimsEntries), // <input string, hex color string>
                useOpaque: Store.local.get('nation-claims-opaque-colors') == 'true',
                showExcluded: Store.local.get('nation-claims-show-excluded') == 'true'
            }
        }

        return colourMarkerNationClaims(marker, parsed.nationName, this.cache)
    }
}

/** @type {MapModeType} */
const OVERCLAIM = {
    name: "overclaim", img: "resources/img/map-mode-overclaim.png", skipIf: () => IS_AURORA,
    preload: async data => preloadTowns(),
    apply: async (marker, parsed, context) => {
        if (context.isRuin) return setMarkerColour(marker, '#000000', '#000000')

        const t = cachedApiTowns.get(parsed.townName.toLowerCase())
        if (t) marker.popup = buildMarkerPopup(t)

        return colourMarkerOverclaim(marker, t)
    }
}

/** @type {MapModeType} */
const NEWDAY = {
    name: "newday", img: "resources/img/map-mode-newday.png", skipIf: () => IS_AURORA,
    preload: async (data) => {
        console.log('preloading new day')
        if (cachedFallingTowns == null) cachedFallingTowns = await fetchFallingTowns()
		if (cachedRuinedTowns == null) cachedRuinedTowns = await fetchRuinedTowns()

		addRuinMarkers(data, cachedRuinedTowns, '#ff1900')
    },
    apply: async (marker, parsed, context) => colourMarkerNewDay(marker, parsed)
}

/** @type {MapModeType} */
const POPULATION = {
    name: "population", img: "resources/img/map-mode-heatmap-population.png", skipIf: () => IS_AURORA,
    apply: async (marker, parsed, context) => {
        if (context.isRuin) return setMarkerColour(marker, '#000000', '#000000')
		return colourMarkerHeatmap(marker, parsed.residentNum, 7)
    }
}

/** @type {MapModeType} */
const BALANCE = {
    name: "balance", img: "resources/img/map-mode-heatmap-balance.png", skipIf: () => IS_AURORA,
    preload: async data => preloadTowns(),
    apply: async (marker, parsed, context) => {
        if (context.isRuin) return setMarkerColour(marker, '#000000', '#000000')

        const t = cachedApiTowns.get(parsed.townName.toLowerCase())
        if (t) marker.popup = buildMarkerPopup(t)

        return colourMarkerHeatmap(marker, t?.stats?.balance || 0, 90)
    }
}

/** @type {MapModeType} */
const CUSTOM = {
    name: "custom", img: "resources/img/map-mode-default.png", skipIf: () => IS_AURORA,
    apply: async (marker, parsed, context) => {}
}

const MapMode = Object.freeze({
    DEFAULT, MEGANATIONS, ALLIANCES,
    NATION_CLAIMS, OVERCLAIM, NEWDAY,
    POPULATION, BALANCE,
    CUSTOM, ARCHIVE
})

const MAP_MODE_LIST = Object.values(MapMode).map((mode, i) => { mode.order = i; return mode })
const sortedMapModes = () => [...MAP_MODE_LIST].sort((a, b) => a.order - b.order)
const currentMapMode = () => MapMode[(Store.local.get('mapmode', null) || MapMode.DEFAULT.name).toUpperCase()]

/** @param {MapModeType} mode */
function selectMapMode(mode) {
    Store.local.set('mapmode', mode.name)
    location.reload()
}

/** @param {HTMLElement} parent - The "leaflet-top leaflet-left" element. */
function addMapModeSelector(parent) {
    /** @type {HTMLDivElement} */
    const selectorDiv = addElement(parent, INSERTABLE_HTML.mapMode.selector)
	document.addEventListener("keydown", e => {
		if (!(e.key === "M" && e.shiftKey)) return

        const hidden = selectorDiv.style.display == 'none'
        selectorDiv.style.display = hidden ? 'flex' : 'none'
        
        document.getElementById('nation-claims').classList.toggle('no-selector', !hidden)
	})

    const label = addElement(selectorDiv, INSERTABLE_HTML.mapMode.currentModeLabel)
    const iconContainer = addElement(selectorDiv, INSERTABLE_HTML.mapMode.optionContainer)
    for (const mode of sortedMapModes()) {
        if (mode.img == null || mode.skipIf?.()) continue
        addMapModeBtn(iconContainer, mode, _ => selectMapMode(mode))
    }

    label.textContent = `Current Mode: ${currentMapMode().name}`
}

/**
 * Adds a map mode button to its parent container div using its img/icon and btn handler.
 * @param {HTMLDivElement} iconContainer 
 * @param {MapModeType} mode 
 * @param {(mode: MapModeType) => void} clickHandler 
 */
function addMapModeBtn(iconContainer, mode, clickHandler = null) {
    const button = addElement(iconContainer, INSERTABLE_HTML.mapMode.btnOption)
    const src = isUserscript() ? MAP_MODE_IMGS[mode.name] : chrome.runtime.getURL(mode.img)
    addElement(button, `<img title="${mode.name}" alt="${mode.name}" src="${src}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}