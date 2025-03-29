"use strict";

import { BitStream, realloc_double_size, realloc_fixed_size, log2_uni } from '../BitStream.js'

export class BitstreamTests {

	test_complex(t) {
		let bs = new BitStream(2, realloc_double_size())

		for (let i=0; i < 10;i++) {
			bs.write(7,3)
		}

		let exp = [
			0b00000110,
			0b00001100,
			0b00011000,
			0b00110000,
			0b01100000,
			0b11000001,
			0b10000011,
			0b00000110,
			0b00001100
			]
	
		t.marker("array compare")
		t.assertEq(exp, bs.arr.slice(0, exp.length), t.cmp_arr_items_eq)

		bs.lock()
		let data = bs.get_stream_data()

		for (let i = 0; i < 10;i++) {
			t.mini.assertEq(3, bs.read(7))
		}

		// load and write
		bs = new BitStream(2, realloc_fixed_size(3))
		bs.set_stream_data(data)

		for (let i= 0; i< 5; i++) {
			bs.write(7,49)
		}

		bs.lock()

		for (let i = 0; i < 10;i++) {
			t.mini.assertEq(3, bs.read(7))
		}
		for (let i = 0; i < 5;i++) {
			t.mini.assertEq(49, bs.read(7))
		}
	}


	_test_bitstream_various_item_bitsize_list(t) {
		let n_items = Math.floor(Math.random()*200)+100

		let arr_org = new Array(n_items).fill().map(x => {

			let item_bit_size = Math.floor(Math.random()*8)+1
			let item_data_max_val = item_bit_size**2-1

			return { 'bit_size': item_bit_size,
				'val': Math.floor(Math.random() * item_data_max_val)
			}
		})
	
		let bs = new BitStream()
		
		arr_org.forEach(x => {
			bs.write(x.bit_size, x.val)
		})
		
		bs.lock()

		let restored = new Array()
		arr_org.forEach(x => {
			restored.push(bs.read(x.bit_size))
		})

		let org_vals = arr_org.map(x => x.val)

		t.mini.assertEq(restored, org_vals, t.cmp_arr_items_eq)

	}

	test_bitstream_various_item_bitsize_list(t) {
		for (let i=0; i<100; i++) {
			this._test_bitstream_various_item_bitsize_list(t)
		}
	}

	test_big_bitstream(t) {
		// see issue with using bit_size over 53
		//const val = Number(2 ** 53 - 1)
		const val = (2 ** 53) - 1
		let bs = new BitStream()
		bs.turnOffConsoleWarnings = true
		bs.write(100, val)
		bs.write(147, val)
		bs.lock()
		let read_val_1 = bs.read(100)
		let read_val_2 = bs.read(147)

		// because bitsize is over 53, it returns BigInt
		t.mini.assertEq(BigInt(val), read_val_1)
		t.mini.assertEq(BigInt(val), read_val_2)

		//console.log(val)
		//console.log(read_val_1)
		//console.log(read_val_2)
	}

	test_big_bitstream_BigInt(t) {
		// see issue with using bit_size over 53
		//const val = Number(2 ** 53 - 1)
		const val = BigInt(2) ** BigInt(99) - BigInt(1)
		const val2 = 5
		let bs = new BitStream()
		bs.write(100, val)
		bs.write(147, val)
		bs.write(3, val2)
		bs.lock()
		let read_val_1 = bs.read(100)
		let read_val_2 = bs.read(147)
		let read_val_3 = bs.read(3)

		t.mini.assertEq(val, read_val_1)
		t.mini.assertEq(val, read_val_2)
		t.mini.assertEq(val2, read_val_3)
		t.mini.assertEq(read_val_1, BigInt("633825300114114700748351602687"))
		t.mini.assertEq(read_val_2, BigInt("633825300114114700748351602687"))
	}

	test_number_limits(t) {
		t.mini.assertEq(2**53, 2**53)
		t.mini.assertNotEq(2**53, 2**53-1)
	
		// this is just over limit, calculation are not precise
		t.mini.assertEq(2**54, 2**54-1)

		// But using BigInt in strange way leads to success
		t.mini.assertNotEq((BigInt(2)**BigInt(64), BigInt(2)**BigInt(64)-BigInt(1)))
	}

	test_log2_uni(t) {
		t.mini.assertEq(Math.floor(log2_uni(2**53-1)), 53)
		t.mini.assertEq(log2_uni(BigInt(2)**BigInt(103)-BigInt(1)), 103)
		t.mini.assertEq(log2_uni(BigInt(2)**BigInt(1)-BigInt(1)), 1)
		t.mini.assertEq(log2_uni(BigInt(2)**BigInt(1023)-BigInt(1)), 1023)
	}

}
