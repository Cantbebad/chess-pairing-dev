import { parseSchemaSet, parseSchemaGet } from './DataSchema.js' 

const player_schema_v2 = [
	[ 'str8', 'name' ],
	[ 'b16' , 'rating' ]
]

const finalStandingsResolvers_schema_v2 = [
	[ 'str8', null ]
]

const tournament_info_schema_v2 = [
	[ 'str8', 'id' ],
	[ 'str8', 'seed' ],
	[ 'str8', 'title' ],
	[ 'str8', 'date' ],
	[ 'str8', 'location_' ],
	[ 'b8' , 'pairing_version'],
	[ 'array8', 'finalStandingsResolvers', finalStandingsResolvers_schema_v2 ]
]


const results_schema_v2 = [
	[ 'bs_item', null, 3 ]
]

const bs_container_schema_v2 = [
	[ 'bs_bool' , 'double_rounded'],
	[ 'bs_bool' , 'werePlayersRandomized'], // moved
	[ 'bs_bool' , 'wasPairingGenerated'],  // moved
	[ 'array16', 'results', results_schema_v2 ]
]

const tournament_data_schema_v2 = [ 
	[ 'b16', 'data_version' ],
	[ 'object', 'tournamentInfo', tournament_info_schema_v2],
	[ 'array16', 'players', player_schema_v2 ],
	[ 'bitstream16', null, bs_container_schema_v2]
]

function prepare_data(data) {
	let prep = structuredClone(data)
	prep.data_version = 2
	// move bools for BitStream
	prep.werePlayersRandomized = data.tournamentInfo.werePlayersRandomized
	prep.wasPairingGenerated = data.tournamentInfo.wasPairingGenerated

	// this is optional
	delete prep.TournamentInfo.werePlayersRandomized
	delete prep.TournamentInfo.wasPairingGenerated

	return prep
}

function finalize_data(data) {
	let prep = data
	delete prep.data_version
	// move bools for BitStream
	prep.tournamentInfo.werePlayersRandomized = data.werePlayersRandomized
	prep.tournamentInfo.wasPairingGenerated = data.wasPairingGenerated

	// delete moved properties
	delete prep.werePlayersRandomized
	delete prep.wasPairingGenerated

	return prep
}

// data from Controller->data (that is class Tournament)
export function serialize_tournament_data_v2(data) {
	const prep = prepare_data(data)
	
	let arr = new Array()
	let ds = new DullSerializer()

	parseSchemaSet(ds, arr, tournament_data_schema_v2, prep)

	return arr
}

export function deserialize_tournament_data_v2(arr) {

	let idx = { val : 0 }
	let ds = new DullSerializer()
	let ret = {}
	parseSchemaGet(ds, arr, idx, tournament_data_schema_v2, ret) 

	return finalize_data(ret)
}









