(() => {
  "use strict";

  const hls = {
    muxMain: {
      stream: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      source: "Mux 开放 HLS 测试信号"
    },
    muxShift: {
      stream: "https://test-streams.mux.dev/pts_shift/master.m3u8",
      source: "Mux 开放 HLS 测试信号"
    },
    muxTos: {
      stream: "https://test-streams.mux.dev/tos_ismc/main.m3u8",
      source: "Mux 开放 HLS 测试信号"
    },
    muxTest: {
      stream: "https://test-streams.mux.dev/test_001/stream.m3u8",
      source: "Mux 开放 HLS 测试信号"
    },
    appleBipBop: {
      stream: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
      source: "Apple 开放 HLS 测试信号"
    },
    unifiedTears: {
      stream: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      source: "Unified Streaming 开放 HLS 测试信号"
    }
  };

  const mp4 = {
    sintel: {
      stream: "https://media.w3.org/2010/05/sintel/trailer.mp4",
      source: "W3C 开放授权 MP4 测试片源"
    },
    bunny: {
      stream: "https://media.w3.org/2010/05/bunny/trailer.mp4",
      source: "W3C 开放授权 MP4 测试片源"
    },
    movie: {
      stream: "https://media.w3.org/2010/05/video/movie_300.mp4",
      source: "W3C 开放授权 MP4 测试片源"
    }
  };

  window.NovaDemoMedia = {
    library: {
      dune: mp4.sintel,
      interstellar: mp4.movie,
      joker: mp4.bunny,
      peaky: mp4.sintel,
      totoro: mp4.bunny,
      lostyou: mp4.movie,
      avengers: mp4.sintel,
      yourname: mp4.bunny
    },
    live: {
      cctv1: hls.muxMain,
      cctv5: hls.muxShift,
      cctv6: hls.muxTos,
      cctv13: hls.muxTest,
      hunan: hls.appleBipBop,
      dragon: hls.unifiedTears,
      zhejiang: hls.muxMain,
      jiangsu: hls.muxShift,
      anqing: hls.muxTos,
      ahpublic: hls.muxTest,
      "music-live": hls.appleBipBop,
      concert: hls.unifiedTears
    }
  };
})();
