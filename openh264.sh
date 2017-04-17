#!/bin/bash

# MOZ_GMP_PATH=$(pwd)/.tmp2/gmp-gmpopenh264/1.5.0
MOZ_GMP_PATH=/tmp/gmp-gmpopenh264/1.5.0

curl -O http://ciscobinary.openh264.org/libopenh264-1.5.0-osx64.dylib.bz2
bzip2 -d libopenh264-1.5.0-osx64.dylib.bz2

mkdir -p "${MOZ_GMP_PATH}"
mv libopenh264-1.5.0-osx64.dylib "${MOZ_GMP_PATH}/libgmpopenh264.dylib"
echo 'Name: gmpopenh264' > "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'Description: GMP Plugin for OpenH264.' >> "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'Version: 1.5.0' >> "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'APIs: encode-video[h264], decode-video[h264]' >> "${MOZ_GMP_PATH}/gmpopenh264.info"

touch ~/.bash_profile
echo "export MOZ_GMP_PATH=${MOZ_GMP_PATH}" >> ~/.bash_profile
source ~/.bash_profile
