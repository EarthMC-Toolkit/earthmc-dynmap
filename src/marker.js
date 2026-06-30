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
			popup: buildRuinedPopup(t),
			type: 'polygon',
			weight: 1.5,
			opacity: 1,
			fillOpacity: 0.33,
			color: colour,
			fillColor: colour,
			points: chunksToSquaremap(t.coordinates.townBlocks.map(([x, z]) => [x*16, z*16]))
		}

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

const timestampToDateStr = (ts, opts = null) => new Date(ts).toLocaleDateString(navigator.language, opts)
const timestampToDateTimeStr = (ts, opts = null) => {
	const d = new Date(ts)
	const dateStr = d.toLocaleDateString(navigator.language, opts) + " at " 
	return dateStr + d.toLocaleTimeString("en-US", { hour: 'numeric', minute: 'numeric' })
}

const formatStrDate = (str, opts = null) => timestampToDateStr(new Date(Date.parse(str)), opts)
const formatStrDateTime = (str, opts = null) => timestampToDateTimeStr(new Date(Date.parse(str)), opts)

/** @param {CAPIRuinedTown} t */
const buildRuinedPopup = t => `
<div class="infowindow">
    <span style="font-size:120%;">${t.name} (Ruined)</span>
    <br>
    ${t.board && t.board !== '/town set board [msg]' ? `<i>${t.board}</i><br><br>`: '<br>' }
    Founded: <b>${timestampToDateTimeStr(t.timestamps.registered, dateOpts)}</b>
    <br>
	Founder: <b>${t.founder}</b>
	<br>
    Mayor: <b>${t.mayor.name ?? 'Unknown'}</b>
    <br>
	<br>
	Balance: <b>${t.stats.balance ?? 0}G</b>
    <br>
    PVP: <b>${t.perms.flags.pvp ? 'true' : 'false'}</b>
    <br>
    Public: <b>${t.status.isPublic ? 'true' : 'false'}</b>
    <br>
	<br>
    <details style="min-width: 250px">
        <summary style="cursor: pointer;">
            Residents: <b>${t.residents?.length ?? 0}</b>
        </summary>
        ${t.residents?.map(r => r.name).join(', ') ?? ''}
    </details>
</div>
`

/** @param {CAPIFallingTown} t */
const buildFallingPopup = t => `
<div class="infowindow">
    <span style="font-size:120%;">${t.status.isCapital ? '⭐ ' : ''}${t.name} (${t.nation.name || 'No Nation'}) (Falling)</span>
    <br>
	${t.board && t.board !== '/town set board [msg]' ? `<i>${t.board}</i><br><br>`: '<br>' }
	Fall Date: <b>${formatStrDate(t.ruinAt, dateTimeOptsUTC)}AM UTC</b>
    <br>
	Deletion Date: <b>${formatStrDate(t.deletionAt, dateTimeOptsUTC)}AM UTC</b>
    <br>
	<br>
    Founded: <b>${timestampToDateTimeStr(t.timestamps.registered, dateOpts)}</b>
    <br>
	Founder: <b>${t.founder}</b>
	<br>
	Mayor: <b>${t.mayor.name ?? 'Unknown'} (Last Online: ${formatStrDateTime(t.mayorLastOnline, dateOpts)})</b>
    <br>
	<br>
	Balance: <b>${t.stats.balance ?? 0}G</b>
	<br>
    PVP: <b>${t.perms.flags.pvp ? 'true' : 'false'}</b>
    <br>
    Public: <b>${t.status.isPublic ? 'true' : 'false'}</b>
    <br>
	Open: <b>${t.status.isOpen ? 'true' : 'false'}</b>
    <br>
	<br>
	<details style="min-width: 250px">
        <summary style="cursor: pointer;">
            Councillors: <b>${(t.ranks?.['Councillor'] || []).length}</b>
        </summary>
        ${(t.ranks?.['Councillor'] || []).map(r => r.name).join(', ') ?? ''}
    </details>
    <details style="min-width: 250px">
        <summary style="cursor: pointer;">
            Residents: <b>${t.residents?.length ?? 0}</b>
        </summary>
        ${t.residents?.map(r => r.name).join(', ') ?? ''}
    </details>
</div>
`

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

	const used = new Set()
	const out = []

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

/** 
 * Sets the colours of a marker with optional weight and returns it back.
 * @param {Marker} marker
 * @param {string} fill
 * @param {string} outline
 * @param {number} weight
 */
