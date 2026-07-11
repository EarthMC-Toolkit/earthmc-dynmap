// Hand-picked constants
// 1.94 is how many times Nostra's map is horizontally bigger than Aurora's
const SCALE_X 	 = IS_AURORA ? 1.0015 : 1.94133 	// Aurora is slightly stretched horizontally
const MOVE_DOWN  = IS_AURORA ? 0 : 8175 			// How much to move the layer down by
const MOVE_RIGHT = IS_AURORA ? 0 : 382.5 		// How much to move the layer right by

const AURORA_ZBOUNDS = { min: -16640, max: 16508 } // Vertical bounds of old map (Plate Carree projection)
const NORTH_HEMISPHERE_FACTOR = 0.994 // Project from Plate Carree to Miller Cylindrical. Adjust projection of north hemisphere
const MAP_SCALE_FACTOR = 94704 / 33148 // Estimated height of new (Nostra) map if it wasn't cropped / Height of old map

// 16574 is a mean average of old map vertical bounds
// 2.304 is a magic number from 5/4 * Math.asinh(Math.tan(4/5 * (90 * (Math.PI / 180))))
const MILLER_Y_NORMALIZER = 16574 / 2.3034125433763912

/** @param {number} z */
function millerProjection(z) {
	// Converts old (Aurora) map's Z-coord to latitude. Assuming old map covers every latitude. 
	const latDeg = ((z - AURORA_ZBOUNDS.min) * 180 / (AURORA_ZBOUNDS.max - AURORA_ZBOUNDS.min)) - 90
	const latRad = latDeg * (Math.PI / 180)

	let millerOldZ = (5/4) * Math.asinh(Math.tan((4 / 5) * latRad)) * MILLER_Y_NORMALIZER
	if (millerOldZ < 0) millerOldZ *= NORTH_HEMISPHERE_FACTOR

	return millerOldZ * MAP_SCALE_FACTOR
}

/**
 * @param {MarkerPoints} linePoints
 * @param {string} weight 
 * @param {string} colour 
 */
const makePolyline = (linePoints, weight = 1, colour = '#ffffff') => ({
	'type': 'polyline', 'points': linePoints,
	'weight': weight, 'color': colour,
})

/**
 * @param {MarkersResponse} data - The markers response JSON data.
 * @param {Borders} borders - The borders JSON data.
 */
function addCountryBordersLayer(data, borders) {
	try {
		const points = Object.keys(borders).map(country => {
			/** @type {Polygon} */
			const countryPoly = []
			const line = borders[country]
			for (let i = 0; i < line.x.length; i++) {
				const xCoord = line.x[i]
				if (!isNumeric(xCoord)) continue

				const zCoord = line.z[i]
				countryPoly.push(IS_AURORA ? { x: xCoord * SCALE_X, z: zCoord } : {
					x: xCoord * SCALE_X + MOVE_RIGHT,
					z: millerProjection(zCoord) + MOVE_DOWN
				})
			}

			return countryPoly
		})

		data.push({
			'name': 'Country Borders',
			'id': 'borders',
			'order': 125, // Put it before the last layer 'Folia Regions' (150) but after the 'Chunk Borders' (100) layer.
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