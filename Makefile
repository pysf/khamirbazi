# Khamirbazi: local build commands. CI runs the same targets (see .github/workflows/pages.yml).
# Run `make help` for the list.

.DEFAULT_GOAL := help
NODE_MODULES := node_modules/.package-lock.json

.PHONY: help install dev build test check ci preview clean

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-9s %s\n", $$1, $$2}'

$(NODE_MODULES): package.json package-lock.json
	npm ci

install: $(NODE_MODULES) ## Install dependencies

dev: install ## Local server with live reload at http://localhost:8080/
	npm run dev

build: install ## Build the site into _site/ (set PATH_PREFIX=/khamirbazi/ to mimic GitHub Pages)
	npm run build

test: install ## Run the calculator and data tests
	npm test

check: ## Check English and Farsi stay in sync
	node scripts/check-sync.mjs

ci: test check build ## Everything CI runs: tests, language sync, build

preview: ## Build as GitHub Pages would and serve it at http://localhost:8081/khamirbazi/
	PATH_PREFIX=/khamirbazi/ $(MAKE) build
	@rm -rf .preview && mkdir -p .preview && cp -R _site .preview/khamirbazi
	@echo "Serving http://localhost:8081/khamirbazi/  (Ctrl+C to stop)"
	cd .preview && python3 -m http.server 8081

clean: ## Remove build output
	rm -rf _site .preview
