/**
 * @param {GeoJsonData} countriesGeo - The country GeoJSON data. Already projected to Miller Cylindrical at build time.
 * @param {GeoJsonData} provincesGeo - The province GeoJSON data. Already projected to Miller Cylindrical at build time.
 */
function addBorderLayers(countriesGeo, provincesGeo) {
	try {
		/** @type {L.PathOptions} */
		const style = {
			weight: 1.2,
			opacity: 0.9,
			color: '#d4ffff',
			fill: false
		}

		const layer = createLayer(countriesGeo, 'country-borders', 'Country Borders', 71, style)
		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADD_LEAFLET_LAYER', { detail: layer }))
	} catch (e) {
		showAlert(`Could not set up a layer of country borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}

	try {
		/** @type {L.PathOptions} */
		const style = {
			weight: 1.1,
			opacity: 0.45,
			color: '#87c9ebe5',
			fillColor: '#161e2a',
			fillOpacity: 0.12
		}

		const layer = createLayer(provincesGeo, 'provinces', 'Provinces', 70, style, true, true, true)
		document.dispatchEvent(new CustomEvent('EMCDYNMAPPLUS_ADD_LEAFLET_LAYER', { detail: layer }))
	} catch (e) {
		showAlert(`Could not set up a layer of province borders. You may need to clear this website's data. If problem persists, contact the developer.`)
		console.error(e)
		return null
	}
}

/**
 * @param {GeoJsonData} geo - Contents of a geojson file including coords and extra info such as area names/codes.
 * @param {string} id - The unique id of this layer used to save the toggle state and identify it in the DOM.
 * @param {string} name - The name of this layer which will be shown in the layer selector.
 * @param {number} order - The order determining where the layer is shown in the layer selector.
 * @param {L.PathOptions} style - The styling this layer has (colour, opacity, weight etc).
 * @param {boolean} hide - Whether the layer is hidden (off) by default.
 * @param {boolean} interactive - Can the layer be interacted with (pointer vs hand cursor).
 * @param {boolean} bindTooltip - Whether to bind a tooltip that displays the area name on hover.
 * @returns {LeafletLayerData}
 */
const createLayer = (
	geo, id, name, order, style,
	hide = false, interactive = false, bindTooltip = false
) => ({ 
	geo, id, name, order, style, 
	hide, interactive, bindTooltip
})