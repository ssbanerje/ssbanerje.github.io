#!/bin/bash

USER=ssbaner2
HOST=web.engr.illinois.edu
DIR=public/

# BUILD
rm -rf ${DIR}
hugo

# MINIFY
html-minifier --input-dir ${DIR} --output-dir ${DIR} --collapse-whitespace --html5 --minify-css --minify-js --file-ext html
html-minifier --input-dir ${DIR} --output-dir ${DIR} --collapse-whitespace --minify-css --file-ext css
html-minifier --input-dir ${DIR} --output-dir ${DIR} --collapse-whitespace --minify-js --file-ext js

#rsync -avz --delete public/ ${USER}@${HOST}:${DIR}

exit 0
