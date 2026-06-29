/** @param {string} str */ const isNumeric = str => Number.isFinite(+str)
/** @param {number} num */ const roundTo16 = num => Math.round(num / 16) * 16

/** 
 * Fowler-Noll-Vo hash function
 * @param {string} str
 */
function hashCode(str) {
	let hexValue = 0x811c9dc5
	for (let i = 0; i < str.length; i++) {
		hexValue ^= str.charCodeAt(i)
		hexValue += (hexValue << 1) + (hexValue << 4) + (hexValue << 7) + (hexValue << 8) + (hexValue << 24)
	}

	return '#' + ((hexValue >>> 0) % 16777216).toString(16).padStart(6, '0')
}

/**
 * Shoelace formula
 * @param {Polygon} vertices 
 */
function calcPolygonArea(vertices) {
	let area = 0
	const amtVerts = vertices.length
	for (let i = 0; i < amtVerts; i++) {
		const j = (i + 1) % amtVerts

		// Vertices need rounding to 16 because data has imprecise coordinates
		area += roundTo16(vertices[i].x) * roundTo16(vertices[j].z)
		area -= roundTo16(vertices[j].x) * roundTo16(vertices[i].z)
	}

	return (Math.abs(area) / 2) / (16 * 16)
}

/**
 * Computes total area of a marker, accounting for holes.
 * @param {SquaremapMarker} marker
 * @returns {number}
 */
function calcMarkerArea(marker) {
    if (marker.type !== 'polygon') return 0

    let area = 0
    const processed = [] // Temp array of polys used to check existence of holes
    for (const multiPolygon of marker.points || []) {
        for (let polygon of multiPolygon) {
            if (!polygon || polygon.length < 3) continue

			// Filter out any NaN points
			polygon = polygon
				.map(v => ({ x: Number(v.x), z: Number(v.z) }))
				.filter(v => Number.isFinite(v.x) && Number.isFinite(v.z))
            
            if (polygon.length < 3) continue

            // Check if polygon is fully inside any previous polygon
            const isHole = processed.some(prev => polygon.every(v => pointInPolygon(v, prev)))
            area += isHole ? -calcPolygonArea(polygon) : calcPolygonArea(polygon)
            processed.push(polygon)
        }
    }

    return area
}

/**
 * Credit: James Halliday (substack)
 * @param {Vertex} vertex 
 * @param {Polygon} polygon
 */
function pointInPolygon(vertex, polygon) {
	let { x, z } = vertex
	let n = polygon.length
	let inside = false
	for (let i = 0, j = n - 1; i < n; j = i++) {
		let xi = polygon[i].x, xj = polygon[j].x
		let zi = polygon[i].z, zj = polygon[j].z

		let intersect = ((zi > z) != (zj > z))
			&& (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
		if (intersect) inside = !inside
	}

	return inside
}

/**
 * @param {Polygon} vertices 
 * @returns {Vertex}
 */
function midrange(vertices) {
	let minX = Infinity, maxX = -Infinity
	let minZ = Infinity, maxZ = -Infinity

	for (const vert of vertices) {
		if (vert.x < minX) minX = vert.x
		if (vert.x > maxX) maxX = vert.x
		if (vert.z < minZ) minZ = vert.z
		if (vert.z > maxZ) maxZ = vert.z
	}

	return {
		x: roundTo16((minX + maxX) / 2),
		z: roundTo16((minZ + maxZ) / 2)
	}
}

/**
 * Formats a timestamp into a string. Ex: "Today", "2 days ago", "3 months ago" or "1 year ago" 
 * @param {number} ts The UNIX timestamp to format 
 */
function timeAgo(ts) {
	const diff = Date.now() - ts
	const units = [['year', 365*DAY_MS], ['month', 30*DAY_MS], ['day', DAY_MS]]
	for (const [name, ms] of units) {
		const v = Math.floor(diff / ms)
		if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`
	}

	return 'Today'
}