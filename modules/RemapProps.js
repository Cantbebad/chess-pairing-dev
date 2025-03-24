
// brx 2025

function get_final_object(obj, obj_name) {
	const layers = obj_name.split('.')

	//console.log(layers)
	for (let i = 0; i< layers.length-1; ++i) {
		if (typeof obj[layers[i]] == 'undefined'){
			// create empty object if not defined 
			obj[layers[i]] = {}
		}
		obj = obj[layers[i]]
	}

	return [ obj, layers[layers.length-1] ]
}

function _remap_one_prop(src_obj, src_name, dest_obj, dest_name, delete_=false) {
	let src = get_final_object(src_obj, src_name)
	let dest = get_final_object(dest_obj, dest_name)

	dest[0][dest[1]] = src[0][src[1]].valueOf()

	if (delete_) {
		// if dest was copied from src, this removes moved element in dest
		try {
			let dest_x = get_final_object(dest_obj, src_name)
			delete dest_x[0][dest_x[1]]
		}
		catch(e) {
			// probably object is not there, it is ok
		}
	}
}

export function remap_properties(src_obj, dest_obj, table, reverse=false, delete_=false) {
	table.forEach((items => {
		if (reverse) {
			_remap_one_prop(dest_obj, items[1], src_obj, items[0], delete_)	
		}
		else {
			_remap_one_prop(src_obj, items[0], dest_obj, items[1], delete_)	
		}
	}))
}
