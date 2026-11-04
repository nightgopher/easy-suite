/* Easy Suite — 交互脚本：移动端菜单 / 代码复制 / 版本号在线刷新 */

(function () {
  "use strict";

  /* 不做滚动显隐：内容始终可见，脚本只负责菜单 / 复制 / 版本号刷新 */

  /* ---- 移动端菜单 ---- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- 代码复制 ---- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.closest(".codebox");
      var code = box ? box.querySelector("code") : null;
      if (!code) return;
      var text = code.textContent;
      function done() {
        btn.textContent = "已复制";
        btn.classList.add("done");
        setTimeout(function () {
          btn.textContent = "复制";
          btn.classList.remove("done");
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallback(); });
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* 忽略 */ }
        document.body.removeChild(ta);
      }
    });
  });

  /* ---- 版本号在线刷新（GitHub API，失败时保留写死的兜底值） ---- */
  var FALLBACK = { easyagent: "v0.38.0", easygateway: "v0.3.18" };
  document.querySelectorAll("[data-repo]").forEach(function (el) {
    var repo = el.getAttribute("data-repo");
    if (!repo || !FALLBACK[repo]) return;
    fetch("https://api.github.com/repos/nightgopher/" + repo + "/releases/latest")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        if (!data || !data.tag_name) return;
        var tag = data.tag_name;
        el.classList.contains("ver-pill")
          ? (el.textContent = tag)
          : (el.querySelector(".ver").textContent = tag);
      })
      .catch(function () { /* 静默失败，使用兜底值 */ });
  });
})();
