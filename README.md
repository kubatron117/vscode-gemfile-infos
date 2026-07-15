# vscode-gemfile-infos

Provide useful information on 'hover' of a gem in your Gemfile.

This is a fork of [ngouy/vscode-gemfile-infos](https://github.com/ngouy/vscode-gemfile-infos), which itself is a fork of [bung87/vscode-gemfile](https://github.com/bung87/vscode-gemfile).

This fork exists because the original stopped working after RubyGems.org redesigned their site (the extension was scraping HTML that no longer matched), so it was updated to use the official RubyGems API instead.

![preview](https://raw.githubusercontent.com/ngouy/vscode-gemfile-infos/main/preview.png)

## Release Notes
### 0.5.8
- Fix hover data no longer loading after rubygems.org redesigned their site (the extension was scraping HTML that no longer matches)
- Switch from HTML scraping to the official RubyGems API (`api/v1/gems/{name}.json`) for version, last update date and links
- Fix wrong "last update" date shown for some gems (was falling back to a `1980-01-01` placeholder from RubyGems' version history)
- Faster hover: a single API call instead of scraping a full HTML page
- Added automated tests for the RubyGems API integration
### 0.5.7
- Update Tags (marketplace "SEO")
### 0.5.6
- Update preview
### 0.5.5
- Refactor the engine (ts + eslint + better structure overall)
- Add custom settings to hide or show each line
- proper cache refresh when updating a gem version
### 0.5.3
Fix preview
### 0.5.2
Initial release.


-----------------------------------------------------------------------------------------------------------

## Plan
- [x] re-write the main engine (for code readability and maintainability)
- [x] Being able to have setting for parts to display (or not)
- [ ] introduce new links
- [ ] ability to pick order

### Contribute

Just send your PR!

**Enjoy!**