/** ANYTHING RELATING TO MARKERS (POPUP, COLOUR ETC) BELONGS HERE. USUALLY REFERENCED BY MAIN */
/** 
 * @param {MarkersResponse} data 
 * @param {Array<CAPIRuinedTown>} ruined
 * @param {string} colour
*/
function addRuinMarkers(data, ruined, colour) {
	ruined.forEach(t => {
		/** @type {SquaremapMarker} */
		const marker = {
			tooltip: `<b>${t.name}</b> (Ruined)`,
			popup: buildMarkerPopup(t, 'ruined'),
			type: 'polygon',
			color: colour,
			fillColor: colour,
			points: chunksToSquaremap(t.coordinates.townBlocks.map(([x, z]) => [x*16, z*16]))
		}

		setMarkerTransparency(marker, 0.33, 1, 1.5)
		data[0].markers.push(marker)
	})
}

/** @type {Intl.DateTimeFormatOptions} */
const dateOpts = { year: 'numeric', month: 'numeric', day: 'numeric' }

/** @type {Intl.DateTimeFormatOptions} */
const dateTimeOptsUTC = { 
	year: 'numeric', month: 'long',
	day: 'numeric', hour: 'numeric',
	timeZone: 'UTC'
}

/** @param {number} ts */
const timestampToDateStr = (ts, opts = null) => new Date(ts).toLocaleDateString(navigator.language, opts)
const timestampToDateTimeStr = (ts, opts = null) => {
	const d = new Date(ts)
	const dateStr = d.toLocaleDateString(navigator.language, opts) + " at " 
	return dateStr + d.toLocaleTimeString("en-US", { hour: 'numeric', minute: 'numeric' })
}

/** @param {string} str */
const formatStrDate = (str, opts = null) => timestampToDateStr(Date.parse(str), opts)
const formatStrDateTime = (str, opts = null) => timestampToDateTimeStr(Date.parse(str), opts)

/** @param {string} name */
const residentClickable = name => `<span class="resident-clickable">${name}</span>`

/**
 * @param {OAPITown | CAPIRuinedTown | CAPIFallingTown} t
 * @param {'normal' | 'ruined' | 'falling'} type
 */
const buildMarkerPopup = (t, type = 'normal') => {
	const isRuined = type === 'ruined'
	const isFalling = type === 'falling'

	const title = isRuined
		? `${t.name} (Ruined)`
		: `${t.status.isCapital ? '⭐ ' : ''}${t.name} (${t.nation.name || 'No Nation'})${isFalling ? ' (Falling)' : ''}`

	const extraDates = isRuined ? `
		Ruin Date: <b>${timestampToDateStr(t.timestamps.ruinedAt, dateTimeOptsUTC)}AM UTC</b>
		<br>
		Deletion Date: <b>${formatStrDate(t.deletionAt, dateTimeOptsUTC)}AM UTC</b>
		<br>
		<br>`
		: isFalling ? `
		Fall Date: <b>${formatStrDate(t.ruinAt, dateTimeOptsUTC)}AM UTC</b>
		<br>
		Deletion Date: <b>${formatStrDate(t.deletionAt, dateTimeOptsUTC)}AM UTC</b>
		<br>
		<br>`
		: ''

	const mayor = t.mayor.name
		? residentClickable(t.mayor.name) + (isFalling ? ` (Last Online: ${formatStrDateTime(t.mayorLastOnline, dateOpts)})` : '')
		: 'Unknown'

	const flags = [
		['PVP', t.perms.flags.pvp],
		['Public', t.status.isPublic],
		...(!isRuined ? [['Open', t.status.isOpen]] : []),
		...(!isRuined ? [['Overclaimed', t.status.isOverClaimed]] : [])
	]

	const councillors = t.ranks?.['Councillor'] || []

	return `
<div class="infowindow">
	<span style="font-size:120%;">${title}</span>
	<br>
	${t.board && t.board !== '/town set board [msg]' ? `<i>${t.board}</i><br><br>` : '<br>'}
	${extraDates}
	Founded: <b>${timestampToDateTimeStr(t.timestamps.registered, dateOpts)}</b>
	<br>
	Founder: <b>${residentClickable(t.founder)}</b>
	<br>
	Mayor: <b>${mayor}</b>
	<br>
	<br>
	Balance: <b>${t.stats.balance ?? 0}G</b>
	<br>
	Size: <b>${t.stats.numTownBlocks ?? 0} Chunks</b>
	<br>
	${flags.map(([name, value]) => `${name}: <b>${value ? '<span style="color: green">Yes</span>' : '<span style="color: red">No</span>'}</b><br>`).join('')}
	<br>
	<details style="min-width: 250px">
		<summary style="cursor: pointer;">Councillors: <b>${councillors.length}</b></summary>
		<span class="resident-list">${councillors.map(r => residentClickable(r.name)).join(', ')}</span>
	</details>
	<details style="min-width: 250px">
		<summary style="cursor: pointer;">Residents: <b>${t.residents?.length ?? 0}</b></summary>
		<span class="resident-list">${t.residents?.map(r => residentClickable(r.name)).join(', ') ?? ''}</span>
	</details>
</div>
`
}

