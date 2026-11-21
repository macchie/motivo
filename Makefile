# Motivo — development tasks
# Run `make` (or `make help`) to list targets.

NPM      ?= npm
NEU      := node_modules/.bin/neu
HTTP     := node_modules/.bin/http-server
PORT     ?= 8080
BINARIES := bin/neutralino-linux_x64
CLIENT   := resources/js/neutralino.js

BUMP     ?= patch

.DEFAULT_GOAL := help
.PHONY: help install update dev run web test check build build-embed golden clean distclean \
        release release-dry release-patch release-minor release-major release-rc \
        mac-app mac-sign mac-dmg mac-notarize mac-release mac-verify mac-run mac-unquarantine \
        site site-serve site-deploy

help: ## Show this help
	@echo "Motivo — make targets"
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[33m%-12s\033[0m %s\n", $$1, $$2}'

# ── Setup ────────────────────────────────────────────────────────────────
node_modules/.installed: package.json
	$(NPM) install
	@touch $@

$(BINARIES) $(CLIENT): | node_modules/.installed
	$(NEU) update

install: node_modules/.installed $(BINARIES) $(CLIENT) ## Install npm deps and download Neutralino binaries (only if missing)

update: node_modules/.installed ## Force re-download of Neutralino binaries + client library
	$(NEU) update

# ── Develop ──────────────────────────────────────────────────────────────
dev: install ## Run the desktop app with the web inspector (auto-reloads on resource changes)
	$(NEU) run -- --window-enable-inspector=true

run: install ## Run the desktop app as users see it
	$(NEU) run

web: node_modules/.installed ## Serve the UI in a browser (no native APIs; downloads + localStorage)
	$(HTTP) resources -p $(PORT) -c-1 -o /index.html

test: node_modules/.installed ## Run the generator / encoder smoke tests
	node --test tests/*.test.mjs

check: test ## Alias for test

golden: node_modules/.installed ## Re-record golden seeds (only after bumping GENERATOR_VERSION)
	node scripts/update-golden.mjs

# ── Build ────────────────────────────────────────────────────────────────
build: install test ## Build release packages for all platforms into dist/
	$(NEU) build --release --clean

build-embed: install test ## Build single-file binaries (resources embedded) into dist/
	$(NEU) build --release --clean --embed-resources

# ── Publish a release ────────────────────────────────────────────────────
# release.mjs bumps the version everywhere, updates CHANGELOG.md, commits, tags
# and pushes; the tag then starts .github/workflows/release.yml.
release-dry: node_modules/.installed ## Preview the next version and notes (BUMP=patch|minor|major|rc)
	node scripts/release.mjs $(BUMP) --dry-run

release-patch: node_modules/.installed ## Cut & push a patch release (x.y.Z)
	node scripts/release.mjs patch

release-minor: node_modules/.installed ## Cut & push a minor release (x.Y.0)
	node scripts/release.mjs minor

release-major: node_modules/.installed ## Cut & push a major release (X.0.0)
	node scripts/release.mjs major

release-rc: node_modules/.installed ## Cut & push a release candidate (x.y.z-rc.N)
	node scripts/release.mjs rc

release: node_modules/.installed ## Cut & push an explicit version (make release V=2.0.0)
	@test -n "$(V)" || { echo "Set V, e.g. make release V=2.0.0"; exit 1; }
	node scripts/release.mjs $(V)

# ── macOS packaging (run on a Mac) ───────────────────────────────────────
mac-app: build-embed ## Build dist/mac/Motivo.app from the universal binary
	scripts/macos.sh app

mac-sign: ## Sign the app (ad-hoc by default, or MAC_SIGN_IDENTITY)
	scripts/macos.sh sign

mac-dmg: ## Package dist/Motivo-macOS.dmg
	scripts/macos.sh dmg

mac-notarize: ## Notarize and staple the dmg (needs Developer ID + credentials)
	scripts/macos.sh notarize

mac-release: build-embed ## Build, sign and package the dmg (notarizes when credentials are set)
	scripts/macos.sh release

mac-verify: ## Show the signature and what Gatekeeper thinks of it
	scripts/macos.sh verify

mac-run: ## Open the built app
	open dist/mac/Motivo.app

mac-unquarantine: ## Let a downloaded unsigned app open (APP=/path/to/Motivo.app)
	scripts/macos.sh unquarantine $(APP)

# ── Website ──────────────────────────────────────────────────────────────
site: node_modules/.installed ## Build the landing page into _site/
	node scripts/build-site.mjs

site-serve: site ## Build and preview the website at localhost:8081
	$(HTTP) _site -p 8081 -c-1 -o /index.html

site-deploy: ## Rebuild and publish the website now (triggers the Pages workflow via gh)
	gh workflow run pages.yml

# ── Clean ────────────────────────────────────────────────────────────────
clean: ## Remove build output and logs
	rm -rf dist .tmp _site neutralinojs.log

distclean: clean ## Also remove node_modules and downloaded binaries
	rm -rf node_modules bin
