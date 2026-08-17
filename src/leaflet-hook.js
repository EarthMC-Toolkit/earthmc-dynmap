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

	const { data, name, style, order, hide, interactive, enableTooltip } = e.detail
	const onEachFeature = !enableTooltip ? null : (feature, layer) => {
		if (!feature.properties?.name) return

		const { name, admin } = feature.properties
		layer.bindTooltip(admin ? `${name}, ${admin}` : name, { sticky: true })
	}

	const scale = squaremap.options.scale // this is defined within setScale() during SquaremapMap init
	const coordsToLatLng = coords => L.latLng(-coords[1] * scale, coords[0] * scale)

	const layer = L.geoJSON(data, { style, interactive, coordsToLatLng, onEachFeature })
	
	layer.id = e.detail.id
	layer.order = order
	layerControl.addOverlay(layer, name, false)
	
	const saved = localStorage.getItem(`hide_${layer.id}`)
	const shouldHide = saved == null ? hide : saved === 'true'
	if (!shouldHide) layer.addTo(squaremap)

	console.log(`Added layer to leaflet map: ${name}`)
})