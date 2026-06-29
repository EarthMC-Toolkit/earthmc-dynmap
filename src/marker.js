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