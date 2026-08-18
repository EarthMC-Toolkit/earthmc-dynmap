/// <reference types="node"/>
/// <reference types="geojson"/>
/// <reference types="./src/types.d.ts"/>
import { readFile, writeFile } from "fs/promises"
import { applyCommands } from "mapshaper-typed"

//#region Hand-picked constants from the existing map.
// 16574 is a mean average of old map vertical bounds
const MILLER_Y_CALC = (5 / 4 * Math.asinh(Math.tan(4 / 5 * (90 * (Math.PI / 180))))) // ≈ 2.3034125433763912
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

// the humble round func. will round your number to the nearest precision, no questions asked.
const round = (v: number, precision = 0.01): number => Math.round(v / precision) * precision

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
	const boundsDiff = NOSTRA_X_BOUNDS.max - NOSTRA_X_BOUNDS.min
	return round(normalized * boundsDiff / 2)
}

/**
 * Converts a Miller projection Z coordinate from metres into a Nostra Z coordinate.
 *
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

/**
 * Recursively converts GeoJSON coordinates from projected metres into Nostra coordinates.
 *
 * GeoJSON coordinates can be nested to different depths depending on the geometry type:
 * Point       -> [x, y]\
 * LineString  -> [[x, y], ...]\
 * Polygon     -> [[[x, y], ...], ...]\
 * MultiPolygon -> [[[[x, y], ...], ...], ...]
 */
function convertCoordinates(coordinates: Coordinates): Coordinates {
	if (
		typeof coordinates[0] === "number" &&
		typeof coordinates[1] === "number"
	) return [convertX(coordinates[0]), convertZ(coordinates[1])]
	
	const nested = coordinates as Coordinates[]
	return nested.map(convertCoordinates)
}

/**
 * Converts all geometry coordinates in a GeoJSON FeatureCollection
 * into Nostra's coordinate system while preserving the GeoJSON structure.
 */
function convertGeoJSON(json: GeoJsonData): GeoJsonData {
	return {
		...json,
		features: json.features.map(feature => {
			if (!feature.geometry) return feature
			if (feature.geometry.type === "GeometryCollection") return feature
			return {
				...feature,
				geometry: {
					...feature.geometry,
					coordinates: convertCoordinates(feature.geometry.coordinates) as never
				}
			}
		})
	}
}

//const GREEN = "\x1b[32m"
const BLUE = "\x1b[4;34m"
const RESET = "\x1b[0m"

/**
 * Converts a GeoJSON file to GeoJSON in Nostra's coordinate system.
 */
async function convertGeoJsonFile(inputPath: string, outputPath: string, simplify: string): Promise<void> {
	const inputCmd = `-i input.geojson -proj +proj=mill -clean -simplify dp ${simplify} `
	const outputCmd = `-o format=geojson precision=0.01 fix-geometry output.geojson`

	// Read border input file and run our mapshaper cmds on it which then saves to a temp buffer.
	const input = { "input.geojson": await readFile(inputPath) }
	const res: Record<string, Buffer> = await applyCommands(inputCmd + outputCmd, input)

	// Mapshaper has already projected/simplified the GeoJSON into Miller coordinates.
	const geojson = JSON.parse(res["output.geojson"].toString("utf8")) as GeoJsonData

	// Convert the projected coordinates into Nostra's coordinate system while keeping the result as normal GeoJSON.
	const converted = convertGeoJSON(geojson)

	await writeFile(outputPath, JSON.stringify(converted), "utf8")

	console.log(`Parsed contents of ${BLUE}${inputPath}${RESET}`)
	console.log(`\tWrote converted GeoJSON to ${BLUE}${outputPath}${RESET}\n`)
}

const COUNTRIES_INPUT_PATH = "./geojson/ne_10m_admin_0_countries.geojson"
const COUNTRIES_OUTPUT_PATH = "./resources/borders-countries.geojson"

const PROVINCES_INPUT_PATH = "./geojson/ne_10m_admin_1_states_provinces.geojson"
const PROVINCES_OUTPUT_PATH = "./resources/borders-provinces.geojson"

console.log("Converting GeoJSON files to Nostra GeoJSON...\n")
await convertGeoJsonFile(COUNTRIES_INPUT_PATH, COUNTRIES_OUTPUT_PATH, "60%")
await convertGeoJsonFile(PROVINCES_INPUT_PATH, PROVINCES_OUTPUT_PATH, "40%")
console.log("Generated border files.")