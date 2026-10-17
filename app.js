(function () {
  var videos = Array.prototype.slice.call(document.querySelectorAll('video[data-src]'));
  if (!('IntersectionObserver' in window)) {
    videos.forEach(function (v) { v.src = v.dataset.src; });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting && en.intersectionRatio >= 0.45) {
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }, { threshold: [0, 0.45, 0.8] });
  videos.forEach(function (v) { io.observe(v); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) videos.forEach(function (v) { v.pause(); });
  });
})();
