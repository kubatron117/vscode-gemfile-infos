'use strict';
import * as gemfile from 'gemfile';
import * as vscode from 'vscode';
import {fetchGemData, GemData} from './rubygemsApi';

// Exports.deactivate = exports.activate = void 0;

let cache = new Map<string, GemfileCache>();
const wordsToIgnore = [
	'require',
	'true',
	'false',
	'group',
	'development',
	'test',
	'production',
	'do',
	'gem',
];

/*
** Types
*/

type GemsData = Record<string, GemData>;

type GemfileCache = {
	lockedVersions: GemVersions;
	provider: string;
	gemsData: GemsData;
};

type GemVersions = Record<string, {
	version: string;
}>;

type ParsedGemlock = {
	specs: GemVersions;
	remote: {
		path: string;
	};
};

/*
** Core class
*/

class GemfileProvider implements vscode.HoverProvider {
	public provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	) {
		const nameAndRange = retrieveGemNameAndRange(document, position);
		if (!nameAndRange) {
			return;
		}

		const [gemName, gemRange] = nameAndRange;
		const cacheKey = cacheKeyFor(document.uri.fsPath);
		const gemfileCache = cache.get(cacheKey);
		let gemData = gemfileCache.gemsData[gemName];

		let infobulleStr;

		if (gemData) {
			infobulleStr = formatInfobulleData(gemData);

			const doc = new vscode.MarkdownString(infobulleStr);
			return new vscode.Hover(doc, gemRange);
		}

		if (!gemfileCache.lockedVersions[gemName]) {
			console.error('unknown gem ', gemName);
			return;
		}

		return (async () => {
			await fetchOnlineData(gemName, cacheKey);
			gemData = gemfileCache.gemsData[gemName];
			infobulleStr = formatInfobulleData(gemData);

			const doc = new vscode.MarkdownString(infobulleStr);
			return new vscode.Hover(doc, gemRange);
		})();
	}
}

/*
** Retrieve and populate Data from the web
*/

async function fetchOnlineData(gemName: string, cacheKey: string): Promise<void> {
	const gemfileCache = cache.get(cacheKey);
	const {version} = gemfileCache.lockedVersions[gemName];
	const {provider} = gemfileCache;

	try {
		const gemData = await fetchGemData(provider, gemName, version);
		gemfileCache.gemsData[gemName] = gemData;
	} catch (error) {
		console.error(`Error while fetching gem data for ${gemName}`, error);
	}
}

/*
** Activation related functions
*/

function activate(context: vscode.ExtensionContext) {
	populateCacheOnActivation();
	setupFileWatchers();
	subscribeToGemfileHover(context);
}

function populateCacheOnActivation() {
	vscode.workspace
		.findFiles('**/Gemfile.lock')
		.then(gemfileLockUris => {
			gemfileLockUris.forEach(({fsPath: gemfileLockPath}) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				gemfile.parse(gemfileLockPath).then(({GEM}) => {
					refreshFileCache(gemfileLockPath, GEM as ParsedGemlock);
				});
			});
		}, () => {
			console.error('Error while fetching Gemfile.lock files');
		});
}

function setupFileWatchers() {
	const refreshCache = function ({fsPath: filePath}: vscode.Uri) {
		const gemfileLockPath = cacheKeyFor(filePath);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const parsedGemFileLock = gemfile.parseSync(gemfileLockPath).GEM as ParsedGemlock;
		refreshFileCache(gemfileLockPath, parsedGemFileLock);
	};

	const lockWatcher = vscode.workspace.createFileSystemWatcher('**/Gemfile.lock');
	const watcher = vscode.workspace.createFileSystemWatcher('**/Gemfile');
	lockWatcher.onDidChange(refreshCache);
	watcher.onDidChange(refreshCache);
}

