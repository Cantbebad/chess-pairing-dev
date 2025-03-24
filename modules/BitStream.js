/* brx 2025
 * https://github.com/Cantbebad
*/

"use strict";

// bitstream realloc strategy
export function realloc_double_size(limit_max_add = 0) {
	// double size of previus buffer size
	return (bitstream) => {
		let to_add = bitstream.arr.length 
		// max addon can be limited in 'limit_max_add'
		if (limit_max_add && limit_max_add < to_add) {
			to_add = limit_max_add
		}

		let newArr =new Uint8Array(bitstream.arr.length + to_add)
		newArr.set(bitstream.arr)
		newArr.set(new Uint8Array(to_add).fill(0), bitstream.arr.length)
		bitstream.arr = newArr
	}
}

// bitstream realloc strategy
export function realloc_fixed_size(realloc_size) {
	return (bitstream) => {
		// expand by realoc_size
		let newArr = new Uint8Array(bitstream.arr.length + realloc_size)
		newArr.set(bitstream.arr)
		newArr.set(new Uint8Array(realloc_size).fill(0), bitstream.arr.length)
		bitstream.arr = newArr	
	}
}

function unsigned_int(val) {
	// work only in 32(?) bits interval
	return val >>> 0
}

export function log2_uni(val) {
	if (typeof Object(val).valueOf() === 'bigint') {
		const bigint_as_str = val.toString(2)
		// returns something like 10101000000000000 (no 'n' included)
		return bigint_as_str.length
	}
	else {
		return Math.log2(val)
	}
}

export class BitStream {
	/* Naive implementation of BitStream for limited purposes.
	 * XXX Single write item is limited to byte size boundaries (0-255)
	 * Now it supports almost arbitrary bit_size
	 * If you use bit_size > 53, see implementation details (uses BigInt)
	 * Return values for bit_size > 53 are in BigInt
	 * */

	constructor(expected_length_in_bytes=4, realloc_strategy=realloc_double_size()) {
		if (expected_length_in_bytes<1) throw new Error("Out of range: expected length")
		this.arr = new Uint8Array(expected_length_in_bytes).fill(0);
		this.realloc_strategy = realloc_strategy
		this.byte_idx = 0
		this.bit_idx = 8
		this.cur_bit_length = 0
		this.locked = false
		this.n_values = 0
		this.turnOffConsoleWarnings = false // no API, change directly
		if (this.realloc_strategy == null) {
			throw new Error("realloc_strategy is null")
		}
	}

	get_stream_data() {
		// for save
		// use immediatelly after lock, later, bitstream after read is modified
		// shrinks data to only used space (in bytes)
		let bytes_needed = Math.ceil(this.cur_bit_length/8)
		return { 'bit_length' : this.cur_bit_length, 
			'bytes': this.arr.slice(0, bytes_needed),
			'n_values': this.n_values
		}
	}

	set_stream_data(data) {
		// restore for read or write
		this.cur_bit_length = data.bit_length
		this.arr = new Uint8Array(data.bytes.length+1).fill(0)
		this.arr.set(data.bytes)

		this.byte_idx = Math.floor(data.bit_length/8)
		this.bit_idx = 8 - (data.bit_length % 8)
		this.n_values = data.n_values
		this.locked = false
	}

	inc_byte_idx() {
		this.byte_idx++
		if (this.arr.length <= this.byte_idx) {
			this.realloc_strategy(this)
		}
	}

	_write_big(bit_size, big_data) {
		//console.log("_write_big:" + big_data)
		const isBigInt = typeof Object(big_data).valueOf() === 'bigint'
		let divider = isBigInt ? BigInt(256) : 256
		while(bit_size > 8) {
			//console.log('write: ' + (big_data%256))
			this.write(8, Number(big_data % divider))
			bit_size -= 8

			if (isBigInt) { 
				big_data = big_data/ divider
			}
			else {
				big_data = Math.floor(big_data/ divider)
			}
		}
		if (bit_size) {
			// this is rest of data [0,256), so conversion is ok
			this.write(bit_size, Number(big_data))
		}
	}

