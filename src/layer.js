/**
 * @param {MarkerPoints} linePoints
 * @param {string} weight
 * @param {string} colour
 */
const makePolyline = (linePoints, weight = 1, opacity = 1, colour = '#ffffff') => ({
	'type': 'polyline',
	'points': linePoints,
	'weight': weight,
	'color': colour,
	'opacity': opacity
})

/**
 * @param {Borders} borders - Generic borders JSON data. Represents either countries or provinces.
 */
function parseBorders(borders) {
	return Object.keys(borders).map(k => {
		/** @type {Polygon} */
		const border = []
		const line = borders[k] // the border of current country/province

		for (let i = 0; i < line.x.length; i++) {
			const xCoord = line.x[i]
			if (!isNumeric(xCoord)) continue

			border.push({ x: xCoord, z: line.z[i] })
		}

		return border
	})
}

/**
 * @param {MarkersResponse} data - The markers response JSON data.
 * @param {Borders} countryBorders - The country borders JSON data. This is already in Miller Cylindrical format (converted at build time).
 * @param {Borders} provinceBorders - The province borders JSON data. This is already in Miller Cylindrical format (converted at build time).
 */
function addBorderLayers(data, countryBorders, provinceBorders) {
	try {
		/** @type {L.PathOptions} */
		const style = {
			weight: 1.2,
			opacity: 0.9,
			color: '#d4ffff',
			fill: false
		}
		const layer = {
			data: countryBorders,
			id: 'country-borders',
			name: "Country Borders",
			interactive: false,
			order: 71,
			hide: false,
			style
		}
		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADD_BORDER_LAYER', { detail: layer }))
	} catch (e) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}

	try {
		/** @type {L.PathOptions} */
		const style = {
			weight: 1.,
			opacity: 0.45,
			color: '#87c9ebe5',
			fillColor: '#161e2a',
			fillOpacity: 0.12
		}
		const layer = {
			data: provinceBorders,
			id: 'provinces',
			name: "Provinces",
			order: 70,
			hide: true,
			interactive: true,
			enableTooltip: true,
			style
		}
		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADD_BORDER_LAYER', { detail: layer }))
	} catch (e) {
		showAlert(`Could not set up a layer of province borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}
}