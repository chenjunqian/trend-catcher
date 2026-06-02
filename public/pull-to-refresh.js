(function () {
  var THRESHOLD = 80;
  var MAX_HEIGHT = 60;
  var PIN_HEIGHT = 48;
  var startY = 0;
  var currentY = 0;
  var pulling = false;
  var refreshing = false;
  var indicator = document.createElement("div");
  indicator.className = "pull-indicator";
  indicator.innerHTML = '<div class="spinner"></div>';
  document.body.prepend(indicator);

  document.addEventListener("touchstart", function (e) {
    if (refreshing) return;
    if (window.scrollY > 0) {
      pulling = false;
      return;
    }
    startY = e.touches[0].clientY;
    currentY = startY;
    pulling = true;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (!pulling || refreshing) return;
    currentY = e.touches[0].clientY;
    var delta = currentY - startY;
    if (delta > 5) {
      e.preventDefault();
      indicator.style.height = Math.min(delta * 0.5, MAX_HEIGHT) + "px";
    } else if (delta < -10) {
      pulling = false;
      indicator.style.height = "0";
    }
  }, { passive: false });

  document.addEventListener("touchend", function () {
    if (!pulling || refreshing) return;
    pulling = false;
    var delta = currentY - startY;
    if (delta > THRESHOLD) {
      refreshing = true;
      indicator.style.height = PIN_HEIGHT + "px";
      indicator.querySelector(".spinner").style.display = "block";
      window.location.reload();
    } else {
      indicator.style.height = "0";
    }
  });
})();
