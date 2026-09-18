(function () {
  // Light is the default theme. We only ever set data-theme="dark" when the
  // visitor explicitly asked for it, and we remember that choice.
  var stored = localStorage.getItem("rousscuts-theme");
  if (stored === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("rousscuts-theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("rousscuts-theme", "dark");
      }
    });
  });
})();
