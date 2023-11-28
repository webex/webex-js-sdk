#!/bin/bash -e
source ~/.nvm/nvm.sh

if [ -f $HOME/.npmrc ]; then
    rm $HOME/.npmrc
fi

echo "--------------------------------------------------"
echo "Set up Node"
nvm use
echo "--------------------------------------------------"

echo "Set up Yarn"
npm i -g yarn
echo "--------------------------------------------------"

echo "Install project dependencies..."
yarn install
echo '--------------------------------------------------'

echo "Determine branch name and set env..."
git_branch=$(git name-rev --name-only HEAD)
echo "Branch name: ${git_branch}"
echo "--------------------------------------------------"