/**
 * Convert Towny chunk blocks into Squaremap multipolygon rings.
 * Each chunk is treated as a 1x1 square and merged into outer boundary edges.
 *
 * @param {Array<[number, number]>} blocks - Chunk coordinates [x, z]
 * @returns {MultiPolygonPoints} MultiPolygon (Squaremap format)
 */
function chunksToSquaremap(blocks) {
	const edges = new Set()
	const add = (a, b) => {
		const k = `${a.x},${a.z}|${b.x},${b.z}`
		const r = `${b.x},${b.z}|${a.x},${a.z}`
		if (edges.has(r)) edges.delete(r)
		else edges.add(k)
	}

	for (const [x, z] of blocks) {
		const A = { x, z }
		const B = { x: x + 16, z }
		const C = { x: x + 16, z: z + 16 }
		const D = { x, z: z + 16 }

		add(A, B); add(B, C); add(C, D); add(D, A)
	}

	const edgeMap = new Map()
	for (const k of edges) {
		const [ax, az, bx, bz] = k.split(/[|,]/).map(Number)

		const a = { x: ax, z: az }
		const b = { x: bx, z: bz }

		const key = `${a.x},${a.z}`
		if (!edgeMap.has(key)) edgeMap.set(key, [])
		edgeMap.get(key).push(b)
	}

	const out = []
	const used = new Set()
	for (const startKey of edgeMap.keys()) {
		if (used.has(startKey)) continue

		const [sx, sz] = startKey.split(',').map(Number)
		const start = { x: sx, z: sz }

		const ring = []
		let cur = start

		while (true) {
			ring.push(cur)

			const nexts = edgeMap.get(`${cur.x},${cur.z}`) || []
			let next = null

			for (const n of nexts) {
				const k = `${cur.x},${cur.z}|${n.x},${n.z}`
				if (!used.has(k)) {
					next = n
					used.add(k)
					break
				}
			}

			if (!next) break

			cur = next
			if (cur.x === start.x && cur.z === start.z) break
		}

		if (ring.length >= 4) {
			ring.push({ ...ring[0] }) // close loop (important for Squaremap)
			out.push([ring])
		}
	}

	return out
}

const DEFAULT_BLUE = '#3fb4ff'
const DEFAULT_GREEN = '#89c500'
const toHex = v => Math.round(v).toString(16).padStart(2, '0')

/** 
 * Sets the colour values of a marker with optional weight and returns it back.
 * @param {Marker} marker
 * @param {string} fill - Usually HEX.
 * @param {string} outline - Usually HEX.
 * @param {number} weight - How "fat" or apparent the marker appears at different zoom levels
 */
const setMarkerColour = (marker, fill, outline, weight = null) => {
	marker.fillColor = fill
	marker.color = outline
	if (weight) marker.weight = weight
	return marker
}

/** 
 * Sets the opacity values of a marker with optional weight and returns it back.
 * @param {Marker} marker
 * @param {number} fillOpacity - The inner fill opacity 0-1.
 * @param {number} outlineOpacity - The outline transparency 0-1. If null, uses fillOpacity
 * @param {number} weight - How "fat" or apparent the marker appears at different zoom levels
 */
