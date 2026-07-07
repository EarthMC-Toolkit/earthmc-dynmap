/** MAIN RUNTIME LOGIC. ANYTHING NOT RELATING TO HTTP/DOM OR DOES NOT HAVE ITS OWN FILE BELONGS HERE */
//console.log('emcdynmapplus: loaded main')

// Add clickable player nameplates
waitForElement('.leaflet-nameplate-pane').then(element => {
	element.addEventListener('click', event => {
		const username = event.target.textContent || event.target.parentElement.parentElement.textContent
		if (username.length > 0) {
			// TODO: We don't need to send a request every click. Use a ~10s expiring cache.
			lookupPlayer(username, false)
		}
	})
})

const EXTRA_BORDER_OPTS = {
	label: "Country Border",
	opacity: 0.5,
	weight: 3,
	color:  "#000000",
	markup: false,
}

// Black
const DEFAULT_ALLIANCE_COLOURS = { fill: '#000000', outline: '#000000' }
const CHUNKS_PER_RES = 12
const DAY_MS = 86_400_000 // 24hrs in millis

/** @type {() => Array<{color: string | null, input: string | null}>} */
const nationClaimsInfo = () => Store.local.get('nation-claims-info', [])
const archiveDate = () => parseInt(Store.local.get('archive-date'))

/** @type {Array<ParsedMarker>} */
let parsedMarkers = [] // this is essential for the locater to work correctly

/** 
 * @typedef {Object} OAPITown
 * @property {string} name
 * @property {{ spawn: { x: number, z: number } }} coordinates
 * @property {{ numResidents: number, balance: number }} stats
 * @property {{ isOverClaimed: boolean, isRuined: boolean }} status
 */

/** @type {Array<Alliance>} 	   */ let cachedAlliances 	 = null
/** @type {Array<CAPIFallingTown>} */ let cachedFallingTowns = null
/** @type {Array<CAPITown>} 	   */ let cachedRuinedTowns  = null
/** @type {Map<string, OAPITown>}  */ let cachedApiTowns 	 = null

