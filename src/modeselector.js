/** ANY CODE RELATING TO THE MAP MODE SELECTOR GOES HERE */
//console.log('emcdynmapplus: loaded mode selector')

const GITHUB_REPO = "https://raw.githubusercontent.com/EarthMC-Toolkit/earthmc-dynmap/refs/heads/main/"

const MAP_MODES = /** @type {const} */ ({
    DEFAULT:        { name: "default",      img: "resources/img/map-mode-default.png", order: 0 },
    MEGANATIONS:    { name: "meganations",  img: "resources/img/map-mode-meganations.png", order: 1 },
    ALLIANCES:      { name: "alliances",    img: "resources/img/map-mode-alliances.png", order: 2 },
    NATIONCLAIMS:   { name: "nationclaims", img: "resources/img/map-mode-nationclaims.png", order: 3 },
    OVERCLAIM:      { name: "overclaim",    img: "resources/img/map-mode-overclaim.png", order: 4, skipIf: () => isAurora },
    NEWDAY:         { name: "newday",       img: "resources/img/map-mode-newday.png", order: 5, skipIf: () => isAurora },
    ARCHIVE:        { name: "archive",      img: null, order: 6 }, // null img to avoid showing up in the selector
})
Object.freeze(MAP_MODES)

/**
 * @typedef {typeof MAP_MODES[keyof typeof MAP_MODES]} MapMode
 * @typedef {MapMode["name"]} MapModeName
 */
const MapMode = MAP_MODES // this exists at runtime to replace the typedef
const sortedMapModes = () => Object.values(MAP_MODES).sort((a, b) => a.order - b.order)

/** @type {() => MapMode} */
const currentMapMode = () => {
    const name = localStorage['emcdynmapplus-mapmode']
	if (!name) return MapMode.DEFAULT

    return sortedMapModes().find(m => m.name == name) ?? MapMode.DEFAULT
}

/** @param {MapMode} currentMode */
function selectMapMode(mode) {
    localStorage['emcdynmapplus-mapmode'] = mode.name
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
    
    const modes = sortedMapModes()
    for (const mode of modes) {
        if (mode.img == null) continue
        if (mode.skipIf && mode.skipIf()) continue

        addMapModeBtn(iconContainer, mode, _ => selectMapMode(mode))
    }

    const curMode = currentMapMode()
    label.textContent = `Current Mode: ${curMode.name}`
}

/**
 * Adds a map mode button to its parent container div using its img/icon and btn handler.
 * @param {HTMLDivElement} iconContainer 
 * @param {MapMode} mode 
 * @param {(mode: MapMode) => void} clickHandler 
 */
function addMapModeBtn(iconContainer, mode, clickHandler = null) {
    const button = addElement(iconContainer, INSERTABLE_HTML.mapMode.btnOption)
    addElement(button, `<img title="${mode.name}" alt="${mode.name}" src="${GITHUB_REPO + mode.img}">`)

    if (clickHandler) button.addEventListener('click', clickHandler)
}