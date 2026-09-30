#!/bin/zsh
export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}"
npm run local:start