/** @param {MarkersResponse} data - The markers response JSON data. */
async function modifyMarkers(data) {
	const mapMode = currentMapMode()
	console.log(`Modifying markers according to current map mode: ${mapMode.name}`)

	const borders = isUserscript() ? BORDERS : await fetch(chrome.runtime.getURL('resources/borders.json')).then(r => r.json())
	if (!borders) showAlert("An unexpected error occurred fetching the borders resource file.")
	else {
		for (const key in borders) {
			borders[key] = { ...borders[key], ...EXTRA_BORDER_OPTS }
		}
		addCountryBordersLayer(data, borders)
	}

	if (mapMode == MapMode.ARCHIVE) {
		data = await getArchive(data)
	}
	if (!data?.[0]?.markers?.length) {
		showAlert('Unexpected error occurred while loading the map, EarthMC may be down. Try again later.')
		return data
	}

	const isAllianceMode = mapMode == MapMode.ALLIANCES || mapMode == MapMode.MEGANATIONS
    if (isAllianceMode && cachedAlliances == null) {
        cachedAlliances = await fetchAlliances()
    }

	if (mapMode == MapMode.NEWDAY) {
		if (cachedFallingTowns == null) cachedFallingTowns = await fetchFallingTowns()
		if (cachedRuinedTowns == null) cachedRuinedTowns = await fetchRuinedTowns()

		addRuinMarkers(data, cachedRuinedTowns, '#ff1900')
	}

	if (mapMode == MapMode.BALANCE || mapMode == MapMode.OVERCLAIM) {
		/** @type {Array<OAPITown>} */
		const cached = await Store.opfs.cache("api-towns", 3*60*1000, async () => {
			const alert = showAlertNoDismiss('Querying the EMC API for extra town info...', 30)

			const url = `${currentMapApiUrl()}/towns`
			const tlist = await fetchJSON(url)
			const towns = await queryConcurrent(url, tlist)
			
			alert.remove()
			return towns
		})

		cachedApiTowns = new Map(cached.map(t => [t.name.toLowerCase(), t]))
	}

	// Get current local storage values
	const date = archiveDate()
	const isSquaremap = mapMode != MapMode.ARCHIVE || date >= 20240701

	const useOpaque = Store.local.get('nation-claims-opaque-colors') == 'true'
	const showExcluded = Store.local.get('nation-claims-show-excluded') == 'true'
	const claimsCustomizerInfo = new Map(nationClaimsInfo()
		.filter(obj => obj.input != null)
		.map(obj => [obj.input?.toLowerCase(), obj.color])
	)

	for (const marker of data[0].markers) {
		if (marker.type != 'polygon' && marker.type != 'icon') continue

		// Set default transparency. May be altered l8r depending on map mode.
		setMarkerTransparency(marker, 0.33, 1, 1.2)

		const parsed = isSquaremap 
			? modifySquaremapDescription(marker, mapMode)
			: modifyDynmapDescription(marker, date)

		const match = parsed.mayor?.match(/^NPC(\d+)$/)
		const isRuin = match ? Number(match[1]) >= 0 && Number(match[1]) <= 1000 : false

		switch (mapMode) {
			case MapMode.DEFAULT: 
			case MapMode.ARCHIVE: break
			case MapMode.ALLIANCES: {
				colourMarkerAlliances(marker, parsed)
				break
			}
			case MapMode.MEGANATIONS: {
				colourMarkerMeganations(marker, parsed)
				break
			}
			case MapMode.OVERCLAIM: {
				const t = cachedApiTowns.get(parsed.townName.toLowerCase())
				if (t) marker.popup = buildMarkerPopup(t)

				if (isRuin) setMarkerColour(marker, '#000000', '#000000')
				else colourMarkerOverclaim(marker, t)
				break
			}
			case MapMode.NATIONCLAIMS: {
				colourMarkerNationClaims(marker, parsed.nationName, claimsCustomizerInfo, useOpaque, showExcluded)
				break
			}
			case MapMode.NEWDAY: {
				colourMarkerNewDay(marker, parsed)
				break
			}
			case MapMode.POPULATION: {
				if (isRuin) setMarkerColour(marker, '#000000', '#000000')
				else colourMarkerHeatmap(marker, parsed.residentNum, 7)
				break
			}
			case MapMode.BALANCE: {
				if (isRuin) setMarkerColour(marker, '#000000', '#000000')
				else {
					const t = cachedApiTowns.get(parsed.townName.toLowerCase())
					if (t) marker.popup = buildMarkerPopup(t)

					colourMarkerHeatmap(marker, t?.stats?.balance || 0, 90)
				}

				break
			}
			default: if (isRuin) setMarkerColour(marker, '#000000', '#000000')
		}

		parsedMarkers.push(parsed) // needs to be at very end in case any map mode funcs modify parsed
	}
	
	//const elapsed = performance.now() - start
	//console.log(`emcdynmapplus: modified description and colour of all markers. took ${elapsed.toFixed(2)}ms`)

	return data
}

/**
 * Modifies a town description of a Squaremap marker.
 * @param {SquaremapMarker} marker
 * @param {MapMode} mapMode - The currently selected map mode.
 * @returns {ParsedMarker}
 */
