# FROM node 14.21.3-bullseye-slim
FROM node@sha256:0f5b374fae506741ff14db84daff2937ae788e88fb48a6c66d15de5ee808ccd3

RUN apt update && apt install --yes --no-install-recommends wget git apt-transport-https ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /home/root/tornado-cli

ENV GIT_REPOSITORY=https://git.tornado.ws/tornadocash/tornado-cli
ENV GIT_COMMIT_HASH=1ae2aec71d3cfb28911ce4c60bdd35650e93e5e4

RUN git init && \
  git remote add origin $GIT_REPOSITORY && \
  git fetch --depth 1 origin $GIT_COMMIT_HASH && \
  git checkout $GIT_COMMIT_HASH

RUN npm ci

RUN npm install -g pkg@5.8.1

RUN node scripts/createDeterministicExecutable.js

RUN printf '#!/bin/sh\ncp /home/root/tornado-cli/tornado-cli.exe /output/' > /copy_out.sh && chmod +x /copy_out.sh

CMD ["/bin/bash"] 