HUGO=hugo
USER=ssbaner2
HOST=web.illinois.edu
DIR=public_html/
FILES=$(shell find archetypes assets content data layouts static -type f)

.PHONY: all clean watch sync

all: public

clean:
	rm -rf public/ resources/

public: $(FILES) config.toml
	$(HUGO) --minify
	mkdir -p public/cgi-bin
	@find . -name ".DS_Store" -delete

watch:
	$(HUGO) server --disableFastRender --buildDrafts

sync: public
	rsync -avz --delete public/ $(USER)@$(HOST):$(DIR)
