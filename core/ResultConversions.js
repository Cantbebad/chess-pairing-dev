
export class ResultConversions {
	resultToHtml(result) {
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

	result_from_save_id(result) {
		let pos = [ '-', '0', '0.5', '1', '0-0' ]

		if (result >= 0 && result < pos.length)
			return pos[result]
		// ? log error ?
		return '-'
	}

	result_to_save_id(result) {
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

	invertedResult(result) {
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

	resultToValue(result) {
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

}
