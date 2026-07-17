/** THIS FILE CONTAINS ALL TYPES FOR DEVELOPMENT AND IT IS NOT INCLUDED IN THE FINAL BUNDLE */

declare global {
    // --------------------- GENERIC SHARED TYPES ---------------------
    export interface Entity { name: string, uuid: string }

    // --------------------- BUILD SCRIPT TYPES ---------------------
    export interface Border { x: Array<number>, y: Array<number>, z: Array<number> }
    export interface Borders { [key: string]: Border }

    // --------------------- GEOMETRY TYPES ---------------------
    export interface Vertex { x: number, z: number }
    export type Polygon = Array<Vertex>
    export type MarkerPoints = Array<Polygon>
    export type MultiPolygonPoints = Array<MarkerPoints>

    // --------------------- EMC MAP RESPONSE TYPES ---------------------
    /** The raw response data from `markers.json`. Contains markers from Towny at index 0 and World Border at index 1. */
    export type MarkersResponse = Array<ResponseMarker>
    export interface ResponseMarker { 
        // id: string;
        // name: string;
        // timestamp: number
        // control: boolean;
        // z_index: number;
        // order: number;
        // hide: boolean;
        markers: Array<SquaremapMarker | DynmapMarker>;
    }

    export interface Marker {
        tooltip: string
        popup: string
        type: string
        weight: number
        color: string
        opacity: number
        fillColor: string
        fillOpacity: number
    }
    
    export interface SquaremapMarker extends Marker {
        points: MultiPolygonPoints
    }

    export interface DynmapMarker extends Marker {
        points: Polygon
    }

    export interface ParsedMarker {
        townName: string
        nationName: string
        residentList: Array<string>
        residentNum: number
        isCapital: boolean
        area: number
        x: number
        z: number
        mayor?: string
    }

    // --------------------- MAP MODE TYPES ---------------------
    export interface NationClaimsEntry {
        input?: string | null,
        color?: string | null
    }

    export interface NationClaimsCacheInfo {
        entries: Map<string, string>
        showExcluded: boolean
        useOpaque: boolean
    }

    export interface MarkerApplyContext {
        date: number // eg: 20240701
        isSquaremap: boolean
        isRuin: boolean
    }

    export interface MapModeType {
        name: string
        img: string | null
        order: number // the index at which it sits in the selector
        cache?: { [key: string]: any },
        skipIf?: () => boolean
        preload?: (data: MarkersResponse) => Promise<any>
        apply?: <T = SquaremapMarker | DynmapMarker>(marker: T, parsed: ParsedMarker, context: MarkerApplyContext) => Promise<T | void>
    }

    // --------------------- ALLIANCE TYPES ---------------------
    export interface Alliance {
        name: string
        modeType: string
        colours: AllianceColours
        ownNations: Array<string>
        puppetNations: Array<string>
        /** Set of all nations (own & puppets) in this alliance. */
        _nationSet: Set<string>
    }

    export interface AllianceColours {
        fill: string
        outline: string
    }

    // --------------------- EMC STATS API TYPES ---------------------
    export interface CAPIFallingTown extends OAPITown {
        ruinAt: Date
        deletionAt: Date
        mayorLastOnline: Date
        /** Duration in seconds the mayor has been inactive */
        inactiveDuration: number
    }

    export interface CAPIRuinedTown extends OAPITown {
        deletionAt: Date
    }

    // --------------------- EMC API RESPONSE TYPES ---------------------
    export interface OAPITown extends Entity {
        board: string
        discord: string
        founder: string
        mayor: Entity
        nation: Entity // when ruined: { name: null, uuid: null }
        residents: Array<Entity>
        stats: {
            numTownBlocks: number
            maxTownBlocks: number
            numResidents: number
            balance: number
        }
        status: {
            isPublic: boolean
            isOpen: boolean
            isCapital: boolean
            isOverClaimed: boolean
            isRuined: boolean
            canOutsidersSpawn: boolean
            forSale: boolean
        }
        timestamps: {
            registered: number
            joinedNationAt: number // when ruined: null
            ruinedAt?: number
        }
        coordinates: {
            homeBlock: [number, number]
            townBlocks: Array<[number, number]>
            spawn: {
                x: number
                z: number
                y: number
                world: string
                pitch: number
                yaw: number
            }
        }
        perms: {
            build: [boolean, boolean, boolean, boolean]     // when ruined: true, true, true, true
            destroy: [boolean, boolean, boolean, boolean]   // when ruined: true, true, true, true
            switch: [boolean, boolean, boolean, boolean]    // when ruined: true, true, true, true
            itemUse: [boolean, boolean, boolean, boolean]   // when ruined: true, true, true, true
            flags: {
                pvp: boolean        // when ruined: true
                explosions: boolean // when ruined: false
                fire: boolean       // when ruined: true
                mobs: boolean       // when ruined: true
            }
        }
        ranks: {
            [key: string]: Array<Entity>
        }
    }

    export interface ServerInfo {
        version: string
        moonPhase: string
        timestamps: ServerTimestamps
        status: ServerStatus
        stats: ServerStats
        voteParty: ServerVoteParty
    }

    export interface ServerTimestamps {
        newDayTime: number
        serverTimeOfDay: number
    }

    export interface ServerStatus {
        hasStorm: boolean
        isThundering: boolean
    }

    export interface ServerStats {
        time: number
        fullTime: number
        maxPlayers: number
        numOnlinePlayers: number
        numOnlineNomads: number
        numResidents: number
        numNomads: number
        numTowns: number
        numTownBlocks: number
        numNations: number
        numQuarters: number
        numCuboids: number
    }

    export interface ServerVoteParty {
        target: number
        numRemaining: number
    }

    // --------------------- MISC TYPES ---------------------
    export interface TokenBucketOptions {
        capacity: number
        refillRate: number
        storageKey: string
    }

    export interface TokenBucketStored {
        tokens: number
        lastRefill: number
    }
}

export {}