const setMarkerTransparency = (marker, fillOpacity, outlineOpacity = undefined, weight = null) => {
	marker.fillOpacity = fillOpacity
	if (outlineOpacity !== null) marker.opacity = outlineOpacity || fillOpacity
	if (weight) marker.weight = weight
	return marker
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {MapModeType} mapMode - The currently selected map mode.
 * @returns {Marker}
 */
function applyAllianceColours(marker, nationName, mapMode) {
	const nationAlliances = getNationAlliances(nationName, mapMode)
	if (nationAlliances.length === 0) return marker

	const { colours } = nationAlliances[0]
	const weight = nationAlliances.length > 1 ? 1.5 : 0.75
	return setMarkerColour(marker, colours.fill, colours.outline, weight)
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsed
 * @returns {Marker}
 */
function colourMarkerAlliances(marker, parsed) {
	setMarkerColour(marker, '#000000', '#000000', 1)
	applyAllianceColours(marker, parsed.nationName, MapMode.ALLIANCES)
	return marker
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsed
 * @returns {Marker}
 */
function colourMarkerMeganations(marker, parsed) {
	const isDefaultCol = marker.color == DEFAULT_BLUE && marker.fillColor == DEFAULT_BLUE
	marker.color = isDefaultCol ? '#363636' : DEFAULT_GREEN
	marker.fillColor = isDefaultCol ? hashCode(parsed.nationName) : marker.fillColor

	return applyAllianceColours(marker, parsed.nationName, MapMode.MEGANATIONS)
}

/**
 * @param {Marker} marker
 * @param {OAPITown} town
 * @returns {Marker}
 */
function colourMarkerOverclaim(marker, town) {
	const overclaimed = town?.status?.isOverClaimed
	const colour = overclaimed ? '#ff0000' : '#00ff00'
	return setMarkerColour(marker, colour, colour, overclaimed ? 2 : 0.5)
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {NationClaimsCacheInfo} info
 * @returns {Marker}
 */
function colourMarkerNationClaims(marker, nationName, info) {
	const nationColorInput = info.entries.get(nationName?.toLowerCase())
	if (!nationColorInput) {
		if (info.useOpaque) setMarkerTransparency(marker, 0.5)
		if (!info.showExcluded) setMarkerTransparency(marker, 0) // Make town invisible if not part of a nation in claims customizer.
		return setMarkerColour(marker, '#000000', '#000000', 1)
	}

	if (info.useOpaque) setMarkerTransparency(marker, 1) // 100% opacity similar to manual player drawn claim maps
	return setMarkerColour(marker, nationColorInput, nationColorInput, 1.5)
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsedMarker
 * @returns {Marker}
 */
function colourMarkerNewDay(marker, parsedMarker) {
	marker.weight = 3.5 // all new day markers should stand out
	
	const fallingTown = cachedFallingTowns.find(v => v.name.toLowerCase() == parsedMarker.townName.toLowerCase())
	if (fallingTown) {
		parsedMarker.isCapital = fallingTown.status.isCapital
		parsedMarker.x = fallingTown.coordinates.spawn.x
		parsedMarker.z = fallingTown.coordinates.spawn.z

		marker.popup = buildMarkerPopup(fallingTown, 'falling')

		return fallingTown.status.isOpen 
			? setMarkerColour(marker, DEFAULT_GREEN, DEFAULT_GREEN)
			: setMarkerColour(marker, '#ffa200', '#ffa200')
	}

	const ruinedTown = cachedRuinedTowns.find(v => v.name.toLowerCase() == parsedMarker.townName.toLowerCase())
	if (ruinedTown) {
		parsedMarker.isCapital = ruinedTown.status.isCapital
		parsedMarker.x = ruinedTown.coordinates.spawn.x
		parsedMarker.z = ruinedTown.coordinates.spawn.z
		return marker // we already set the marker colour in addRuinMarkers()
	}

	setMarkerTransparency(marker, 0.33, 0.8, 0.85)
	return setMarkerColour(marker, '#151515', '#151515')
}

const rgb = (r, g, b) => ({ r: r, g: g, b: b })
const stops = [
	rgb(255, 255, 255), // white
	rgb(0, 255, 0), // green
	rgb(250, 220, 0), // orange
	rgb(255, 0, 0)  // red
]

/**
 * Colours a marker using a perceptual heatmap curve (EarthMC-style).
 *
 * `power` controls contrast:
 * - `1` = linear-ish
 * - `>1` = more detail in low values
 * - `<1` = more aggressive heat
 *
 * @param {Marker} marker
 * @param {number} value The value to map (>= 0).
 * @param {number} power Curve strength (> 0).
 * @returns {Marker}
 */
function colourMarkerHeatmap(marker, value, power) {
	const t0 = value / (value + 1)
	const t = Math.pow(t0, power)

	const scaled = t * (stops.length - 1)
	const i = Math.floor(scaled)
	const f = scaled - i

	const a = stops[i]
	const b = stops[Math.min(i + 1, stops.length - 1)]

	const r = a.r + (b.r - a.r) * f
	const g = a.g + (b.g - a.g) * f
	const bl = a.b + (b.b - a.b) * f

	const colour = `#${toHex(r)}${toHex(g)}${toHex(bl)}`

	const weight = 0.9 + t
	setMarkerTransparency(marker, 0.6, 1, weight)

	return setMarkerColour(marker, colour, colour)
}