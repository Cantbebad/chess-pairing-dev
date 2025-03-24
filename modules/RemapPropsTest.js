
import { remap_properties } from './RemapProps.js'

let obj1 = {
}

let obj2 = {
	cont : {
		data: "abc",
		data2: "efg",
		data3: "hij",
	}
}

obj1 = structuredClone(obj2)

/*
remap_prop(obj2, 'cont.data', obj1, 'data', true)

console.log(obj2)
console.log(obj1)

let obj3 ={}
remap_prop(obj1, 'data', obj3, 'cont.data', true)
console.log(obj3)
*/

let remap_table = [
	['cont.data', 'data'],
	['cont.data2', 'data2'],
	['cont.data3', 'data1']
]

remap_properties(obj2, obj1, remap_table, false, true)

console.log(obj1)

console.log("empty, delete")
let obj3 = {}
//obj3 = structuredClone(obj1)
remap_properties(obj3, obj1, remap_table, true, true)
console.log(obj3)

console.log("copy, delete")
obj3 = structuredClone(obj1)
remap_properties(obj3, obj1, remap_table, true, true)
console.log(obj3)

console.log("copy, no delete")
obj3 = structuredClone(obj1)
remap_properties(obj3, obj1, remap_table, true, false)
console.log(obj3)