const colorMarker = (marker, fill, outline, weight = null) => {
	marker.fillColor = fill
	marker.color = outline
	if (weight) marker.weight = weight
	return marker
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {MapMode} mapMode - The currently selected map mode.
 * @returns {Marker}
 */
function applyAllianceColours(marker, nationName, mapMode) {
	const nationAlliances = getNationAlliances(nationName, mapMode)
	if (nationAlliances.length === 0) return marker

	const { colours } = nationAlliances[0]
	const weight = nationAlliances.length > 1 ? 1.5 : 0.75
	return colorMarker(marker, colours.fill, colours.outline, weight)
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsed
 * @returns {Marker}
 */
function colorMarkerAlliances(marker, parsed) {
	colorMarker(marker, '#000000', '#000000', 1)
	applyAllianceColours(marker, parsed.nationName, MapMode.ALLIANCES)
	return marker
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsed
 */
function colorMarkerMeganations(marker, parsed) {
	const isDefaultCol = marker.color == DEFAULT_BLUE && marker.fillColor == DEFAULT_BLUE
	marker.color = isDefaultCol ? '#363636' : DEFAULT_GREEN
	marker.fillColor = isDefaultCol ? hashCode(parsed.nationName) : marker.fillColor

	applyAllianceColours(marker, parsed.nationName, MapMode.MEGANATIONS)
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsed
 * @returns {Marker}
 */
function colorMarkerOverclaim(marker, parsed) {
	const nation = parsed.nationName ? cachedApiNations.get(parsed.nationName.toLowerCase()) : null
	const info = !nation
		? checkOverclaimedNationless(parsed.area, parsed.residentNum)
		: checkOverclaimed(parsed.area, parsed.residentNum, nation.stats.numResidents)

	const colour = info.isOverclaimed ? '#ff0000' : '#00ff00'
	return colorMarker(marker, colour, colour, info.isOverclaimed ? 2 : 0.5)
}

/**
 * @param {Marker} marker
 * @param {string} nationName
 * @param {Map<string|null, string|null>} claimsCustomizerInfo
 * @param {boolean} useOpaque
 * @param {boolean} showExcluded
 * @returns {Marker}
 */
function colorMarkerNationClaims(marker, nationName, claimsCustomizerInfo, useOpaque, showExcluded) {
	//const strippedName = nationName?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
	const nationColorInput = claimsCustomizerInfo.get(nationName?.toLowerCase())
	if (!nationColorInput) {
		if (useOpaque) marker.fillOpacity = marker.opacity = 0.5
		if (!showExcluded) marker.fillOpacity = marker.opacity = 0 // Make town invisible if not part of a nation in claims customizer.

		return colorMarker(marker, '#000000', '#000000', 1)
	}

	if (useOpaque) marker.fillOpacity = marker.opacity = 1 // 100% opacity similar to manual player drawn claim maps
	return colorMarker(marker, nationColorInput, nationColorInput, 1.5)
}

/**
 * @param {Marker} marker
 * @param {ParsedMarker} parsedMarker
 * @returns {Marker}
 */
function colorMarkerNewDay(marker, parsedMarker) {
	const fallingTown = cachedFallingTowns.find(v => v.name.toLowerCase() == parsedMarker.townName.toLowerCase())
	if (fallingTown) {
		parsedMarker.isCapital = fallingTown.status.isCapital
		parsedMarker.x = fallingTown.coordinates.spawn.x
		parsedMarker.z = fallingTown.coordinates.spawn.z

		marker.popup = buildFallingPopup(fallingTown)

		return fallingTown.status.isOpen 
			? colorMarker(marker, DEFAULT_GREEN, DEFAULT_GREEN, 2)
			: colorMarker(marker, '#ffa200', '#ffa200', 2)
	}

	const ruinedTown = cachedRuinedTowns.find(v => v.name.toLowerCase() == parsedMarker.townName.toLowerCase())
	if (!ruinedTown) {
		if (marker.type == 'icon') {
			marker.opacity = marker.fillOpacity = 0
			return marker // don't show icons like capital stars
		}

		marker.fillOpacity = 0.35
		marker.opacity = 0.8
		return colorMarker(marker, '#151515', '#151515', 0.85)
	}

	marker.weight = 3 // make ruined town markers stand out
	parsedMarker.isCapital = ruinedTown.status.isCapital
	parsedMarker.x = ruinedTown.coordinates.spawn.x
	parsedMarker.z = ruinedTown.coordinates.spawn.z

	return marker
}
