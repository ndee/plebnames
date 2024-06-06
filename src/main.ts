import { PadAddressHistory } from './PadAddressHistory.ts'
import { explorerAdapter } from './explorerAdapter.ts'
import * as util from './util.ts'

main()

async function main(): Promise<void> {
	const showUrl: boolean = Boolean(document.currentScript?.getAttribute('showUrl'))
	const url: string|null = new URLSearchParams(window.location.search).get('url')

	const urlStyle: string|undefined = showUrl ? undefined : 'display:none'

	document.body.innerHTML = `
		<table style="margin:auto">
			${buildRowHtml({html: ''}, {html: 'PlebNames', style: 'font-size:200%'})}
			${buildRowHtml({html: 'coming from: '}, {html: url ?? undefined}, urlStyle)}
			${buildRowHtml({html: '<label for="url">url: </label>'}, {html: `<input id="url" value="${url}"></input>`}, urlStyle)}
			${buildRowHtml({html: '<label for="name">name: </label>'}, {html: `<input id="name" placeholder="input name of choice" value=""></input>`})}
			${buildRowHtml({html: 'normalizedName: '}, {id: 'normalizedName'})}
			${buildRowHtml({html: 'padAddress: '}, {id: 'padAddress'})}
			${buildRowHtml({html: 'broadestAddress: '}, {html: util.generateBech32AddressWithPad('m')}, 'visibility:hidden;line-height:0')}
			${buildRowHtml({html: ''}, {html: '<button id="lookup" style="cursor:pointer">lookup padAddress</button>'})}
		</table>
		<div id="lookupResult"></div>
	`

	setTimeout(() => getInputElement('url').oninput = () => updateNamesAndPadAddress(), 0)
	setTimeout(() => getInputElement('name').oninput = () => updateNormalizedNameAndPadAddress(), 0)
	setTimeout(() => getElement('lookup').onclick = () => lookupPadAddress(), 0)

	updateNamesAndPadAddress()
}

function buildRowHtml(left: {html: string}, right: {html?: string, id?: string, style?: string}, style?: string): string {
	const styleHtml: string =style ? `style="${style}"` : ''
	const rightId: string = right.id ? `id="${right.id}"` : ''
	const rightStyle: string = right.style ? `style="${right.style}"` : ''
	return `<tr ${styleHtml}>
		<td style="text-align:right">${left.html}</td>
		<td ${rightId} ${rightStyle}>${right.html}</td>
	</tr>`
}

function updateNamesAndPadAddress(): void {
	const url: string = getInputElement('url').value
	const name: string = url === 'null' ? '' : getNameFromUrl(url)

	getInputElement('name').value = name

	updateNormalizedNameAndPadAddress()
}

function updateNormalizedNameAndPadAddress(): void {
	const name: string = getInputElement('name').value

	const normalizedName: string = util.normalizeAsciiToBech32(name)
	document.getElementById('normalizedName')!.textContent = normalizedName
	
	const padAddress: string = util.generateBech32AddressWithPad(normalizedName)
	document.getElementById('padAddress')!.textContent = padAddress
}

function getNameFromUrl(url: string): string {
	//return new URLPattern(url).hostname.split('.')[0]
	const tld: string = '.btc'
	if (url.endsWith(tld)) {
		url = url.slice(0, -tld.length)
	} else {
		const endIndex: number = url.indexOf(tld)
		if (endIndex > 0) {
			url = url.slice(0, endIndex)
		}
	}
	const schemeIndex: number = url.indexOf('//')
	if (schemeIndex > -1) {
		url = url.slice(schemeIndex+2)
	}
	const startIndex: number = url.lastIndexOf('.')
	if (startIndex > -1) {
		url = url.slice(startIndex+1)
	}
	return url
}

async function lookupPadAddress(): Promise<void> {
	const lookupResultElement: HTMLElement = getElement('lookupResult')
	lookupResultElement.innerHTML = 'looking up...'

	const padAddress: string = document.getElementById('padAddress')!.textContent!
	const name: string = getInputElement('name').value

	const claimer: {addr: string}|undefined = (await explorerAdapter.getFirstInputOfAddress(padAddress))
	lookupResultElement.innerHTML = `<div style="font-size:150%">Information about ${name}</div>`
	if (!claimer) {
		lookupResultElement.innerHTML += `The name '${name}' is not claimed yet.<br>`
		lookupResultElement.innerHTML += `You can claim it by sending one Satoshi to '${padAddress}'.`
		showScriptOptions(name, '${addressUsedToSentToPadAddress}')
		return
	}
	lookupResultElement.innerHTML += `The name '${name}' was first claimed by '${claimer.addr}'.<br>`
	
	const history = new PadAddressHistory(name, claimer.addr)
	await followChanges(history)
	showScriptOptions(history.name, history.getData().owner)
}