function modifySquaremapDescription(marker, mapMode) {
	if (mapMode == MapMode.NEWDAY && marker.tooltip.endsWith("(Ruined)")) {
		const name = marker.tooltip.substring(marker.tooltip.indexOf(">") + 1, marker.tooltip.lastIndexOf("</"))	
		return { townName: name }
	}

	const town = marker.tooltip.match(/<b>(.*)<\/b>/)[1]
	const nation = marker.tooltip.match(/\(\b(?:Member|Capital)\b of (.*)\)\n/)?.[1]
	const isCapital = marker.tooltip.match(/\(Capital of (.*)\)/) != null
	const mayor = marker.popup.match(/Mayor: <b>(.*)<\/b>/)?.[1]

	const residents = marker.popup?.match(/<\/summary>\n    \t(.*)\n   \t<\/details>/)?.[1]
	const residentNum = residents?.split(', ').length ?? 0

	const councillors = marker.popup.match(/Councillors: <b>(.*)<\/b>/)?.[1]
		.split(', ').filter(councillor => councillor != 'None')

	// Fix a bug with names that are wrapped in angle brackets
	const fixedTownName = town.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
	const fixedNationName = nation?.replaceAll('<', '&lt;').replaceAll('>', '&gt;') ?? nation

	let location = { x: 0, z: 0 }
	if (marker.points) location = midrange(marker.points.flat(2))

	// Create clickable resident lists
	const isArchiveMode = mapMode == MapMode.ARCHIVE
	const residentList = isArchiveMode ? residents : residents.split(', ').map(r => INSERTABLE_HTML.residentClickable.replaceAll('{player}', r)).join(', ')
	const councillorList = isArchiveMode ? councillors : councillors.map(c => INSERTABLE_HTML.residentClickable.replaceAll('{player}', c)).join(', ')

	// Modify description
	if (residentNum > 50) {
		marker.popup = marker.popup.replace(residents, INSERTABLE_HTML.scrollableResidentList.replace('{list}', residentList))
	} else {
		marker.popup = marker.popup.replace(residents + '\n', INSERTABLE_HTML.residentList.replace('{list}', residentList) + '\n')
	}

	const area = calcMarkerArea(marker) // Area excluding interior holes
	marker.popup = marker.popup
		.replace('</details>\n   \t<br>', '</details>') // Remove line break
		.replace('Councillors:', `Size: <b>${area} chunks</b><br/>Councillors:`) // Add size info
		.replace('<i>/town set board [msg]</i>', '<i></i>') // Remove default town board
		.replace('<i></i> \n    <br>\n', '') // Remove empty town board
		.replace('\n    <i>', '\n    <i style="overflow-wrap: break-word">') // Wrap long town board
		.replace('Councillors: <b>None</b>\n\t<br>', '') // Remove none councillors info
		.replace('Size: <b>0 chunks</b><br/>', '') // Remove 0 chunks town size info
		.replace(town, fixedTownName)
		.replace(nation, fixedNationName)
		.replaceAll('<b>false</b>', '<b><span style="color: red">No</span></b>') // 'False' flag
		.replaceAll('<b>true</b>', '<b><span style="color: green">Yes</span></b>') // 'True' flag
	
	if (!isArchiveMode) {
		marker.popup = marker.popup
		.replace(/Mayor: <b>(.*)<\/b>/, `Mayor: <b>${INSERTABLE_HTML.residentClickable.replaceAll('{player}', mayor)}</b>`) // Lookup mayor
		.replace(/Councillors: <b>(.*)<\/b>/, `Councillors: <b>${councillorList}</b>`) // Lookup a councillor in the list
	}
	if (isCapital) {
		// Prepend star indicating a capital
		marker.popup = marker.popup.replace('<span style="font-size:120%;">', '<span style="font-size: 120%">⭐ ')
	}

	marker.tooltip = marker.tooltip
		.replace('<i>/town set board [msg]</i>', '<i></i>')
		.replace('<br>\n    <i></i>', '')
		.replace('\n    <i>', '\n    <i id="clamped-board">') // Clamp long town board
		.replace(town, fixedTownName)
		.replace(nation, fixedNationName)

	if (mapMode == MapMode.ALLIANCES || mapMode == MapMode.MEGANATIONS) {
		// Add 'Part of' label
		const nationAlliances = getNationAlliances(nation, mapMode)
		if (nationAlliances.length > 0) {
			const allianceList = nationAlliances.map(alliance => alliance.name).join(', ')
			const partOfLabel = INSERTABLE_HTML.partOfLabel.replace('{allianceList}', allianceList)
			marker.popup = marker.popup.replace('</span>\n', '</span></br>' + partOfLabel)
		}
	}

	return {
		townName: fixedTownName, 
		nationName: fixedNationName,
		residentNum, residentList: residents.split(', '), 
		isCapital, mayor, area, ...location
	}
}

