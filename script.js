
import { Tournament } from './core/Tournament.js'
import { ResultConversions } from './core/ResultConversions.js'

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

function debugGetCallingStack() {
	try {
		throw new Error("")
	}
	catch(e) {
		console.log(e.stack)
	}
}

// ************************************************************


export class Controller {
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

		if (this.wasPairingGenerated()) {
			$(".pairing-not-generated").removeClass("show")
		} else {
			$(".pairing-not-generated").addClass("show")
		}
		this.checkPlayerTableLastField();
	}

	wasPairingGenerated() {
		console.assert(typeof this.data.tournamentInfo.wasPairingGenerated !==
			'undefined')
		return this.data.tournamentInfo.wasPairingGenerated
	}

	loadFromCookie() {
		try {
			if(! CookieConsent.acceptedCategory('Tournament')){
				return
			}
			let cookie_data = this.data.cookieStorage.loadAll('trndata')
			if (cookie_data !== null) {
				let preparedData = {}

				// recreate tournament inf
				preparedData.tournamentInfo = this.data.createTournamentInfo()
				// TODO: should merge
				preparedData.tournamentInfo = cookie_data.tournamentInfo

				// remap 'ratings' to 'Elo'
				preparedData.players = cookie_data.players.map(p => { 
					return {'name' : p.name, 'Elo' : p.rating} })

				preparedData.rounds = []
				if (cookie_data.results.length || 
					cookie_data.tournamentInfo.wasPairingGenerated) {

					preparedData.rounds = this.data.generateCorePairingIdx(
						cookie_data.players.length, 
						cookie_data.tournamentInfo.doubleRounded)
				}

				// recreate results
				const rc = new ResultConversions()

				let idx = 0
				preparedData.rounds.forEach((round, round_i) => {
					round.forEach((resultRecord, rec_i) => {
						preparedData.rounds[round_i][rec_i].result =
							rc.result_from_save_id(cookie_data.results[idx])
						idx++
					})
				})

				this._loadAllPart2(preparedData)
			}
		}
		catch(e) {
			console.error(e + "\n" + e.stack)
		}
	}

	saveToCookie() {
		this.data.saveToCookie()
	}

	setCookie(tournament_id) {
		if(CookieConsent.acceptedCategory('Tournament')){
			try {
				if (document.constructor.name === 'NodeDocument484948494849') {
					// when we are in NodeJs 
					document.cookie[Controller.COOKIE_ID] = tournament_id	
					return
				}
			}
			catch(e) {
				console.log("error in setting cookie: " + e)
			}
			document.cookie= `${Controller.COOKIE_ID}${tournament_id}; max-age=999999;`
		}
	}

	newTournament(confirmed = false) {
		if (!confirmed) {
			if (!confirm("THIS WILL DELETE ALL CURRENT DATA,\nIS IT OK ?")) {
				return
			}
		}

		this.clearAll()
		this.openTab('tab1')
	}

	clearAll() {
		// clear all Tournament data
		this.data = new Tournament()

		this.clearPlayersTable(true)
		this.clearResultsTab()
		this.clearCrosstableTab()
		this.clearStandingsTab()

		// set no criteria names in standing table
		this.updateStandingTableNames([])

		this.checkPlayerTableLastField();

		this.setCookie("")
		this.unlockWidgets()
		this.saveToCookie()
	}

	unlockWidgets() {
		// Enable buttons
		$('#tab1 .button-container button').prop('disabled', false);
		
		// Optionally, add a visual indication that the table is locked
		$("#dataTable").removeClass('locked');
		$("#criteria").prop('disabled', false);

		this.wasPairingGenerated() ?
			$(".pairing-not-generated").removeClass("show") :
			$(".pairing-not-generated").addClass("show")
	}

	lockWidgets() {
		// Disable input fields

		// Disable buttons
		$('#tab1 .button-container button').prop('disabled', true);
		
		// Optionally, add a visual indication that the table is locked
		$("#dataTable").addClass('locked');
		$("#criteria").prop('disabled', true);

		this.wasPairingGenerated() ?
			$(".pairing-not-generated").removeClass("show") :
			$(".pairing-not-generated").addClass("show")
	}

	getPlayerTableRow(idx) {
		let rows = $("#dataTable tbody tr")

		if (idx > rows.length) return null
		return rows[idx]
	}

	checkPlayerTableLastField() {
		if (!this.wasPairingGenerated() &&
			(!this.data.players.length ||
			this.data.players[this.data.players.length-1].name !== '')
		) {
				//debugGetCallingStack()
				this.addPlayerToTable('', 0)
		}
	}

	removeEmptyFieldsFromPlayersTable() {
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
			this.removePlayerByRowIdx(index, false)
		})
	}

	checkPlayerRatings() {
		let isOk = true
		this.data.players.forEach((pl, idx) => {
			if (isNaN(Number(pl.Elo))) {
				this.data.players[idx].Elo = 0
				isOk = false
			}
			else {
				this.data.players[idx].Elo = Number(pl.Elo)
			}
		})

		return isOk
	}
	
	retrieveOtherTournamentData() {
		let ti = this.data.tournamentInfo
		ti.title = $("#inp-title").val()
		ti.date = $("#inp-date").val()
		ti.location_ = $("#inp-place").val()
		ti.doubleRounded = $("#inp-double-rounded").is(':checked')
		ti.autoShuffleOrderOfPlayers = $("#inp-auto-shuffle").is(':checked')

		this.saveToCookie()
	}

	insertOtherTournamentData(opt) {
		if (opt.title && opt.title.trim() !== '') {
			$("#inp-title").attr("value", opt.title.trim())
		}

		if (opt.date && opt.date.trim() !== '') {
			$("#inp-date").attr("value", opt.date.trim())
		}

		if (opt.location_ && opt.location_.trim() !== '') {
			$("#inp-place").attr("value", opt.location_.trim())
		}

		if (opt.doubleRounded) {
			$("#inp-double-rounded").prop("checked", opt.doubleRounded)
		}

		if (opt.autoShuffleOrderOfPlayers) {
			$("#inp-auto-shuffle").prop("checked", opt.autoShuffleOrderOfPlayers)
		}
	}

	lockAndPairing() {
		const isOk = this._lockAndPairing()
		if (!isOk) {
			this.checkPlayerTableLastField();
		}
		return isOk
	}

	_lockAndPairing() {
		this.retrieveOtherTournamentData()
		this.removeEmptyFieldsFromPlayersTable()
		if (!this.checkPlayerRatings()) {
			alert("Same player has wrong rating (not number)\n. Please, check ratings again.");
			return false
		}	
		
		if (this.data.players.length < 2) {
			alert("Not enought players.\n")
			return false
		}

		let arePlayersDataOk = this.data.checkPlayerNamesBeforeLock()
		switch(arePlayersDataOk) {
			case "same name": 
				alert("Players with same name in tournament.\nParticipants will be confused.\nPlease, repair.");
				return false
			case "too long":
				alert("Some player name is too long.\n(max:255 bytes, consider single character can have up to 4 bytes)");
				return false
			case "wrong utf8":
				alert("Some problem with names.\nDid you copy-paste some data ?");
				return false
			default:
				;
		}
				

		if (!this.data.tournamentInfo.autoShuffleOrderOfPlayers &&
			!this.data.tournamentInfo.werePlayersRandomized) 
		{
			if (!confirm("The order of players should be shuffled.\nDo you want to proceed without randomizing the order ?")) {
				return false
			}
		}
		// TODO: info about Bye is being added if num of players is odd

		// Add a "Bye" player if the number of players is odd
		this.data.addByeIfNeeded();

		this.updatePlayersTable();

		// Update the standings table names (dynamic criteria)
		this.updateStandingTableNames(this.data.tournamentInfo.finalStandingsResolvers)

		// Generate pairings
		this.generatePairings()

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

		return true
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
			if (this.wasPairingGenerated()) {
				this.calculateStandings();
			}
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
			players.push({"name": "Wildcard Player 1", "Elo": 2300 })
		}

		players.forEach(player => {
			// batch mode
			this.addPlayerToTable(player.name, player.Elo, true);
		})
		
		this.updatePlayersTable();
	}

	generatePairings() {
		this.data.generatePairings()

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
		this.data.players = data_loaded.players;
		this.data.rounds = data_loaded.rounds;
		this.data.tournamentInfo = data_loaded.tournamentInfo;
	
		this.updateCriteriaForm(this.data.tournamentInfo.finalStandingsResolvers)

		this.wasPairingGenerated() ?
			$(".pairing-not-generated").removeClass("show") :
			$(".pairing-not-generated").addClass("show")

		this.clearResultsTab(); // Clear existing results in pairing subtabs for each round
		this.clearCrosstableTab(); // Clear existing cross table

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

		const ti = this.data.tournamentInfo
		this.insertOtherTournamentData({
			'title' : ti.title,
			'date' : ti.date,
			'location_': ti.location_,
			'doubleRounded': ti.doubleRounded,
			'autoShuffleOrderOfPlayers' : ti.autoShuffleOrderOfPlayers
		})

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

	addPlayerToTable(name, rating, batchMode=false) {
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

		rating = Number(rating)
		if (isNaN(rating)) {
			rating = 0
		}

		this.createRowWithPlayer(table, { 'name': name, 'Elo': rating })

		// Store in variable
		this.data.addPlayer(name, rating)
	}

	// HTML API
	removePlayer(button, appObj) {
		let row = button.parentNode.parentNode;
		let rowIndex = row.rowIndex - 1; // Adjust for header row
		this.data.removePlayer(rowIndex)
		row.parentNode.removeChild(row); // Remove row from table

		appObj.checkPlayerTableLastField()
	}

	// HTML API
	moveUpPlayer(button, appObj) {
		let row = button.parentNode.parentNode;
		let rowIndex = row.rowIndex - 1; // Adjust for header row

		// TODO
		console.log("TODO")
		if (rowIndex > 0) {
			;
		}

		appObj.checkPlayerTableLastField()
	}

	// HTML API
	moveDownPlayer(button, appObj) {
		let row = button.parentNode.parentNode;
		let rowIndex = row.rowIndex - 1; // Adjust for header row

		// TODO
		console.log("TODO")
		if (rowIndex < appObj.data.players.length-1) {
			;
		}

		appObj.checkPlayerTableLastField()
	}

	removePlayerByRowIdx(row, sanitize=true) {
		this.data.removePlayer(row)
		let tableRow = this.getPlayerTableRow(row)
		tableRow.remove(); // Remove row from table

		if (sanitize) {
			this.checkPlayerTableLastField()
		}
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

	// HTML API (+ used from app)
	clearPlayersTable(force=false) {
		if (!force && 
			!confirm("Do you really want to remove all players ?")) return
	
		let table = $("#dataTable tbody");
		table.html(""); // Clear all rows
		this.data.players = []; // Clear players array

		this.checkPlayerTableLastField();
	}
	
	updatePlayersTable() {
		let table = $("#dataTable tbody");
		table.html(""); // Clear existing rows

		this.data.players.forEach(player => {
			this.createRowWithPlayer(table, player)
		});
	}

	createRowWithPlayer(table, player) {
		let appInst = this
		let newRow = $("<tr>")
		let nameCell = $("<td>")
		let EloCell = $("<td>")
		let actionCell = $("<td>")

		nameCell.addClass("editablePlayerData")
		EloCell.addClass("editablePlayerData")

		let btnRemove = $("<button>")
		btnRemove.on("click",
			function(event) { appInst.removePlayer(this, appInst) })
		btnRemove.html("Remove")

		let btnMoveUp = $("<button>")
		btnMoveUp.html("Up")
		btnMoveUp.on("click",
			function(event) { appInst.moveUpPlayer(this, appInst) })

		let btnMoveDown = $("<button>")
		btnMoveDown.html("Down")
		btnMoveDown.on("click",
			function(event) { appInst.moveDownPlayer(this, appInst) })

		actionCell.append([btnRemove, btnMoveUp, btnMoveDown])

		var editableName = $("<input>");
		editableName.attr("type", "text")
		editableName.addClass("editablePlayerData")
		nameCell.append(editableName)

		editableName.val(player.name)
		editableName.on("input", 
			function(event) { appInst.playerNameChanged(event, appInst) }
		);

		var editableRating = $("<input>");
		editableRating.attr("type", "text")
		editableRating.addClass("editablePlayerData")
		EloCell.append(editableRating)

		editableRating.val(player.Elo)
		editableRating.on("input", 
			function (event) { appInst.playerRatingChanged(event, appInst) }
		);

		newRow.append(nameCell, EloCell, actionCell)
		table.append(newRow)
	}

	playerNameChanged(event, appObj) {
		let idx = event.target.parentNode.parentNode.rowIndex - 1
		appObj.data.players[idx].name = event.target.value

		// if this is last row, add one empty row at end 
		if (idx === event.target.parentNode.parentNode.parentNode.childNodes.length - 1) {
			appObj.checkPlayerTableLastField()
		}

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
		if (!this.wasPairingGenerated()) return
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
		if (!this.wasPairingGenerated()) return

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
		if (!this.wasPairingGenerated()) return
		let result = resultRow.result

		// TODO: double rounded - does not change correctly, when result is changed

		// two coresponding fields in the table are updated
		let ind1 = resultRow.player1Idx
		let ind2 = resultRow.player2Idx
		let table = $("#crossTable tbody");
		// nth starts from 1 !
		// the first cell in row is player name
		let cell = table.find(`tr:nth-of-type(${ind1+1}) td:nth-of-type(${ind2 + 2})`)
		let reverseCell = table.find(`tr:nth-of-type(${ind2+1}) td:nth-of-type(${ind1 + 2})`)

		const rc = new ResultConversions()

		// mitigation no.1 :-(
		let oldTextCell = cell.text().replace("½","&frac12;")
		let oldTextReverseCell = reverseCell.text().replace("½","&frac12;")

		// mitigation no.2 :-(
		if (oldTextCell === "-") oldTextCell = ""
		if (oldTextReverseCell === "-") oldTextReverseCell = ""
		
		let newTextCell = ""
		let newTextReverseCell = ""

		switch(result) {
			case"-": 
				//cell.text("");
				//reverseCell.text("");
				break;
			case "1":
			case "0":
			case "0.5":

				newTextCell = rc.resultToHtml(result)
				newTextReverseCell = rc.resultToHtml(rc.invertedResult(result))
				break
			case "0-0":
				newTextCell = "0"
				newTextReverseCell = "0"

				break
			default: 
				newTextCell = "?"
				newTextReverseCell = "?"
				console.warn("unknown result: '" + result + "'");
		}

		let space = ""
		let res = ""
		space = (oldTextCell === "" || newTextCell === "") ?
			"" : "&nbsp;"

		res = oldTextCell + space + newTextCell
		// mitigation no.3 :-(
		if (res === "") res = "-"
		cell.html(res)

		space = (oldTextReverseCell === "" || newTextReverseCell === "") ?
			"" : "&nbsp;"

		res = oldTextReverseCell + space + newTextReverseCell
		if (res === "") res = "-"
		reverseCell.html(res)

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
		if (!this.wasPairingGenerated()) return
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
		if (!this.wasPairingGenerated()) return
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
		//if (!this.wasPairingGenerated()) return

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

	generateTestResults(completeTournament=true) {
		const results = ["1", "0.5", "0"];
		//const results = ["1", "0.5", "0", "0-0"];

		let numOfResultRoundsSet = this.data.rounds.length

		if (!completeTournament) {
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

	demo(evenPlayers=true, completeTournament=true) {
		this.insertOtherTournamentData({
			'title' : 'Fictional Tournament',
			'date': '4th Sixteenber, 6044',
			'location_': 'Parallel Universe Gama',
	//		'doubleRounded': false,
			'autoShuffleOrderOfPlayers': true
		})
		this.retrieveOtherTournamentData()
		this.removeEmptyFieldsFromPlayersTable()	
		this.importDemoPlayers(evenPlayers, true);
		this.randomizePlayers();
		if (!this.lockAndPairing()) {
			return
		}

		this.generateTestResults(completeTournament);
		this.saveToCookie()

		this.openTab('tab3');
	}

	debugLoadCookie(evenPlayers=true, paired=true) {
		this.clearAll()
		this.removeEmptyFieldsFromPlayersTable()	
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

	// HTML API
	criteriaInfo() {
		alert(
`Additional criteria:\n
Berger Score - Calculated as full total final score from player you win with, and half final score from player you draw with. No score, if you lost.\n
Mutual Score - In case some players have same score, only results among them are considered.\n
More Wins - More fighting players are prefered, but that is discutable, as there are many draws after fierce battle.`)
	}
}

function sanitizeInput(input) {
    return input.replace(/[^a-zA-Z0-9À-ž .,:;!?'\n\r\[\](){}-]/g, '');
}

if (typeof window !== 'undefined') {
	window.Controller = Controller
	window.Tournament = Tournament
}

