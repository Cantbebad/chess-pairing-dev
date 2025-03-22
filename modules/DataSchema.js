
// brx 2025

import { DullSerializer } from './DullSerializer.js'
import { BitStream } from './BitStream.js'

let DullSerializerDataTypes = {
	'b8' : [ (ds, arr, idx) => { return ds.readInt8(arr, idx) } ,
					(ds, arr, val) => { ds.appendInt8(arr, val) } ] ,
	'b16' : [ (ds, arr, idx) => { return ds.readInt16(arr, idx) } ,
					(ds, arr, val) => { ds.appendInt16(arr, val) } ] ,
	'bool' : [ (ds, arr, idx) => { return ds.readBool(arr, idx) } ,
					(ds, arr, val) => { ds.appendBool(arr, val) } ] ,
	'str8' : [ (ds, arr, idx) => { 
						return ds.readString8(arr, idx)
						/*
						let size = ds.readInt8(arr, idx)
						const bytes = ds.readBytes(arr, idx, size)
						return ds.byteArrayToUtf8(bytes)
						*/
					},
			   (ds, arr, val) => { 
				   ds.appendString8(arr, val)
				   /*
				  let bytes = ds.utf8ToByteArray(val)
				  ds.appendInt8(arr, bytes.length)
				  ds.appendBytes(arr, bytes)
				  */
			  }],

	/* implemented in parser (differently, no bytes size)
	'bitstream16' : [ (ds, arr, idx) => { 
						let size = ds.readInt16(arr, idx)
						return ds.readBytes(arr, idx, size)
					},
			   (ds, arr, bs) => { 
				   let bsd = bs.get_stream_data()
				   ds.appendInt16(arr, bsd.bytes.length) 
				   ds.appendBytes(arr, bsd.bytes)
			  }],
	*/
}


// Note: will not work correctly with array of array
// Opt: To implement array_of_array
export function parseSchemaSet(ds, arr, schema, obj, idx=null) {
	schema.forEach((item_data => {
		const type = item_data[0]
		const item_name = item_data[1]
		const other_schema = item_data.length >=2 ? item_data[2] : null
		switch(type) {
			case 'b8':
			case 'b16':
			case 'str8':
			case 'bool':
				const setter_fn = DullSerializerDataTypes[type][1]

				if (idx === null) {
					if (item_name === null) {
						setter_fn(ds, arr, obj)
					}
					else {
						setter_fn(ds, arr, obj[item_name])
					}
				}
				else {
					// we are in array
					// not used in implementation
					setter_fn(ds, arr, obj[idx])
				}
				break
			case 'object':
				parseSchemaSet(ds, arr, other_schema, obj[item_name])
				break

			case 'array8':
				{
					const count = obj[item_name].length
					ds.appendInt8(arr, count)
					for (let i=0; i<count; ++i) {
						parseSchemaSet(ds, arr, other_schema, obj[item_name][i])
					}
				}
				break
			case 'array16':
				{
					const count = obj[item_name].length
					ds.appendInt16(arr, count)
					for (let i=0; i<count; ++i) {
						parseSchemaSet(ds, arr, other_schema, obj[item_name][i])
					}
				}
				break
			case 'bitstream16':
				{
					let bs = new BitStream()
					parseBitstreamSchemaSet(bs, other_schema, obj)
					bs.lock()
					const bs_data = bs.get_stream_data()
					ds.serialize_bitstream(arr, bs_data)
				}
				break
			default:
				throw new Error("unknown datatype")
		}
	}))
}

function parseBitstreamSchemaSet(bs, schema, obj, idx = null) {
	schema.forEach((item_data => {
		const type = item_data[0]
		// TODO
		const item_name = item_data[1]
		const item_size = item_data[2]
		const other_schema = item_data.length >=2 ? item_data[2] : null
		const value = item_data.length >=2 ? item_data[2] : null
		switch(type) {
			case 'bs_bool':
			case 'bs_item':
				//const getter_fn = BitStreamDataTypes[type][0]
				const setter_fn = BitStreamDataTypes[type][1]

				if (idx === null) {
					if (item_name === null) {
						// we are in array
						setter_fn(bs, item_size, obj)
					}
					else {
						setter_fn(bs, item_size, obj[item_name])
					}
				}
				else {
					// not used in implementation
					setter_fn(bs, item_size, obj[idx])
				}
				break
			case 'array8':
				{
					const count = obj.length
					bs.write(8, count)
					for (let i=0; i<count; ++i) {
						parseBitstreamSchemaSet(bs, other_schema, obj[item_name][i])
					}
				}
				break
			case 'array16':
				{
					const count = obj[item_name].length
					bs.write(16, count)
					for (let i=0; i<count; ++i) {
						parseBitstreamSchemaSet(bs, other_schema, obj[item_name][i])
					}
				}
				break
		}
	}))
}

