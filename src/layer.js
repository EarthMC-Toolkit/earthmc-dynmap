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
		const points = parseBorders(countryBorders)
		data.push({
			'name': 'Country Borders',
			'id': 'country-borders',
			'order': 101,
			'hide': false,
			'control': true,
			'markers': [makePolyline(points, 1.1, 0.8, '#d0ffff')]
		})
	} catch (e) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}

	try {
		const points = parseBorders(provinceBorders)
		data.push({
			'name': 'Province Borders',
			'id': 'province-borders',
			'order': 102,
			'hide': true,
			'control': true,
			'markers': [makePolyline(points, 0.85, 0.52, '#c3dee9')]
		})
	} catch (e) {
		showAlert(`Could not set up a layer of province borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}
}