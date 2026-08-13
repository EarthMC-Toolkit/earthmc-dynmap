/**
 * @param {MarkerPoints} linePoints
 * @param {string} weight
 * @param {string} colour
 */
const makePolyline = (linePoints, weight = 0.84, colour = 'hsl(179, 53%, 82%)') => ({
	'type': 'polyline',
	'points': linePoints,
	'weight': weight,
	'color': colour,
})

/**
 * @param {MarkersResponse} data - The markers response JSON data.
 * @param {Borders} borders - The borders JSON data. This is already in Miller Cylindrical format (converted at build time).
 */
function addCountryBordersLayer(data, borders) {
	try {
		const points = Object.keys(borders).map(country => {
			/** @type {Polygon} */
			const border = []
			const line = borders[country]

			for (let i = 0; i < line.x.length; i++) {
				const xCoord = line.x[i]
				if (!isNumeric(xCoord)) continue

				border.push({ x: xCoord, z: line.z[i] })
			}

			return border
		})

		data.push({
			'name': 'Country Borders',
			'id': 'borders',
			'order': 101,
			'hide': false,
			'control': true,
			'markers': [makePolyline(points)]
		})
	} catch (e) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}
}