let BitStreamDataTypes = {
	'bs_bool' : [ (bs, item_size) => { return !!bs.read(1) } ,
	   		   (bs, item_size, val) => { bs.write(1, !!val) } ],
	'bs_item' : [ (bs, item_size) => { return bs.read(item_size) } ,
	   		   (bs, item_size, val) => { bs.write(item_size, val) } ],
	/*
	'bs_item_arr16' : [ (bs, item_size, arr_length) => { 
					return new Array(arr_length).fill(0).forEach((item, idx) =>
						{ item = bs.read(item_size) }) 
					},
					 (bs, item_size, arr) => { 
						new Array(arr_length).fill(0).forEach((item, idx) =>
							{ bs.write(item_size) }) 
					}]
	*/
}

// will convert all null str8 to ''
export function parseSchemaGet(ds, arr, arr_idx, schema, obj, item_index = null) {
	schema.forEach((item_data => {
		const type = item_data[0]
		const item_name = item_data[1]
		const other_schema = item_data.length >=2 ? item_data[2] : null
		switch(type) {
			case 'b8':
			case 'b16':
			case 'str8':
			case 'bool':
				const getter_fn = DullSerializerDataTypes[type][0]
				//const setter_fn = DullSerializerDataTypes[type][1]

				if (item_name === null) {
					obj[item_index] = getter_fn(ds, arr, arr_idx)
				}
				else {
					if (item_index !== null) {
						obj[item_index][item_name] = getter_fn(ds, arr, arr_idx)
					}
					else {
						obj[item_name] = getter_fn(ds, arr, arr_idx)
					}
				}
				break
			case 'object':
				obj[item_name] = {}
				parseSchemaGet(ds, arr, arr_idx, other_schema, obj[item_name])
				break

			case 'array8':
				{
					const count = ds.readInt8(arr, arr_idx)
					obj[item_name] = new Array(count).fill(0)
					obj[item_name].forEach((item,index) => { obj[item_name][index] = {}})

					for (let i=0; i<count; ++i) {
						parseSchemaGet(ds, arr, arr_idx, other_schema, obj[item_name], i)
					}
				}
				break
			case 'array16':
				{
					const count = ds.readInt16(arr, arr_idx)
					obj[item_name] = new Array(count).fill(0)
					obj[item_name].forEach((item,index) => { obj[item_name][index] = {}})

					for (let i=0; i<count; ++i) {
						parseSchemaGet(ds, arr, arr_idx, other_schema, obj[item_name], i)
					}
				}
				break
			case 'bitstream16':
				{
					let bs = ds.reconstruct_bitstream16(arr, arr_idx)
					bs.lock()
					parseBitstreamSchemaGet(bs, other_schema, obj)
				}
				break
			default:
				throw new Error("unknown datatype: "+ type)
		}
	}))
}

function parseBitstreamSchemaGet(bs, schema, obj, item_index=null) {
	schema.forEach((item_data => {
		const type = item_data[0]
		// TODO
		const item_name = item_data[1]
		const item_size = item_data[2]
		const other_schema = item_data.length >=2 ? item_data[2] : null
		const value = item_data.length >=2 ? item_data[2] : null
		switch(type) {
			case 'bs_bool':
			case 'bs_item':
				{
					const getter_fn = BitStreamDataTypes[type][0]
					//const setter_fn = BitStreamDataTypes[type][1]

					if (item_name === null) {
						// getter for bool has fixed size 1
						obj[item_index] = getter_fn(bs, item_size, obj)
					}
					else {
						obj[item_name] = {}
						// getter for bool has fixed size 1
						obj[item_name] = getter_fn(bs, item_size)
					}
				}
				break
			case 'array8':
				{
					const count = bs.read(16)
					obj[item_name] = new Array(count).fill(0)
					obj[item_name].forEach((item,index) => { obj[item_name][index] = {}})
					for (let i=0; i<count; ++i) {
						parseBitstreamSchemaGet(bs, other_schema, obj[item_name], i)
					}
				}
				break
			case 'array16':
				{
					const count = bs.read(16)
					obj[item_name] = new Array(count).fill(0)
					obj[item_name].forEach((item,index) => { obj[item_name][index] = {}})
					for (let i=0; i<count; ++i) {
						parseBitstreamSchemaGet(bs, other_schema, obj[item_name], i)
					}
				}
				break
		}
	}))
}


