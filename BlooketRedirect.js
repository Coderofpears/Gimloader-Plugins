/**
 * @name BlooketRedirect
 * @description Redirects Gimkit Join page to Blooket Play
 * @author Coderofpears
 * @version 1.0.0
 * @downloadUrl https://raw.githubusercontent.com/yourname/gimloader-plugins/main/plugins/BlooketRedirect.js
 */

(function() {
  // Check if we’re on the join page
  if (window.location.hostname.includes("gimkit.com") && window.location.pathname.startsWith("/join")) {
    console.log("[GimLoader:BlooketRedirect] Redirecting to Blooket...");
    window.location.replace("https://play.blooket.com/play");
  } else {
    console.log("[GimLoader:BlooketRedirect] Not on join page, idle.");
  }
})();
