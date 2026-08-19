/// <reference types="leaflet"/>

/// <reference types="leaflet"/>

/** @type {L.Map} */ let squaremap
/** @type {L.Control.Layers} */ let layerControl

/** @type {L.GeoJSON<any, GeoJSON.Geometry>} */ let provincesLayer
/** @type {L.GeoJSON<any, GeoJSON.Geometry>} */ let bordersLayer

function updateLayerOrder() {
	provincesLayer?.bringToBack()
	bordersLayer?.bringToFront()
}

function hookLeaflet() {
	if (typeof L === 'undefined') {
		requestAnimationFrame(hookLeaflet)
		return
	}

	const originalAddTo = L.Control.Layers.prototype.addTo
	L.Control.Layers.prototype.addTo = function (map) {
		layerControl = this
		squaremap = map
		squaremap.on('overlayadd overlayremove', () => updateLayerOrder())

		return originalAddTo.call(this, map)
	}

	const originalAddOverlay = L.Control.Layers.prototype.addOverlay
	L.Control.Layers.prototype.addOverlay = function (layer, name) {
		if (layer.id === 'chunk-borders') {
			layer.order = 1.5
		}

		return originalAddOverlay.call(this, layer, name)
	}

	console.log('Leaflet hooks installed')
}

hookLeaflet()

/** 
 * Initializes a layer by inserting a new toggle into the layer selector dropdown.
 * @param {LeafletLayerData} data
 */
const initLayer = data => {
	const { scale } = squaremap.options // this is initialized when setScale() runs in SquaremapMap class
	const layer = L.geoJSON(data.geo, {
		...data,
		coordsToLatLng: coords => L.latLng(-coords[1] * scale, coords[0] * scale),
		onEachFeature: (feature, layer) => {
			if (!feature.properties?.name) return

			if (data.bindTooltip) {
				const { name, admin } = feature.properties
				layer.bindTooltip(admin ? `${name}, ${admin}` : name, { 
					sticky: true,
					direction: 'top',
					className: 'leaflet-control'
				})
			}
			if (data.bindPopup) {
				const { type, adm0_a3, admin, name, name_local, region_sub } = feature.properties
				const title = admin ? `${name}, ${admin}` : name
				const content = `
					<div class="infowindow">
						<span style="font-size:120%;"><b>Province Info</b> | ${title}</span>
						${name_local ? `<br><br><b>Local Name:</b> ${name_local}` : ''}
						${region_sub ? `<br><b>Region:</b> ${region_sub}` : ''}
						${type ? `<br><b>Type:</b> ${type}` : ''}
						${adm0_a3 ? `<br><b>Code:</b> ${adm0_a3}` : ''}
					</div>
				`
				layer.bindPopup(content, { autoClose: true })
			}
		}
	})

	layer.id = data.id
	if (data.order) layer.order = data.order

	layerControl.addOverlay(layer, data.name, false)
	return layer
}

/** 
 * @param {L.Layer} layer 
 * @param {boolean} hide
 */
const tryRenderLayer = (layer, hide) => {
	const saved = localStorage.getItem(`hide_${layer.id}`)
	const shouldHide = saved == null ? hide : saved === 'true'
	if (!shouldHide) layer.addTo(squaremap)
}

// Fires after leaflet is hooked and we are ready to add a layer.
document.addEventListener('EMCDYNMAPPLUS_ADD_LEAFLET_LAYER', async e => {
	while (!squaremap || !layerControl) {
		await new Promise(resolve => setTimeout(resolve, 10))
	}

	/** @type {LeafletLayerData} */
	const layerData = e.detail
	const layer = initLayer(layerData)

	if (layerData.id === 'provinces') provincesLayer = layer
	if (layerData.id === 'country-borders') countriesLayer = layer

	tryRenderLayer(layer, layerData.name)

	console.log(`Added layer to leaflet map: ${layerData.name}`)
})