// state: experimental
export function generate_data_schema_from_plain_object(obj, schema_name, out_schema, in_array=false) {
	let variables = Object.getOwnPropertyNames(obj)
	let schema_data = new Array()

//	console.log('variables: ' +  variables)

	if (in_array) {
		//console.log('HACK variables[0]: ' + variables[0])
		if (variables[0] !== '0') {
			// still in array, but object happens
			//console.log('HACK')
			in_array = false
		}
	}
	
	
	if (in_array) {
		let item = variables[0]
		const con = obj[item].constructor.name

		//console.log('in_array con: ' + con)
		switch(con) {
			case 'Object':
				//console.log('object schema name: '+ schema_name)
				out_schema[schema_name] = []
				generate_data_schema_from_plain_object(
					obj[item], schema_name, out_schema)
				schema_data = out_schema[schema_name]
				//console.log('debug:  ' + out_schema[schema_name])
				break
			case 'String':
				schema_data.push(["'str8', null", "adjust item size"])
				break
			case 'Number':
				schema_data.push(["'b16', null", "adjust item size, if less bits are needed, recosider to move it to BitStream"])
				break
			case 'Array':
				schema_data.push([`'array16', '${item}', ${item}_schema`,''])
				out_schema[item + '_schema'] = []
				try {
					generate_data_schema_from_plain_object(
						obj[item], 
						item + '_schema', 
						out_schema, 
						true)
				}
				catch(e) {;}
				break
			case 'Boolean':
				schema_data.push([`'bool', '${item}'`, "reconsider to move it to BitStream"])
				break
			default:
				schema_data.push(["UNRECOGNIZED",''])
		}
		//console.log(item)
	}
	else {
		variables.forEach((item => {
			const con = obj[item].constructor.name

			switch(con) {
				case 'Object':
					schema_data.push([`'object', '${item}', ${item}_schema`,''])
					out_schema[item + '_schema'] = []
					generate_data_schema_from_plain_object(
						obj[item], item + '_schema', out_schema)
					break
				case 'String':
					schema_data.push([`'str8', '${item}'`, "adjust item size"])
					break
				case 'Number':
					schema_data.push([`'b16', '${item}'`, "adjust item size"])
					break
				case 'Array':
					schema_data.push([`'array16', '${item}', ${item}_schema`,''])
					out_schema[item + '_schema'] = []
					try {
						generate_data_schema_from_plain_object(
							obj[item], 
							item + '_schema', 
							out_schema, 
							true)
					}
					catch(e) {
						console.log(e)
					}
					break
				case 'Boolean':
					schema_data.push([`'bool', '${item}'`, "reconsider to move it to BitStream"])
					break
				default:
					schema_data.push(["UNRECOGNIZED",''])
			}
		
		}))
	}

	//console.log('out schema: ' + out_schema[schema_name])
	out_schema[schema_name] = schema_data 

}

export function str_schema(out_schema, sections=null) {

	let msg =""
	let variables = null
	if (sections !== null) {
		variables = sections
	}
	else {
		variables = Object.getOwnPropertyNames(out_schema)
	}

	variables.forEach((item => {

		//if (out_schema[item].constructor.name !== 'Object') return

		msg += "const "+ item + " = [\n"

		out_schema[item].forEach((data => {
			msg += "\t[ " + data[0] + " ],"
			if (data[1] !== "") {
				msg += "    // " + data[1] 
			}
			msg += '\n'
		}))

		msg += "]\n\n"

	}))
	return msg
}




