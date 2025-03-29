
import { FeatPersistentCookie } from './modules/FeatPersistentCookie.js'

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
class Tournament {
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
			double_rounded : false,
			wasPairingGenerated: false,
			pairing_version : 1,

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

			this.rounds.forEach((round, round_i) => {
				round.forEach((resultRecord, rec_i) => {
					data.results.push(result_to_save_id(this.rounds[round_i][rec_i].result))
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

	generatePairingsForCookieLoad(number_of_players, method) {
		// now only Berger method is supported
	    this.rounds = generateBergerPairingsIdx(number_of_players);

    	// Add result to the pairings - "1" or "0" or "0.5" or ""
		// brx: changing pair[3] to ResultRow hard way
		for (let i=0; i<this.rounds.length; i++) {
			for (let y=0; y < this.rounds[i].length; y++) {
				this.rounds[i][y] = new ResultRow(this.rounds[i][y][0], this.rounds[i][y][1], "-");	
			}
		}

//		console.assert(!this.hasTournamentId())
//		this.tournamentInfo.id = this.generateRandomId()
//		this.saveToCookie()
	}

	generatePairings(method) {
		// now only Berger method is supported
	    this.rounds = generateBergerPairingsIdx(this.players.length);

    	// Add result to the pairings - "1" or "0" or "0.5" or ""
		// brx: changing pair[3] to ResultRow hard way
		for (let i=0; i<this.rounds.length; i++) {
			for (let y=0; y < this.rounds[i].length; y++) {
				this.rounds[i][y] = new ResultRow(this.rounds[i][y][0], this.rounds[i][y][1], "-");	
			}
		}
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
						player1.points += resultToValue(result);
						player2.points += resultToValue(invertedResult(result));
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
								resultToValue(resultRow.result);
							player2.additionalCriteria[critIdx] += 
								resultToValue(invertedResult(resultRow.result));
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
		this.rounds.forEach(round => {
			round.forEach(resultRow => {
				let player1 = standings[resultRow.player1Idx];
				let player2 = standings[resultRow.player2Idx];
				switch(resultRow.result) {
					case "1":
					case "0":
						player1.additionalCriteria[critIdx] += 
							resultToValue(resultRow.result);
						player2.additionalCriteria[critIdx] += 
							resultToValue(invertedResult(resultRow.result));
						break;
					default:
						;
				}
			});
		});
	}
}

function getCriteriumVisibleName(crit) {
	switch(crit) {
		case Tournament.MUTUAL_RESULTS_CRIT:
			return "Mutual results"
		case Tournament.SONNEBORG_BERGER_CRIT:
			return "Berger Score"
		case Tournament.WINS_CRIT:
			return "More Wins"
		default:
			console.error("unknown criterium: '" + crit + "'")
			return "????"
	}
}

function resultToHtml(result) {
	switch(result) {
		case "0.5":
			return "&frac12;"
		case "1":
		case "0":
		case "0-0":
			return result
		default:
			return '-'
	}
}

function invertedResult(result) {
	switch(result) {
		case "1": 
			return "0"
		case "0":
			return "1"
		case "0.5":
		case "0-0":
		default:
			;
	}
	return result
}

function resultToValue(result) {
	switch(result) {
		case "1": 
			return 1
		case "0":
		case "0-0":
			return 0
		case "0.5":
			return 0.5
		default:
			console.error("result data can't be used as value now");
	}
	throw new Error("result data can't be used as value now");
}

function result_to_save_id(result) {
	switch(result) {
		case "0":
			return 1
		case "0.5":
			return 2
		case "1":
			return 3
		case "0-0":
			return 4
		default:
			return 0
	}
}

function result_from_save_id(result) {
	let pos = [ '-', '0', '0.5', '1', '0-0' ]

	if (result >= 0 && result < pos.length)
		return pos[result]
	// ? log error ?
	return '-'
}

// ************************************************************


class Controller {
	static COOKIE_ID = "tournament-id="

	constructor(tournament_data) {
		this.data = tournament_data
	}

	initialize() {
		// https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
		
		try {
			let cookies = document.cookie.split(";").map((x) => x.trim())

			cookies.forEach(cookie => {
				if (cookie.startsWith(Controller.COOKIE_ID)) {
					let data = cookie.split('=')
					if (data[1] !== "") {
						this.data.tournamentInfo.id = data[1]
					}
				}
			});	
		}
		catch(error) {
			;
		}
		this.loadFromCookie()
	}

	loadFromCookie() {
		try {
			if(! CookieConsent.acceptedCategory('Tournament')){
				return
			}
			let cookie_data = this.data.cookieStorage.loadAll('trndata')
			if (cookie_data !== null) {
				let data = {}
				// remap 'ratings' to 'Elo'
				data.players = cookie_data.players.map(p => { 
					return {'name' : p.name, 'Elo' : p.rating} })

				if (cookie_data.results.length || 
					cookie_data.tournamentInfo.wasPairingGenerated) {

					this.data.generatePairingsForCookieLoad(data.players.length)
				}

				// recreate results
				data.rounds = this.data.rounds

				let idx = 0
				data.rounds.forEach((round, round_i) => {
					round.forEach((resultRecord, rec_i) => {
						data.rounds[round_i][rec_i].result =
							result_from_save_id(cookie_data.results[idx])
						idx++
					})
				})

				// recreate tournament inf
				data.tournamentInfo = this.data.createTournamentInfo()

				data.tournamentInfo = cookie_data.tournamentInfo

				this._loadAllPart2(data)
			}
		}
		catch(e) {
			console.log("This is catched exception. This is not error, if cookie for Tournament data was disabled.\n" + e)
		}
	}

	saveToCookie() {
		this.data.saveToCookie()
	}

	setCookie(tournament_id) {
		if(CookieConsent.acceptedCategory('Tournament')){
			document.cookie= `${Controller.COOKIE_ID}${tournament_id}; max-age=999999;`
		}
	}

	newTournament(confirmed = false) {
		if (!confirmed) {
			if (!confirm("THIS WILL DELETE ALL CURRENT DATA,\nPROCEED ?")) {
				return
			}
		}

		this.clearAll()
		this.openTab('tab1')
	}

	clearAll() {
		// clear all Tournament data
		this.data = new Tournament()

		this.clearPlayersTable()
		this.clearResultsTab()
		this.clearCrosstableTab()
		this.clearStandingsTab()

		// set no criteria names in standing table
		this.updateStandingTableNames([])

		this.setCookie("")
		this.unlockWidgets()
		this.saveToCookie()
	}

	unlockWidgets() {
		$("#name").prop('disabled', false);
		$("#Elo").prop('disabled', false);

		// Enable buttons
		$('#tab1 .button-container button').prop('disabled', false);
		$('#addBtn').prop('disabled', false)
		
		// Optionally, add a visual indication that the table is locked
		$("#dataTable").removeClass('locked');
		$("#criteria").prop('disabled', false);
	}

	lockWidgets() {
		// Disable input fields
		$("#name").prop('disabled', true);
		$("#Elo").prop('disabled', true);

		// Disable buttons
		$('#tab1 .button-container button').prop('disabled', true);
		$('#addBtn').prop('disabled', true)
		
		// Optionally, add a visual indication that the table is locked
		$("#dataTable").addClass('locked');
		$("#criteria").prop('disabled', true);
	}

	getPlayerTableRow(idx) {
		let rows = document.getElementById("dataTable").getElementsByTagName('tbody')[0].getElementsByTagName('tr');
		if (idx > rows.length) return null
		return rows[idx]
	}

	lockAndPairing() {
		// trim player names -> input fields may contain only spaces, 
		// special utf8 empty chars not considered
		let toRemove = new Array()
		this.data.players.forEach((player, index) => {
			player.name = player.name.trim()
			if (player.name === "") {
				toRemove.push(index)
			}
		})

		// remove empty fields 
		toRemove.reverse().forEach(index => {
			this.removePlayerByRowIdx(index)
		})
		
		if (this.data.players.length < 2) {
			alert("Not enought players.\n")
			return
		}

		let arePlayersDataOk = this.data.checkPlayerNamesBeforeLock()
		switch(arePlayersDataOk) {
			case "same name": 
				alert("Players with same name in tournament.\nParticipants will be confused.\nPlease, repair.");
				return
			case "too long":
				alert("Some player name is too long.\n(max:255 bytes, consider single character can have up to 4 bytes)");
				return
			case "wrong utf8":
				alert("Some problem with names.\nDid you copy-paste some data ?");
				return
			default:
				;
		}
				

		// TODO: change logic of next questions, probably needs some better UI widgets
		if (!this.data.tournamentInfo.werePlayersRandomized) {
			if (!confirm("The order of players should be randomized.\nDo you want to proceed without randomizing the order ?")) {
				return
			}
		}
		// TODO: confirm final standing criteria before lock
		// TODO: info about Bye is being added if num of players is odd

		// Update the standings table names (dynamic criteria)
		this.updateStandingTableNames(this.data.tournamentInfo.finalStandingsResolvers)

		// Add a "Bye" player if the number of players is odd
		this.data.addByeIfNeeded();

		this.updatePlayersTable();

		// Generate pairings
		this.generatePairings("Berger")

		// Create tabs for all rounds
		for (let i = 1; i <= (this.data.rounds.length); i++) {
			this.createRoundTab(i);
		}

		// Generate empty cross table
		this.generateCrossTable();

		this.lockWidgets()

		this.openTab('tab2')

		// Make round 1 active tab
		this.openRound(1);

		this.saveToCookie()
	}

	openRound(roundNumber) {
		const roundTabs = $(".round-tab");
		const roundContents = $(".round-content");

		roundTabs.removeClass('active');
		roundContents.removeClass('active');

		$(`.round-tab:nth-child(${roundNumber})`).addClass("active");
		$(`#round${roundNumber}`).addClass("active");
	}

	openTab(tabId) {
		if (tabId === "tab4") {
			this.calculateStandings();
		}

		let tabs = $('.tab-content');
		let tabButtons = $('.tab');

		tabs.removeClass('active');
		tabButtons.removeClass('active');

		$(`#${tabId}`).addClass('active');
		$(`.tab-container #head_${tabId}`).addClass('active');
	}

	importDemoPlayers(evenNumOfPlayers = true, confirmed = false) {
		// Elo rating system was adopted by FIDE in 1970 (wiki)
		// may be it is possible to calc it backward, I did not try
		let players = [
			{"name": "Emanuel Lasker", "Elo": 2571},
			{"name": "Adolf Anderssen", "Elo": 2365},
			{"name": "Richard Réti", "Elo": 2421},
			{"name": "Wilhelm Steinitz", "Elo": 2501},
			{"name": "Paul Morphy", "Elo": 2477},
			{"name": "Gioachino Greco", "Elo": 2060},
			{"name": "François-André Danican Philidor", "Elo": 2151},
			{"name": "Siegbert Tarrasch", "Elo": 2355},
			{"name": "Aron Nimzowitsch", "Elo": 2430},
			{"name": "Frank Marshall", "Elo": 2380}
		]

		// user could have added some players manually already
		let playersSoFar = this.data.players.length + players.length
		// this triggers on [true, false] or [false, true]
		if ( evenNumOfPlayers !== (playersSoFar % 2 === 0) ) 
		{
			players.push({"name": "Wildcard Player", "Elo": 2300 })
		}

		players.forEach(player => {
			// batch mode
			this.addPlayerToTable_2(player.name, player.Elo, true);
		})
		
		this.updatePlayersTable();
	}

	generatePairings(method) {
		this.data.generatePairings(method)

		this.setCookie(this.data.tournamentInfo.id)
	}

	// ************************************************************
	// save & load

	saveAll() {
		if (!this.data.hasTournamentId()) {
			// create cookie if there is none (case: pairing was not generated yet)
			this.data.tournamentInfo.id = this.data.generateRandomId()
			this.setCookie(this.data.tournamentInfo.id)
		}

		// brx: changed to save all data
		const jsonContent = JSON.stringify(this.data);

		// fail: firefox on mobile: opens file instead of download
		//const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" }); //vytvori binarny objekt, ktory bude obsahovat json data
		
		// TODO: test: application/octet-stream
		// TODO: test: const blob = new Blob([jsonContent], { type: "text/plain;charset=utf-8" }); 
		const blob = new Blob([jsonContent], { type: "data: attachement/file;charset=utf-8" }); //vytvori binarny objekt, ktory bude obsahovat json data

		const url = URL.createObjectURL(blob); //vytvori temporrary URL pre tento objekt
		const link = document.createElement("a"); //vytvori anchor element, ktory bude pouzity na ulozenie Blob contentu

		link.href = url;
		link.download = "tournament-" + this.data.tournamentInfo.id + ".json";
		document.body.append(link); //vlozi link do body dokumentu, neskor sa nan programom klikne
		link.click(); //simuluje click to anchor element
		document.body.removeChild(link); // odstrani element z body dokumentu
		URL.revokeObjectURL(url); // Clean up the URL object
	}

	loadAll(event) {
		const file = event.target.files[0];
		const reader = new FileReader();

		// save instance of class to reader object to some unique variable
		reader.source_app_392483928 = this
		reader.onload = function(e) {

			// app_inst is our saved app instance, because we are in FileReader object ('this' = FileReader)
			let app_inst = e.target.source_app_392483928
			const text = e.target.result;
			try {
				// brx: load all data instead
				const data_loaded = JSON.parse(text); // Parse the JSON content

				
				if (app_inst.data.hasTournamentId() && app_inst.data.tournamentInfo.id !== data_loaded.tournamentInfo.id) {
					if (!confirm("Data from file are not for current tournament.\nCurrent tournament has id: " 
						+ app_inst.data.tournamentInfo.id + "\nThis id should be in loaded file name for same tournament.\nReplace ?")) {
						return;
					}
				}

				app_inst._loadAllPart2(data_loaded)
			} catch (error) {
				console.error('Error parsing JSON:', error);
			}
		};
		reader.readAsText(file);
	}

	_loadAllPart2(data_loaded) {
		// Apply all data to DOM	

		this.clearResultsTab(); // Clear existing results in pairing subtabs for each round
		this.clearCrosstableTab(); // Clear existing cross table

		this.data.players = data_loaded.players;
		this.data.rounds = data_loaded.rounds;
		this.data.tournamentInfo = data_loaded.tournamentInfo;
	
		this.updateCriteriaForm(this.data.tournamentInfo.finalStandingsResolvers)

		// Update the standings table names
		this.updateStandingTableNames(this.data.tournamentInfo.finalStandingsResolvers)

		// Create tabs for all rounds
		for (let i = 1; i <= (this.data.rounds.length); i++) {
			this.createRoundTab(i);
		}
		
		this.updatePlayersTable()

		// Generate empty cross table
		this.generateCrossTable();
		
		// Update the result values based on the loaded rounds data
		this.updateResultsTab();

		// lock widgets if pairing was generated
		if (this.data.rounds.length) {
			this.lockWidgets()
		}

		// find first empty result
		let r = 0
		let found = false
		for (; r < this.data.rounds.length; r++) {
			if (this.data.rounds[r].some(
				(rowItem) => rowItem.result == "-" || rowItem.result =="")) {
				found =  true
				break;
			}
		}

		if (found) {
			// open round tab with missing result
			this.openTab('tab2')
			this.openRound(r+1);            
		}
		else {
			if (this.data.rounds.length) {
				//set the first round as active
				this.openTab('tab2')
				this.openRound(1);            
			}
			else {
				// pairing has not been generated yet
				this.openTab("tab1")
			}
		}
		this.saveToCookie()
	}

	// ************************************************************
	// Players Tab(le)

	// HTML API
	addPlayerToTable() {
		// Add player & ELO to the table
		let name = $("#name").val();
		let Elo = $("#Elo").val();
		if (!Elo) {
			Elo = 0; // Default Elo value, means No rating
		}
		// allow empty player added, name and rating can be edited 
		this.addPlayerToTable_2(name, Elo)
	}

	addPlayerToTable_2(name, Elo, batchMode=false) {
		// restrictions for players moved to lockAndPairing
		// check at least same player names here
		if (name.length !== 0) {
			// 
			if (this.data.players.some(player => { return player.name === name })) {
				if (!batchMode) {
					alert("Player with same name in tournament")
				}
				{ // silently skip in batch mode
					// if gui will be able to show some time-restricted info, msg can be shown here
					;
				}
				return
			}
		}

		let table = $("#dataTable tbody");

		this.createRowWithPlayer(table, { 'name': name, 'Elo': Elo })

		// Store in variable
		this.data.addPlayer(name, Number(Elo))

		// Clear input fields
		$("#name").val("");
		$("#Elo").val("");
	}

	// HTML API
	removePlayer(button) {
		let row = button.parentNode.parentNode;
		let rowIndex = row.rowIndex - 1; // Adjust for header row
		this.data.removePlayer(rowIndex)
		row.parentNode.removeChild(row); // Remove row from table
	}

	removePlayerByRowIdx(row) {
		this.data.removePlayer(row)
		let tableRow = this.getPlayerTableRow(row)
		tableRow.remove(row); // Remove row from table
	}

	// HTML API
	sortPlayers() {
		this.data.sortPlayers() // Sort players by Elo in descending order
		this.updatePlayersTable();
	}

	// HTML API
	randomizePlayers() {
		this.data.randomizePlayers();
		this.updatePlayersTable();
	}

	// HTML API
	clearPlayersTable() {
		let table = $("#dataTable tbody");
		table.html(""); // Clear all rows
		this.data.players = []; // Clear players array
	}
	
	updatePlayersTable() {
		let table = $("#dataTable tbody");
		table.html(""); // Clear existing rows

		this.data.players.forEach(player => {
			this.createRowWithPlayer(table, player)
		});
	}

	createRowWithPlayer(table, player) {
			let newRow = $("<tr>")
			let nameCell = $("<td>")
			let EloCell = $("<td>")
			let actionCell = $("<td>")

			nameCell.addClass("editablePlayerData")
			EloCell.addClass("editablePlayerData")

			actionCell.html('<button onclick="app.removePlayer(this)">Remove</button>');


			var editableName = $("<input>");
			editableName.attr("type", "text")
			editableName.addClass("editablePlayerData")
			nameCell.append(editableName)

			editableName.val(player.name)
			editableName.on("input", 
				function(event) { app.playerNameChanged(event, app) }
			);

			var editableRating = $("<input>");
			editableRating.attr("type", "text")
			editableRating.addClass("editablePlayerData")
			EloCell.append(editableRating)

			editableRating.val(player.Elo)
			editableRating.on("input", 
				function (event) { app.playerRatingChanged(event, app) }
			);

			newRow.append(nameCell, EloCell, actionCell)
			table.append(newRow)
	}

	playerNameChanged(event, appObj) {
		let idx = event.target.parentNode.parentNode.rowIndex - 1
		appObj.data.players[idx].name = event.target.value
		appObj.saveToCookie()
	}
	
	playerRatingChanged(event, appObj) {
		let idx = event.target.parentNode.parentNode.rowIndex - 1
		appObj.data.players[idx].Elo = Number(event.target.value)
		appObj.saveToCookie()
	}
	// ************************************************************
	// Rounds Tab (also Results)
	
	createRoundTab(roundNumber) {
		const roundTabs = $("#roundTabs");
		const roundContents = $("#roundContents");

		// Create round tab
		const roundTab = $("<div>");
		roundTab.addClass("round-tab")
		roundTab.text(`${roundNumber}`);
		roundTab.on("click", function () { app.openRound(roundNumber)}); // Use captured round number
		roundTabs.append(roundTab);

		// Create round content
		const roundContent = $("<div>");
		roundContent.addClass("round-content");
		roundContent.prop('id', `round${roundNumber}`);
		roundContent.html(`<h3>Round ${roundNumber}</h3>`)
		const table = $("<table>");
		
		let html = `
			<thead>
				<tr>
					<th>Board</th>
					<th>White Pieces</th>
					<th>Black Pieces</th>
					<th>Result</th>
				</tr>
			</thead>
			<tbody>`

		this.data.rounds[roundNumber - 1].map((pair, index) => {
			let player1Name = this.data.players[pair.player1Idx].name
			let player2Name = this.data.players[pair.player2Idx].name
			html += `
					<tr>
						<td>${index+1}.</td>
						<td>${player1Name}</td>
						<td>${player2Name}</td>
						<td>
							<select id="sel${roundNumber-1}_${index}" onchange="app.updateResult(${roundNumber - 1}, ${index}, this.value)">
								<option value="-" selected> - </option>
								<option value="1">1-0</option>
								<option value="0">0-1</option>
								<option value="0.5">&frac12;-&frac12;</option>
								<option value="0-0">0-0</option>
							</select>
						</td>
					</tr>
				`
		});
		html += "</tbody>"
		table.html(html)

		roundContent.append(table);
		roundContents.append(roundContent);
		
		this.openRound(roundNumber);
	}

	updateResult(roundIndex, pairIndex, result) {
		this.data.setResult(roundIndex, pairIndex, result);
		this.updateCrosstable(this.data.rounds[roundIndex][pairIndex]);
	}


	// ************************************************************
	// crosstable
	
	clearCrosstableTab() {
		let table = $("#crossTable");
		table.html(""); // Clear existing rows
	}

	// TODO: crosstable sorted by standing (a little bit tricky to code)
	generateCrossTable() {
		let table = $("#crossTable");
		table.html(""); // Clear existing rows

		// Create the header row
		//let headerRow = $("<thead>").append($("<tr>"))
		let headerRow = $("<thead>")
		let th_left_top = $("<th>")
		th_left_top.addClass('th-left-top')
		headerRow.append(th_left_top); // Empty top-left corner

		this.data.players.forEach(function(player) {
			let th = null
			th = $("<th>");
			// fix safari on mobile
			let span = $("<span>")
			//th.css({ "writing-mode" : "vertical-rl", "text-orientation" : "mixed" })
			span.text(player.name);
			th.append(span)
			headerRow.append(th);
		});

		table.append(headerRow)

		let tbody = $("<tbody>")

		// Create rows for players
		this.data.players.forEach((player, rowIndex) => {
			let row = $("<tr>")
			let nameCell = $("<td>")
			nameCell.text(player.name); // Player name in the first column
			nameCell.css({ "fontWeight": "bold"})

			row.append(nameCell)

			this.data.players.forEach((opponent, colIndex) => {
				let cell = $("<td>")
				if (rowIndex === colIndex) {
					cell.addClass("empty"); // Empty cell for self-match
					cell.text("X");
				} else {
					cell.text("-"); // Placeholder for match results
				}
				row.append(cell)
			});
			tbody.append(row)
		});
		table.append(tbody)
	}

	updateCrosstable(resultRow) {
		let result = resultRow.result

		// two coresponding fields in the table are updated
		let ind1 = resultRow.player1Idx
		let ind2 = resultRow.player2Idx
		let table = $("#crossTable tbody");
		// nth starts from 1 !
		// the first cell in row is player name
		let cell = table.find(`tr:nth-of-type(${ind1+1}) td:nth-of-type(${ind2 + 2})`)
		let reverseCell = table.find(`tr:nth-of-type(${ind2+1}) td:nth-of-type(${ind1 + 2})`)

		switch(result) {
			case"-": 
				cell.text("");
				reverseCell.text("");
				break;
			case "1":
			case "0":
			case "0.5":
				cell.html(resultToHtml(result));
				reverseCell.html(resultToHtml(invertedResult(result)))
				break
			case "0-0":
				cell.text("0");
				reverseCell.text("0");
				break
			default: 
				console.warn("unknown result: '" + result + "'");
		}
	}
	// ************************************************************
	// results
	
	clearResultsTab() {
		const roundTabs = $("#roundTabs");
		const roundContents = $("#roundContents");

		// Clear existing round tabs and contents
		roundTabs.html("");
		roundContents.html("");
	}

	// Update the result values based on the loaded rounds data
	updateResultsTab() {
		this.data.rounds.forEach((round, roundIndex) => {
			round.forEach((pair, pairIndex) => {
				let result = this.data.rounds[roundIndex][pairIndex].result.toString();            
				let selectElement = $(`#round${roundIndex + 1} #sel${roundIndex}_${pairIndex}`);
				if (selectElement) {
					selectElement.val(result);
				}
				this.updateCrosstable(this.data.rounds[roundIndex][pairIndex])
			});
		});
	}

	// ************************************************************
	// standings
	
	clearStandingsTab() {
		let table = $("#standingsTable tbody");
		table.html(""); // Clear existing rows
	}
	
	calculateStandings() {
		let standings = this.data.calculateStandings()

		// Update the standings table
		let table = $("#standingsTable tbody");
		table.html(""); // Clear existing rows
		for (let i = 0; i < standings.length; i++) {
			let newRow = $("<tr>")
			let numberCell = $("<td>")
			let nameCell = $("<td>")
			let eloCell = $("<td>")
			let pointsCell = $("<td>")
			numberCell.text(i + 1);
			nameCell.text(standings[i].name);
			eloCell.text(standings[i].elo);
			pointsCell.text(standings[i].points);

			newRow.append(numberCell, nameCell, eloCell, pointsCell)

			for (let idx = 0; 
				idx < this.data.tournamentInfo.finalStandingsResolvers.length; 
				idx++) {
				let criteriaCell = $("<td>")
				criteriaCell.text(standings[i].additionalCriteria[idx]);
				newRow.append(criteriaCell)
			}
			table.append(newRow)
		}
	}

	updateStandingTableNames(criteriaResolvers) {
		// dynamicly adds final standing criteria names to Standing Table
		let table_th = $("#standingsTable thead");

		// first shrink to predefined static names
		let toRemove = table_th.find("th").length - 4 
		for (let i=0; i< toRemove; i++) {
			table_th.find("th").last().remove()
		}

		let row = $("#standingsTable thead tr")
		criteriaResolvers.forEach(crit => {
			let elem = $("<th>")
			elem.text(getCriteriumVisibleName(crit))
			row.append(elem) 
		})
	}

	// ************************************************************
	// CSV
	
	exportToCSV() {
		let csvContent = "data:text/csv;charset=utf-8,Name,Elo\n";
		this.data.players.forEach(player => {
			csvContent += `${player.name},${player.Elo}\n`;
		});

		let encodedUri = encodeURI(csvContent);
		let link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", "players.csv");
		document.body.append(link); // Required for FF
		link.click();
		document.body.removeChild(link); // Clean up
	}

	
	// brx: not very useful now, but it should contain all players (even removed)
	// simple case: load all and just remove ones who is not presented
	// after few local tournaments you will have prepared list of local players for quick
	// and simple player list creation
	// TODO: all players list
	importFromCSV(event) {
		const file = event.target.files[0];
		const reader = new FileReader();
		// save instance of class to reader object to some unique variable
		reader.source_app_392483928 = this

		reader.onload = function(e) {
			let app_inst = e.target.source_app_392483928
			const text = e.target.result;
			const rows = text.split('\n').slice(1); // Skip header row
			rows.forEach(row => {
				const [name, Elo] = row.split(',');
				if (name && Elo) {

					app_inst.data.addPlayer(name.trim(), Number(Elo.trim()) );
				}
			});
			app_inst.updatePlayersTable();
		};
		reader.readAsText(file);
	}

	// ************************************************************
	// criteria
	criteriaChanged(target) {
		let opt = target.criteria.selectedIndex
		if (opt>=0  && opt < Tournament.criteriaList.length) {
			this.data.tournamentInfo.finalStandingsResolvers = Tournament.criteriaList[opt]

			this.updateStandingTableNames(this.data.tournamentInfo.finalStandingsResolvers)
		}
	}

	updateCriteriaForm(criterium) {
		Tournament.criteriaList.forEach((item, idx) => {
			if (item.join() === criterium.join()) {
				// this works as is
				$("#criteria").selectedIndex = idx;
			}
		})
	}

	// ************************************************************
	// some test functions

	generateTestResults(fullResults=true) {
		const results = ["1", "0.5", "0"];
		//const results = ["1", "0.5", "0", "0-0"];

		let numOfResultRoundsSet = this.data.rounds.length
		if (!fullResults) {
			numOfResultRoundsSet = Math.floor(numOfResultRoundsSet/2)
		}

		this.data.rounds.forEach((round, roundIndex) => {
			round.forEach((pair, pairIndex) => {
				if (roundIndex < numOfResultRoundsSet) {
					const random = Math.floor(Math.random() * results.length);
					this.data.rounds[roundIndex][pairIndex].result = results[random]
				}
				else {
					this.data.rounds[roundIndex][pairIndex].result = '-'
				}
			});
		});
	
		this.updateResultsTab();
	}

	demo(evenPlayers=true, fullResults=true) {
		this.importDemoPlayers(evenPlayers, true);
		this.randomizePlayers();
		this.lockAndPairing();

		this.generateTestResults(fullResults);
		this.saveToCookie()

		this.openTab('tab3');
	}

	debugLoadCookie(evenPlayers=true, paired=true) {
		this.clearAll()
		this.importDemoPlayers(evenPlayers, true);
		if (! paired) {
			this.saveToCookie()
			// force refresh
			//window.location.reload()
			return
		}
		this.randomizePlayers();
		this.lockAndPairing();
		
		// force refresh
		//window.location.reload()
	}

	async sendFeedback() {
		const feedback_text = sanitizeInput($("#feedback").val());
		const myHeaders = new Headers();
    	myHeaders.append("Content-Type", "application/json");		
    	const raw = JSON.stringify({
    	  "message": feedback_text
    	});
	
    	const requestOptions = {
    	  method: "POST",
    	  headers: myHeaders,
    	  body: raw,
    	  redirect: "follow"
    	};
	
    	fetch("https://p11gt3fasc.execute-api.eu-central-1.amazonaws.com/default/Handle_CP_feddback", requestOptions)
    	  .then((response) => response.text())
    	  .then((result) => console.log(result))
    	  .catch((error) => console.error(error));
		
		$("#feedback").val("Thank You.");
	}
}

function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9À-ž .,:;!?'\n\r\[\](){}-]/g, '');
}

window.Controller = Controller
window.Tournament = Tournament


