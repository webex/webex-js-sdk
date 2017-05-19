'use strict';

const debug = require(`debug`)(`tooling:git`);
const Git = require(`nodegit`);
const kit = require(`nodegit-kit`);

exports.diff = async function diff(tag) {
  debug(`opening repo`);
  const repo = await Git.Repository.open(`${process.cwd()}/.git`);
  debug(`diffing HEAD against ${tag}`);
  const d = await kit.diff(repo, `HEAD`, tag);
  return d;
};

exports.lastLog = async function lastLog() {
  const repo = await Git.Repository.open(`${process.cwd()}/.git`);
  const commit = await repo.getHeadCommit();
  return commit.summary();
};