async function followChanges(history: PadAddressHistory): Promise<void> {
	getElement('lookupResult').innerHTML += `
		<div id="lookupResultData">
			looking up...
		</div>
		<details>
			<summary style="cursor:pointer">History</summary>
			<pre id="lookupResultHistory"></pre>
		</details>
		<details>
			<summary style="cursor:pointer">All related OP_RETURN scripts</summary>
			<pre id="lookupResultRelatedScripts"></pre>
		</details>
	`

	let owner: string|undefined = undefined
	while (owner !== history.getData().owner) {
		owner = history.getData().owner
		const scripts: string[] = await explorerAdapter.getOutScriptsOfAddress(owner)
		document.getElementById('lookupResultRelatedScripts')!.innerHTML += JSON.stringify({issuer: owner, scripts}, null, 4)+'\n'
		for (const script of scripts) {
			history.addChangeFromOpReturnScript(script)
			document.getElementById('lookupResultHistory')!.innerHTML = JSON.stringify(history.getChanges(), null, 4)
			if (owner !== history.getData().owner) {
				break
			}
		}
	}

	document.getElementById('lookupResultData')!.innerHTML = `
		The current owner is '${history.getData().owner}'<br>
		The current website is <a href="${history.getData().website}">${history.getData().website}</a><br>
		The current lightningAddress is ${history.getData().lightningAddress}<br>
		All current data:
		<pre>${JSON.stringify(history.getData(), null, 4)}</pre>
	`
}

function showScriptOptions(name: string, owner: string): void {
	getElement('lookupResult').innerHTML += `
		<div style="margin-top:8px; font-size:150%">Alter ${name}</div>
		<div style="display:flex">
			<select id="lookupResultSelect">
				<option value="website">website</option>
				<option value="owner">owner</option>
				<option value="lightningAddress">lightningAddress</option>
				<option value="any">any</option>
			</select>
			<input id="lookupResultSelectInput" style="margin-left:4px"></input>
			=
			<input id="lookupResultSelectValue" style="flex-grow:1"><br>
		</div>
		<div id="lookupResultSelectWarning" style="color:red">
			When changing owner you transfer '${name}' to another address, be sure to type in the address correctly because<br>
			you cannot change anything regarding '${name}' afterwards (there are no checksums put in yet TODO)<br>
		</div>
		To add or change data of '${name}' send following OP_RETURN script from '${owner}'<br>
		e.g. with Electrum with amount 0:<br>
		<div style="display:flex">
			<pre id="lookupResultSelectProposedScript" style="margin:0 4px 0 0;border:1px solid; padding:4px 8px;"></pre>
			<button id="lookupResultSelectProposedScriptCopy" style="cursor:pointer" title="copy">&#x1f4cb;</button>
		</div>
	`
	
	getElement('lookupResultSelect').oninput = () => {
		updateScriptOptions(name)
		;(getElement('lookupResultSelectValue') as HTMLInputElement).value = ''
	}
	getElement('lookupResultSelectInput').oninput = () => updateScriptOptions(name)
	getElement('lookupResultSelectValue').oninput = () => updateScriptOptions(name)
	getElement('lookupResultSelectProposedScriptCopy').onclick = () => navigator.clipboard.writeText(getElement('lookupResultSelectProposedScript').innerHTML)

	updateScriptOptions(name)
}

function updateScriptOptions(name: string): void {
	let key: string = (getElement('lookupResultSelect') as HTMLInputElement).value
	if (key === 'any') {
		key = (getElement('lookupResultSelectInput') as HTMLInputElement).value
		getElement('lookupResultSelectInput').style.display = ''
	} else {
		getElement('lookupResultSelectInput').style.display = 'none'
	}
	if (key === 'owner') {
		getElement('lookupResultSelectWarning').style.display = ''
	} else {
		getElement('lookupResultSelectWarning').style.display = 'none'
	}

	const valueElement: HTMLInputElement = getElement('lookupResultSelectValue') as HTMLInputElement
	switch (key) {
		case 'owner':
			valueElement.placeholder = 'bc1qtp8nlplz7myycp5vtyy7zd7a7c2xgkwx7hsssr'
			break
		case 'website':
			valueElement.placeholder = 'https://bitcoin.org'
			break
		default:
			valueElement.placeholder = ''
	}

	getElement('lookupResultSelectProposedScript').innerHTML = `OP_RETURN ${name}.${key}=${valueElement.value}`
}

function getInputElement(id: 'url'|'name'): HTMLInputElement {
	return getElement(id) as HTMLInputElement
}

function getElement(id: 
	'url'|
	'name'|
	'lookup'|
	'lookupResult'|
	'lookupResultSelect'|
	'lookupResultSelectInput'|
	'lookupResultSelectValue'|
	'lookupResultSelectWarning'|
	'lookupResultSelectProposedScript'|
	'lookupResultSelectProposedScriptCopy'
): HTMLElement {
	return document.getElementById(id)!
}

//window.location.replace('bitcoin.org')