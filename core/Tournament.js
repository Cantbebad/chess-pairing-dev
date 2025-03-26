
import { FeatPersistentCookie } from '../modules/FeatPersistentCookie.js'
import { ResultConversions } from './ResultConversions.js'

class ResultRow {
	constructor(player1Idx, player2Idx, result="-") {
		this.player1Idx = player1Idx
		this.player2Idx = player2Idx
		this.result = result
	}
}

// model class - only data and operations on it, no DOM usage
// all data is stored here
// can be separate js module
export class Tournament {
	// need some strings for JSON
	static MUTUAL_RESULTS_CRIT = "_Same_group";
	static SONNEBORG_BERGER_CRIT = "_Sonneborg-Berger";
	static WINS_CRIT = "_Wins";

	static criteriaList = [
		[ Tournament.MUTUAL_RESULTS_CRIT, Tournament.SONNEBORG_BERGER_CRIT, Tournament.WINS_CRIT ],
		[ Tournament.MUTUAL_RESULTS_CRIT, Tournament.SONNEBORG_BERGER_CRIT ],
		[ Tournament.SONNEBORG_BERGER_CRIT, Tournament.MUTUAL_RESULTS_CRIT, Tournament.WINS_CRIT ],
		[ Tournament.SONNEBORG_BERGER_CRIT, Tournament.MUTUAL_RESULTS_CRIT],
		[ Tournament.SONNEBORG_BERGER_CRIT],
		[],
		]

	constructor() {
		this.tournamentInfo = this.createTournamentInfo() 

		this.players = [], // [ player = { name, Elo, bye (opt)}, ... ]
		this.rounds = [] // [ round [ ResutRow ,... ], ... ] 

		this.cookieStorage = new FeatPersistentCookie() 
	}

	createTournamentInfo() {
		return { 

			// generate random hex string (used for save to distinguish files)
			// stays same for one tournament
			// will be generated, when pairing is done or on first save action
			// after browser refresh, it will be loaded from cookies (if allowed)
			id : null,

			// next are not implemented yet
			seed : "", // TODO: generated (to check correctness of pairings for purists)
			title : "", // opt
			date : "", // opt
			location_ : "", // opt

			werePlayersRandomized : false,
			doubleRounded : false,
			wasPairingGenerated: false,
			pairingVersion : 1,

			autoShuffleOrderOfPlayers: true,

			themeNumber: 0,

			// the order is priority
			finalStandingsResolvers : [
				Tournament.MUTUAL_RESULTS_CRIT,
				Tournament.SONNEBORG_BERGER_CRIT,
				Tournament.WINS_CRIT
			]
		}
	}

	saveToCookie() {
		try {
			if(! CookieConsent.acceptedCategory('Tournament')){
				return
			}
			let data = {}
			let players_copy = this.players.slice()
			data.players = players_copy.map(p => { 
				return {'name' : p.name, 'rating' : p.Elo} })
			data.results = []

			const rc = new ResultConversions()

			this.rounds.forEach((round, round_i) => {
				round.forEach((resultRecord, rec_i) => {
					data.results.push(rc.result_to_save_id(
						this.rounds[round_i][rec_i].result))
				})
			})
			data.tournamentInfo = this.tournamentInfo
			this.cookieStorage.saveAll('trndata', data)
		}
		catch(e) {
			console.log(e)
		}
	}
		
	generateRandomId() {
		// generate random hex string
		return Math.floor((Math.random()* 1e10 + 1e10)).toString(16)
	}

	hasTournamentId() {
		return this.tournamentInfo.id !== null
	}

	addPlayer(name, Elo, bye /*opt*/) {
		// if 'bye' set to something other then null, it is bye 
		// 'bye' variable not used anywhere now
		this.players.push({ name: name, Elo: Number(Elo), bye: bye });
		this.saveToCookie()
	}
	
	removePlayer(idx) {
		this.players.splice(idx, 1); // Remove from players array
		this.saveToCookie()
	}

	_isSameNamePlayer() {
		let areSame = false
		this.players.forEach((player1, idx1) => {
			this.players.forEach((player2, idx2) => {
				if (idx1 !== idx2 && player1.name === player2.name) {
					areSame = true
				}
			})
		})
		return areSame
	}

	_isPlayerNameTooLong(name) {
		// can throw
		// need bytes length, if utf-8 string
		return new TextEncoder().encode(name).length > 255
	}

	checkPlayerNamesBeforeLock() {
		if (this._isSameNamePlayer()) return "same name"
		try {
			if (this.players.some((player =>  { 
				return this._isPlayerNameTooLong(player.name)
			}))
			) {
				return "too long"	
			}
		}
		catch(e) {
			console.log(e)
			return "wrong utf8"
		}
		return ""
	}
	
	lookupPlayerIndex(name) {
	    // return index of requested player
	    return this.players.findIndex(player => player.name === name);
	}

	setResult(roundIndex, resultRow, result) {
		if (roundIndex > this.rounds.length || resultRow > this.rounds[roundIndex].length) {
			throw new Error("round or row index out of range");
		}
    	this.rounds[roundIndex][resultRow].result = result;
		this.saveToCookie()
	}

	getPlayer(idx) {
		if (idx <0 || idx > this.players.length) {
			console.error("player index out of range");
			throw new Error("player index out of range"); 
		}
		return this.players[idx];
	}

	sortPlayers() {
		this.players.sort((a, b) => b.Elo - a.Elo); // Sort players by Elo in descending order
		this.saveToCookie()
	}

