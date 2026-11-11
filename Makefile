HUGO=hugo
# Interface for `make watch`; docker-watch overrides it so the port is reachable from the host.
BIND=127.0.0.1

DOCKER_IMAGE_NAME=ssbanerje-hugo

.PHONY: all public clean watch docker-image docker-all docker-clean docker-watch

all: public

clean:
	rm -rf public/ resources/

# .github/workflows/gh-pages.yml runs hugo with the same flags; keep them in sync.
public:
	$(HUGO) --gc --minify --cleanDestinationDir --printPathWarnings

watch:
	$(HUGO) server --disableFastRender --buildDrafts --bind $(BIND)

docker-image:
	docker build -t $(DOCKER_IMAGE_NAME) .

docker-all: docker-image
	docker run --rm --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make all

docker-clean: docker-image
	docker run --rm --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make clean

docker-watch: docker-image
	docker run -it --rm -p 1313:1313 --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make watch BIND=0.0.0.0
