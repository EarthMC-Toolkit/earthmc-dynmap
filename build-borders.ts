import { readFile, writeFile } from "node:fs/promises"

type Position = [number, number]
type Ring = Position[]
type Polygon = Ring[]
type MultiPolygon = Polygon[]

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
		coordinates: MultiPolygon
	}
	properties: {
		name?: string
		admin?: string
		adm0_a3?: string
		ADM0_A3?: string
	} | null
}

interface Border {
	x: number[]
	z: number[]
}

const COUNTRIES_INPUT = "./local/ne_10m_admin_0_countries.json"
const PROVINCES_INPUT = "./local/ne_10m_admin_1_states_provinces.json"

const COUNTRIES_OUTPUT = "./resources/borders-countries.json"
const PROVINCES_OUTPUT = "./resources/borders-provinces.json"

// Hand-picked constants from the existing map.

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

function convertX(x: number): number {
	const normalized = x / (Math.PI * MERCATOR_RADIUS)
	const boundsDiff = (NOSTRA_X_BOUNDS.max - NOSTRA_X_BOUNDS.min)
	return round(normalized * boundsDiff / 2)
}

function convertZ(z: number): number {
	const millerZ = (z / MILLER_RADIUS) * MILLER_Y_NORMALIZER
	return round(-millerZ * MAP_SCALE_FACTOR + MOVE_DOWN)
}

function convertRing(ring: Ring): Border {
	const x: number[] = []
	const z: number[] = []

	for (const [projectedX, projectedZ] of ring) {
		x.push(convertX(projectedX))
		z.push(convertZ(projectedZ))
	}

	return { x, z }
}

const round = (value: number): number => Math.round(value * 100) / 100

const input = await readFile(PROVINCES_INPUT, "utf8")
const geojson = JSON.parse(input) as GeoJSON

const borders: Record<string, Border> = {}

let idx = 0

for (const feature of geojson.features) {
	if (
		feature.properties?.admin === "Antarctica" ||
		feature.properties?.adm0_a3 === "ATA" ||
		feature.properties?.ADM0_A3 === "ATA"
	) {
		continue
	}

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

await writeFile(PROVINCES_OUTPUT, JSON.stringify(borders), "utf8")
console.log(`Wrote ${idx} border rings to ${PROVINCES_OUTPUT}`)