	randomizePlayers() {
		for (let i = this.players.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.players[i], this.players[j]] = [this.players[j], this.players[i]];
		}
		this.tournamentInfo.werePlayersRandomized = true
		this.saveToCookie()
	}

	addByeIfNeeded() {
	    // Add a "Bye" player if the number of players is odd
	    if (this.players.length % 2 !== 0) {
        	this.players.push({ name: "Bye", Elo: 0, bye: true});
    	}
	}

	clearResults() {
		this.rounds = [];
		this.saveToCookie()
	}

	generateCorePairingIdx(number_of_players, doubleRounded) {
	    let rounds = generateBergerPairingsIdx(number_of_players);

    	// Add result to the pairings - "1" or "0" or "0.5" or ""
		// brx: changing pair[3] to ResultRow hard way
		for (let i=0; i<rounds.length; i++) {
			for (let y=0; y < rounds[i].length; y++) {
				rounds[i][y] = new ResultRow(rounds[i][y][0], rounds[i][y][1], "-");	
			}
		}

		if (doubleRounded) {
			const numOfRounds = this.rounds.length
			for (let i=0; i< numOfRounds; i++) {
				rounds.push(new Array())
				for (let y=0; y < rounds[i].length; y++) {
					rounds[numOfRounds+i].push(
						new ResultRow(rounds[i][y].player2Idx, rounds[i][y].player1Idx, "-")
					)
				}
			}
		}

		return rounds
	}

	generatePairings() {
	    this.rounds = this.generateCorePairingIdx(
			this.players.length, 
			this.tournamentInfo.doubleRounded
		);

		this.tournamentInfo.wasPairingGenerated = true

		console.assert(!this.hasTournamentId())
		this.tournamentInfo.id = this.generateRandomId()
		this.saveToCookie()
	}

	calculateStandings() {
		let standings = this.players.map(player => ({
			name: player.name,
			elo: player.Elo,
			points: 0,
			//berger: 0,
			additionalCriteria: 
			  new Array(this.tournamentInfo.finalStandingsResolvers.length).fill(0)
		}));

		this.calcPoints(standings)

		// calculate additional criteria
		for (let idx = 0;
			idx < this.tournamentInfo.finalStandingsResolvers.length;
			idx++)
		{
			let method = this.tournamentInfo.finalStandingsResolvers[idx]
			switch(method) {
				case Tournament.MUTUAL_RESULTS_CRIT:
					this.calcSameGroupScore(standings, idx)
					break
				case Tournament.SONNEBORG_BERGER_CRIT:
					this.calcSonneborgBerger(standings, idx)
					break
				case Tournament.WINS_CRIT:
					this.calcWins(standings, idx)
					break
				default:
					console.error("unknown method")
			}
		};

		// sort it all, use all criteria at once
		standings.sort((a, b) => {
			if (b.points !== a.points) {
				return b.points - a.points; // Sort by points
			} else {
				// sort by additional criteria
				for (let idx = 0; 
					idx< this.tournamentInfo.finalStandingsResolvers.length; 
					idx++) {

					if (a.additionalCriteria[idx] !== b.additionalCriteria[idx]) {
						return b.additionalCriteria[idx] - a.additionalCriteria[idx]
					}
				}
				return 0
			}
		});

		return standings
	}

	// Calculate points
	calcPoints(standings) {
		const rc = new ResultConversions()

		this.rounds.forEach(round => {
			round.forEach(resultRow => {
				let player1 = standings[resultRow.player1Idx];
				let player2 = standings[resultRow.player2Idx];

				let result = resultRow.result
				switch(result) {
					case "1":
					case "0":
					case "0.5":
					case "0-0":
						player1.points += rc.resultToValue(result);
						player2.points += rc.resultToValue(rc.invertedResult(result));
						break
					default:
						;
				}
			});
		});
	}

	// Calculate Neustadtl Sonneborn–Berger score
	calcSonneborgBerger(standings, critIdx) {
		this.rounds.forEach(round => {
			round.forEach(resultRow => {
				let player1 = standings[resultRow.player1Idx];
				let player2 = standings[resultRow.player2Idx];
				
				switch(resultRow.result) {
					case "1":
						player1.additionalCriteria[critIdx] += player2.points;
						break;
					case "0":
						player2.additionalCriteria[critIdx] += player1.points;
						break;
					case "0.5":
						player1.additionalCriteria[critIdx] += player2.points * 0.5;
						player2.additionalCriteria[critIdx] += player1.points * 0.5;
						break;
					default:
						;
				}
			});
		});
	}

	// Calculate mutual results 
	calcSameGroupScore(standings, critIdx) {
		const rc = new ResultConversions()

		this.rounds.forEach(round => {
			round.forEach(resultRow => {
				let player1 = standings[resultRow.player1Idx];
				let player2 = standings[resultRow.player2Idx];


				if (player1.points === player2.points) {
					switch(resultRow.result) {
						case "1":
						case "0":
						case "0.5":
						case "0-0":
							player1.additionalCriteria[critIdx] += 
								rc.resultToValue(resultRow.result);
							player2.additionalCriteria[critIdx] += 
								rc.resultToValue(rc.invertedResult(resultRow.result));
							break;
						default:
							;
					}
				}
			});
		});
	}

	// brx: solves case when more than 2 players have same score
	// Calculate 'More wins better' criterium
	calcWins(standings, critIdx) {
		const rc = new ResultConversions()

		this.rounds.forEach(round => {
			round.forEach(resultRow => {
				let player1 = standings[resultRow.player1Idx];
				let player2 = standings[resultRow.player2Idx];

				switch(resultRow.result) {
					case "1":
					case "0":
						player1.additionalCriteria[critIdx] += 
							rc.resultToValue(resultRow.result);
						player2.additionalCriteria[critIdx] += 
							rc.resultToValue(rc.invertedResult(resultRow.result));
						break;
					default:
						;
				}
			});
		});
	}
}


