# Motivo — development tasks
# Run `make` (or `make help`) to list targets.

NPM      ?= npm
NEU      := node_modules/.bin/neu
HTTP     := node_modules/.bin/http-server
PORT     ?= 8080
BINARIES := bin/neutralino-linux_x64
CLIENT   := resources/js/neutralino.js

.DEFAULT_GOAL := help
.PHONY: help install update dev run web test check build build-embed clean distclean

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

# ── Release ──────────────────────────────────────────────────────────────
build: install test ## Build release packages for all platforms into dist/
	$(NEU) build --release --clean

build-embed: install test ## Build single-file binaries (resources embedded) into dist/
	$(NEU) build --release --clean --embed-resources

clean: ## Remove build output and logs
	rm -rf dist .tmp neutralinojs.log

distclean: clean ## Also remove node_modules and downloaded binaries
	rm -rf node_modules bin
