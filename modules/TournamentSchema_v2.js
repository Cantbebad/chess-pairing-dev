// brx 2025

import { DullSerializer } from './DullSerializer.js'
import { parseSchemaSet, parseSchemaGet } from './DataSchema.js' 
import { remap_properties } from './RemapProps.js'

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
	[ 'bs_bool' , 'double_rounded'],  // moved
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

const remap_table = [
	[ 'tournamentInfo.werePlayersRandomized', 'werePlayersRandomized' ],
	[ 'tournamentInfo.wasPairingGenerated',  'wasPairingGenerated'],
	[ 'tournamentInfo.double_rounded', 'double_rounded']
]



function prepare_data(data) {
	let prep = structuredClone(data)
	prep.data_version = 2
	// move bools for BitStream
	remap_properties(data, prep, remap_table, false, true)
	/*
	prep.double_rounded = data.tournamentInfo.double_rounded
	prep.werePlayersRandomized = data.tournamentInfo.werePlayersRandomized
	prep.wasPairingGenerated = data.tournamentInfo.wasPairingGenerated

	// this is optional
	delete prep.TournamentInfo.werePlayersRandomized
	delete prep.TournamentInfo.wasPairingGenerated
	delete prop.TournamentInfo.double_rounded
	*/
	return prep
}

function finalize_data(data) {
	let prep = data
	delete prep.data_version
	// move bools back
	remap_properties(prep, data, remap_table, true /*reverse*/, true)
	/*
	prep.tournamentInfo.werePlayersRandomized = data.werePlayersRandomized
	prep.tournamentInfo.wasPairingGenerated = data.wasPairingGenerated
	prep.tournamentInfo.double_rounded = data.double_rounded

	// delete moved properties
	delete prep.werePlayersRandomized
	delete prep.wasPairingGenerated
	delete prep.double_rounded
	*/

	return prep
}

// data from Controller->data (that is class Tournament)
export function serialize_tournament_data_v2(data) {
	try {
		const prep = prepare_data(data)
		
		let arr = new Array()
		let ds = new DullSerializer()

		parseSchemaSet(ds, arr, tournament_data_schema_v2, prep)

		return arr
	}
	catch(e) {
		console.error("serialize tournament data v2 failed")
		throw e
	}
}

export function deserialize_tournament_data_v2(arr) {
	try {
		let arr_idx = { val : 0 }
		let ds = new DullSerializer()
		let ret = {}
		parseSchemaGet(ds, arr, arr_idx, tournament_data_schema_v2, ret) 

		return finalize_data(ret)
	}
	catch(e) {
		console.error("deserialize tournament data v2 failed")
		console.error(e.stack)
		throw e
	}
}









