HUGO=hugo
FILES=$(shell find archetypes assets content data layouts static -type f -not -path '*/bulma/docs/*' -not -path '*/bulma/test/*' -not -path '*/.git*')

DOCKER_IMAGE_NAME=ssbanerje-hugo

.PHONY: all clean watch sync
.PHONY: docker-image docker-all docker-clean docker-watch

all: public

clean:
	rm -rf public/ resources/

public: $(FILES) hugo.toml
	$(HUGO) --minify
	@find . -name ".DS_Store" -delete

watch:
	$(HUGO) server --disableFastRender --buildDrafts

docker-image:
	docker build --pull -t $(DOCKER_IMAGE_NAME) .

docker-all: docker-image
	docker run --rm --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make all

docker-clean: docker-image
	docker run --rm --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make clean

docker-watch: docker-image
	docker run -it --rm -p 1313:1313 --user $(shell id -u):$(shell id -g) -v $(CURDIR):/src -w /src $(DOCKER_IMAGE_NAME) make watch
