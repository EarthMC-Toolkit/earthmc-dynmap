/// <reference types="node"/>
import { readFile, writeFile } from "fs/promises"

// @ts-ignore mapshaper does not provide TypeScript declarations
import * as mapshaper from "mapshaper"

type Position = [number, number]
type Ring = Array<Position>
type Polygon = Array<Ring>

interface GeoJSON {
	type: "FeatureCollection"
	features: Feature[]
}

interface Feature {
	geometry: {
		type: "Polygon"
		coordinates: Polygon
	} | {
		type: "MultiPolygon"
		coordinates: Array<Polygon>
	} | null
	properties: {
		name?: string
		admin?: string
		adm0_a3?: string
		ADM0_A3?: string
	} | null
}

interface Border {
	x: Array<number>
	z: Array<number>
}

//#region Hand-picked constants from the existing map.

// 16574 is a mean average of old map vertical bounds
const MILLER_Y_CALC = (5/4 * Math.asinh(Math.tan(4/5 * (90 * (Math.PI / 180))))) // ≈ 2.3034125433763912
const MILLER_Y_NORMALIZER = 16540 / MILLER_Y_CALC // ≈ 7178.35

// For some reason Nostra (or miller?) uses mercator for X but Miller for Y.
const MILLER_RADIUS = 6370997
const MERCATOR_RADIUS = 6378137

const MAP_SCALE_FACTOR = 94704 / 33148 // Estimated height of new (Nostra) map if it wasn't cropped / Height of old map
const MOVE_DOWN = 8014 // THE EQUATOR. Centre of the map used to move the whole border layer down by.

const NOSTRA_X_BOUNDS = {
	min: -64512,
	max: 64512
}
//#endregion

const PRECISION = 0.01

// the humble round func. will round your number to the nearest precision, no questions asked.
const round = (v: number, precision = PRECISION): number => Math.round(v / precision) * precision

/**
 * Converts a Web Mercator X coordinate from metres into a Nostra X coordinate.
 *
 * The input is converted into a normalized world coordinate, where ±PI*MERCATOR_RADIUS represents the full width 
 * of the projected world. It is then scaled into Nostra's X coordinate range defined by its map bounds.
 *
 * @param x Web Mercator X coordinate in metres.
 */
function convertX(x: number): number {
	const normalized = x / (Math.PI * MERCATOR_RADIUS)
	const boundsDiff = (NOSTRA_X_BOUNDS.max - NOSTRA_X_BOUNDS.min)
	return round(normalized * boundsDiff / 2)
}

/**
 * Converts a Miller projection Z coordinate from metres into a Nostra Z coordinate.

 * The input is converted into a normalized Miller coordinate using the radius used by the source projection, 
 * the result then gets negated because Nostra's Z axis is inverted relative to the GeoJSON projection 
 * (prolly caused by Minecraft/Squaremap), as to convert it from projection Y to map Z.
 *
 * @param z Miller projection Z coordinate in metres.
 */
function convertZ(z: number): number {
	const millerZ = (z / MILLER_RADIUS) * MILLER_Y_NORMALIZER
	return round(-millerZ * MAP_SCALE_FACTOR + MOVE_DOWN)
}

function convertRing(ring: Ring): Border {
	const [x, z] = [new Array<number>(), new Array<number>()]
	for (const [projectedX, projectedZ] of ring) {
		x.push(convertX(projectedX))
		z.push(convertZ(projectedZ))
	}

	return { x, z }
}

let idx = 0

/** 
 * Parses a file in the GeoJSON format, returning a Record<string, Border> where the key is the index of the country.\
 * Since Nostra crops out Antarctica, we skip it here to ensure its border does not exist in the record.
*/
function parseGeoJSON(json: GeoJSON) {
	idx = 0

	const borders: Record<string, Border> = {}
	for (const feature of json.features) {
		if (!feature.geometry) continue
		if (feature.properties?.admin === "Antarctica") continue
		if (feature.properties?.adm0_a3 === "ATA" || feature.properties?.ADM0_A3 === "ATA") continue

		if (feature.geometry.type === "Polygon") {
			for (const ring of feature.geometry.coordinates) {
				borders[`countryBorders_0_1_${idx}`] = convertRing(ring)
				idx++
			}
		} else {
			for (const polygon of feature.geometry.coordinates) {
				for (const ring of polygon) {
					borders[`countryBorders_0_1_${idx}`] = convertRing(ring)
					idx++
				}
			}
		}
	}

	return borders
}

const GREEN = "\x1b[32m"
const BLUE = "\x1b[4;34m"
const RESET = "\x1b[0m"

/**
 * Convert GeoJSON file to regular JSON encoded file, stripping unnecessary duplicate info 
 * (such as features, type and properties) since only want to output a Record<string, Border> 
 * where the key is the country index and the value (Border) contains its X and Z coordinates.
*/ 
async function convertGeoJsonFile(inputPath: string, outputPath: string, simplify: string): Promise<void> {
	const input = await readFile(inputPath)
	const output = await mapshaper.applyCommands(
		"-i input.geojson -proj +proj=mill -clean -simplify dp 90% -o format=geojson fix-geometry precision=0.01 output.geojson",
		{ "input.geojson": input }
	)

	const geojson = JSON.parse(output["output.geojson"].toString("utf8")) as GeoJSON
	const borders = parseGeoJSON(geojson)

	await writeFile(outputPath, JSON.stringify(borders), "utf8")
	console.log(`Parsed contents of ${BLUE}${inputPath}${RESET}`)
	console.log(`\tWrote ${GREEN}${Object.keys(borders).length}${RESET} border rings to ${BLUE}${outputPath}${RESET}\n`)
}

const COUNTRIES_INPUT_PATH = "./geojson/ne_10m_admin_0_countries.geojson"
const COUNTRIES_OUTPUT_PATH = "./resources/borders-countries.json"

const PROVINCES_INPUT_PATH = "./geojson/ne_10m_admin_1_states_provinces.geojson"
const PROVINCES_OUTPUT_PATH = "./resources/borders-provinces.json"

console.log('Converting GeoJSON files to JSON...\n')
await convertGeoJsonFile(COUNTRIES_INPUT_PATH, COUNTRIES_OUTPUT_PATH, "90%")
await convertGeoJsonFile(PROVINCES_INPUT_PATH, PROVINCES_OUTPUT_PATH, "40%")
console.log("Generated border files.")