function subscribeToGemfileHover(context: vscode.ExtensionContext) {
	const disposable = vscode.languages.registerHoverProvider(
		{
			// Language: "ruby", may not identical as ruby file so commented this
			pattern: '**/Gemfile',
			scheme: 'file',
		},
		new GemfileProvider(),
	);
	context.subscriptions.push(disposable);
}

/*
** Helpers
*/

// Populate cache for a specific gemfile
function refreshFileCache(gemfileLockPath: string, {specs, remote: {path}}: ParsedGemlock) {
	const cacheKey = cacheKeyFor(gemfileLockPath);
	let gemfileCache: GemfileCache = cache.get(cacheKey);
	const gemDatas: GemsData = {};

	if (gemfileCache) {
		gemfileCache.lockedVersions = specs;
	} else {
		const newCache: GemfileCache = {
			lockedVersions: specs,
			provider: path,
			gemsData: gemDatas,
		};

		cache.set(cacheKey, newCache);
		gemfileCache = cache.get(cacheKey);
	}

	const {lockedVersions} = gemfileCache;

	// Cleanup non matching versions
	Object.keys(gemfileCache.gemsData).forEach((gemName: string) => {
		if (gemName === 'faker') {
			console.log('current cache version ', gemfileCache.gemsData[gemName].version);
			console.log('Lock version ', lockedVersions[gemName].version);
		}

		if (gemfileCache.gemsData[gemName].version !== lockedVersions[gemName].version) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete gemfileCache.gemsData[gemName];
		}
	});
}

// Format the data for the actual infobulle popup
function formatInfobulleData({version, endpoint, infos, lastAvailableVersion}: GemData): string {
	let result = '';
	const config = vscode.workspace.getConfiguration('vscodeGemfileInfo');

	if (config.showCurrentVersion) {
		result += `Current installed version: _${version}_  `;
		if (lastAvailableVersion === version) {
			result += '🟢  \n';
		} else {
			result += '⏫  \n';
		}
	}

	infos.forEach(({title, isLink, content}) => {
		let configKey = `show${pascalize(title)}`;
		configKey += isLink ? 'Link' : '';

		if (config[configKey]) {
			result += `${title}: `;
			if (isLink) {
				result += `[${content}](${content})`;
			} else {
				result += content;
			}

			result += '  \n';
		}
	});

	if (config.showPackageManagerLink) {
		result += `Gem informations: [${endpoint}](${endpoint})  \n`;
	}

	return result;
}

/* eslint-disable max-statements-per-line, @typescript-eslint/brace-style */
function retrieveGemNameAndRange(
	document: vscode.TextDocument,
	position: vscode.Position,
): [string, vscode.Range] | undefined {
	const gemRange = document.getWordRangeAtPosition(position, /([A-Za-z/0-9_-]+)(\.[A-Za-z0-9]+)*/);
	if (!gemRange) { return; }

	const lineText = document.lineAt(position.line).text.trim();
	if (lineText.startsWith('source')) { return; } // ignore source

	const gemName = document.getText(gemRange);
	if (!gemName || wordsToIgnore.includes(gemName)) { return; } // Gemfile KW
	if (/^[^a-zA-Z]+$/.test(gemName)) { return; } // Empty name

	return [gemName, gemRange];
}
/* eslint-enable max-statements-per-line, @typescript-eslint/brace-style */

function cacheKeyFor(path: string): string {
	return path.endsWith('.lock') ? path : path + '.lock';
}

let cachedPascalizedValuesV2 = {};
function pascalize(str: string): string {
	cachedPascalizedValuesV2[str] ||= (
		str.replace(
			/(\w)(\w*)/g,
			// eslint-disable-next-line
			(_g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase()
		).replace(' ', '')
	);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return cachedPascalizedValuesV2[str];
}

/*
**
*/

exports.activate = activate;
function deactivate() {
	cache = null;
	cachedPascalizedValuesV2 = null;
}

exports.deactivate = deactivate;
// # sourceMappingURL=extension.js.map
