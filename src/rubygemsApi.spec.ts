'use strict';
import * as https from 'https';
import {EventEmitter} from 'events';
import {buildGemData, fetchGemData} from './rubygemsApi';

describe('buildGemData', () => {
	const gemInfo = {
		version: '1.19.4',
		version_created_at: '2026-06-18T15:18:58.041Z',
		homepage_uri: 'https://nokogiri.org',
		changelog_uri: 'https://nokogiri.org/CHANGELOG.html',
		source_code_uri: 'https://github.com/sparklemotion/nokogiri',
	};

	it('reports the locked version alongside the latest published version and its real date', () => {
		const gemData = buildGemData('1.19.3', 'https://rubygems.org/gems/nokogiri', gemInfo);

		expect(gemData.version).toBe('1.19.3');
		expect(gemData.lastAvailableVersion).toBe('1.19.4');
		expect(gemData.infos).toEqual([
			{title: 'Last update', isLink: false, content: '2026-06-18 (1.19.4)'},
			{title: 'Homepage', isLink: true, content: 'https://nokogiri.org'},
			{title: 'Changelog', isLink: true, content: 'https://nokogiri.org/CHANGELOG.html'},
			{title: 'Repo', isLink: true, content: 'https://github.com/sparklemotion/nokogiri'},
		]);
	});

	it('falls back to the locked version when the gem info has none', () => {
		const gemData = buildGemData('1.19.3', 'https://rubygems.org/gems/nokogiri', {});

		expect(gemData.lastAvailableVersion).toBe('1.19.3');
		expect(gemData.infos).toEqual([]);
	});

	it('omits link infos that are missing from the gem info', () => {
		const gemData = buildGemData('1.19.4', 'https://rubygems.org/gems/nokogiri', {
			version: '1.19.4',
			version_created_at: '2026-06-18T15:18:58.041Z',
		});

		expect(gemData.infos).toEqual([
			{title: 'Last update', isLink: false, content: '2026-06-18 (1.19.4)'},
		]);
	});
});

describe('fetchGemData', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	function mockHttpGet(payload: unknown, statusCode = 200) {
		jest.spyOn(https, 'get').mockImplementation((_url: any, callback: any) => {
			const response = new EventEmitter() as any;
			response.statusCode = statusCode;
			response.setEncoding = jest.fn();

			const request = new EventEmitter() as any;

			process.nextTick(() => {
				callback(response);
				if (statusCode === 200) {
					response.emit('data', JSON.stringify(payload));
					response.emit('end');
				}
			});

			return request;
		});
	}

	it('fetches gem info from a single rubygems API call', async () => {
		mockHttpGet({
			version: '1.19.4',
			version_created_at: '2026-06-18T15:18:58.041Z',
			homepage_uri: 'https://nokogiri.org',
		});

		const getSpy = jest.spyOn(https, 'get');
		const gemData = await fetchGemData('https://rubygems.org/', 'nokogiri', '1.19.3');

		expect(getSpy).toHaveBeenCalledTimes(1);
		expect(getSpy).toHaveBeenCalledWith(
			'https://rubygems.org/api/v1/gems/nokogiri.json',
			expect.anything(),
		);
		expect(gemData.endpoint).toBe('https://rubygems.org/gems/nokogiri');
		expect(gemData.version).toBe('1.19.3');
		expect(gemData.lastAvailableVersion).toBe('1.19.4');
		expect(gemData.infos).toContainEqual({title: 'Homepage', isLink: true, content: 'https://nokogiri.org'});
	});

	it('rejects when the rubygems API responds with a non-200 status code', async () => {
		mockHttpGet(null, 404);

		await expect(fetchGemData('https://rubygems.org/', 'missing', '1.0.0')).rejects.toThrow();
	});
});
