FROM node:4

ENV NPM_CONFIG_LOGLEVEL warn

RUN apt-get update && apt-get install -y graphicsmagick

ENV NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group

ENV COVERAGE=TRUE
ENV SAUCE=TRUE
ENV XUNIT=TRUE
ENV PORT=8000
ENV FIXTURE_PORT=9000
ENV KARMA_PORT=8001

WORKDIR /work

COPY cmd.sh cmd.sh
COPY retry.sh retry.sh
COPY test.sh test.sh

CMD '/work/cmd.sh'
