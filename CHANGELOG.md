# Changelog

## [0.4.2](https://github.com/Tora-Build/sooth-sdk/compare/sdk-v0.4.1...sdk-v0.4.2) (2026-07-26)


### 🤖 CI

* publish to npm after release-please creates a release ([21195fd](https://github.com/Tora-Build/sooth-sdk/commit/21195fddf61fa1979b9df7cb10467ea2d9560687))
* publish to npm after release-please creates a release ([baad6f3](https://github.com/Tora-Build/sooth-sdk/commit/baad6f351ebfee7bc7c739b1ce38ad872aaad5b9))

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
