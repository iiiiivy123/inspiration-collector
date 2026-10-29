#!/bin/sh
# Run in Ubuntu 24.04 with /work bound to this project's build-tools directory.
# Only local MP4 remux/inspection; no external media libraries, GPL or networking.
set -eu
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gcc gcc-mingw-w64-x86-64 make unzip ca-certificates
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libc6-dev
gcc -std=c17 -x c -fsyntax-only -include ctype.h -include stdio.h /dev/null
x86_64-w64-mingw32-gcc -std=c17 -x c -fsyntax-only -include ctype.h -include stdio.h /dev/null
cd /tmp
unzip -q /work/ffmpeg-source-611cec792a.zip
cd FFmpeg-611cec792a
trap 'cp ffbuild/config.log /work/media-config.log 2>/dev/null || true' EXIT
./configure --arch=x86_64 --target-os=mingw32 --cross-prefix=x86_64-w64-mingw32- \
  --disable-autodetect --disable-everything --disable-network --disable-x86asm \
  --disable-doc --disable-debug --enable-small --disable-gpl --disable-nonfree \
  --disable-pthreads --enable-w32threads --enable-ffmpeg --enable-ffprobe \
  --enable-protocol=file --enable-demuxer=mov --enable-muxer=mp4 \
  --enable-parser=h264,aac --enable-decoder=h264,aac \
  --enable-bsf=aac_adtstoasc,h264_mp4toannexb
make -j4
mkdir -p /work/media-minimal
cp ffmpeg.exe ffprobe.exe COPYING.LGPLv2.1 LICENSE.md /work/media-minimal/
cp ffbuild/config.mak /work/media-minimal/build-config.txt
cp /work/ffmpeg-source-611cec792a.zip /work/media-minimal/
cp /usr/share/doc/mingw-w64-common/copyright /work/media-minimal/MinGW-COPYRIGHT.txt
dpkg-query -W > /work/media-minimal/toolchain-packages.txt
