#!/bin/bash

MOZ_GMP_PATH=./.tmp/selenium/mac/gmp-gmpopenh264/1.6

curl -O http://ciscobinary.openh264.org/libopenh264-1.6.0-osx64.dylib.bz2
bzip2 -d libopenh264-1.6.0-osx64.dylib.bz2
mkdir -p "${MOZ_GMP_PATH}"
mv libopenh264-1.6.0-osx64.dylib "${MOZ_GMP_PATH}/libgmpopenh264.dylib"
echo 'Name: gmpopenh264' > "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'Description: GMP Plugin for OpenH264.' >> "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'Version: 1.6' >> "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'APIs: encode-video[h264], decode-video[h264]' >> "${MOZ_GMP_PATH}/gmpopenh264.info"
echo 'user_pref("media.gmp-gmpopenh264.abi", "x86_64-gcc3");' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-gmpopenh264.lastUpdate", 1494528046);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-gmpopenh264.version", "1.6");' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-manager.buildID", "20170504105526");' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-manager.lastCheck", 1494528044);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-provider.enabled", true);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-widevinecdm.abi", "x86_64-gcc3");' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-widevinecdm.lastUpdate", 1494528048);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp-widevinecdm.version", "1.4.8.903");' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.gmp.storage.version.observed", 1);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.peerconnection.video.h264_enabled", true);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.navigator.permission.disabled", true);' >> "./.tmp/selenium/mac/user.js"
echo 'user_pref("media.navigator.streams.fake", true);' >> "./.tmp/selenium/mac/user.js"
