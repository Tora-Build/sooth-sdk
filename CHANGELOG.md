# Changelog

## [0.5.3](https://github.com/Tora-Build/sooth-sdk/compare/sooth-v0.5.2...sooth-v0.5.3) (2026-07-27)


### 🐛 Bug Fixes

* finish v0.2.1 contract parity ([#33](https://github.com/Tora-Build/sooth-sdk/issues/33)) ([e11a818](https://github.com/Tora-Build/sooth-sdk/commit/e11a818c08fbd60e11dbe189e88b8a4861895619))

## [0.5.2](https://github.com/Tora-Build/sooth-sdk/compare/sooth-v0.5.1...sooth-v0.5.2) (2026-07-26)


### 🐛 Bug Fixes

* **abi:** sync deployed AMM and adjudicator surfaces ([#32](https://github.com/Tora-Build/sooth-sdk/pull/32)) ([7affcc3](https://github.com/Tora-Build/sooth-sdk/commit/7affcc30f42e5f5b9e8ccb0a622ae0ffd62057e8))


### 📝 Docs

* record 0.5.1 ESM fix and Trusted Publishing migration (ADR-003) ([fc55e49](https://github.com/Tora-Build/sooth-sdk/commit/fc55e49c2a3185d155a8023852a742e5f31f13ad))

## [0.5.1](https://github.com/Tora-Build/sooth-sdk/compare/sooth-v0.5.0...sooth-v0.5.1) (2026-07-26)


### 🐛 Bug Fixes

* **pkg:** make dist resolvable by plain Node ESM ([4214257](https://github.com/Tora-Build/sooth-sdk/commit/42142572aebfbffb4660154ef8b0a884335746c2))
* **pkg:** plain-Node ESM resolution + Trusted Publishing ([8739c3a](https://github.com/Tora-Build/sooth-sdk/commit/8739c3a82f4502a223cb37d380d771ca721b00fa))


### 🤖 CI

* verify plain-Node ESM resolution; publish via npm Trusted Publishing ([ac48c22](https://github.com/Tora-Build/sooth-sdk/commit/ac48c2245055e2513d4a627538326c7aa8d36818))

## [0.5.0](https://github.com/Tora-Build/sooth-sdk/compare/sooth-v0.4.1...sooth-v0.5.0) (2026-07-26)


### ⚠ BREAKING CHANGES

* **pkg:** rename package to sooth
* **pkg:** rename package to unscoped sooth-sdk

### ✨ Features

* **abis:** add canonical feerouter and orderengine abis ([#15](https://github.com/Tora-Build/sooth-sdk/issues/15)) ([8fd5a44](https://github.com/Tora-Build/sooth-sdk/commit/8fd5a44397c48e8822e9f5d1da729041f7a6234b))
* **abis:** add events and custom errors to the SoothBook ABI ([#13](https://github.com/Tora-Build/sooth-sdk/issues/13)) ([e4128c2](https://github.com/Tora-Build/sooth-sdk/commit/e4128c209a0a19a4b94d0accd7453f9cba683f11))
* **sqf:** canonical SQF parser + generator; run tests in CI ([#11](https://github.com/Tora-Build/sooth-sdk/issues/11)) ([cec74a5](https://github.com/Tora-Build/sooth-sdk/commit/cec74a54c94e3ee7c964cd75ae2a8867b4bb0aab))


### 🐛 Bug Fixes

* **cli:** derive SDK_VERSION from package.json, not the core version ([9ef4644](https://github.com/Tora-Build/sooth-sdk/commit/9ef4644b0a29fe458cd30ce67faf6b460266b134))
* **cli:** harden MegaETH reads and history ([e35c460](https://github.com/Tora-Build/sooth-sdk/commit/e35c460af5235df9b067be4cfa7693180cd21409))
* **cli:** harden MegaETH reads and history ([86dd837](https://github.com/Tora-Build/sooth-sdk/commit/86dd83797480d761e0a27bd65108577729aca7e7))
* **cli:** make the CLI type-checked and Node-runnable from dist ([#23](https://github.com/Tora-Build/sooth-sdk/issues/23)) ([7ace7ae](https://github.com/Tora-Build/sooth-sdk/commit/7ace7aeba89fa19e140c6b96c454ce3843f43553))
* complete v0.2.1 ABI migration in SDK + CLI ([#7](https://github.com/Tora-Build/sooth-sdk/issues/7)) ([ffabdbf](https://github.com/Tora-Build/sooth-sdk/commit/ffabdbf4a0fb4473c3335b252d685ac52a6ed720))
* **core:** reconcile settlement/claim path with v0.2.1 contracts ([#24](https://github.com/Tora-Build/sooth-sdk/issues/24)) ([0896db0](https://github.com/Tora-Build/sooth-sdk/commit/0896db00589e7539bc949c9ac2fc4a0e8b960c36))
* **lint:** prefix unused vars in soothbook and soothCore ([27d5932](https://github.com/Tora-Build/sooth-sdk/commit/27d59326ef50c928740ec0ae14873992308ed041))
* **lint:** resolve unused vars and stale imports across cli ([df36cc8](https://github.com/Tora-Build/sooth-sdk/commit/df36cc80a2d95a101b7937896396c96c531f1ce2))
* **lint:** resolve unused vars from v0.2.1 migration ([b1a1d86](https://github.com/Tora-Build/sooth-sdk/commit/b1a1d869ffd09afc3bd249ab2286388f825b1674))
* **pkg:** make the published tarball correct and complete ([#18](https://github.com/Tora-Build/sooth-sdk/issues/18)) ([5ad6a91](https://github.com/Tora-Build/sooth-sdk/commit/5ad6a915a3b1cf11111cc781b75c3335a90c72e4))
* **pkg:** rename package to sooth ([6087583](https://github.com/Tora-Build/sooth-sdk/commit/6087583e9934f5784874dca2d2dc3f6402c80b4a))
* **pkg:** rename package to unscoped sooth-sdk ([437f3f6](https://github.com/Tora-Build/sooth-sdk/commit/437f3f60b8f9c29bc36a81a415d282b96375edf6))
* **sdk:** rebuild SoothClient wrapper on canonical ABIs ([#21](https://github.com/Tora-Build/sooth-sdk/issues/21)) ([b0433a4](https://github.com/Tora-Build/sooth-sdk/commit/b0433a48d8312073e3e7bb3ff69aae4353203645))


### 🧹 Chores

* add check script to run lint and format together ([3a684c3](https://github.com/Tora-Build/sooth-sdk/commit/3a684c380dacb36fc6520366ea26dfcc221f95a9))
* add CODEOWNERS, PR template, and issue template ([3920c2c](https://github.com/Tora-Build/sooth-sdk/commit/3920c2cda96b4938321e19a4fee4898b87e81e8d))
* add npm publish metadata and MIT LICENSE ([3b2ba46](https://github.com/Tora-Build/sooth-sdk/commit/3b2ba4662afcfa61474874ed415aae9b5885b393))
* add npm publish metadata and MIT LICENSE ([a1ec7ed](https://github.com/Tora-Build/sooth-sdk/commit/a1ec7ed441103cb459fdf6b7d9b99c21ed7503ca))
* bump version to 0.2.1 to match sooth-core ([3522315](https://github.com/Tora-Build/sooth-sdk/commit/3522315e2a8db3136150719179755e8ce2f0312e))
* initial commit — sooth-sdk extracted from sooth-alpha ([cb37abd](https://github.com/Tora-Build/sooth-sdk/commit/cb37abd4d9f3d6a7e287dec61804a1551dc79413))
* **main:** release sdk 0.2.2 ([3efa23a](https://github.com/Tora-Build/sooth-sdk/commit/3efa23ab233285c51d462e1fef4552256576f723))
* **main:** release sdk 0.2.2 ([d6e0228](https://github.com/Tora-Build/sooth-sdk/commit/d6e02288c5f733e876ed2eb065b2be28166c0412))
* **main:** release sdk 0.3.0 ([#12](https://github.com/Tora-Build/sooth-sdk/issues/12)) ([a5ad62c](https://github.com/Tora-Build/sooth-sdk/commit/a5ad62ce2890328e6b31011c1708fd61b98351e8))
* **main:** release sdk 0.4.0 ([#14](https://github.com/Tora-Build/sooth-sdk/issues/14)) ([7965d46](https://github.com/Tora-Build/sooth-sdk/commit/7965d4610098998f36394d03818fdb629166e7c3))
* **main:** release sdk 0.4.1 ([#22](https://github.com/Tora-Build/sooth-sdk/issues/22)) ([fb13f6f](https://github.com/Tora-Build/sooth-sdk/commit/fb13f6f69a6b02e8eebb869c7e3ef02f71a6bbce))
* pin pnpm package manager version ([c9fca39](https://github.com/Tora-Build/sooth-sdk/commit/c9fca39e5a416fa5252cb08a6930f980c0c31710))
* refresh registry snapshot (add Base Sepolia 84532 node) ([a5f0b53](https://github.com/Tora-Build/sooth-sdk/commit/a5f0b53bb05ea1f1c77116fb026911d40efc09f1))
* refresh registry snapshot to manifest 0.2.3 ([b9cfcd5](https://github.com/Tora-Build/sooth-sdk/commit/b9cfcd548a28b6ff9ea9748fe6313931775364c4))


### 🤖 CI

* add github actions workflows and release-please ([e94776c](https://github.com/Tora-Build/sooth-sdk/commit/e94776c24c399925f9f64a26f72fccc3beae324d))
* port tooling and CI from sooth-core ([fc58f95](https://github.com/Tora-Build/sooth-sdk/commit/fc58f95b3d5e3bd57490d6baae463c19f0598e97))
* publish to npm after release-please creates a release ([21195fd](https://github.com/Tora-Build/sooth-sdk/commit/21195fddf61fa1979b9df7cb10467ea2d9560687))
* publish to npm after release-please creates a release ([baad6f3](https://github.com/Tora-Build/sooth-sdk/commit/baad6f351ebfee7bc7c739b1ce38ad872aaad5b9))
* **release-please:** use ALPHA_PAT to allow PR creation ([d7023e8](https://github.com/Tora-Build/sooth-sdk/commit/d7023e8d02666f6f8740a574c9fc55684cadc409))
* **release-please:** use ALPHA_PAT to allow PR creation ([63de862](https://github.com/Tora-Build/sooth-sdk/commit/63de862e69b2c698ec57a711d3218566617efef1))


### 📝 Docs

* add CONTRIBUTING.md and SECURITY.md ([12d1aec](https://github.com/Tora-Build/sooth-sdk/commit/12d1aec510373de83bfc743e3e14c40ff8888520))
* add STATUS.md and DECISIONS.md coordination docs ([c934c6f](https://github.com/Tora-Build/sooth-sdk/commit/c934c6f707ddea320efa72ce674763c5a9da7b23))
* **readme:** remove sooth-alpha references and link sooth-core ([08fa940](https://github.com/Tora-Build/sooth-sdk/commit/08fa940831c38bbca58335fe3b4cb2b004fc895c))
* **skills:** fold v0.2.1 lessons into cli-migration skill ([52d2bce](https://github.com/Tora-Build/sooth-sdk/commit/52d2bce34da6c54fc778b85f3e3212b956328a82))
* standalone repo intro + cli-migration skill ([b7a20d8](https://github.com/Tora-Build/sooth-sdk/commit/b7a20d82a667660e45a6eb50b0fbd51ec2a6c28a))

## [0.4.1](https://github.com/Tora-Build/sooth-sdk/compare/sdk-v0.4.0...sdk-v0.4.1) (2026-07-26)


### 🐛 Bug Fixes

* **cli:** make the CLI type-checked and Node-runnable from dist ([#23](https://github.com/Tora-Build/sooth-sdk/issues/23)) ([7ace7ae](https://github.com/Tora-Build/sooth-sdk/commit/7ace7aeba89fa19e140c6b96c454ce3843f43553))
* **core:** reconcile settlement/claim path with v0.2.1 contracts ([#24](https://github.com/Tora-Build/sooth-sdk/issues/24)) ([0896db0](https://github.com/Tora-Build/sooth-sdk/commit/0896db00589e7539bc949c9ac2fc4a0e8b960c36))
* **sdk:** rebuild SoothClient wrapper on canonical ABIs ([#21](https://github.com/Tora-Build/sooth-sdk/issues/21)) ([b0433a4](https://github.com/Tora-Build/sooth-sdk/commit/b0433a48d8312073e3e7bb3ff69aae4353203645))

## [0.4.0](https://github.com/Tora-Build/sooth-sdk/compare/sdk-v0.3.0...sdk-v0.4.0) (2026-07-26)


### ✨ Features

* **abis:** add canonical feerouter and orderengine abis ([#15](https://github.com/Tora-Build/sooth-sdk/issues/15)) ([8fd5a44](https://github.com/Tora-Build/sooth-sdk/commit/8fd5a44397c48e8822e9f5d1da729041f7a6234b))
* **abis:** add events and custom errors to the SoothBook ABI ([#13](https://github.com/Tora-Build/sooth-sdk/issues/13)) ([e4128c2](https://github.com/Tora-Build/sooth-sdk/commit/e4128c209a0a19a4b94d0accd7453f9cba683f11))


### 🐛 Bug Fixes

* **cli:** harden MegaETH reads and history ([e35c460](https://github.com/Tora-Build/sooth-sdk/commit/e35c460af5235df9b067be4cfa7693180cd21409))
* **cli:** harden MegaETH reads and history ([86dd837](https://github.com/Tora-Build/sooth-sdk/commit/86dd83797480d761e0a27bd65108577729aca7e7))
* **pkg:** make the published tarball correct and complete ([#18](https://github.com/Tora-Build/sooth-sdk/issues/18)) ([5ad6a91](https://github.com/Tora-Build/sooth-sdk/commit/5ad6a915a3b1cf11111cc781b75c3335a90c72e4))


### 🧹 Chores

* add npm publish metadata and MIT LICENSE ([3b2ba46](https://github.com/Tora-Build/sooth-sdk/commit/3b2ba4662afcfa61474874ed415aae9b5885b393))
* add npm publish metadata and MIT LICENSE ([a1ec7ed](https://github.com/Tora-Build/sooth-sdk/commit/a1ec7ed441103cb459fdf6b7d9b99c21ed7503ca))

## [0.3.0](https://github.com/Tora-Build/sooth-sdk/compare/sdk-v0.2.2...sdk-v0.3.0) (2026-07-12)


### ✨ Features

* **sqf:** canonical SQF parser + generator; run tests in CI ([#11](https://github.com/Tora-Build/sooth-sdk/issues/11)) ([cec74a5](https://github.com/Tora-Build/sooth-sdk/commit/cec74a54c94e3ee7c964cd75ae2a8867b4bb0aab))

## [0.2.2](https://github.com/Tora-Build/sooth-sdk/compare/sdk-v0.2.1...sdk-v0.2.2) (2026-07-11)


### 🐛 Bug Fixes

* **cli:** derive SDK_VERSION from package.json, not the core version ([9ef4644](https://github.com/Tora-Build/sooth-sdk/commit/9ef4644b0a29fe458cd30ce67faf6b460266b134))
* complete v0.2.1 ABI migration in SDK + CLI ([#7](https://github.com/Tora-Build/sooth-sdk/issues/7)) ([ffabdbf](https://github.com/Tora-Build/sooth-sdk/commit/ffabdbf4a0fb4473c3335b252d685ac52a6ed720))
* **lint:** prefix unused vars in soothbook and soothCore ([27d5932](https://github.com/Tora-Build/sooth-sdk/commit/27d59326ef50c928740ec0ae14873992308ed041))
* **lint:** resolve unused vars and stale imports across cli ([df36cc8](https://github.com/Tora-Build/sooth-sdk/commit/df36cc80a2d95a101b7937896396c96c531f1ce2))
* **lint:** resolve unused vars from v0.2.1 migration ([b1a1d86](https://github.com/Tora-Build/sooth-sdk/commit/b1a1d869ffd09afc3bd249ab2286388f825b1674))


### 🧹 Chores

* add check script to run lint and format together ([3a684c3](https://github.com/Tora-Build/sooth-sdk/commit/3a684c380dacb36fc6520366ea26dfcc221f95a9))
* add CODEOWNERS, PR template, and issue template ([3920c2c](https://github.com/Tora-Build/sooth-sdk/commit/3920c2cda96b4938321e19a4fee4898b87e81e8d))
* bump version to 0.2.1 to match sooth-core ([3522315](https://github.com/Tora-Build/sooth-sdk/commit/3522315e2a8db3136150719179755e8ce2f0312e))
* initial commit — sooth-sdk extracted from sooth-alpha ([cb37abd](https://github.com/Tora-Build/sooth-sdk/commit/cb37abd4d9f3d6a7e287dec61804a1551dc79413))
* pin pnpm package manager version ([c9fca39](https://github.com/Tora-Build/sooth-sdk/commit/c9fca39e5a416fa5252cb08a6930f980c0c31710))
* refresh registry snapshot (add Base Sepolia 84532 node) ([a5f0b53](https://github.com/Tora-Build/sooth-sdk/commit/a5f0b53bb05ea1f1c77116fb026911d40efc09f1))
* refresh registry snapshot to manifest 0.2.3 ([b9cfcd5](https://github.com/Tora-Build/sooth-sdk/commit/b9cfcd548a28b6ff9ea9748fe6313931775364c4))


### 🤖 CI

* add github actions workflows and release-please ([e94776c](https://github.com/Tora-Build/sooth-sdk/commit/e94776c24c399925f9f64a26f72fccc3beae324d))
* port tooling and CI from sooth-core ([fc58f95](https://github.com/Tora-Build/sooth-sdk/commit/fc58f95b3d5e3bd57490d6baae463c19f0598e97))
* **release-please:** use ALPHA_PAT to allow PR creation ([d7023e8](https://github.com/Tora-Build/sooth-sdk/commit/d7023e8d02666f6f8740a574c9fc55684cadc409))
* **release-please:** use ALPHA_PAT to allow PR creation ([63de862](https://github.com/Tora-Build/sooth-sdk/commit/63de862e69b2c698ec57a711d3218566617efef1))


### 📝 Docs

* add CONTRIBUTING.md and SECURITY.md ([12d1aec](https://github.com/Tora-Build/sooth-sdk/commit/12d1aec510373de83bfc743e3e14c40ff8888520))
* **readme:** remove sooth-alpha references and link sooth-core ([08fa940](https://github.com/Tora-Build/sooth-sdk/commit/08fa940831c38bbca58335fe3b4cb2b004fc895c))
* **skills:** fold v0.2.1 lessons into cli-migration skill ([52d2bce](https://github.com/Tora-Build/sooth-sdk/commit/52d2bce34da6c54fc778b85f3e3212b956328a82))
* standalone repo intro + cli-migration skill ([b7a20d8](https://github.com/Tora-Build/sooth-sdk/commit/b7a20d82a667660e45a6eb50b0fbd51ec2a6c28a))