	_read_big(bit_size) {
		// be careful using bit_size > 53 
		// if bit_size>53, it returns BigInt

		// using BigInt, else issues with number sign
		let big_data = BigInt(0)
		const org_bit_size = bit_size
		while(bit_size > 8) {
			let big_data_val = BigInt(this.read(8)) << BigInt(org_bit_size - bit_size)

			//console.log('read: ' + (big_data_val))
			bit_size -= 8
			big_data += big_data_val
		}
		if (bit_size) {
			let big_data_val = BigInt(this.read(bit_size)) << BigInt(org_bit_size - bit_size)
			big_data += big_data_val
		}

		if (org_bit_size>53) {
			// leave it as is, that means as BigInt
			return big_data
		}
		// convert number in format 'XXXXn' to 'XXXX'
		const str_val = "" + big_data
		return Number(str_val.substring(0,str_val.length))
	}

	write(bit_size, byte_data) {
		// be careful using bit_size > 53 
		// see notice in _read_big_data

		// bit_size over 53 still works, however calculation doesn't:
		// (2**53) !== (2**53-1)   // true
		// (2**54) === (2**54-1)   // true
		// use BigInt instead in form BigInt(2) ** BigInt(67) - BigInt(1)
		// well, this is not meant to be used with BigInt, but it is implemented
		// and it works

		if (bit_size > 53 && 
			!this.turnOffConsoleWarnings &&
			(typeof Object(byte_data).valueOf() != 'bigint')) {
			console.warn("warning: bit size is over 53, but data type is not bigint. It can lead to unexpected behaviour in calculations, if data value needs more than 53 bits")
		}
		//if (bit_size > 53 || bit_size<1) throw new Error("Out of range: bit_size (write)")
		if (bit_size <= 0) {
			throw new Error("byte_data needs more bit_size")
		}
		if (byte_data < 0) {
			throw new Error("byte_data must by positive number")
		}
		else if (byte_data>0) {
			if (Math.ceil(log2_uni(byte_data)>bit_size)) {
				throw new Error("byte_data needs more bit_size")
			}
		}

		if (bit_size > 8) {
			this._write_big(bit_size, byte_data)
			return
		}

		if (this.locked) throw new Error("bitstream is locked for write")
		if (bit_size > 8 || bit_size<1) throw new Error("Out of range: bit_size (write)")
		let data = byte_data

		let shift = this.bit_idx - bit_size
		if (shift > 0) {
			this.arr[this.byte_idx] |= (data<<shift) % 256
			this.bit_idx -= bit_size
		}
		else if (shift == 0) {
			this.arr[this.byte_idx] |= data
			this.bit_idx = 8
			this.inc_byte_idx()
		}
		else {
			// shift <0
			this.arr[this.byte_idx] |= (data>>-shift)
			this.bit_idx = 8
			this.inc_byte_idx()

			this.arr[this.byte_idx] |= (data<<(8+shift)) % 256
			this.bit_idx += shift
		}

		this.cur_bit_length += bit_size
		this.n_values++
	}
	
	lock() {
		/* lock bitstream, when you have finished with writing
		 * this enables reading it
		 */

		if (this.locked) throw new Error("bitstream can be locked only once")
		this.locked = true

		this.bit_idx = 8
		this.byte_idx = 0
	}

	read(bit_size) {
		/* NOTE: read CHANGES (=consumes) bitstream */

		if (!this.locked) throw new Error("bitstream must be locked before read")

		//if (bit_size > 63 || bit_size<1) throw new Error("Out of range: bit_size (read)")

		if (bit_size > 8) {
			return this._read_big(bit_size)
		}
		
		let data = this.arr[this.byte_idx]
		let ret = 0
		let val = 0

		if (this.cur_bit_length < bit_size) {
			throw Error("trying to read beyond written data")
		}

		let shift = this.bit_idx - bit_size
		if (shift > 0) {

			val = (data>>shift)
			ret <<= bit_size
			ret |= val

			this.arr[this.byte_idx] ^= (val<<shift)
			this.bit_idx -= bit_size
		}
		else if (shift == 0) {
			val = data
			ret <<= bit_size
			ret |= val
			this.arr[this.byte_idx] = 0
			this.bit_idx = 8
			this.byte_idx++
		}
		else {
			// shift <0
			val = data
			ret <<= (bit_size + shift)
			ret |= val

			this.byte_idx++

			val = this.arr[this.byte_idx]
			let new_shift = 8+shift
			
			let val2 = (val>>new_shift)
			ret <<= -shift
			ret |= val2

			this.arr[this.byte_idx] ^= (val2<<new_shift)
			this.bit_idx = 8+shift

		}

		this.cur_bit_length -= bit_size

		return ret	
	}

	 write_int_array(item_bit_size, arr) {
		arr.forEach(item => {
			this.write(item_bit_size, item)
		})
	}
	
}
