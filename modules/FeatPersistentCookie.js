
import { base64ArrayBuffer } from "./base64ArrayBuffer.js";
import { Base64Binary } from "./Base64Binary.js";
import { DullSerializer } from './DullSerializer.js'
import { CookiesWrapper } from './CookiesWrapper.js'

import { serialize_tournament_data_v2,
	     deserialize_tournament_data_v2 } from './TournamentSchema_v2.js'

export class FeatPersistentCookie {
	constructor() {
	}

	static CURRENT_BITSIZE = 3 // (8 values)

	// -- serialize data version 1 start --
	// not used now
	
	serialize_players(arr, players) {
		let se = new DullSerializer()
		let str_arr = new Array()

		players.forEach(p => {
			se.appendString8(str_arr, p.name)
		})

		se.appendInt16(arr, players.length)
		se.appendInt16(arr, str_arr.length)
		arr.push(...str_arr)

		players.forEach(p => {
			se.appendInt16(arr, p.rating)
		})
	}

	deserialize_players(arr, idx) {
		let se = new DullSerializer()

		let n_players = se.readInt16(arr, idx)
		let text_size = se.readInt16(arr, idx)

		let names = new Array(n_players).fill().map((_) => {
				return se.readString8(arr, idx)
		})
		
		let ratings = new Array(n_players).fill().map((_) => {
			return se.readInt16(arr, idx)
		})

		// combine to object
		let players = names.map(function(x,i) {
			return { 'name': x, 'rating': ratings[i] }})

		return players
	}

	serialize_tournamentInfo(arr, info) {
		let se = new DullSerializer()
		se.appendString8(arr, info.id)
		se.appendString8(arr, info.seed)
		se.appendString8(arr, info.title)
		se.appendString8(arr, info.date)
		se.appendString8(arr, info.location_)
		se.appendInt8(arr, info.werePlayersRandomized)
		se.appendInt8(arr, info.doubleRounded)
		se.appendInt8(arr, info.pairing_version)

		se.appendInt8(arr, info.finalStandingsResolvers.length)
		info.finalStandingsResolvers.forEach(item => {
			se.appendString8(arr, item) })

	}

	deserialize_tournamentInfo(arr, idx) {
		let se = new DullSerializer()
		var info = {} 
		info.id = se.readString8(arr, idx)
		info.seed = se.readString8(arr, idx) 
		info.title = se.readString8(arr, idx) 
		info.date = se.readString8(arr, idx)
		info.location_ = se.readString8(arr, idx)
		info.werePlayersRandomized = se.readInt8(arr, idx)
		info.doubleRounded = se.readInt8(arr, idx)
		info.pairing_version = se.readInt8(arr, idx) 

		info.finalStandingsResolvers = Array(se.readInt8(arr, idx)).fill()

		for (let i=0 ; i< info.finalStandingsResolvers.length; i++) {
			info.finalStandingsResolvers[i] = se.readString8(arr, idx)
		}

		return info
	}

	// -- serialize data version 1 end --

	serialize_tournament_data(data) {

		// current data version: 2
		let arr = serialize_tournament_data_v2(data)

		return base64ArrayBuffer(arr)
	}

	deserialize_tournament_data(data) {
		let se = new DullSerializer()
		let arr = Base64Binary.decode(data)

		let idx = { 'val' : 0 }

		let data_version = se.readInt16(arr, idx)
		
		switch(data_version) {
			case 1 : {

				let res = {}
				res.players = this.deserialize_players(arr, idx)
				res.tournamentInfo = this.deserialize_tournamentInfo(arr, idx)
				res.results = se.deserialize_bitstream(arr, idx, FeatPersistentCookie.CURRENT_BITSIZE)

				// add mising fields from later versions:

				// fix name:
				res.tournamentInfo.pairingVersion = res.pairing_version
				
				// this one was not sufficient in version 1
				// case: players are added, pairing generated, but no result
				//   after resfresh, state is restored to not generated,
				//   pairing will be same, but there is devil option 'randomize players',
				//   if pressed,  pairing will be defferent
				res.tournamentInfo.wasPairingGenerated = !!res.results.length

				res.tournamentInfo.doubleRounded = false
				res.tournamentInfo.autoShuffleOrderOfPlayers = true
				res.tournamentInfo.themeNumber = 0

				// TODO (when new data are added)
				return res
			}
			case 2: {
				return deserialize_tournament_data_v2(arr)
			}
			default: {
				throw new Error("unknown data version: " + data_version)
			}
		}

		return null
	}

	saveAll(cookie_name, data_org) {
		let data = this.serialize_tournament_data(data_org)

		new CookiesWrapper().save_base64_to_cookie(cookie_name, data)
	}

	loadAll(cookie_name) {
		let data = new CookiesWrapper().load_base64_from_cookie(cookie_name)

		if (data === null) return null

		let res = this.deserialize_tournament_data(data)

		return res
	}
}


