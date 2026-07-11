/** ANY CODE RELATING TO THE MAP MODE SELECTOR GOES HERE */

/** The array of map mode objects, `order` key is automagically added. */
const MAP_MODES = /** @type {const} */ [
    { key: "DEFAULT",      name: "default",      img: "resources/img/map-mode-default.png" },
    { key: "MEGANATIONS",  name: "meganations",  img: "resources/img/map-mode-meganations.png" },
    { key: "ALLIANCES",    name: "alliances",    img: "resources/img/map-mode-alliances.png" },
    { key: "NATIONCLAIMS", name: "nationclaims", img: "resources/img/map-mode-nationclaims.png" },
    { key: "OVERCLAIM",    name: "overclaim",    img: "resources/img/map-mode-overclaim.png", skipIf: () => IS_AURORA },
    { key: "NEWDAY",       name: "newday",       img: "resources/img/map-mode-newday.png", skipIf: () => IS_AURORA },
    { key: "POPULATION",   name: "population",   img: "resources/img/map-mode-heatmap-population.png", skipIf: () => IS_AURORA },
    { key: "BALANCE",      name: "balance",      img: "resources/img/map-mode-heatmap-balance.png", skipIf: () => IS_AURORA },
    { key: "ARCHIVE",      name: "archive",      img: null },
].reduce((obj, mode, order) => {
    obj[mode.key] = { ...mode, order };
    delete obj[mode.key].key;
    return obj;
}, {})
Object.freeze(MAP_MODES)

/**
 * @typedef {typeof MAP_MODES[keyof typeof MAP_MODES]} MapMode
 * @typedef {MapMode["name"]} MapModeName
 */

const MapMode = MAP_MODES // this exists at runtime to replace the typedef
const sortedMapModes = () => Object.values(MAP_MODES).sort((a, b) => a.order - b.order)

/** @returns {MapMode} */
const currentMapMode = () => {
    const name = Store.local.get('mapmode')
	if (!name) return MapMode.DEFAULT

    return sortedMapModes().find(m => m.name == name) ?? MapMode.DEFAULT
}

/** @param {MapMode} currentMode */
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
 * @param {MapMode} mode 
 * @param {(mode: MapMode) => void} clickHandler 
 */
function addMapModeBtn(iconContainer, mode, clickHandler = null) {
    const button = addElement(iconContainer, INSERTABLE_HTML.mapMode.btnOption)
    const src = isUserscript() ? MAP_MODE_IMGS[mode.name] : chrome.runtime.getURL(mode.img)
    addElement(button, `<img title="${mode.name}" alt="${mode.name}" src="${src}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}