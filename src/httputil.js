/** ANYTHING RELATED TO NETWORKING BELONGS IN HERE */
const EMC_DOMAIN = "earthmc.net"
const CURRENT_MAP = location.href.includes('aurora') ? "aurora" : "nostra"
const IS_AURORA = CURRENT_MAP == 'aurora'

const CAPI_BASE = `https://emcstats.bot.nu`
const MAPI_BASE = `https://map.${EMC_DOMAIN}`
const OAPI_BASE = `https://api.${EMC_DOMAIN}`

const OAPI_REQ_PER_MIN = 180
const OAPI_ITEMS_PER_REQ = 100

const currentMapApiUrl = () => CURRENT_MAP == 'aurora' ? `${OAPI_BASE}/v3/aurora` : `${OAPI_BASE}/v4`

/**
 * Token/leaky bucket implementation with localStorage caching.\
 * Useful for rate limiting requests client side while persisting the bucket state through reloads.
 */
class TokenBucket {
	/** @param {TokenBucketOptions} opts */
	constructor(opts) {
		this.capacity = opts.capacity       // max tokens
		this.refillRate = opts.refillRate   // token refill rate (per sec)
		this.storageKey = opts.storageKey	// localStorage key

		// load previous bucket state if available
		/** @type {TokenBucketStored} */
		const cachedBucket = Store.local.get(this.storageKey, null)
		if (cachedBucket) {
			const elapsed = (Date.now() - cachedBucket.lastRefill) / 1000
			const added = elapsed * opts.refillRate
			this.tokens = Math.min(opts.capacity, cachedBucket.tokens + added)
		} else {
			this.tokens = opts.capacity
		}

		this.lastRefill = Date.now()
	}

	#save() {
		const bucketInfo = { tokens: this.tokens, lastRefill: this.lastRefill }
		Store.local.set(this.storageKey, bucketInfo)
	}

	refill() {
		const now = Date.now()
		const elapsed = (now - this.lastRefill) / 1000
		if (elapsed <= 0) return

		const added = elapsed * this.refillRate
		this.tokens = Math.min(this.capacity, this.tokens + added)
		this.lastRefill = now
		this.#save()
	}

	take = async () => new Promise(resolve => {
		const attempt = () => {
			this.refill()
			if (this.tokens >= 1) {
				this.tokens -= 1
				this.#save()
				resolve()
			} else {
				// automatically retry after enough time for one token
				const msUntilNext = Math.ceil((1 - this.tokens) / this.refillRate * 1000)
				setTimeout(attempt, msUntilNext)
			}
		}

		attempt()
	})
}

const oapiBucket = new TokenBucket({
	capacity: OAPI_REQ_PER_MIN,
	refillRate: OAPI_REQ_PER_MIN / 60,
	storageKey: 'oapi-bucket'
})

/**
 * Sends a request to a url, parsing the response as JSON unless we received 404.
 * @param {string} url - The URL to retrieve data from.
 * @param {RequestInit} options - Optional options like method, body, credentials etc.
 */
async function fetchJSON(url, options = null) {
	if (url.includes(OAPI_BASE)) await oapiBucket.take()

    const response = await fetch(url, options)
    if (!response.ok && response.status != 304) return null

    return response.json()
}

/**
 * Sends a POST request to a url with the body, parsing the response as JSON unless we received 404.
 * @param {string} url - The URL to send and retrieve data from.
 * @param {Object} body - A JS object that is automatically stringified. 
 */
const postJSON = (url, body) => fetchJSON(url, { body: JSON.stringify(body), method: 'POST' })

/**
 * Fetches an info object from the Official API base endpoint.
 * @returns {Promise<ServerInfo>}
 */
const fetchServerInfo = async () => fetchJSON(currentMapApiUrl())

/**
 * Fetches an archived markers.json from the Wayback Machine at the given date.
 * The markers URL is automatically determined by the date since it changed multiple times over the years.
 * @param {number} date 
 * @param {string} markersURL
 */
const fetchArchive = async date => {
	const markersURL = // markers.json URL changed over time
		date < 20230212 ? `https://earthmc.net/map/aurora/tiles/_markers_/marker_earth.json` :
		date < 20240701 ? `https://earthmc.net/map/aurora/standalone/MySQL_markers.php?marker=_markers_/marker_earth.json` :
		`https://map.earthmc.net/tiles/minecraft_overworld/markers.json` // latest

	const fetcher = createCorsFetcher()
	const res = await fetcher(`https://web.archive.org/web/${date}id_/${markersURL}`)
	if (!res.ok) throw new Error('error fetching archive: ' + res.status)
	
	return await res.json()
}