/**
 * Modifies a town description of a Dynmap archive marker.
 * @param {DynmapMarker} marker 
 * @param {number} curArchiveDate - Date as a number in the format YYYYDDMM
 * @returns {ParsedMarker}
 */
function modifyDynmapDescription(marker, curArchiveDate) {
	const membersTitle = marker.popup.match(/Members <span/) ? 'Members' : 'Associates'
	const residents = marker.popup.match(`${membersTitle} <span style="font-weight:bold">(.*)<\/span><br \/>Flags`)?.[1]
	const residentList = residents?.split(', ') ?? []
	const residentNum = residentList.length
	const isCapital = marker.popup.match(/capital: true/) != null
	const area = calcPolygonArea(marker.points)
	const location = midrange(marker.points.flat(2))

	// Modify description
	if (isCapital) marker.popup = marker.popup.replace('120%">', '120%">⭐ ') // Prepend star indicating a capital
	if (curArchiveDate < 20220906) {
		marker.popup = marker.popup.replace(/">hasUpkeep:.+?(?<=<br \/>)/, '; white-space:pre">')
	}
	else marker.popup = marker.popup.replace('">pvp:', '; white-space:pre">pvp:')

	marker.popup = marker.popup
		.replace("Mayor", "Mayor:")
		.replace('Flags<br />', '<br>Flags<br>')
		.replace('>pvp:', '>PVP allowed:')
		.replace('>mobs:', '>Mob spawning:')
		.replace('>public:', '>Public status:')
		.replace('>explosion:', '>Explosions:&#9;')
		.replace('>fire:', '>Fire spread:&#9;')
		.replace(/<br \/>capital:.*<\/span>/, '</span>')
		.replaceAll('true<', '&#9;<span style="color:green">Yes</span><')
		.replaceAll('false<', '&#9;<span style="color:red">No</span><')
		.replace(`${membersTitle} <span`, `${membersTitle} <b>[${residentNum}]</b> <span`)
	if (area > 0) {
		marker.popup = marker.popup
		.replace(`</span><br /> ${membersTitle}`, `</span><br>Size:<span style="font-weight:bold"> ${area} chunks</span><br> ${membersTitle}`)
	}
	// Scrollable resident list
	if (residentNum > 50) {
		marker.popup = marker.popup
			.replace(`<b>[${residentNum}]</b> <span style="font-weight:bold">`,
				`<b>[${residentNum}]</b> <div id="scrollable-list"><span style="font-weight:bold">`)
			.replace('<br>Flags', '</div><br>Flags')
	}

	// Strip all HTML tags and leading star so we can get town and nation names.
	const clean = marker.popup.replace(/<[^>]+>/g, '').trim().replace(/^⭐\s*/, '')
	const [, town, nation] = (clean.match(/^(.+?)\s*\((.+?)\)/) || [])

	return {
		townName: town?.trim() || null,
		nationName: nation?.trim() || null,
		residentList, residentNum, 
		isCapital, area, ...location
	}
}

/**
 * Gets all alliances the input nation exists within / is related to.
 * @param {string} nationName - The name of the nation to get related alliances.
 * @param {MapMode} mapMode - The currently selected map mode.
 */
function getNationAlliances(nationName, mapMode) {
	if (cachedAlliances == null) return []

	/** @type {Array<{name: string, colours: AllianceColours}>} */
	const nationAlliances = []
	for (const alliance of cachedAlliances) {
		if (alliance.modeType != mapMode.name) continue
		if (!alliance._nationSet.has(nationName)) continue

		nationAlliances.push({ name: alliance.name, colours: alliance.colours })
	}

	return nationAlliances
}

/** @param {MarkersResponse} data - The markers response JSON data. */
async function getArchive(data) {
	const loadingAlert = showAlertNoDismiss('Loading archive, please wait...', 10)
	const date = archiveDate()
	const path = `db/archives/${date}.json`

	try {
		let archive = null
		try {
			archive = await Store.opfs.readJSON(path)
		} catch (e) {
			console.warn("Failed to read cached archive:", e.name, e.message, e)
		}
		if (archive == null) {
			archive = await fetchArchive(date)
			await Store.opfs.writeJSON(path, archive)
		}

		let actualArchiveDate // Structure of markers.json changed at some point
		if (date < 20240701) {
			data[0].markers = convertOldMarkersStructure(archive.sets['townyPlugin.markerset'])
			actualArchiveDate = archive.timestamp
		} else {
			data = archive
			actualArchiveDate = archive[0].timestamp
		}

		// THIS HAS TO BE EN-CA SO REPLACING DASHES WORKS TO MATCH STORED DATE
		actualArchiveDate = new Date(parseInt(actualArchiveDate)).toLocaleDateString('en-ca')
		document.querySelector('#current-map-mode-label').textContent += ` (${actualArchiveDate})`
		
		loadingAlert.remove()
		if (actualArchiveDate.replaceAll('-', '') != date) {
			showAlert(`The closest archive to your prompt comes from ${actualArchiveDate}.`)
		}

		return data
	} catch (e) {
		console.error(e)
		return showAlert('Archive service is currently unavailable, please try later.', 5)
	}
}

/** @param {Object} markerset - The towny markerset of the old markers response JSON data */
function convertOldMarkersStructure(markerset) {
	return Object.entries(markerset.areas).filter(([key]) => !key.includes('_Shop')).map(([_, v]) => ({
		fillColor: v.fillcolor,
		color: v.color,
		popup: v.desc ?? `<div><b>${v.label}</b></div>`,
		weight: v.weight,
		opacity: v.opacity,
		type: 'polygon',
		points: v.x.map((x, i) => ({ x, z: v.z[i] }))
	}))
}

/**
 * Calculate the claim limit for an independent town and report overclaimed status.
 * @param {number} claimedChunks 
 * @param {number} numResidents 
 */
// function checkOverclaimedNationless(claimedChunks, numResidents) {
//     const resLimit = numResidents * CHUNKS_PER_RES
//     const isOverclaimed = claimedChunks > resLimit

//     // Calculate how much the town is overclaimed by, if applicable
//     return {
// 		isOverclaimed,
// 		chunksOverclaimed: isOverclaimed ? claimedChunks - resLimit : 0,
// 		resLimit
// 	}
// }

/**
 * Calculate the claim limit for a town with a nation and report overclaimed status.
 * @param {number} claimedChunks
 * @param {number} numResidents
 * @param {number} numNationResidents
 */
// function checkOverclaimed(claimedChunks, numResidents, numNationResidents) {
// 	const bonus = calcNationBonus(numNationResidents)

//     const resLimit = numResidents * CHUNKS_PER_RES
//     const totalClaimLimit = resLimit + bonus
//     const isOverclaimed = claimedChunks > totalClaimLimit
	
// 	return { 
// 		isOverclaimed,
// 		chunksOverclaimed: isOverclaimed ? claimedChunks - totalClaimLimit : 0,
// 		nationBonus: bonus,
// 		resLimit, totalClaimLimit
// 	}
// }

/** @param {number} numNationResidents */
const calcNationBonus = numNationResidents => numNationResidents >= 200 ? 100
	: numNationResidents >= 120 ? 80
	: numNationResidents >= 80 ? 60
	: numNationResidents >= 60 ? 50
	: numNationResidents >= 40 ? 30
	: numNationResidents >= 20 ? 10 : 0

/**
 * @param {string} playerName
 * @param {boolean} showOnlineStatus 
 */
async function lookupPlayer(playerName, showOnlineStatus = true) {
	document.querySelector('#player-lookup')?.remove()
	document.querySelector('#player-lookup-loading')?.remove()
	
	const leafletTL = document.querySelector('.leaflet-top.leaflet-left')
	if (!leafletTL) return showAlert('Error selecting element required to show player info popup.')

	const loading = addElement(leafletTL, INSERTABLE_HTML.playerLookupLoading, '#player-lookup-loading')
	const players = await postJSON(`${currentMapApiUrl()}/players`, { query: [playerName] })

	loading.remove()

	if (!players) return showAlert('Service is currently unavailable, please try later.', 5)
	if (players.length < 1) return showAlert(`Error looking up player: ${playerName}. They have possibly opted-out.`, 3)
	
	const player = players[0]
	const hasTown = player.town && player.town.uuid

	// Insert and populate with placeholders
	const lookup = addElement(leafletTL, INSERTABLE_HTML.playerLookup)
	lookup.insertAdjacentHTML('beforeend', '<span class="close-container">X</span>')
	lookup.insertAdjacentHTML('beforeend', '{show-online-status}<br>')
	lookup.insertAdjacentHTML('beforeend', '<img id="player-lookup-avatar"/>')
	lookup.insertAdjacentHTML('beforeend', '<center><b id="player-lookup-name">{player}</b>{about}</center>')
	lookup.insertAdjacentHTML('beforeend', '<hr>{town}{nation}')
	lookup.insertAdjacentHTML('beforeend', 'Rank: <b>{rank}</b><br>')
	lookup.insertAdjacentHTML('beforeend', 'Balance: <b>{balance} gold</b><br>')
	lookup.insertAdjacentHTML('beforeend', '{registered}')
	if (hasTown) lookup.insertAdjacentHTML('beforeend', '{town-join}')
	lookup.insertAdjacentHTML('beforeend', '{last-online}')

	// Gather data
	const isOnline = player.status.isOnline
	const balance = player.stats.balance
	const town = player.town.name
	const nation = player.nation.name

	const registeredDate = new Date(player.timestamps.registered).toLocaleDateString()
	const townJoinDate = new Date(player.timestamps.joinedTownAt || 0).toLocaleDateString()
	const loDate = new Date(player.timestamps.lastOnline).toLocaleDateString()

	let onlineStatus = '<span id="player-lookup-online" style="color: {online-color}">{online}</span>'
	const about = (!player.about || player.about == '/res set about [msg]') ? '' : `<br><i>${player.about}</i>`
	let rank = 'Townless'
	if (player.status.hasTown) rank = 'Resident'
	if (player.ranks.townRanks.includes('Councillor')) rank = 'Councillor'
	if (player.status.isMayor) rank = 'Mayor'
	if (player.ranks.nationRanks.includes('Chancellor')) rank = 'Chancellor'
	if (player.status.isKing) rank = 'Leader'

	// Place data
	const playerAvatarURL = `https://mc-heads.net/avatar/${player.uuid.replaceAll('-', '')}`
	document.querySelector('#player-lookup-avatar').setAttribute('src', playerAvatarURL)
	lookup.innerHTML = lookup.innerHTML
		.replace('{player}', player.name || playerName)
		.replace('{about}', about)
		.replace('{show-online-status}', showOnlineStatus ? onlineStatus : '')
		.replace('{online-color}', isOnline ? 'green' : 'red')
		.replace('{online}', isOnline ? '⚫︎ Online' : '○ Offline')
		.replace('{town}', town ? `Town: <b>${town}</b><br>` : '')
		.replace('{nation}', nation ? `Nation: <b>${nation}</b><br>` : '')
		.replace('{rank}', rank)
		.replace('{balance}', balance)
		.replace('{registered}', `Registered:<br><b>${registeredDate}</b> (${timeAgo(player.timestamps.registered)})`)

	if (hasTown) {
		const townJoinStr = `<br>Joined town:<br><b>${townJoinDate}</b> (${timeAgo(player.timestamps.joinedTownAt)})`
		lookup.innerHTML = lookup.innerHTML.replace('{town-join}', townJoinStr)
	}
	
	const onlineStr = !isOnline ? `<br>Last online:<br><b>${loDate}</b> (${timeAgo(player.timestamps.lastOnline)})` : ''
	lookup.innerHTML = lookup.innerHTML.replace('{last-online}', onlineStr)

	lookup.querySelector('.close-container').addEventListener('click', event => { event.target.parentElement.remove() })
}