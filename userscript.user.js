
// ==UserScript==
// @name         Service Cloud Premium 3
// @namespace    https://github.com/sadnalor/tampermonkeys
// @version      2026.01.14.0
// @author       Roland
// @description  Internal Salesforce Service Cloud helper
//
// @match        https://planview.lightning.force.*/
// @match        https://planview--trident.lightning.force.*/
// @match        https://planview--trident.sandbox.lightning.force.*/
// @match        https://planview--partialsb.lightning.force.*/
// @match        https://planview--partialsb.sandbox.lightning.force.*/
//
// @connect      whoslookingatcases.herokuapp.com
// @connect      servicecloudpremium-781150c5a240.herokuapp.com
// @connect      file.force.com
// @connect      my.salesforce.com
//
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.6.4/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/jqueryui@1.13.2/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/gh/sadnalor/apiflow@20201120v2/scripts/popup.js
// @resource     popupStyleCSS https://cdn.jsdelivr.net/gh/sadnalor/apiflow@20201120v2/styles/popupStyle.css
// @resource     jQueryUIcss https://cdn.jsdelivr.net/npm/jqueryui@1.13.2/jquery-ui.min.css
//
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_setValue
// @grant        GM_getValue
//
// @run-at       document-idle
//
// @downloadURL  https://katvmte04.eu.world/tetools/userscripts/sfdc/servicecloud.user.js
// @updateURL    https://katvmte04.eu.world/tetools/userscripts/sfdc/servicecloud.user.js
// ==/UserScript==

console.log('init');