async function fetchAlliances() {
	const alliances = await fetchJSON(`${CAPI_BASE}/${CURRENT_MAP}/alliances`)
	if (!alliances) {
		try {
			const cache = Store.local.get('alliances')
			if (!cache) throw new Error('No alliance data in cache')

			for (const alliance of cache) {
				const [ownNations, puppetNations] = [alliance.ownNations || [], alliance.puppetNations || []]
				alliance._nationSet = new Set([...ownNations, ...puppetNations])
			}

			showAlert('Service responsible for loading alliances is unavailable, falling back to locally cached data.', 5)
			return cache
		} catch (_) {
			showAlert('Service responsible for loading alliances will be available later.')
		}
		
		return []
	}

	// Build map of parentAlliance (identifier) -> child alliances for O(1) lookup
	const childrenByParent = new Map()
	for (const a of alliances) {
		if (!a.parentAlliance) continue

		const arr = childrenByParent.get(a.parentAlliance) || []
		arr.push(a)
		childrenByParent.set(a.parentAlliance, arr)
	}

	/** @type {Array<Alliance>} */
	const allianceData = []
	for (const a of alliances) {
		const allianceType = a.type?.toLowerCase() || 'mega'
		//if (alliance.parentAlliance) continue // this is a child alliance, skip it

		const children = childrenByParent.get(a.identifier) || []
		const puppetNations = children.flatMap(a => a.ownNations || [])
		const ownNations = a.ownNations || []

		allianceData.push({
			name: a.label || a.identifier,
			modeType: allianceType == 'mega' ? 'meganations' : 'alliances',
			colours: parseColours(a.optional.colours),
			ownNations, puppetNations,
			_nationSet: new Set([...ownNations, ...puppetNations])
		})
	}

	Store.local.set('alliances', allianceData)
	return allianceData
}

/**
 * Fetches falling towns from the EMC Stats API for the current map.
 * @returns {Promise<Array<CAPIFallingTown>>}
 */
const fetchFallingTowns = () => fetchJSON(`${CAPI_BASE}/${CURRENT_MAP}/falling`)

/**
 * Fetches ruined towns from the EMC Stats API for the current map.
 * @returns {Promise<Array<CAPIFallingTown>>}
 */
const fetchRuinedTowns = () => fetchJSON(`${CAPI_BASE}/${CURRENT_MAP}/ruined`)

/**
 * Sends multiple requests and concatenates the results to circumvent 
 * the query limit while adhering to the rate limit.
 * @param {string} url 
 * @param {Array<any>} arr 
 */
async function queryConcurrent(url, arr) {
	const chunks = chunkArr(arr, OAPI_ITEMS_PER_REQ)
	const promises = chunks.map(async chunk => {
		await oapiBucket.take()
		return sendBatch(url, chunk)
	})

	const batchResults = await Promise.all(promises)
	return batchResults.flat()
}

/**
 * Splits an array into sub arrays by chunk size `sz`.
 * @param {Array} arr 
 * @param {number} chunkSize
 * @returns {Array<Array>}
 */
function chunkArr(arr, sz) {
	const ch = []
	let i = 0, len = arr.length
	for (; i < len; i += sz) { ch.push(arr.slice(i, i + sz)) }
	return ch
}

/**
 * @param {string} url 
 * @param {Array<{uuid: string}>} chunk 
 */
async function sendBatch(url, chunk) {
	return postJSON(url, { query: chunk.map(e => e.uuid) }).catch(err => {
		console.error('emcdynmapplus: error sending request:', err)
		return []
	})
}

/** @param {AllianceColours} colours  */
function parseColours(colours) {
	if (!colours) return DEFAULT_ALLIANCE_COLOURS
	colours.fill = "#" + colours.fill.replaceAll("#", "")
	colours.outline = "#" + colours.outline.replaceAll("#", "")
	return colours
}

function createCorsFetcher() {
	if (isUserscript()) return url => new Promise((res, rej) => GM_xmlhttpRequest({
		url, method: 'GET',
		onerror: rej,
		onload: r => res({
			ok: true,
			text: r.responseText,
			json: async () => JSON.parse(r.responseText)
		})
	}))

	return url => chrome.runtime.sendMessage({ url, type: 'fetch' }).then(r => {
		if (!r.ok) throw new Error(r.error)
		return { ok: true, text: r.text, json: async () => JSON.parse(r.text) }
	})
}

/**
 * Updates the address bar / href with the specified coords and zoom.
 * @param {Vertex} coords
 * @param {number} zoom
 */
function updateUrlLocation(coords, zoom = 4) {
	location.href = `${MAPI_BASE}?zoom=${zoom}&x=${coords.x}&z=${coords.z}`
}