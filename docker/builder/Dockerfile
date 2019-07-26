FROM node:carbon

RUN apt-get update && apt-get install -y graphicsmagick curl wget jq daemon

ENV NPM_CONFIG_LOGLEVEL       warn
ENV SAUCE                     true
ENV XUNIT                     true
ENV PORT                      8000
ENV FIXTURE_PORT              9000
ENV KARMA_PORT                8001

RUN npm install -g npm@6

WORKDIR /work

COPY cmd.sh cmd.sh

CMD '/work/cmd.sh'
