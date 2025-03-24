import { parseSchemaSet, 
	parseSchemaGet, 
	str_schema, 
	generate_data_schema_from_plain_object } from './DataSchema.js'
import { DullSerializer } from './DullSerializer.js'

const player_schema_test = [
	[ 'str8', 'name' ],
	[ 'b16' , 'rating' ]
]

const finalStandingsResolvers_schema_test = [
	[ 'str8', null ]
]

const tournament_info_schema_test = [
	[ 'str8', 'id' ],
	[ 'str8', 'seed' ],
	[ 'str8', 'title' ],
	[ 'str8', 'date' ],
	[ 'str8', 'location_' ],
	[ 'b8' , 'pairing_version'],
	[ 'array8', 'finalStandingsResolvers', finalStandingsResolvers_schema_test ]
]


const results_schema_test = [
	[ 'bs_item', null, 3 ]
]

const bs_container_schema_test = [
	[ 'bs_bool' , 'double_rounded'],
	[ 'bs_bool' , 'werePlayersRandomized'],
	[ 'bs_bool' , 'wasPairingGenerated'],
	[ 'array16', 'results', results_schema_test ]
]

const tournament_data_schema_test = [ 
	[ 'b16', 'data_version' ],
	[ 'object', 'tournamentInfo', tournament_info_schema_test],
	[ 'array16', 'players', player_schema_test ],
	[ 'bitstream16', null, bs_container_schema_test]
]

const data = {
	data_version : 2,
	players : [ 
		{ name : 'pl1', rating : 2000 }, 
		{ name: 'pl2', rating: 2400 },
		{ name: 'pl3', rating: 2200 },
		{ name: 'pl4', rating: 2600 },
	],

	results : [ 0, 0, 0, 1],
	tournamentInfo : {
		id : 'AE124',

		seed : "1234", 
		title : "Tournament", 
		date : "1.1.1970", 
		location_ : "Mars", 

		pairing_version : 1,
		finalStandingsResolvers : [ 'mutual', 'special', 'more_wins' ]
	},
	double_rounded : false,
	werePlayersRandomized : true,
	wasPairingGenerated : true,

}


function _test_schema() {
	let arr = new Array()
	let ds = new DullSerializer()

	console.log("original:")
	console.log(data)
	parseSchemaSet(ds, arr, tournament_data_schema_test, data)

	console.log('arr size: ' + arr.length)
	console.log(arr)

	let idx = { val : 0 }
	ds = null
	ds = new DullSerializer()
	let ret = {}
	parseSchemaGet(ds, arr, idx, tournament_data_schema_test, ret) 
	console.log("restored from serialized data:")
	console.log(ret)
}

function _test_schema_generator() {
	// nested arrays (? - not exactly)
	const test_obj = {
		// this does not work correctly,
		// it is array of anonymous object
		'arr1' : [
			{
			'arr2' : [
				 1,2,3
				],
			'arr3' : [
				"a", "b"
			],
			'object_with_array': {
					'arr4': [ 5,6,7]
				}
			}
		]
	}


	let out_schemas = {}
	generate_data_schema_from_plain_object(data, 'root_schema', out_schemas)

	console.log("\n// Schema as code:\n")
	console.log(str_schema(out_schemas))


	out_schemas = {}
	generate_data_schema_from_plain_object(test_obj, 'root_schema', out_schemas)

	console.log("\n// Schema as code:\n")
	let code = str_schema(out_schemas, [
		'arr4_schema',
		'object_with_array_schema',
		'arr2_schema',
		'arr3_schema',
		'arr1_schema',
		'root_schema'
	])

	console.log(code)

	// test code - not working in strict mode, global variables are not set
	//eval?.(code);

	/*
	{
		let arr = new Array()
		let ds = new DullSerializer()

		let idx = { val : 0 }
		ds = null
		ds = new DullSerializer()
		let ret = {}
		//parseSchemaSet(ds, arr, root_schema, test_obj)
		parseSchemaGet(ds, arr, idx, root_schema, ret) 
		console.log("restored from serialized data:")
		console.log(ret)
	}
	*/

	//console.log(out_schemas)

	{
		// Schema as code:

		const arr4_schema = [
			[ 'b16', null ],    // adjust item size, if less bits are needed, recosider to move it to BitStream
		]

		const object_with_array_schema = [
			[ 'array16', 'arr4', arr4_schema ],
		]

		const arr2_schema = [
			[ 'b16', null ],    // adjust item size, if less bits are needed, recosider to move it to BitStream
		]

		const arr3_schema = [
			[ 'str8', null ],    // adjust item size
		]

		const arr1_schema = [
			[ 'array16', 'arr2', arr2_schema ],
			[ 'array16', 'arr3', arr3_schema ],
			[ 'object', 'object_with_array', object_with_array_schema ],
		]

		const root_schema = [
			[ 'array16', 'arr1', arr1_schema ],
		]

		let arr = new Array()
		let ds = new DullSerializer()

		console.log("original:")
		console.log(test_obj)
		parseSchemaSet(ds, arr, root_schema, test_obj)

		let idx = { val : 0 }
		ds = null
		ds = new DullSerializer()
		let ret = {}
		parseSchemaGet(ds, arr, idx, root_schema, ret) 
		console.log("restored from serialized data:")
		console.log(ret)
		// NOT SAME - reason: array of anonymous object
	}

}

_test_schema()
// _test_schema_generator()



