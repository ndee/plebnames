
export type InputPrevout = {
	scriptpubkey_address?: string, scriptpubkey: string
}

export type Input = {
	prevout: InputPrevout
}

export class Transaction {
	public readonly vin: Input[]
	public readonly vout: {scriptpubkey: string}[]
	public readonly status: {block_height: number}

	private constructor(inputs: Input[], outputs: {scriptpubkey: string}[], status: {block_height: number}) {
		this.vin = inputs
		this.vout = outputs
		this.status = status
	}

	public static fromBlockstreamOrMempoolTransaction(blockstreamTransaction: any): Transaction {
		const transaction: Transaction = Object.setPrototypeOf(blockstreamTransaction, Transaction.prototype) // raw object would not have member methods
		transaction.validate()
		return transaction
	}

	public static fromBlockchainTransaction(blockchainTransaction: any): Transaction {
		const transaction = new Transaction(
			blockchainTransaction.inputs.map((input: any) => {
				return {
					prevout: {
						scriptpubkey_address: input.prev_out.addr,
						scriptpubkey: input.prev_out.script
					}
				}
			}),
			blockchainTransaction.out.map((output: any) => {
				return {scriptpubkey: output.script}
			}),
			{block_height: blockchainTransaction.block_height}
		)
		transaction.validate()
		return transaction
	}

	/**
	 * TODO use e.g. Zod?
	 */
	private validate(): void {
		for (const input of this.vin) {
			const prevout = input.prevout
			if (!prevout) {
				console.warn(`!input.prevout, input is: ${JSON.stringify(input)}`)
			}
			if (prevout.scriptpubkey_address && typeof prevout.scriptpubkey_address !== 'string') {
				console.warn(`prevout.scriptpubkey_address && typeof prevout.scriptpubkey_address !== 'string', input is: ${JSON.stringify(input)}`)
			}
			if (typeof prevout.scriptpubkey !== 'string') {
				console.warn(`typeof input.prevout.scriptpubkey !== 'string', input is: ${JSON.stringify(input)}`)
			}
		}
		for (const output of this.vout) {
			if (typeof output.scriptpubkey !== 'string') {
				console.warn(`typeof output.scriptpubkey !== 'string', output is: ${JSON.stringify(output)}`)
			}
		}
		if (typeof this.status?.block_height !== 'number') {
			console.warn(`typeof status?.block_height !== 'number', status is: ${JSON.stringify(this.status)}`)
		}
	}
}