'use strict';
import * as https from 'https';

export type GemInfo = {
	title: string;
	isLink: boolean;
	content: string;
};

export type GemData = {
	version: string;
	endpoint: string;
	lastAvailableVersion: string;
	infos: GemInfo[];
};

type RubygemsGemInfo = {
	version?: string;
	version_created_at?: string;
	homepage_uri?: string;
	changelog_uri?: string;
	source_code_uri?: string;
};

function httpGetJson<T>(url: string): Promise<T> {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			response.setEncoding('utf8');

			if (response.statusCode !== 200) {
				reject(new Error(`Unexpected status code ${response.statusCode} for ${url}`));
				return;
			}

			const chunks: string[] = [];
			response.on('data', (data: string) => chunks.push(data));
			response.on('end', () => {
				try {
					resolve(JSON.parse(chunks.join('')) as T);
				} catch (error) {
					reject(error);
				}
			});
			response.on('error', reject);
		}).on('error', reject);
	});
}

// A single call to `api/v1/gems/{name}.json` gives us the latest published
// version, its release date and the useful links in one round-trip, instead
// of downloading the full (potentially very long) version history.
export async function fetchGemData(provider: string, gemName: string, lockedVersion: string): Promise<GemData> {
	const endpoint = `${provider}gems/${gemName}`;
	const gemInfoUrl = `${provider}api/v1/gems/${gemName}.json`;

	const gemInfo = await httpGetJson<RubygemsGemInfo>(gemInfoUrl);

	return buildGemData(lockedVersion, endpoint, gemInfo);
}

export function buildGemData(
	lockedVersion: string,
	endpoint: string,
	gemInfo: RubygemsGemInfo,
): GemData {
	const gemData: GemData = {
		version: lockedVersion,
		lastAvailableVersion: gemInfo.version ?? lockedVersion,
		endpoint,
		infos: [],
	};

	if (gemInfo.version_created_at) {
		gemData.infos.push({
			title: 'Last update',
			isLink: false,
			content: `${formatDate(gemInfo.version_created_at)} (${gemData.lastAvailableVersion})`,
		});
	}

	[{
		uri: gemInfo.homepage_uri,
		target: 'Homepage',
	}, {
		uri: gemInfo.changelog_uri,
		target: 'Changelog',
	}, {
		uri: gemInfo.source_code_uri,
		target: 'Repo',
	}].forEach(({uri, target}) => {
		if (uri) {
			gemData.infos.push({
				title: target,
				isLink: true,
				content: uri,
			});
		}
	});

	return gemData;
}

function formatDate(isoDate: string): string {
	return isoDate.slice(0, 10);
}
