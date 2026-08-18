/// <reference types="leaflet"/>

/** @type {L.Map} */
let squaremap

/** @type {L.Control.Layers} */
let layerControl

function hookLeaflet() {
	if (typeof L === 'undefined') {
		requestAnimationFrame(hookLeaflet)
		return
	}

	L.Map.addInitHook(function () {
		squaremap = this
	})

	L.Control.Layers.addInitHook(function () {
		layerControl = this

		const originalAddOverlay = L.Control.Layers.prototype.addOverlay
		L.Control.Layers.prototype.addOverlay = function(layer, name) {
			if (layer.id === 'chunk-borders') layer.order = 1.5
			return originalAddOverlay.call(this, layer, name)
		}
	})
}

hookLeaflet()

document.addEventListener('EMCDYNMAPPLUS_ADD_BORDER_LAYER', e => {
	if (!squaremap || !layerControl) {
		console.error('Squaremap has not been initialized')
		return
	}

	/** @type {LeafletLayerData} */
	const layerData = e.detail

	const layer = initLayer(layerData)
	tryRenderLayer(layer, layerData.name)

	console.log(`Added layer to leaflet map: ${layerData.name}`)
})

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
			if (!data.bindTooltip || !feature.properties?.name) return

			const { name, admin } = feature.properties
			layer.bindTooltip(admin ? `${name}, ${admin}` : name, { 
				sticky: true,
				direction: 'top',
				className: 'leaflet-control'
			})
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