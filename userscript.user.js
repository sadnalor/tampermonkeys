// ==UserScript==
// @name         Service Cloud Premium 3
// @namespace    https://github.com/sadnalor/tampermonkeys
// @version      2026.11.01.01
// @author       Roland
// @description  Internal Salesforce Service Cloud helper
//
// @include      /.*planview.lightning.force.*/
// @include      /.*planview--trident.lightning.force.*/
// @include      /.*planview--trident.sandbox.lightning.force.*/
// @include      /.*planview--partialsb.lightning.force.*/
// @include      /.*planview--partialsb.sandbox.lightning.force.*/
// @include      /.*planview--bizappspro.sandbox.lightning.force.*/
// @include      /.*planview.my.salesforce.com\/email\/htmlbody\/htmlbody.jsp.*/
//
// @connect      whoslookingatcases.herokuapp.com
// @connect      tam-04a6caab6366.herokuapp.com
// @connect      file.force.com
// @connect      my.salesforce.com
// @connect      planview.file.force.com
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
// @run-at       document-idle
//
// @downloadURL  https://github.com/sadnalor/tampermonkeys/releases/latest/download/userscript.user.js
// @updateURL    https://github.com/sadnalor/tampermonkeys/releases/latest/download/userscript.user.js
// ==/UserScript==

class MutationObserverRegistry {
  constructor(observerName) {
    this.functionsForAnyMutation = [];
    this.functionsForNodeAddition = [];
    this.observerName = observerName;
    this.observer;
  }

  addFunctionForAnyMutation = (functionRef) =>
    this.functionsForAnyMutation.push(functionRef);
  addFunctionForNodeAddition = (functionRef) =>
    this.functionsForNodeAddition.push(functionRef);

  createObserver = () => {
    this.observer = new MutationObserver((mutations) => {
      const start = Date.now();
      for (let i in mutations) {
        let mutation = mutations[i];
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          let nodes = Array.from(mutation.addedNodes);
          for (let j in nodes) {
            let node = nodes[j];
            for (let k in this.functionsForNodeAddition) {
              let func = this.functionsForNodeAddition[k];
              func(node, this.observerName);
            }
          }
        }
        for (let n in this.functionsForAnyMutation) {
          let func = this.functionsForAnyMutation[n];
          func(mutation, this.observerName);
        }
      }
      const finish = Date.now();
      GLOBAL.totalTimeSpentInRolandUImodsScript += finish - start;
      //console.log("Total time used by this script:", GLOBAL.totalTimeSpentInRolandUImodsScript);
    });
  };
}

class ConditionalFormatting {
  constructor() {
    this.textMatchStyles = JSON.parse(
      GLOBAL.settingsManager.settings.textMatchStyles,
    );
    const customRules = JSON.parse(
      GLOBAL.settingsManager.settings.customTextMatchStyles || '[]',
    );
    for (const rule of customRules) {
      const idx = this.textMatchStyles.findIndex((s) => s.text === rule.text);
      if (idx >= 0) {
        this.textMatchStyles[idx] = { ...this.textMatchStyles[idx], ...rule };
      } else {
        this.textMatchStyles.push({
          exactMatch: true,
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
          ...rule,
        });
      }
    }
    //this.displayTimeSpent();
    this.textHighlightColorMap = this.calculateTextHighlightColorMap();
    this.textValuesToMonitor = Object.keys(this.textHighlightColorMap);
  }

  calculateTextHighlightColorMap = () => {
    const colorMap = {};
    for (let i in this.textMatchStyles) {
      const style = this.textMatchStyles[i];
      colorMap[style.text] = style;
    }
    return colorMap;
  };

  run = () => {
    GLOBAL.mutationObserverRegistry.addFunctionForAnyMutation(
      this.processMutation,
    );
    GLOBAL.mutationObserverRegistry.addFunctionForNodeAddition(
      this.processTextNode,
    );
    GLOBAL.mutationObserverRegistry.addFunctionForNodeAddition(
      this.defectRequestMod,
    );
  };

  processMutation = (mutation, observerName) => {
    this.expandEmailInput(mutation);
    this.expandT3investigationActionTextInput(mutation);
    this.monitorActiveCaseWhenUrlChanges(mutation);
    this.listenForAttachedImages(mutation);
    this.applyFeedFont(mutation);
  };

  applyFeedFont = (mutation) => {
    if (GLOBAL.settingsManager.settings.overrideStandardFeedFont) {
      const mutationTarget = $(mutation.target);
      const fontToApply =
        GLOBAL.settingsManager.settings.customFeedFont.length > 0
          ? GLOBAL.settingsManager.settings.customFeedFont
          : GLOBAL.settingsManager.settings.feedFontFamily;
      if (mutationTarget.attr('id') == 'emailuiFrame') {
        const jDocument = $(mutationTarget.get(0).contentWindow.document);
        const emailExpandedBody = jDocument.find('body');
        emailExpandedBody.css({
          fontFamily: fontToApply,
          fontSize: `${GLOBAL.settingsManager.settings.feedFontSize}px`,
        });
      } else if (mutationTarget.hasClass('cuf-compactBody')) {
        let internalPostExpandedTextSpan =
          mutationTarget.find('.feedBodyInner');
        if (internalPostExpandedTextSpan.length > 0)
          internalPostExpandedTextSpan.css({
            fontFamily: fontToApply,
            fontSize: `${GLOBAL.settingsManager.settings.feedFontSize}px`,
          });
      } else if (mutationTarget.hasClass('cuf-element')) {
        let collapsedFeedTextSpan = mutationTarget.find(
          '.preamble_custom-summary',
        );
        if (collapsedFeedTextSpan.length > 0) {
          collapsedFeedTextSpan.css({
            fontFamily: fontToApply,
            fontSize: `${GLOBAL.settingsManager.settings.feedFontSize}px`,
          });
        }
        let expandedEmailTextSpan = mutationTarget.find('.uiOutputText');
        if (expandedEmailTextSpan.length > 0)
          expandedEmailTextSpan.css({
            fontFamily: fontToApply,
            fontSize: `${GLOBAL.settingsManager.settings.feedFontSize}px`,
          });
      }
    }
  };

  listenForAttachedImages = (mutation) => {
    const mutationTarget = $(mutation.target);
    if (mutationTarget.hasClass('forceContentModalPreviewPlayer')) {
      GLOBAL.imageContainerDiv = mutationTarget
        .find('div.thumbnail img.pageImg')
        .parent();
      let imageUrl = mutationTarget
        .find('div.thumbnail img.pageImg')
        .attr('src');
      let url = mutationTarget.find('img.pageImg').attr('src');
      if (imageUrl) GLOBAL.attachedImageUrls.push(imageUrl);
      if (GLOBAL.imageUrlResolvedCallback && (imageUrl || url)) {
        GLOBAL.imageUrlResolvedCallback(imageUrl);
      }
    }
  };

  expandT3investigationActionTextInput = (mutation) => {
    const mutationTarget = $(mutation.target);
    if (
      mutationTarget.hasClass(
        'ql-editor slds-rich-text-area__content slds-text-color_weak slds-grow',
      )
    ) {
      mutationTarget.css({ maxHeight: '10000px' });
      let internalPostOuterBox = mutationTarget.closest(
        '.forceChatterMessageBodyInputRichTextEditor',
      );
      if (internalPostOuterBox.length > 0) {
        internalPostOuterBox.css({ maxHeight: '10000px' });
      }
    }
  };

  expandEmailInput = (mutation) => {
    const mutationTarget = $(mutation.target);
    if (mutationTarget.hasClass('uiInput')) {
      const firstIframe = mutationTarget.find('iframe');
      if (firstIframe.length > 0) {
        if (firstIframe[0].classList.contains('scp-email-iframe-fullscreen'))
          return;
        const selectorForResizing = '#cke_1_contents';
        const divForResizing = $(firstIframe[0])
          .contents()
          .find(selectorForResizing);
        const secondIframe = $(firstIframe[0]).contents().find('iframe');
        if (secondIframe.length > 0) {
          const editableBody = $(secondIframe[0]).contents().find('body');
          if (editableBody.length > 0) {
            //console.log(editableBody[0].innerText);
            this.tampermonkeyLinkInQuickText(editableBody);
            divForResizing.height(editableBody.outerHeight() + 20);
            GLOBAL.keyPressedOn = Date.now();
          }
        }
      }
    }
  };

  tampermonkeyLinkInQuickText = (body) => {
    let bodyText = body.html();
    if (
      /\&lt;tampermonkeylink\&gt;.*?\&lt;\/tampermonkeylink\&gt;/.test(bodyText)
    ) {
      bodyText = bodyText.replace(/\&lt;tampermonkeylink\&gt;/g, '<a href="');
      bodyText = bodyText.replace(
        /\&lt;\/tampermonkeylink\&gt;/g,
        '">Tampermonkey link</a>',
      );
      body.html(bodyText);
    }
  };

  tryToFindFileLinks = () => {
    console.log('trying to find links');
    let fileLinks = $(
      `a:not('.tabHeader')[href*="/ContentDocument/"] span.itemTitle.desktop`,
    );
    if (fileLinks.length > 0) GLOBAL.fileLinks = fileLinks;
  };

  monitorActiveCaseWhenUrlChanges = () => {
    if (window.location.pathname != GLOBAL.pathname) {
      //console.log('URL change');
      GLOBAL.uiInjector.injectHideLeftColumnButton();
      GLOBAL.pathname = window.location.pathname;

      let pathNameArray = GLOBAL.pathname.split('/');
      if (pathNameArray.length > 4) {
        if (pathNameArray[3].toLowerCase() == 'case') {
          if (GLOBAL.activeCaseId != pathNameArray[4] && GLOBAL.activeCaseId)
            GLOBAL.fileLinks = null;
          GLOBAL.activeCaseId = pathNameArray[4];
        } else GLOBAL.activeCaseId = null;
      } else GLOBAL.activeCaseId = null;
      if (Object.keys(GLOBAL.caseIdNumberPairs).includes(GLOBAL.activeCaseId)) {
        GLOBAL.activeCaseNumber =
          GLOBAL.caseIdNumberPairs[GLOBAL.activeCaseId].caseNumber;
        this.highlightActiveCase();
      }
    }
  };

  highlightActiveCase = () => {
    let highlightedAlready =
      GLOBAL.caseIdNumberPairs[GLOBAL.activeCaseNumber].highlighted;
    if (!highlightedAlready) {
      for (let key in GLOBAL.caseIdNumberPairs) {
        GLOBAL.caseIdNumberPairs[key].highlighted = false;
      }
      GLOBAL.caseIdNumberPairs[GLOBAL.activeCaseNumber].highlighted = true;
      $('.conditional-formatting-highlighted-case').css('background-color', '');
      $('.conditional-formatting-highlighted-case').removeClass(
        '.conditional-formatting-highlighted-case',
      );
      let activeCaseTextNode =
        GLOBAL.caseIdNumberPairs[GLOBAL.activeCaseNumber].textNode;
      let itemToHighlight = $(activeCaseTextNode).closest(
        '.slds-split-view__list-item',
      );
      if (itemToHighlight.length > 0) {
        let style = this.getStyleBasedOnTextArray(
          this.getTextFromNode(itemToHighlight.get(0)),
        );
        if (style) {
          let bgColor = style.bgColor != null ? style.bgColor : '';
          for (let i in this.textMatchStyles) {
            let style = this.textMatchStyles[i];
            if (style.text == GLOBAL.activeCaseStatus) {
              bgColor = style.bgColor;
              break;
            }
          }
          itemToHighlight.addClass('conditional-formatting-highlighted-case');
          itemToHighlight.css('background-color', bgColor);
        }
      }
    }
  };

  getStyleBasedOnTextArray = (textArray) => {
    for (let i in textArray) {
      let text = textArray[i];
      for (let j in this.textMatchStyles) {
        let style = this.textMatchStyles[j];
        if (style.text == text) return style;
      }
    }
    return null;
  };

  getTextFromNode = (node) => {
    let text = [],
      textNode,
      walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
    while ((textNode = walker.nextNode())) {
      text.push(textNode.textContent);
    }
    return text;
  };

  processTextNode = (node) => {
    const start = Date.now();
    let textNode,
      walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
    while ((textNode = walker.nextNode())) {
      this.clickOnInternalOnly(textNode);
      this.color(textNode);
      this.gatherCaseIdNumberPairs(textNode);
      if (GLOBAL.settingsManager.settings.allUrlHyperlinkingBeta)
        this.allUrlHyperlinking(textNode);
      this.findFilesSection(textNode);
      // this.findEscalatedToT3OrDevWarning(textNode);
      this.supportScoreHighlightInPanels(textNode);
      this.supportScoreInTableHighlighting(textNode);
      this.escalationLevelHighlightingInLists(textNode);
      this.supportScoreInReportsHighlighting1(textNode);
      this.supportScoreInReportsHighlighting2(textNode);
      this.closeTheAccessLinkRequestPopup(textNode);
      this.changepointIdHyperlinking(textNode);
      this.agilePlaceIdHyperlinking(textNode);
      this.tasktopJiraIdHyperlinking(textNode);
      this.sciformaJiraIdHyperlinking(textNode);
      this.planviewJiraIdHyperlinking(textNode);
      this.tasktopZendeskIdHyperlinking(textNode);
      this.tasktopJiraIdHyperlinkingManyIds(textNode);
      this.sciformaJiraIdHyperlinkingManyIds(textNode);
      this.generalMessageIsNullHighlighting(textNode);
    }

    // Additional tree walker for hyprlinks
    if(GLOBAL.settingsManager.settings.shortenAPUrls || GLOBAL.settingsManager.settings.autoExpandPosts) {

      let node_hl,
         walker_hl = document.createTreeWalker(
         node,
         NodeFilter.SHOW_ELEMENT,
        {
           acceptNode(node) {
             return (node.tagName === 'A' && node.hasAttribute('href'))
               ? NodeFilter.FILTER_ACCEPT
               : NodeFilter.FILTER_SKIP; // SKIP still visits children; use FILTER_REJECT to prune subtree
           }
        }
      );

      while ((node_hl = walker_hl.nextNode())) {
              //   console.log('HL WALKER', node);
         // Change display of AgilePlace links to just show the card number
         if (GLOBAL.settingsManager.settings.shortenAPUrls && /planview\.leankit\.com\/card\/\d{10}$/.test(node_hl.href)) {
             if(node_hl.childElementCount === 0)  {
                 let match = node_hl.href.match(/\/card\/(\d+)/);
                 if(match){
                     node_hl.textContent='AP: '+match[1];
                 }
             }
         }

         // Auot select 'Expand post' in internal posts
         if(node_hl.title == 'Show more text' && node_hl.classList.contains('cuf-more') && node_hl.attributes['TMclickDone'] != 'YESSS' &&  GLOBAL.settingsManager.settings.autoExpandPosts) {

           const previousActiveElement = document.activeElement;
           let middleColumn = deepQuerySelector('flexipage-record-home-scrollable-column.col.main-col.slds-col', document.body,true );

           if(middleColumn != null) {
             console.log('Click Expand', node);

             let scrollTop =middleColumn[0].scrollTop;
             node_hl.click();
             node_hl.attributes['TMclickDone'] = 'YESSS';
             this.scrollTopChecker(middleColumn[0], scrollTop, 10);
             document.activeElement?.blur();
           }
         }
      }

      // Additional tree walker for auto-expand buttons
      if(GLOBAL.settingsManager.settings.autoExpandPosts) {
        // console.log('BUT WALKER', node);
        let node_but,
            walker_but = document.createTreeWalker(
              node,
              NodeFilter.SHOW_ELEMENT,
              {
                acceptNode(node) {
                  return (node.tagName === 'BUTTON' && node.childElementCount === 0 && node.textContent == 'More comments' && node.attributes['TMclickDone'] != 'YESSS')
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP; // SKIP still visits children; use FILTER_REJECT to prune subtree
                }
              }
            );

        while ((node_but = walker_but.nextNode())) {
          const previousActiveElement = document.activeElement;
          let middleColumn = deepQuerySelector('flexipage-record-home-scrollable-column.col.main-col.slds-col', document.body,true );

          if(middleColumn != null) {
             console.log('CLICK MORE COMMENTS', node.attributes['TMclickDone'], node_but,  node);

             let scrollTop = middleColumn[0].scrollTop;
             node_but.attributes['TMclickDone'] = 'YESSS';
             node_but.click();
             this.scrollTopChecker(middleColumn[0], scrollTop, 10);
          }
        }
     }
   }

    const finish = Date.now();
    GLOBAL.totalTimeSpent += finish - start;
  };

 // this waits until scrollTop has changed and then sets it back to the target
 scrollTopChecker = ( middleColumn, target, count) =>{

     if(GLOBAL.scrollToTop < target) return;
     GLOBAL.scrollToTop= target;

     console.log('ScrollTopChecker', count, GLOBAL.scrollToTop);
     let scrollTop= middleColumn.scrollTop;
     if( scrollTop == target && count > 0) setTimeout( () => { this.scrollTopChecker( middleColumn, target, count -1) }, 150);
     if( scrollTop != target) { middleColumn.scrollTop = target;  GLOBAL.scrollToTop= 9999999; }
     if(count == 0) GLOBAL.scrollToTop= 9999999;
 }

  generalMessageIsNullHighlighting = (textNode) => {
    if (textNode.textContent == 'General Message') {
      const parentToHighlight = $(textNode.parentNode)
        .closest('div.slds-form-element')
        .get(0);
      const shadowRoot =
        parentToHighlight.parentNode.parentNode.host.shadowRoot;
      const slot = shadowRoot.querySelector('slot');
      const slottedElements = slot.assignedElements();
      slottedElements.forEach((element) => {
        if (element.innerText.length > 0) {
          $(parentToHighlight).css({ backgroundColor: 'rgb(245, 183, 153)' });
        }
      });
    }
  };

  closeTheAccessLinkRequestPopup = (textNode) => {
    if (textNode.textContent == 'Access Link Request') {
      let button = $(textNode.parentNode)
        .closest('div.modal-container')
        .find('button[title="Close this window"]');
      if (button.length > 0) {
        button.click();
      }
    }
  };

  displayTimeSpent = () => {
    setTimeout(() => {
      console.log('Time spent:', GLOBAL.totalTimeSpent);
      this.displayTimeSpent();
    }, 1000);
  };

  supportScoreHighlightInPanels = (textNode) => {
    if (textNode.textContent == 'Support Score') {
      this.tryToHighlightSupportScoreInHighlightsPanel(textNode);
    }
  };

  /*
  querySelectorDeep(selector, root) {
    let currentRoot = root;
    let partials = selector.split('::shadow');
    let elems = currentRoot.querySelectorAll(partials[0]);
    for (let i = 1; i < partials.length; i++) {
      let partial = partials[i];
      let elemsInside = [];
      for (let j = 0; j < elems.length; j++) {
        let shadow = elems[j].shadowRoot;
        if (shadow) {
          const matchesInShadow = shadow.querySelectorAll(partial);
          elemsInside = elemsInside.concat([...matchesInShadow]);
        }
      }
      elems = elemsInside;
    }
    return elems;
  }
*/

  tryToHighlightSupportScoreInHighlightsPanel = (textNode) => {

    const host= textNode?.getRootNode()?.host;
    if(!host) return;

    const value= host?.querySelector('lightning-formatted-number')?.value;
    if(!value) return;

    this.supportScoreHighlight($(host), value.toString());
  };

  supportScoreHighlight = (elToHighlight, score) => {
    let number = isNaN(parseFloat(score)) ? 0 : parseFloat(score.replace(',','.'));
    if (number >= GLOBAL.settingsManager.settings.ssRedThreshold) {
      elToHighlight.css(
        'background-color',
        GLOBAL.settingsManager.settings.ssRedColor,
      );
    } else if (number >= GLOBAL.settingsManager.settings.ssOrangeThreshold) {
      elToHighlight.css(
        'background-color',
        GLOBAL.settingsManager.settings.ssOrangeColor,
      );
    } else if (number >= GLOBAL.settingsManager.settings.ssYellowThreshold) {
      elToHighlight.css(
        'background-color',
        GLOBAL.settingsManager.settings.ssYellowColor,
      );
    } else {
      elToHighlight.css(
        'background-color',
        GLOBAL.settingsManager.settings.ssGreenColor,
      );
    }
  };

  /*
 * This DEV on is no longer in use and has been replaced by a screen flow
 *
  findEscalatedToT3OrDevWarning = (textNode) => {
    if (
      textNode.textContent ==
      'WARNING!!! This case has already been escalated to Tier 3 or Dev. Do not click save!'
    ) {
      let container = $(textNode.parentNode).closest('div.uiTabset--base');
      let li = container.find('span.title:contains("T3")').closest('li');
      li.hide();
      $('span.title:contains("Post")').click();
    }
  };
*
*/

  findFilesSection = (textNode) => {
    if (textNode.textContent == 'Files') {
      let panel = $(textNode.parentNode).closest('.forceListViewManager');
      if (panel.length > 0) this.waitForFileLinks();
    }
  };

  waitForFileLinks = () => {
    setTimeout(() => {
      let fileTabCloseButton = $(`button[title="Close Files"]`);
      console.log('close button', fileTabCloseButton);
      if (fileTabCloseButton.length > 0) {
        GLOBAL.fileTabCloseButton = fileTabCloseButton;
      }
      let fileLinks = $(
        `a:not('.tabHeader')[href*="/ContentDocument/"] span.itemTitle.desktop`,
      );
      if (fileLinks.length > 0) {
        GLOBAL.fileLinks = fileLinks;
        if (typeof GLOBAL.imageUrlResolvedCallback == 'function')
          GLOBAL.imageUrlResolvedCallback(fileLinks);
      } else this.waitForFileLinks();
    }, 100);
  };

  allUrlHyperlinking = (textNode) => {
    if (
      /^(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?$/.test(
        textNode.textContent,
      )
    ) {
      if (!$(textNode.parentNode).is('a')) {
        let url = textNode.textContent;
        let label =
          /^https:\/\/clarizenint\.atlassian\.net\/browse\/CLZDEV-\d*/.test(url)
            ? url.split('/').pop()
            : url;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = label;
        textNode.parentNode.replaceChild(link, textNode);
      } else if (
        /^((https|http|HTTPS|HTTP):\/\/.*(EXP|exp).*(CSIG|csig)[-A-Za-z0-9+&@#\/%?=~_|!:,.;]+[-A-Za-z0-9+&@#\/%=~_|])$/g.test(
          textNode.textContent,
        )
      ) {
        const accessLinkAnchor = $(textNode.parentNode);
        const accessLink = accessLinkAnchor.attr('href');
        const accessLinkExpirationCalculation =
          this.accessLinkExpiration(accessLink);
        let accessLinkExpirationText = accessLinkExpirationCalculation.label;
        let accessLinkColor = accessLinkExpirationCalculation.color;
        accessLinkAnchor.html(accessLinkExpirationText);
        accessLinkAnchor.css('color', accessLinkColor);
      }
    }
  };

  changepointIdHyperlinking = (textNode) => {
    if (/^CP(C|E)-20\d{2,2}-\d{5,5}$/.test(textNode.textContent)) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent;
        let url = `https://desktop.changepointasp.com/core/portlet.aspx?ui=p&portletid=dcrequest&Params=action=edit;reqnum=${id}`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = id;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  agilePlaceIdHyperlinking = (textNode) => {
    if (/^planview\.leankit\.com\/card\/\d{10}$/.test(textNode.textContent)) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent.split('/').reverse()[0];
        let url = `https://${textNode.textContent}`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = id;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  tasktopZendeskIdHyperlinking = (textNode) => {
    if (/^TT-\d\d*\d$/.test(textNode.textContent)) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent.split('-')[1];
        let url = `https://tasktopsupport.zendesk.com/agent/tickets/${id}`;
        setTimeout(() => {
          $(textNode.parentNode).html(
            `<a href="${url}" target="_blank">${textNode.textContent}</a>`,
          );
        }, 100);
      }
    }
  };

  planviewJiraIdHyperlinking = (textNode) => {
    if (/^(REQ|PVE|PVC|req|pve|pvc)\-\d*$/.test(textNode.textContent)) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent;
        let url = `https://jira.planview.com/browse/${id}`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = id;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  tasktopJiraIdHyperlinking = (textNode) => {
    if (
      /^(VIZ|APPS|CON|FC|ROOT|PVC|viz|con|apps|fc|root|pvc)\-\d*$/.test(
        textNode.textContent,
      )
    ) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent;
        let url = `https://tasktop${window.location.href.includes('planview.lightning') ? '' : '-sandbox'}.atlassian.net/browse/${id}`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = id;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  tasktopJiraIdHyperlinkingManyIds = (textNode) => {
    if (
      /^((VIZ|APPS|CON|FC|ROOT|PVC|viz|con|apps|fc|root|pvc)\-\d*\,).*(VIZ|APPS|CON|FC|ROOT|PVC|viz|con|apps|fc|root|pvc)\-\d*$/.test(
        textNode.textContent,
      )
    ) {
      if (!$(textNode.parentNode).is('a')) {
        let ids = textNode.textContent
          .replaceAll(' ', '')
          .replaceAll(',', '%2c');
        let url = `https://tasktop${window.location.href.includes('planview.lightning') ? '' : '-sandbox'}.atlassian.net/browse/${textNode.textContent.split(',')[0]}?jql=key%20in%20(${ids})`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = textNode.textContent;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  sciformaJiraIdHyperlinking = (textNode) => {
    if (
      /^(MIL|mil|SCI|sci|KI|ki|DELIVER|deliver|Deliver|VAN|van|INT|int|OPS|ops)\-\d*$/.test(
        textNode.textContent,
      )
    ) {
      if (!$(textNode.parentNode).is('a')) {
        let id = textNode.textContent;
        let url = `https://sciforma.atlassian.net/browse/${id}`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = id;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  sciformaJiraIdHyperlinkingManyIds = (textNode) => {
    if (
      /^((VIZ|APPS|CON|FC|OPS|ROOT|PVC|viz|con|apps|fc|ops|root|pvc)\-\d*\,).*(VIZ|APPS|CON|FC|OPS|ROOT|PVC|viz|con|apps|fc|ops|root|pvc)\-\d*$/.test(
        textNode.textContent,
      )
    ) {
      if (!$(textNode.parentNode).is('a')) {
        let ids = textNode.textContent
          .replaceAll(' ', '')
          .replaceAll(',', '%2c');
        let url = `https://sciforma.atlassian.net/browse/${textNode.textContent.split(',')[0]}?jql=key%20in%20(${ids})`;
        const link = document.createElement('a');
        link.target = '_blank';
        link.href = url;
        link.textContent = textNode.textContent;
        textNode.parentNode.replaceChild(link, textNode);
      }
    }
  };

  supportScoreInReportsHighlighting1 = (textNode) => {
    if (textNode.textContent == 'Support Score') {
      let parentNode = $(textNode.parentNode);
      let th = parentNode.closest('th');
      let table = parentNode.closest('table');
      if (th.length > 0) {
        let headerIndex = th.index() + 1;
        let spans = table.find(`td:nth-child(${headerIndex}) span.css-13whmom`);
        if (spans.length > 0) {
        }
        spans.each((index, el) => {
          el = $(el);
          let td = el.closest('td');
          this.supportScoreHighlight(td, el.html());
        });
      }
    }
  };

  supportScoreInReportsHighlighting2 = (textNode) => {
    if (/^\d*[.,]\d*$/.test(textNode.textContent)) {
      let el = $(textNode.parentNode);
      let td = this.supportScoreTd(el);
      if (td) {
        this.supportScoreHighlight(td, el.html());
      }
    }
  };

  supportScoreTd = (el) => {
    let td = el.closest('td');
    let dataIndex = td.attr('data-column-index');
    let headerIndex = el
      .closest('table')
      .find(`span[data-tooltip="Support Score"]`)
      .closest('th')
      .attr('data-column-index');
    if (dataIndex && headerIndex && dataIndex == headerIndex) return td;
    return false;
  };

  supportScoreInTableHighlighting = (textNode) => {
    if (isNaN(parseFloat(textNode.textContent)) ) return;

    if(parseFloat(textNode.textContent) < 0 || parseFloat(textNode.textContent)>1000) return;

    const offspringOfTdToHighlight =
      textNode.getRootNode()?.host?.parentNode?.host?.parentNode?.parentNode;
    if (!offspringOfTdToHighlight) return;
    const elToHighlight = $(offspringOfTdToHighlight).closest(
      `td[data-label="Support Score"]`,
    );
    if (!elToHighlight || elToHighlight.length == 0) return;
    this.supportScoreHighlight($(elToHighlight), textNode.textContent);
  };

  escalationLevelHighlightingInLists = (textNode) => {
    if (this.textValuesToMonitor.includes(textNode.textContent)) {
      let table = $(textNode.parentNode).closest(`table`);
      if (table.length > 0) {
        let th1 = $(table).find(`th[title="Case Escalation Level"]`);
        if (th1.length > 0) {
          let headerIndex = th1.index() + 1;
          let spans = table.find(
            `td:nth-child(${headerIndex}) > span.slds-grid.slds-grid_align-spread > span.slds-truncate`,
          );
          spans.each((idx, el) => {
            if (el.innerText.length > 0) {
              const style = this.textHighlightColorMap[el.innerText];
              if (style) $(el).css('background-color', style.bgColor);
            }
          });
        }
      }
    }
  };

  clickOnInternalOnly = (textNode) => {
    if (textNode.textContent == 'Internal Only') {
      if (
        JSON.parse(GLOBAL.settingsManager.settings.autoClickInternalUpdatesTab)
      )
        $(textNode.parentNode).click();
    }
  };

  color = (textNode) => {
    for (let i in this.textMatchStyles) {
      let style = this.textMatchStyles[i];
      if (
        (style.exactMatch && style.text == textNode.textContent) ||
        (!style.exactMatch && textNode.textContent.includes(style.text))
      ) {
        if (
          style.ancestorToHighlight &&
          Array.isArray(style.ancestorToHighlight)
        ) {
          let ancestorFound = false;
          for (let j in style.ancestorToHighlight) {
            let selector = style.ancestorToHighlight[j];
            let closest = $(textNode.parentNode).closest(selector);
            if (closest.length > 0) {
              ancestorFound = true;
              this.styleThis(closest, style);

              // force text color, might not work when set in an ancestor
              this.styleThis($(textNode), style);
              break;
            } else {
                // try 1 web component above
                let closest2= textNode?.getRootNode()?.host;
                closest2= closest2?.closest(selector);
                if (closest2) {
                 ancestorFound = true;
                 this.styleThis($(closest2), style);

                 // force text color, might not work when set in an ancestor
                 textNode.getRootNode()?.host?.style?.setProperty('color', style.textColor);
                 break;
            }
            }
          }
          if (!ancestorFound && style.highlightIfAncestorNotFound) {
            this.styleThis($(textNode.parentNode), style);
          }
          if (
            !ancestorFound &&
            style.highlightIfAncestorNotFound &&
            textNode.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE
          ) {
            const fragmentObserver = new MutationObserver(
              this.textMutationCallback,
            );
            fragmentObserver.observe(textNode, {
              subtree: false,
              childList: false,
              attributes: false,
              characterData: true,
            });
            this.styleThis($(textNode.parentNode.host), style);
          }
        } else {
          this.styleThis($(textNode.parentNode), style);
        }
      }
    }
  };

  textMutationCallback = (mutationsList) => {
    for (let mutation of mutationsList) {
      this.color(mutation.target);
    }
  };

  styleThis = (el, style) => {
    el.css('background-color', style.bgColor);
    el.css('color', style.textColor);
  };

  gatherCaseIdNumberPairs = (textNode) => {
    if (
      /^\d{8}$/.test(textNode.textContent) &&
      $(textNode.parentNode).hasClass('uiOutputText') &&
      $(textNode.parentNode.parentNode).hasClass('test-splitViewCardData')
    ) {
      let caseId = $(textNode.parentNode).closest('a').attr('data-recordid');
      GLOBAL.caseIdNumberPairs[textNode.textContent] = {
        caseNumber: textNode.textContent,
        caseId: caseId,
        textNode: textNode,
        highlighted: false,
      };
      GLOBAL.caseIdNumberPairs[caseId] = {
        caseNumber: textNode.textContent,
        caseId: caseId,
        textNode: textNode,
        highlighted: false,
      };
      this.monitorActiveCasesAsTheyAppear();
    }
  };

  monitorActiveCasesAsTheyAppear = () => {
    GLOBAL.activeCaseId =
      GLOBAL.pathname.split('/')[GLOBAL.pathname.split('/').length - 2];
    if (Object.keys(GLOBAL.caseIdNumberPairs).includes(GLOBAL.activeCaseId)) {
      GLOBAL.activeCaseNumber =
        GLOBAL.caseIdNumberPairs[GLOBAL.activeCaseId].caseNumber;
      this.highlightActiveCase();
    }
  };

  defectRequestMod = (node) => {
    const selectorText = 'Defect Request Issue';
    const selector = `span:contains('${selectorText}')`;
    const results = $(node)
      .find(selector)
      .filter(function () {
        return $(this).text() == selectorText;
      });
    if (results.length > 0) {
      const fieldContent = results.parent().siblings().find('span span');
      if (fieldContent.length > 0) {
        let potentialUrl = fieldContent.html();
        if (
          /^http.*\:\/\/.*\./.test(potentialUrl) &&
          !potentialUrl.includes(' ')
        ) {
          let label =
            /^https:\/\/clarizenint\.atlassian\.net\/browse\/CLZDEV-\d*/.test(
              potentialUrl,
            )
              ? potentialUrl.split('/').pop()
              : potentialUrl;
          fieldContent.html(
            `<a href='${potentialUrl}' target='_blank'>${label}</a>`,
          );
        }
      }
    }
  };

  formatDate = (date) => {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month} ${day} ${year}`;
  };

  accessLinkExpiration = (accessLink) => {
    let searchTerm = 'exp%3D';
    let expPos = accessLink.search(searchTerm);
    if (expPos == -1) {
      searchTerm = 'exp=';
      expPos = accessLink.search(searchTerm);
    }
    const expirationStamp = Number(
      accessLink.substring(
        expPos + searchTerm.length,
        expPos + searchTerm.length + 14,
      ),
    );
    const expirationDate = new Date(
      new Date(expirationStamp).setFullYear(
        new Date(expirationStamp).getFullYear() - 1969,
      ),
    );
    const now = new Date();
    let label,
      color = 'red',
      expired = false;
    if (expirationDate > now) {
      let delta = Math.abs(expirationDate - now) / 1000;
      const days = Math.floor(delta / 86400);
      delta -= days * 86400;
      const hours = Math.floor(delta / 3600) % 24;
      delta -= hours * 3600;
      const minutes = Math.floor(delta / 60) % 60;
      delta -= minutes * 60;
      const seconds = Math.floor(delta) % 60;
      label = `Access link (expires in ${days} days ${hours} hours)`;
      if (days > 5) {
        color = 'green';
      } else if (days >= 1) {
        color = 'orange';
      }
    } else {
      label = `Access link expired on ${this.formatDate(expirationDate)}`;
      expired = true;
    }
    return { label, color, expired };
  };
}

const asyncRequest = (method, url, data, headers) => {
  data = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      data,
      headers,
      onload: function (response) {
        resolve(JSON.parse(response.response));
      },
      onerror: function (error) {
        reject(error);
      },
    });
  });
};

class WhosLooking {
  constructor() {
    this.cooldown = 1000;
    this.caseIdSent = null;
    this.lastMouseActivitySent = null;
    this.lastKeyboardActivitySent = null;
    this.payload = null;
    this.callDetails = null;
  }

  check = () => {
    setTimeout(() => {
      if (
        GLOBAL.settingsManager.settings.userName &&
        GLOBAL.activeCaseId &&
        GLOBAL.mouseMovedOn &&
        (GLOBAL.activeCaseId != this.caseIdSent ||
          GLOBAL.mouseMovedOn != this.lastMouseActivitySent ||
          GLOBAL.keyPressedOn != this.lastKeyboardActivitySent ||
          Date.now() - GLOBAL.whosLookingResponse.timestamp > 10000) // occasionlay check even if there was no user activity
      ) {
        // GLOBAL.userName
        let lastActivityTimestamp = GLOBAL.keyPressedOn
          ? GLOBAL.keyPressedOn > GLOBAL.mouseMovedOn
            ? GLOBAL.keyPressedOn
            : GLOBAL.mouseMovedOn
          : GLOBAL.mouseMovedOn;
        this.payload = {
          caseId: GLOBAL.activeCaseId,
          name: GLOBAL.settingsManager.settings.userName, // GLOBAL.userName
          lastActivityTimestamp: lastActivityTimestamp,
          lastKeypressTimestamp: GLOBAL.keyPressedOn,
          lastMouseMovement: GLOBAL.mouseMovedOn,
          backgroundColor: GLOBAL.settingsManager.settings.avatarColor,
          version: GLOBAL.version,
        };
        this.callDetails = {
          method: 'POST',
          url: 'http://tam-04a6caab6366.herokuapp.com/whosLookingStatusUpdate',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(this.payload),
          onload: this.updateUI,
        };
        GM_xmlhttpRequest(this.callDetails);
      }
      this.check();
    }, this.cooldown);
  };

  updateUI = (response) => {
    if (response.status == 201) {
      GLOBAL.whosLookingResponse = {
        response: JSON.parse(response.response),
        timestamp: Date.now(),
      };
      this.caseIdSent = this.payload.caseId;
      this.lastMouseActivitySent = this.payload.lastMouseMovement;
      this.lastKeyboardActivitySent = this.payload.lastKeypressTimestamp;
    } else {
      console.log(
        'API error detected. Please get in touch with rpumputis@planview.com for support.',
      );
    }
  };
}

class SettingsManager {
  constructor() {
    this.settingsList = null;
    this.settings = null;
    // Explanation of textMatchStyles properties

    //text - text used for matching
    //exctMatch - used to determine if a partial match is OK
    //ancestorToHighlight - an array containing a list of classes where we expect to find the element.
    //Only the ancestor style will be changed. Trying different selectors from left to right until a match is found.
    //No more selectors tries after for performance reasons
    //highlightIfAncestorNotFound - if set to false, we will highlight the element found by text even if desired
    //ancestor is not found
    this.defaultSettings = {
      textMatchStyles: JSON.stringify([
        {
          text: 'New',
          exactMatch: true,
          bgColor: '#ffd631ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Active',
          exactMatch: true,
          bgColor: '#e33232ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Pending Internal Team Response',
          exactMatch: true,
          bgColor: '#de6e31ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Tier 3 Support',
          exactMatch: true,
          bgColor: '#de6e31ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev',
          exactMatch: true,
          bgColor: '#90ba92ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev - Release Scheduled',
          exactMatch: true,
          bgColor: '#34b738ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev - Review',
          exactMatch: true,
          bgColor: '#90ba92ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops',
          exactMatch: true,
          bgColor: '#82c1beff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops - Scheduled',
          exactMatch: true,
          bgColor: '#1dbbb3ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops - Pending Build',
          exactMatch: true,
          bgColor: '#1dbbb3ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Pending Customer',
          exactMatch: true,
          bgColor: '#3091EC',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'On Hold',
          exactMatch: true,
          bgColor: '#2F3941',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Case Closed',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Closed',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Merged',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Ongoing Activity',
          exactMatch: true,
          bgColor: '#3ba755',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Solution Provided',
          exactMatch: true,
          bgColor: '#2F3941',
          textColor: '#D8DCDE',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Scheduled Task',
          exactMatch: true,
          bgColor: '#3ba755',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Critical',
          exactMatch: true,
          bgColor: '#f30707ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '2 - Major',
          exactMatch: true,
          bgColor: '#e1590fff',
          textColor: '#ffffff',
          ancestorToHighlight: ['button','button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Moderate',
          exactMatch: true,
          bgColor: '#FBC02D',
          textColor: '#333333',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '4 - Minor',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#333333',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Flagged to Case Owner',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Watching',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '2 - Elevated to Manager',
          exactMatch: true,
          bgColor: '#ffe599',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Escalated to Development',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Escalated to PM/Infrastructure team',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight:['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '4 - Global XCAR',
          exactMatch: true,
          bgColor: '#ea9999',
          textColor: '#000000',
          ancestorToHighlight:['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'To: Internal',
          exactMatch: true,
          bgColor: '#FFF6D9',
          textColor: '',
          ancestorToHighlight: ['.cuf-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'Case status updated',
          exactMatch: true,
          bgColor: '#FFF6D9',
          textColor: '',
          ancestorToHighlight: ['.cuf-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'Case updated',
          exactMatch: true,
          bgColor: '#FFF6D9',
          textColor: '',
          ancestorToHighlight: ['.cuf-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'Case created',
          exactMatch: true,
          bgColor: '#FFF6D9',
          textColor: '',
          ancestorToHighlight: ['.cuf-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: '...',
          exactMatch: true,
          bgColor: '#FFF6D9',
          textColor: '',
          ancestorToHighlight: ['.cuf-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'Elite',
          exactMatch: false,
          bgColor: '#ffcb2a',
          textColor: '',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'Premium',
          exactMatch: false,
          bgColor: '#bababa',
          textColor: '',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: false,
        },
        {
          text: 'GREEN',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'AMBER',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'RED',
          exactMatch: true,
          bgColor: '#ea9999',
          textColor: '#000000',
          ancestorToHighlight: ['button','lightning-base-combobox-item','.slds-form-element','td','th'],
          highlightIfAncestorNotFound: true,
        }
      ]),
      avatarColor: '#E34F32',
      enableDownloadAllButton: true,
      downloadAllFormat: 'zip',
      autoClickInternalUpdatesTab: JSON.stringify(false),
      userName: null,
      scrollbarWidth: 5,
      listRefreshRate: 60,
      reportRefreshRate: 0,
      disableListRefresh: false,
      closeAllTabsUsingCtrlQ: false,
      openAllImagesUsingCtrlI: false,
      allUrlHyperlinkingBeta: true,
      autoExpandPosts: false,
      shortenAPUrls: false,
      ssRedThreshold: 90,
      ssOrangeThreshold: 80,
      ssYellowThreshold: 70,
      ssRedColor: '#ea9999',
      ssOrangeColor: '#f5b799',
      ssYellowColor: '#ffe599',
      ssGreenColor: '#d9ead3',
      overrideStandardFeedFont: false,
      customFeedFont: '',
      feedFontFamily: 'Sans-Serif',
      feedFontSize: '12',
      hideEmptyMilestones: true,
      customTextMatchStyles: JSON.stringify([]),
    };
    this.run();
  }

  getSettingsList = () => {
    this.settingsList = GM_listValues();
    return this.settingsList;
  };

  getSettings = () => {
    let settings = {};
    for (let i in this.settingsList) {
      let settingKey = this.settingsList[i];
      settings[settingKey] = GM_getValue(settingKey);
    }
    this.settings = settings;
    return this.settings;
  };

  update = (name, value) => {
    GM_setValue(name, value);
    this.settingsList.push(name);
    this.settings[name] = value;
    return this.settings;
  };

  applyDefaultSettings = () => {
    if (true) {
      //GLOBAL.version == "v20251211" && this.settings["clearedTextMatchStylesInVersion"] != "v20251211"
      this.update('clearedTextMatchStylesInVersion', 'v20251211');
      this.update(
        'textMatchStyles',
        JSON.stringify(
          JSON.parse(this.defaultSettings['textMatchStyles']),
          undefined,
          4,
        ),
      );
      this.getSettingsList();
      this.getSettings();
    }
    // ZIP is now the default.
        const zipDefaultMigrationKey = 'downloadAllZipDefaultApplied';
        if (!this.settings[zipDefaultMigrationKey]) {
            this.update('downloadAllFormat', 'zip');
            this.update(zipDefaultMigrationKey, true);
        }
    for (let settingKey in this.defaultSettings) {
      if (!Object.keys(this.settings).includes(settingKey)) {
        this.settings[settingKey] = this.defaultSettings[settingKey];
      }
    }
    return this.settings;
  };

  run = () => {
    this.getSettingsList();
    this.getSettings();
    this.applyDefaultSettings();
  };
}

class UIinjector {
  constructor() {
    this.userName = null;
    this.addStyles();
    this.uiEvents();
    this.injectHideLeftColumnButton();
    this.whosLookingText = null;
    this.whosLookingResponseTimestamp = null;
    this.chatLoader = null;
    this.environment = 'prd';
  }

  injectHideLeftColumnButton = (count = 0) => {
    console.log('injectHideLeftColumnButton');

    // Check if the button is already there and abort if so.
    // By default, deepQuerySelector only finds visible elements and thus will not be fooled
    // if the button already exists in some other, hidden tabs
    if (deepQuerySelector('#roland_hideLeftColumnButton') != null) return;
    if (deepQuerySelector('#roland_showLeftColumnButton') != null) return;

    // Check if we're on a 3 column page
    let recordHome = deepQuerySelector(
      'flexipage-record-home-three-col-template-desktop2',
    );

    // The following searches should be very fast as they start in the record page and don't search the entire document.
    // Even without the sliding effect, we'd need to modify css on all these elements to hide the left column
    let highlights =
      recordHome == null
        ? null
        : deepQuerySelector(
            'div.highlights > div > div.slds-grid.slds-col.slds-has-flexi-truncate',
            recordHome.children,
          );
    let leftColumn =
      recordHome == null
        ? null
        : deepQuerySelector(
            'flexipage-record-home-scrollable-column.col.left-col.slds-col',
            recordHome.children,
          );
    let middleColumn =
      recordHome == null
        ? null
        : deepQuerySelector(
            'flexipage-record-home-scrollable-column.col.main-col.slds-col',
            recordHome.children,
          );
    let rightColumn =
      recordHome == null
        ? null
        : deepQuerySelector(
            'flexipage-record-home-scrollable-column.col.right-col.slds-col',
            recordHome.children,
          );
    let groupDiv =
      recordHome == null
        ? null
        : deepQuerySelector('div.grouping', recordHome.children);

    // if we don't have all required components rendered yet, check back a bit later
    if (
      highlights == null ||
      groupDiv == null ||
      leftColumn == null ||
      middleColumn == null ||
      rightColumn == null
    ) {
      if (count < 10) {
        setTimeout(() => {
          this.injectHideLeftColumnButton(count + 1);
        }, 500);
      }
    } else {
      let butHide = this.hideLeftColumnButtonTemplate(true, true);
      let butShow = this.hideLeftColumnButtonTemplate(false, false);

      let el = {
        highlights: highlights[0],
        butShow: butShow,
        butHide: butHide,
        leftColumn: leftColumn[0],
        middleColumn: middleColumn[0],
        rightColumn: rightColumn[0],
        groupDiv: groupDiv[0],
      };

      butShow.addEventListener('click', (e) => {
        this.setLeftColumnWidth(el, 5, 25, 1);
      });
      butHide.addEventListener('click', (e) => {
        this.setLeftColumnWidth(el, 20, 0, -1);
      });

      highlights[0].insertBefore(butHide, highlights[0].firstChild);
      highlights[0].insertBefore(butShow, highlights[0].firstChild);

      if (GLOBAL.hideLeftColumn) this.setLeftColumnWidth(el, 0, 0, 0);
    }
  };

  //
  // Set the width of the left column and adjust other involved elements accordingly
  // Hide the left column when the width reaches 0
  // input el: the elemenst involved
  //      curpct: current percentage to set
  //     destpct: destination percentage
  //        incr: increment for each step of the slide
  //
  setLeftColumnWidth = (el, curpct, destpct, incr) => {
    // make sure current percentage remains between 0 and destination percentage
    curpct = incr > 0 && curpct > destpct ? destpct : curpct;
    curpct = incr < 0 && curpct < 0 ? 0 : curpct;

    // remember if we should default to left column hidden when the next window is opened
    GLOBAL.hideLeftColumn = curpct == 0;

    el.butShow.style.display = curpct == 0 ? 'block' : 'none';
    el.butHide.style.display = curpct == 0 ? 'none' : 'block';
    el.leftColumn.style.display = curpct == 0 ? 'none' : 'block';

    el.groupDiv.style.width = 100 - curpct + '%';
    el.leftColumn.style.width = curpct + '%';
    el.middleColumn.style.width = ((100 - curpct) * 3) / 4 + '%';
    el.rightColumn.style.width = (100 - curpct) / 4 + '%';

    // forces a resiz of the highlights buttonbar
    window.dispatchEvent(new Event('resize'));

    // if an increment is specified and destination percentage not reached
    // do another iteration
    if (incr != 0 && curpct != destpct) {
      setTimeout(() => {
        this.setLeftColumnWidth(el, curpct + incr, destpct, incr);
      }, 50);
    }
  };

  //
  // Returns a left column collapse or expand button
  // Not as string but as object so we can add an event handler
  //
  hideLeftColumnButtonTemplate = (hide, display) => {
    let but = document.createElement('button');
    but.id = hide
      ? 'roland_hideLeftColumnButton'
      : 'roland_showLeftColumnButton';
    but.style = `display: ${display ? 'block' : 'none'}; border: none; padding-left: 0px`;
    but.title = hide ? 'Hide left column' : 'Show left column';
    but.border = 'none';
    but.innerHTML = `<svg focusable="false" viewBox="0 0 520 520" part="icon"  class="slds-button__icon">
                      <path d="${
                        hide
                          ? 'M380 83v354c0 10-13 17-22 9L146 273c-8-6-8-19 0-25L358 73c9-7 22-1 22 10'
                          : 'M146 83v354c0 10 13 17 22 9L380 273c8-6 8-19 0-25L168 73c-9-7-22-1-22 10'
                      }" >
                      </path>
                   </svg>`;

    return but;
  };

  addStyles = () => {
    GM_addStyle(GM_getResourceText('popupStyleCSS'));
    GM_addStyle(GM_getResourceText('jQueryUIcss'));
    GM_addStyle(`
            ::-webkit-scrollbar {
                width: ${GLOBAL.settingsManager.settings.scrollbarWidth}px;
                height: ${GLOBAL.settingsManager.settings.scrollbarWidth}px;
            }
            .big-blue-button {
            background-color: rgb(1, 118, 211);
            text-decoration: none;
            color: white;
            padding: 10px;
            font-size: large;
            font-weight: bolder;
            border-radius: 0.25rem;
            cursor: pointer;
                display: inline-block;
                margin-right: 10px;
        }
        #roland-ui-mods-header-buttons {
            left: 100px;
            position: absolute;
        }`);
    GM_addStyle(`.roland-ui-mods-whoslooking-indicator {
            background-color: ${GLOBAL.settingsManager.settings.avatarColor};
            color: white;
            padding: 3px 7px 1px 7px;
            font-size: medium;
            font-weight: bolder;
            border-radius: 0.25rem;
            cursor: help;
            margin-right: 3px;
            display: inline-block;
        }
        .tiblock {
            align-items: center;
            display: flex;
            height: 8px;
        }
        .ticontainer .tidot {
            background-color: white;
        }
        .tidot {
            -webkit-animation: mercuryTypingAnimation 1.5s infinite ease-in-out;
            border-radius: 2px;
            display: inline-block;
            height: 4px;
            margin: 2px;
            width: 3px;
        }
        .roland-hide{
            opacity: 0;
        }
        .thomas-ui-mods-modders-indicator {
           padding-left: 8px;
           color: red;
        }
        @-webkit-keyframes mercuryTypingAnimation{
        0%{
        -webkit-transform:translateY(0px)
        }
        28%{
        -webkit-transform:translateY(-5px)
        }
        44%{
        -webkit-transform:translateY(0px)
        }
        }
        .tidot:nth-child(1){
        -webkit-animation-delay:200ms;
        }
        .tidot:nth-child(2){
        -webkit-animation-delay:300ms;
        }
        .tidot:nth-child(3){
        -webkit-animation-delay:400ms;
        }`);
    GM_addStyle(`.big-blue-button:hover {
            background-color: rgb(1, 68, 134);
            color: white;
            text-decoration: none;
        }`);
    GM_addStyle(`.big-blue-button:visited {
            color: white;
            text-decoration: none;
        }`);
    GM_addStyle(`
        .roland-ui-mods-form-heading {
            font-weight: bold;
            font-style: italic;
            border-bottom: 2px solid #ddd;
            margin-bottom: 20px;
            font-size: 15px;
            padding-bottom: 3px;
        }
        .roland-ui-mods-form label{
            display: block;
            margin: 0px 0px 15px 0px;
        }
        .roland-ui-mods-form label > span{
            width: 340px;
            font-weight: bold;
            float: left;
            padding-top: 8px;
            padding-right: 5px;
        }
        .roland-ui-mods-form input.roland-ui-mods-input-field,
        .roland-ui-mods-form .roland-ui-mods-textarea-field {
            box-sizing: border-box;
            -webkit-box-sizing: border-box;
            -moz-box-sizing: border-box;
            border: 1px solid #C2C2C2;
            box-shadow: 1px 1px 4px #EBEBEB;
            -moz-box-shadow: 1px 1px 4px #EBEBEB;
            -webkit-box-shadow: 1px 1px 4px #EBEBEB;
            border-radius: 3px;
            -webkit-border-radius: 3px;
            -moz-border-radius: 3px;
            padding: 7px;
            height: 30px;
            outline: none;
        }
        input[type="color"].ss-color-picker,
        input[type="color"].custom-rule-field {
            height: 30px;
            width: 30px;
            padding: 2px;
            box-sizing: border-box;
            vertical-align: middle;
            cursor: pointer;
        }
        .roland-ui-mods-form .roland-ui-mods-input-field:focus,
        .roland-ui-mods-form .roland-ui-mods-textarea-field:focus {
            border: 1px solid #0C0;
        }
        .roland-ui-mods-form .roland-ui-mods-textarea-field{
            height:300px;
            width: 100%;
            margin-top: 10px;
        }
        .roland-ui-mods-form input[type="checkbox"] {margin-top: 10px;}`);
    GM_addStyle(`
        .inline-edit-trigger {visibility: hidden !important;}
        .slds-form-element:hover .inline-edit-trigger {visibility: visible !important;}
        `);
  };

  showWhosLooking = () => {
    setTimeout(() => {
      if (this.whosLookingText != GLOBAL.whosLookingText) {
        this.whosLookingText = GLOBAL.whosLookingText;
        //console.log(this.whosLookingText);
      }
      if (GLOBAL.whosLookingResponse) {
        // && this.whosLookingResponseTimestamp != GLOBAL.whosLookingResponse.timestamp
        this.whosLookingResponseTimestamp =
          GLOBAL.whosLookingResponse.timestamp;
        this.injectWhosLookingIndicator();
      }
      this.showWhosLooking();
    }, 1000);
  };

  injectWhosLookingIndicator = () => {
    let feedActions = $('div.feedActions.slds-grid');

    $('.roland-ui-mods-whoslooking-indicator').remove();
    $('.thomas-ui-mods-modders-indicator').remove();

    let lookers = ''; // those who look (classic whoslooking)
    let modders = ''; // those who modify the case otherwise

    for (const record of GLOBAL.whosLookingResponse.response.sort(
      (a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp,
    )) {
      let secondsAgo =
        ~~(Date.now() / 1000) - ~~(record.lastActivityTimestamp / 1000);
      let secondsTo20percentOpacity = 100;
      let secondsToShow = 300;
      let opacity =
        1 -
        0.8 *
          (secondsAgo / secondsTo20percentOpacity < 1
            ? secondsAgo / secondsTo20percentOpacity
            : 1);

      if (record.name.startsWith('##info##')) {
        if (secondsAgo < secondsToShow) {
          let timeAgoDisplay =
            secondsAgo < 10
              ? `${secondsAgo}s ago`
              : secondsAgo < 121
                ? `${Math.floor(secondsAgo / 10) * 10}s ago`
                : 'recently';
          modders +=
            (modders != '' ? '<br/>' : '') +
            record.name.slice(8) +
            ' ' +
            timeAgoDisplay;
        }
      } else {
        lookers += this.whosLookingIndicatorTemplate({
          title: `${record.name} was active on this case ${secondsAgo}s ago`,
          initials: this.nameToInitials(record.name),
          opacity: opacity,
          show: secondsToShow < secondsAgo ? false : true,
          isTyping: Date.now() - record.lastKeypressTimestamp < 5000,
          backgroundColor: record.backgroundColor,
        });
      }
    }

    if (modders !== '') {
      feedActions.prepend(
        '<span class="thomas-ui-mods-modders-indicator">' + modders + '</span>',
      );
    }
    if (lookers !== '') {
      feedActions.prepend(lookers);
    }
  };

  nameToInitials = (name) => {
    let nameArr = name.split(' ');
    let initials = '';
    for (let i in nameArr) {
      initials += nameArr[i].charAt(0);
    }
    return initials.toUpperCase();
  };

  setUserName = (userName) => {
    this.userName = userName;
    this.injectSettingsButton();
    this.showWhosLooking();
  };

  whosLookingIndicatorTemplate = (settings) => {
    return settings.show
      ? `<div class='roland-ui-mods-whoslooking-indicator' style='opacity: ${settings.opacity}; background-color: ${settings.backgroundColor}' title='${settings.title}'>
        <div>${settings.initials}</div>
           <div class="ticontainer ${settings.isTyping ? '' : 'roland-hide'}">
               <div class="tiblock">
                   <div class="tidot"></div>
                   <div class="tidot"></div>
                   <div class="tidot"></div>
               </div>
           </div>
       </div>`
      : '';
  };

  settingsButtonTemplate = () => {
    return `<div class="big-blue-button" id='roland-ui-mods-settings-button'>Service Cloud Premium</div>`;
  };

  timesheetsButtonTemplate = () => {
    if (GLOBAL.enableTimesheetsForUsers.includes(this.userName.toLowerCase())) {
      return `<div class="big-blue-button" id='roland-ui-mods-timesheets-button'>Timesheets</div>`;
    } else return ``;
  };

  chatButtonTemplate = () => {
    return `<div class="big-blue-button" id='roland-ui-mods-chat-button'>Chat</div>`;
  };

  headerButtonsTemplate = () => {
    //return `<div id="roland-ui-mods-header-buttons">${this.settingsButtonTemplate()}${this.chatButtonTemplate()}</div>`;
    //return `<div id="roland-ui-mods-header-buttons">${this.settingsButtonTemplate()}${this.timesheetsButtonTemplate()}</div>`;
    return `<div id="roland-ui-mods-header-buttons">${this.settingsButtonTemplate()}</div>`;
  };

  settingsMenuTemplate = () => {
    return `<div class="roland-ui-mods-form">
        <div class="roland-ui-mods-form-heading">Release notes for version: ${GLOBAL.version}</div>
        <ul>
          <li>&bull;&nbsp;Optional auto-expand of internal posts.</li><br>
          <li>&bull;&nbsp;Optional shortening of AgilePlace URLs to show only AP: &lt;cardnumber&gt;.</li><br>
          <li>&bull;&nbsp;Fixed and improved color highlighting.</li><br>
        </ul>
        <br>

        <div class="roland-ui-mods-form-heading">Settings</div>
        <form>
          <label><span>Avatar color</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="avatarColor" id="avatar-color-input" value="${GLOBAL.settingsManager.settings.avatarColor}"/></label>
          <label><span>Enable "Download All Files" button</span><input class="roland-ui-mods-settings-input" data-id="enableDownloadAllButton" type="checkbox" ${GLOBAL.settingsManager.settings.enableDownloadAllButton !== false ? 'checked' : ''}/></label>
          <label><span>Download all files format</span><select class="roland-ui-mods-settings-input" data-id="downloadAllFormat"><option value="zip" ${GLOBAL.settingsManager.settings.downloadAllFormat === 'zip' ? 'selected' : ''}>ZIP file</option><option value="folder" ${GLOBAL.settingsManager.settings.downloadAllFormat === 'folder' ? 'selected' : ''}>Directory (one folder per Case)</option></select></label>
          <label><span>Scrollbar width</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="scrollbarWidth" id="scrollbar-width-input" value="${GLOBAL.settingsManager.settings.scrollbarWidth}"/></label>
          <label><span>Auto-click "Internal Only"</span><input class="roland-ui-mods-settings-input" data-id="autoClickInternalUpdatesTab" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.autoClickInternalUpdatesTab) ? 'checked' : ''}/></label>
          <label><span>Disable list refresh</span><input class="roland-ui-mods-settings-input" data-id="disableListRefresh" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.disableListRefresh) ? 'checked' : ''}/></label>
          <label><span>List refresh rate (in seconds)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="listRefreshRate" value="${GLOBAL.settingsManager.settings.listRefreshRate}"/></label>
          <label><span>Report refresh rate (in seconds)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="reportRefreshRate" value="${GLOBAL.settingsManager.settings.reportRefreshRate}"/></label>
          <label><span>Use CTRL+Q to close all tabs</span><input class="roland-ui-mods-settings-input" data-id="closeAllTabsUsingCtrlQ" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.closeAllTabsUsingCtrlQ) ? 'checked' : ''}/></label>
          <label><span>Use CTRL+I to open all images</span><input class="roland-ui-mods-settings-input" data-id="openAllImagesUsingCtrlI" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.openAllImagesUsingCtrlI) ? 'checked' : ''}/></label>
          <label><span>Hyperlink URLs when possible</span><input class="roland-ui-mods-settings-input" data-id="allUrlHyperlinkingBeta" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.allUrlHyperlinkingBeta) ? 'checked' : ''}/></label>
          <label><span>Auto-expand internal posts</span><input class="roland-ui-mods-settings-input" data-id="autoExpandPosts" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.autoExpandPosts) ? 'checked' : ''}/></label>
          <label><span>Shorten AgilePlace URLs</span><input class="roland-ui-mods-settings-input" data-id="shortenAPUrls" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.shortenAPUrls) ? 'checked' : ''}/></label>
          <label><span>Support Score red threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssRedThreshold" value="${GLOBAL.settingsManager.settings.ssRedThreshold}"/><input type="color" class="ss-color-picker" data-id="ssRedColor" value="${GLOBAL.settingsManager.settings.ssRedColor || '#ea9999'}" style="cursor:pointer;margin-left:6px;vertical-align:middle;"/><input type="text" maxlength="9" class="roland-ui-mods-input-field roland-ui-mods-settings-input ss-color-text" data-id="ssRedColor" value="${GLOBAL.settingsManager.settings.ssRedColor || '#ea9999'}" style="width:72px;"/></label>
          <label><span>Support Score orange threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssOrangeThreshold" value="${GLOBAL.settingsManager.settings.ssOrangeThreshold}"/><input type="color" class="ss-color-picker" data-id="ssOrangeColor" value="${GLOBAL.settingsManager.settings.ssOrangeColor || '#f5b799'}" style="cursor:pointer;margin-left:6px;vertical-align:middle;"/><input type="text" maxlength="9" class="roland-ui-mods-input-field roland-ui-mods-settings-input ss-color-text" data-id="ssOrangeColor" value="${GLOBAL.settingsManager.settings.ssOrangeColor || '#f5b799'}" style="width:72px;"/></label>
          <label><span>Support Score yellow threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssYellowThreshold" value="${GLOBAL.settingsManager.settings.ssYellowThreshold}"/><input type="color" class="ss-color-picker" data-id="ssYellowColor" value="${GLOBAL.settingsManager.settings.ssYellowColor || '#ffe599'}" style="cursor:pointer;margin-left:6px;vertical-align:middle;"/><input type="text" maxlength="9" class="roland-ui-mods-input-field roland-ui-mods-settings-input ss-color-text" data-id="ssYellowColor" value="${GLOBAL.settingsManager.settings.ssYellowColor || '#ffe599'}" style="width:72px;"/></label>
          <label><span>Support Score green (default) color</span><input type="color" class="ss-color-picker" data-id="ssGreenColor" value="${GLOBAL.settingsManager.settings.ssGreenColor || '#d9ead3'}" style="cursor:pointer;vertical-align:middle;"/><input type="text" maxlength="9" class="roland-ui-mods-input-field roland-ui-mods-settings-input ss-color-text" data-id="ssGreenColor" value="${GLOBAL.settingsManager.settings.ssGreenColor || '#d9ead3'}" style="width:72px;"/></label>
          <label><span>Override standard feed font (<span style="text-decoration: underline; color: blue;" title='If disabled, below feed font settings will not be applied.'>info</span>)</span><input class="roland-ui-mods-settings-input" data-id="overrideStandardFeedFont" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.overrideStandardFeedFont) ? 'checked' : ''}/></label>
          <label><span>Custom feed font (<span style="text-decoration: underline; color: blue;" title='If a valid and available font is entered it will be used instead of the below feed font selected in the picklist.'>info</span>)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="customFeedFont" value="${GLOBAL.settingsManager.settings.customFeedFont}"/></label>
          <label><span>Feed font (<span style="text-decoration: underline; color: blue;" title='This will be used if custom feed font is blank'>info</span>)</span><div style='display:inline-block;'><div>${this.feedFontSelectorHTML(GLOBAL.settingsManager.settings.feedFontFamily)}</div><div id='abcxyz' style='padding-top:10px;font-family:${GLOBAL.settingsManager.settings.feedFontFamily};'>ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789</div></div></label>
          <label><span>Feed font size</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="feedFontSize" value="${GLOBAL.settingsManager.settings.feedFontSize}"/></label>

          <div class="roland-ui-mods-form-heading" style="margin-top:12px;">Custom Color Rules</div>
          <p style="font-size:11px;color:#555;margin:4px 0 8px;">Add custom text → color mappings. Matching text overrides the default color; new text is added as a new rule. "Exact" means the full cell text must equal the value.</p>
          <table id="custom-color-rules-table" style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:4px 6px;">Text to match</th>
                <th style="text-align:left;padding:4px 6px;">Background</th>
                <th style="text-align:left;padding:4px 6px;">Text Color</th>
                <th style="text-align:left;padding:4px 6px;">Exact</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="custom-color-rules-body"></tbody>
          </table>
          <button type="button" id="add-custom-color-rule" style="margin-top:6px;cursor:pointer;">+ Add Rule</button>
          <textarea style="display:none;" class="roland-ui-mods-settings-input" data-id="customTextMatchStyles" id="custom-color-rules-json">${JSON.stringify(JSON.parse(GLOBAL.settingsManager.settings.customTextMatchStyles || '[]'))}</textarea>
        </form>
      </div>`; //<label><span>Text match styles</span><textarea class="roland-ui-mods-textarea-field  roland-ui-mods-settings-input" data-id="textMatchStyles">${JSON.stringify(JSON.parse(GLOBAL.settingsManager.settings.textMatchStyles), undefined, 4)}</textarea></label>
  };

  feedFontSelectorHTML = (currentValue) => {
    const fonts = [];
    for (let i in GLOBAL.availableFonts) {
      fonts.push({ name: GLOBAL.availableFonts[i], selected: false });
    }
    let fontsWithFontSelected = fonts.map((font) => {
      font.selected = font.name == currentValue;
      return font;
    });
    return `<select id="feed-font-selector" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="feedFontFamily">
                    ${fontsWithFontSelected.map((font) => {
                      return this.feedFontOptionHTML(font);
                    })}
                </select>`;
  };

  feedFontOptionHTML = (font) => {
    return `<option value="${font.name}" ${font.selected ? `selected ="selected"` : ``}>${font.name}</option>`;
  };

  customColorRuleRowHTML = (rule = {}) => {
    const bg = rule.bgColor || '#ffffff';
    const tc = rule.textColor || '#000000';
    const exact = rule.exactMatch !== false;
    return `<tr class="custom-rule-row">
      <td style="padding:3px 4px;"><input type="text" value="${rule.text || ''}" placeholder="e.g. Active" class="roland-ui-mods-input-field custom-rule-field" data-col="text" style="width:140px;"/></td>
      <td style="padding:3px 4px;">
        <div style="display:flex;align-items:center;gap:4px;">
          <input type="color" value="${bg}" class="custom-rule-field" data-col="bgColor" style="cursor:pointer;"/>
          <input type="text" value="${bg}" maxlength="9" class="roland-ui-mods-input-field custom-rule-field" data-col="bgColor" style="width:72px;"/>
        </div>
      </td>
      <td style="padding:3px 4px;">
        <input type="color" value="${tc}" class="custom-rule-field" data-col="textColor" style="cursor:pointer;"/>
        <input type="text" value="${tc}" maxlength="9" class="roland-ui-mods-input-field custom-rule-field" data-col="textColor" style="width:72px;"/>
      </td>
      <td style="padding:3px 4px;text-align:center;"><input type="checkbox" class="custom-rule-field" data-col="exactMatch" ${exact ? 'checked' : ''}/></td>
      <td style="padding:3px 4px;"><button type="button" class="delete-custom-rule" style="color:red;cursor:pointer;background:none;border:none;font-size:14px;">✕</button></td>
    </tr>`;
  };

  serializeCustomRules = () => {
    const rules = [];
    $('#custom-color-rules-body .custom-rule-row').each((_, row) => {
      const text = $(row).find('[data-col="text"]').first().val().trim();
      if (!text) return;
      rules.push({
        text,
        bgColor: $(row).find('input[type="text"][data-col="bgColor"]').val(),
        textColor: $(row)
          .find('input[type="text"][data-col="textColor"]')
          .val(),
        exactMatch: $(row).find('[data-col="exactMatch"]').is(':checked'),
      });
    });
    $('#custom-color-rules-json').val(JSON.stringify(rules));
  };

  renderCustomRulesTable = () => {
    let stored = '[]';
    try {
      stored = $('#custom-color-rules-json').val() || '[]';
    } catch (e) {}
    const rules = JSON.parse(stored);
    $('#custom-color-rules-body').empty();
    rules.forEach((rule) => {
      $('#custom-color-rules-body').append(this.customColorRuleRowHTML(rule));
    });
  };

  injectSettingsButton = (retrying) => {
    let headerFirstChild = $('div.slds-global-header > div:nth-child(1)');
    if (headerFirstChild.length > 0) {
      GLOBAL.headerFound = true;
      $('div.slds-global-header > div:nth-child(1)').after(
        this.headerButtonsTemplate(),
      );
    } else {
      if (!retrying) {
        setTimeout(() => {
          this.injectSettingsButton(true);
        }, 10000);
      }
    }
  };

  uiEvents = () => {
    $(document).ready(() => {
      $(document)
        .off('click', '#roland-ui-mods-settings-button')
        .on('click', '#roland-ui-mods-settings-button', (e) => {
          this.settingsButtonClicked(e);
          setTimeout(() => this.renderCustomRulesTable(), 80);
        });
      $(document)
        .off('click', '#roland-ui-mods-timesheets-button')
        .on('click', '#roland-ui-mods-timesheets-button', (e) => {
          window.open(
            'https://tam-04a6caab6366.herokuapp.com/timesheetsNew',
            '_blank',
          );
        });
      $(document)
        .off('click', '.tabs__item:not(.roland-ui-mods-chat-button-general)')
        .on(
          'click',
          '.tabs__item:not(.roland-ui-mods-chat-button-general)',
          (e) => {
            const chatTopContainer = $(e.target).closest(
              'div.forceChatterStyle',
            );
            const chatToModify = chatTopContainer.find('div.cuf-feed');
            chatToModify.show();
            $(
              `div.roland-ui-mods-chat-container-${GLOBAL.activeCaseId}`,
            ).remove();
          },
        );
      $(document)
        .off('click', '#feed-font-selector')
        .on('click', '#feed-font-selector', (e) => {
          $('#abcxyz').css('fontFamily', e.target.value);
        });

      $(document)
        .off('click', '#add-custom-color-rule')
        .on('click', '#add-custom-color-rule', () => {
          $('#custom-color-rules-body').append(this.customColorRuleRowHTML());
        });

      $(document)
        .off('click', '.delete-custom-rule')
        .on('click', '.delete-custom-rule', (e) => {
          $(e.target).closest('tr').remove();
          this.serializeCustomRules();
        });

      $(document)
        .off('change input', '.custom-rule-field')
        .on('change input', '.custom-rule-field', (e) => {
          const row = $(e.target).closest('tr');
          const col = $(e.target).data('col');
          if ($(e.target).is('input[type="color"]')) {
            row
              .find(`input[type="text"][data-col="${col}"]`)
              .val($(e.target).val());
          } else if (
            (col === 'bgColor' || col === 'textColor') &&
            $(e.target).is('input[type="text"]')
          ) {
            row
              .find(`input[type="color"][data-col="${col}"]`)
              .val($(e.target).val());
          }
          this.serializeCustomRules();
        });

      $(document)
        .off('change input', '.ss-color-picker, .ss-color-text')
        .on('change input', '.ss-color-picker, .ss-color-text', (e) => {
          const id = $(e.target).data('id');
          if ($(e.target).is('input[type="color"]')) {
            $(`.ss-color-text[data-id="${id}"]`).val($(e.target).val());
          } else {
            $(`.ss-color-picker[data-id="${id}"]`).val($(e.target).val());
          }
        });

      document.addEventListener('mousemove', this.saveMouseMovementTime, false);
      document.addEventListener('keydown', this.saveKeypressTime);
    });
    document.onkeydown = this.keyPress;
  };

  keyPress = (e) => {
    let evtobj = window.event ? event : e;
    if (evtobj.keyCode == 81 && evtobj.ctrlKey) {
      if (GLOBAL.settingsManager.settings.closeAllTabsUsingCtrlQ) {
        this.closeTabs();
      }
    }
    if (evtobj.keyCode == 73 && evtobj.ctrlKey) {
      if (GLOBAL.settingsManager.settings.openAllImagesUsingCtrlI) {
        let viewAllButton = $(
          `a[href*="AttachedContentDocuments"] .view-all-label`,
        );
        if (GLOBAL.fileLinks) {
          this.openImages();
        } else if (viewAllButton.length > 0) {
          viewAllButton.click();
          this.waitForFileLinks();
        }
      }
    }
  };

  waitForFileLinks = async () => {
    if (!GLOBAL.fileLinks) {
      GLOBAL.fileLinks = await new Promise((resolve) => {
        GLOBAL.imageUrlResolvedCallback = resolve;
      });
    }
    this.openImages();
  };

  tryToFindFileLinks = () => {
    console.log('trying to find links');
    let fileLinks = $(
      `a:not('.tabHeader')[href*="/ContentDocument/"] span.itemTitle.desktop`,
    );
    if (fileLinks.length > 0) GLOBAL.fileLinks = fileLinks;
  };

  openImages = async () => {
    GLOBAL.attachedImageUrls = [];
    let buttonsArr = [];
    GLOBAL.fileLinks.each((index, element) => {
      buttonsArr.push(element);
    });
    for (let i in buttonsArr) {
      let button = buttonsArr[i];
      button.click();
      await new Promise((resolve) => {
        GLOBAL.imageUrlResolvedCallback = resolve;
      });
      let closeButton = $(
        'div.forceContentBasePreviewToolbar button[title="Close"]',
      );
      closeButton.click();
    }
    let imagesHtml = this.addImagesToDiv(
      GLOBAL.imageContainerDiv,
      GLOBAL.attachedImageUrls,
    );
    this.showImagePopup(imagesHtml);
  };

  showImagePopup = (imagesHtml) => {
    let popupSettings = {
      title: `Images`,
      content: `<div style="padding: 15px;text-align:center;">${imagesHtml}</div>`,
      buttons: {
        Close: { handler: null },
      }, //optional
      keyEvents: {
        13: { handler: null },
        27: { handler: null },
      }, //optional
      dim: true, //optional, defaults to false
      expandStepDuration: 500, //optional, if not provided, defaults to 300ms
      collapseStepDuration: 300, //optional, if not provided, defaults to 300ms
      expandCallback: null, //optional, if provided, will be called after the expand animation
      collapseCallback: this.closeFilesTab, //optional, if provided, will be called after the collapse animation
    };
    let popup = new Popup(popupSettings);
    popup.keyEvents[13].handler = popup.collapse;
    popup.keyEvents[27].handler = popup.collapse;
    popup.buttons.Close.handler = popup.collapse;
    $('body').append(
      `<div id="roland-ui-mods-image-viewer-popup" style="padding:5px;position:fixed;width:90%;height:90%;top:5%;left:5%;z-index:9000;"></div>`,
    );
    popup.render('roland-ui-mods-image-viewer-popup');
    popup.expand();
  };

  closeFilesTab = () => {
    if (GLOBAL.fileTabCloseButton) GLOBAL.fileTabCloseButton.click();
    console.log('close');
  };

  addImagesToDiv = (div, imageUrls) => {
    let imgHtml = '';
    for (let i in imageUrls) {
      imgHtml += `<img style="border: 1px solid #333;" src='${imageUrls[i]}'><br><br>`;
    }
    div.html(imgHtml);
    this.styleDiv(div);
    return imgHtml;
  };

  styleDiv = (div) => {
    div.css({
      display: 'block',
      overflow: 'scroll',
      'text-align': 'center',
      padding: '100px',
    });
  };

  closeTabs = () => {
    let buttons = $(
      `button.slds-button.slds-button_icon.slds-button_icon-small.slds-button_icon-container[title^="Close "]`,
    );
    if (buttons.length > 0) {
      buttons.click();
    }
  };

  saveMouseMovementTime = () => (GLOBAL.mouseMovedOn = Date.now());

  saveKeypressTime = () => (GLOBAL.keyPressedOn = Date.now());

  getAvailableFonts = async () => {
    const fontCheck = new Set(
      [
        // Windows 10
        'Arial',
        'Arial Black',
        'Bahnschrift',
        'Calibri',
        'Cambria',
        'Cambria Math',
        'Candara',
        'Comic Sans MS',
        'Consolas',
        'Constantia',
        'Corbel',
        'Courier New',
        'Ebrima',
        'Franklin Gothic Medium',
        'Gabriola',
        'Gadugi',
        'Georgia',
        'HoloLens MDL2 Assets',
        'Impact',
        'Ink Free',
        'Javanese Text',
        'Leelawadee UI',
        'Lucida Console',
        'Lucida Sans Unicode',
        'Malgun Gothic',
        'Marlett',
        'Microsoft Himalaya',
        'Microsoft JhengHei',
        'Microsoft New Tai Lue',
        'Microsoft PhagsPa',
        'Microsoft Sans Serif',
        'Microsoft Tai Le',
        'Microsoft YaHei',
        'Microsoft Yi Baiti',
        'MingLiU-ExtB',
        'Mongolian Baiti',
        'MS Gothic',
        'MV Boli',
        'Myanmar Text',
        'Nirmala UI',
        'Palatino Linotype',
        'Segoe MDL2 Assets',
        'Segoe Print',
        'Segoe Script',
        'Segoe UI',
        'Segoe UI Historic',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'SimSun',
        'Sitka',
        'Sylfaen',
        'Symbol',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',
        'Webdings',
        'Wingdings',
        'Yu Gothic',
        // macOS
        'American Typewriter',
        'Andale Mono',
        'Arial',
        'Arial Black',
        'Arial Narrow',
        'Arial Rounded MT Bold',
        'Arial Unicode MS',
        'Avenir',
        'Avenir Next',
        'Avenir Next Condensed',
        'Baskerville',
        'Big Caslon',
        'Bodoni 72',
        'Bodoni 72 Oldstyle',
        'Bodoni 72 Smallcaps',
        'Bradley Hand',
        'Brush Script MT',
        'Chalkboard',
        'Chalkboard SE',
        'Chalkduster',
        'Charter',
        'Cochin',
        'Comic Sans MS',
        'Copperplate',
        'Courier',
        'Courier New',
        'Didot',
        'DIN Alternate',
        'DIN Condensed',
        'Futura',
        'Geneva',
        'Georgia',
        'Gill Sans',
        'Helvetica',
        'Helvetica Neue',
        'Herculanum',
        'Hoefler Text',
        'Impact',
        'Lucida Grande',
        'Luminari',
        'Marker Felt',
        'Menlo',
        'Microsoft Sans Serif',
        'Monaco',
        'Noteworthy',
        'Optima',
        'Palatino',
        'Papyrus',
        'Phosphate',
        'Rockwell',
        'Savoye LET',
        'SignPainter',
        'Skia',
        'Snell Roundhand',
        'Tahoma',
        'Times',
        'Times New Roman',
        'Trattatello',
        'Trebuchet MS',
        'Verdana',
        'Zapfino',
      ].sort(),
    );
    await document.fonts.ready;
    const fontAvailable = new Set();
    for (const font of fontCheck.values()) {
      if (document.fonts.check(`12px "${font}"`)) {
        fontAvailable.add(font);
      }
    }
    GLOBAL.availableFonts = [...fontAvailable.values()];
    return GLOBAL.availableFonts;
  };

  settingsButtonClicked = async (e) => {
    await this.getAvailableFonts();
    let popupSettings = {
      title: `Service Cloud Premium ${GLOBAL.version}`, //optional, if not provided, there will be no title
      content: `<div style="padding: 15px;">${this.settingsMenuTemplate()}</div>`, //optional, if not provided, there will be no content in the popup
      buttons: {
        Cancel: { handler: null },
        Save: { handler: null },
      }, //optional
      keyEvents: {
        13: { handler: null },
        27: { handler: null },
      }, //optional
      dim: true, //optional, defaults to false
      expandStepDuration: 500, //optional, if not provided, defaults to 300ms
      collapseStepDuration: 300, //optional, if not provided, defaults to 300ms
      expandCallback: null, //optional, if provided, will be called after the expand animation
      collapseCallback: null, //optional, if provided, will be called after the collapse animation
    };
    let popup = new Popup(popupSettings);
    //popup.keyEvents[13].handler = partial(saved, popup.collapse);
    popup.keyEvents[27].handler = popup.collapse;
    popup.buttons.Save.handler = partial(this.saved, popup.collapse);
    $('body').append(
      `<div id="roland-ui-mods-settings-popup" style="padding:5px;position:fixed;width:70%;height:70%;top:15%;left:15%;z-index:9000;"></div>`,
    );
    popup.render('roland-ui-mods-settings-popup');
    popup.expand(e);
  };

  saved = (collapse) => {
    let formInputElements = $('.roland-ui-mods-settings-input');
    let newSettings;
    formInputElements.each((index, el) => {
      let element = $(el);
      let value;
      let name = element.attr('data-id');
      if (element.is('input[type="text"]')) {
        value = element.val();
      } else if (element.is('input[type="checkbox"]')) {
        value = element.is(':checked');
      } else if (element.is('textarea')) {
        value = element.val();
      } else if (element.is('select')) {
        value = element.val();
      }
      newSettings = GLOBAL.settingsManager.update(name, value);
    });
    collapse();
    GLOBAL.downloadAllFiles?.synchronizeButton();
  };
}

//GLOBAL vars
const GLOBAL = {
  enableTimesheetsForUsers: [
    'beata genthner',
    'roland pumputis',
    'norbert atienza',
    'warren moorman',
    'sandy meehan',
    'david wallett',
    'dawn pace',
    'andreas plette',
    'thomas bambuch',
    'vincent destailleur',
    'kerryn linse',
    'varun prasad',
  ],
  totalTimeSpentInRolandUImodsScript: 0,
  totalTimeSpent: 0,
  mutationObserverRegistry: null,
  activeCaseNumber: null,
  activeCaseId: null,
  caseIdNumberPairs: {},
  activeCaseStatus: null,
  userName: null,
  profileButton: null,
  pathname: window.location.pathname,
  mouseMovedOn: null,
  keyPressedOn: null,
  headerFound: false,
  attachedImageUrls: [],
  imageUrlResolvedCallback: null,
  imageContainerDiv: null,
  fileLinks: null,
  fileTabCloseButton: null,
  hideLeftColumn: false,
  downloadAllFiles: null,
  version: '2026.11.01.01',
};
// ============================================================
// DOWNLOAD ALL CASE FILES
// ============================================================
const pageWindow = (typeof unsafeWindow !== 'undefined') ?
unsafeWindow : window;
/**********************************************************************
* CONFIGURATION
**********************************************************************/
const BUTTON_ID = 'pv-download-all-button';
const FILE_HOST = 'https://planview.file.force.com';
const REQUEST_TIMEOUT = 120000;
const BUTTON_TOP_PROD = '152px';
const BUTTON_TOP_TRIDENT = '185px';

const BUTTON_TOP = window.location.hostname.includes(
  '--trident.sandbox.lightning.force.com',
)
  ? BUTTON_TOP_TRIDENT
  : BUTTON_TOP_PROD;
const BUTTON_RIGHT = '150px';
/**********************************************************************
* isVisible() / deepQuerySelector() style helpers
*
* Mirrors the pattern used in Service Cloud Premium's own
* isVisible()/deepQuerySelector(): a hidden ancestor (Salesforce
* Console keeps every open Case tab mounted, just hidden) collapses
* descendant bounding rects to 0x0, so filtering on that is enough
* to only scrape the Case tab that is actually on screen.
**********************************************************************/
function downloadAllIsVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}
class DownloadAllFiles {
    static instance = null;
    constructor() {
        DownloadAllFiles.instance = this;
        this.isDownloading = false;
        this.positionListenerAttached = false;
        this.synchronizationScheduled = false;
        this.observerStarted = false;
        this.crcTable = null;
        this.duplicateFileCount = 0;
    }
    log = (...args) => console.log('[PV Download All]', ...args);
    isEnabled = () => GLOBAL.settingsManager?.settings?.enableDownloadAllButton !== false;
    warn = (...args) => console.warn('[PV Download All]', ...args);
    error = (...args) => console.error('[PV Download All]', ...args);
    sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    /******************************************************************
* CASE IDENTIFICATION
******************************************************************/
    getCaseId = () => {
        const path = window.location.pathname;
        let match = path.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/);
        if (match) return match[1];
        match = window.location.href.match(/[?&](?:id|recordId)=([a-zA-Z0-9]{15,18})/);
        if (match) return match[1];
        return null;
    };
    getCaseNumber = () => {
        const titleMatch = document.title.match(/\b(\d{5,10})\b/);
        if (titleMatch) return titleMatch[1];
        const headerSelectors = [
        '.slds-page-header', '.forceHighlightsPanel',
        'records-lwc-highlights-panel', 'lightning-highlights', 'h1'
        ];
        for (const selector of headerSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.innerText || '';
                const match = text.match(/\b(\d{5,10})\b/);
                if (match) return match[1];
            }
        }
        return null;
    };
    getCaseReference = () => {
        const caseNumber = this.getCaseNumber();
        if (caseNumber) return this.sanitizeFilename(caseNumber);
        return this.getCaseId() || 'Attachments';
    };
    isAttachmentsPage = () => {
        const path = window.location.pathname;
        return (
        path.includes('/related/CombinedAttachments/view') ||
        path.includes('/related/Files/view') ||
        path.includes('/related/AttachedContentDocuments/view') ||
        path.includes('/related/Attachments/view')
        );
    };
    /******************************************************************
* GM_xmlhttpRequest WRAPPER
******************************************************************/
    gmRequest = (url, { responseType = 'text', method = 'GET' } = {}) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method, url, responseType, anonymous: false, timeout: REQUEST_TIMEOUT,
                onload: resolve,
                onerror: () => reject(new Error(`Request failed: ${url}`)),
                ontimeout: () => reject(new Error('Request timed out'))
            });
        });
    };
    /******************************************************************
* GET CASE FILES — DOM scraping, scoped to the visible Case tab only
******************************************************************/
   getFilesFromDom = () => {
       const files = [];
       const seen = new Set();
       let duplicateCount = 0;
       const selector =
             'a[href*="/lightning/r/ContentDocument/"],' +
             'a[href*="/lightning/r/Attachment/"]';

       const links =
             typeof deepQuerySelector === 'function'
       ? deepQuerySelector(selector, document, false) || []
       : [...document.querySelectorAll(selector)];

       for (const link of links) {
           if (!downloadAllIsVisible(link)) continue;
           const href = link.getAttribute('href') || '';
           const titleElement = link.querySelector('.itemTitle.desktop');
           const displayName = (
               titleElement?.getAttribute('title') ||
               titleElement?.textContent ||
               link.textContent ||
               ''
           ).trim();

           let match = href.match(
               /\/lightning\/r\/ContentDocument\/([a-zA-Z0-9]{15,18})/
           );
           if (match) {
               const id = match[1];
               const key = `cd:${id}`;
               if (!seen.has(key)) {
                   seen.add(key);
                   files.push({
                       type: 'ContentDocument',
                       id,
                       name: displayName || 'file'
                   });
               } else {
                   duplicateCount++;
                   this.log('Duplicate file ignored:', {
                       id,
                       name: displayName
                   });
               }
               continue;
           }
           match = href.match(
               /\/lightning\/r\/Attachment\/([a-zA-Z0-9]{15,18})/
           );
           if (match) {
               const id = match[1];
               const key = `att:${id}`;
               if (!seen.has(key)) {
                   seen.add(key);
                   files.push({
                       type: 'Attachment',
                       id,
                       name: displayName || 'attachment'
                   });
               } else {
                   duplicateCount++;
                   this.log('Duplicate attachment ignored:', id);
               }
           }
       }
       this.log(
           `Found ${files.length} unique file(s). Ignored ${duplicateCount} duplicate(s).`
       );

       this.duplicateFileCount = duplicateCount;
       return files;
   };
    getCaseFiles = async () => {
        await this.sleep(50);
        return this.getFilesFromDom();
    };
    /******************************************************************
* DOWNLOAD URL / FILENAME
******************************************************************/
    getDownloadUrl = (file) => {
        if (file.type === 'ContentDocument') {
            return `${FILE_HOST}/sfc/servlet.shepherd/document/download/${encodeURIComponent(file.id)}`;
        }
        if (file.type === 'Attachment') {
            return `${FILE_HOST}/servlet/servlet.FileDownload?file=${encodeURIComponent(file.id)}`;
        }
        throw new Error(`Unsupported file type: ${file.type}`);
    };
    getFilenameFromHeaders = (headers, fallbackName, index) => {
        const lines = String(headers || '').split(/\r?\n/);
        const line = lines.find(item => /^content-disposition:/i.test(item));
        const disposition = line ?
        line.substring(line.indexOf(':') + 1).trim() : '';
        const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        if (match) {
        try { return decodeURIComponent(match[1] || match[2]); }
        catch (_) { return match[1] || match[2]; }
    }
        return fallbackName || `file-${String(index + 1).padStart(2, '0')}`;
    };
        downloadFile = async (file, index) => {
        const url = this.getDownloadUrl(file);
        this.log('Downloading:', file.name);
        const response = await this.gmRequest(url, { responseType: 'arraybuffer' });
        if (response.status < 200 || response.status >= 300) {
        throw new Error(`Download failed for "${file.name}".
        HTTP ${response.status}.`);
    }
        const resolvedName = this.getFilenameFromHeaders(response.responseHeaders, file.name, index);
        return { data: new Uint8Array(response.response), name: resolvedName };
    };
        /******************************************************************
        * FILENAME SANITIZATION
        ******************************************************************/
     sanitizeFilename = (name) => {
         let result = String(name ?? 'file')
         .normalize('NFC')
         .replace(/[<>:"/\|?*\u0000-\u001F\u007F]/g, '_')
         .trim()
         .replace(/[ .]+$/g, '');

         if (!result || result === '.' || result === '..') {
             result = 'file';
         }

         const reserved = new Set([
             'CON', 'PRN', 'AUX', 'NUL',
             'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
             'COM6', 'COM7', 'COM8', 'COM9',
             'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5',
             'LPT6', 'LPT7', 'LPT8', 'LPT9'
         ]);

         const base = result.split('.')[0].toUpperCase();

         if (reserved.has(base)) {
             result = `_${result}`;
         }

         // avoid long names
         const maxLength = 180;

         if (result.length > maxLength) {
             const extensionIndex = result.lastIndexOf('.');
             const extension =
                   extensionIndex > 0 ? result.substring(extensionIndex) : '';
             const baseName =
                   extensionIndex > 0
             ? result.substring(0, extensionIndex)
             : result;

             if (extension.length >= maxLength) {
                 result = result.substring(0, maxLength);
             } else {
                 result =
                     baseName.substring(0, maxLength - extension.length) +
                     extension;
             }
         }

         return result;
     };
    makeUniqueFilename = (filename, usedNames) => {
        const safe = this.sanitizeFilename(filename);
        const key = safe.toLowerCase();
        if (!usedNames.has(key)) { usedNames.add(key); return safe; }
        const dot = safe.lastIndexOf('.');
        const base = dot > 0 ?
        safe.substring(0, dot) : safe;
        const extension = dot > 0 ?
        safe.substring(dot) : '';
        let counter = 2;
        while (true) {
            const candidate = `${base} (${counter})${extension}`;
            const candidateKey = candidate.toLowerCase();
            if (!usedNames.has(candidateKey)) { usedNames.add(candidateKey); return candidate; }
            counter++;
        }
    };
    /******************************************************************
* CRC32 / ZIP HELPERS
******************************************************************/
    createCRCTable = () => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) { c = (c & 1) ?
                (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
            table[n] = c >>> 0;
        }
        return table;
    };
    crc32 = (data) => {
        if (!this.crcTable) this.crcTable = this.createCRCTable();
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) { crc = this.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8); }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    };
    write16 = (view, offset, value) => view.setUint16(offset, value, true);
    write32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
    utf8 = (text) => new TextEncoder().encode(text);
    getDosDateTime = () => {
        const date = new Date();
        const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
        const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
        return { dosTime, dosDate };
    };
    createLocalHeader = (filenameBytes, crc, size, dosTime, dosDate) => {
        const header = new Uint8Array(30 + filenameBytes.length);
        const view = new DataView(header.buffer);
        this.write32(view, 0, 0x04034b50); this.write16(view, 4, 20); this.write16(view, 6, 0x0800);
        this.write16(view, 8, 0); this.write16(view, 10, dosTime); this.write16(view, 12, dosDate);
        this.write32(view, 14, crc); this.write32(view, 18, size); this.write32(view, 22, size);
        this.write16(view, 26, filenameBytes.length); this.write16(view, 28, 0);
        header.set(filenameBytes, 30);
        return header;
    };
    createCentralHeader = (entry) => {
        const filenameBytes = this.utf8(entry.filename);
        const header = new Uint8Array(46 + filenameBytes.length);
        const view = new DataView(header.buffer);
        this.write32(view, 0, 0x02014b50); this.write16(view, 4, 20); this.write16(view, 6, 20);
        this.write16(view, 8, 0x0800); this.write16(view, 10, 0); this.write16(view, 12, entry.dosTime);
        this.write16(view, 14, entry.dosDate); this.write32(view, 16, entry.crc); this.write32(view, 20, entry.size);
        this.write32(view, 24, entry.size); this.write16(view, 28, filenameBytes.length); this.write16(view, 30, 0);
        this.write16(view, 32, 0); this.write16(view, 34, 0); this.write16(view, 36, 0); this.write32(view, 38, 0);
        this.write32(view, 42, entry.offset);
        header.set(filenameBytes, 46);
        return header;
    };
    createEndRecord = (entryCount, centralSize, centralOffset) => {
        const data = new Uint8Array(22);
        const view = new DataView(data.buffer);
        this.write32(view, 0, 0x06054b50); this.write16(view, 4, 0); this.write16(view, 6, 0);
        this.write16(view, 8, entryCount); this.write16(view, 10, entryCount);
        this.write32(view, 12, centralSize); this.write32(view, 16, centralOffset); this.write16(view, 20, 0);
        return data;
    };
    /******************************************************************
* ZIP CREATION
******************************************************************/
    createZipBlob = async (files) => {
        const parts = [];
        const centralDirectory = [];
        let offset = 0;
        const usedNames = new Set();
        const caseReference = this.getCaseReference();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateButtonText(`Downloading ${i + 1}/${files.length}...`);
            this.log(`Downloading ${i + 1}/${files.length}:`, file.name);
            const downloaded = await this.downloadFile(file, i);
            const filename = this.makeUniqueFilename(downloaded.name, usedNames);
            const zipPath = `${caseReference}/${filename}`;
            const data = downloaded.data;
            const crc = this.crc32(data);
            const { dosTime, dosDate } = this.getDosDateTime();
            const filenameBytes = this.utf8(zipPath);
            const header = this.createLocalHeader(filenameBytes, crc, data.length, dosTime, dosDate);
            parts.push(header); parts.push(data);
            centralDirectory.push({ filename: zipPath, crc, size: data.length, offset, dosTime, dosDate });
            offset += header.length + data.length;
            if (i % 3 === 0) await this.sleep(0);
        }
        const centralOffset = offset;
        let centralSize = 0;
        for (const entry of centralDirectory) {
            const header = this.createCentralHeader(entry);
            parts.push(header);
            centralSize += header.length;
            offset += header.length;
        }
        const end = this.createEndRecord(centralDirectory.length, centralSize, centralOffset);
        parts.push(end);
        return new Blob(parts, { type: 'application/zip' });
    };
    createZipDirectToDisk = async (files, existingHandle = null) => {
       let handle = existingHandle;
        if (!handle) {
            if (typeof pageWindow.showSaveFilePicker !== 'function') {
                return false;
            }
            handle = await pageWindow.showSaveFilePicker({
                suggestedName: `Case_${this.getCaseReference()}_files.zip`,
                types: [
                    {
                        description: 'ZIP archive',
                        accept: { 'application/zip': ['.zip'] }
                    }
                ]
            });
        }
        const writable = await handle.createWritable();
        const centralDirectory = [];
        let offset = 0;
        const usedNames = new Set();
        const caseReference = this.getCaseReference();
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateButtonText(`Downloading ${i + 1}/${files.length}...`);
                this.log(`Downloading ${i + 1}/${files.length}:`, file.name);
                const downloaded = await this.downloadFile(file, i);
                const filename = this.makeUniqueFilename(downloaded.name, usedNames);
                const zipPath = `${caseReference}/${filename}`;
                const data = downloaded.data;
                const crc = this.crc32(data);
                const { dosTime, dosDate } = this.getDosDateTime();
                const filenameBytes = this.utf8(zipPath);
                const header = this.createLocalHeader(filenameBytes, crc, data.length, dosTime, dosDate);
                await writable.write(header);
                await writable.write(data);
                centralDirectory.push({ filename: zipPath, crc, size: data.length, offset, dosTime, dosDate });
                offset += header.length + data.length;
                await this.sleep(0);
            }
            const centralOffset = offset;
            let centralSize = 0;
            for (const entry of centralDirectory) {
                const header = this.createCentralHeader(entry);
                await writable.write(header);
                centralSize += header.length;
                offset += header.length;
            }
            const end = this.createEndRecord(centralDirectory.length, centralSize, centralOffset);
            await writable.write(end);
            await writable.close();
            return true;
        } catch (e) {
            try { await writable.abort(); } catch (_) {}
            throw e;
        }
    };
    createFolderDirectToDisk = async (
        files,
        existingParentDirectory = null
    ) => {
        let parentDirectory = existingParentDirectory;
        if (!parentDirectory) {
            if (typeof pageWindow.showDirectoryPicker !== 'function') {
                throw new Error(
                    'Folder download requires Chrome or Edge with File System Access API support.'
                );
            }
            parentDirectory = await pageWindow.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads'
            });
        }

        const caseFolderName = `Case_${this.getCaseReference()}_files`;
        const caseDirectory = await parentDirectory.getDirectoryHandle(caseFolderName, { create: true });
        const usedNames = new Set();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateButtonText(`Downloading ${i + 1}/${files.length}...`);
            this.log(`Downloading ${i + 1}/${files.length}:`, file.name);
            const downloaded = await this.downloadFile(file, i);
            let filename = this.makeUniqueFilename(downloaded.name, usedNames);

            this.log('Folder filename:', {
                original: downloaded.name,
                safe: filename
            });

            let fileHandle;

            try {
                fileHandle = await caseDirectory.getFileHandle(filename, {
                    create: true
                });
            } catch (e) {
                this.warn('Filename rejected; using fallback name.', {
                    original: downloaded.name,
                    rejected: filename,
                    error: e.message
                });

                const extension =
                      filename.match(/.[A-Za-z0-9]{1,10}$/)?.[0] || '';
                const fallbackName = `file-${String(i + 1).padStart(2, '0')}${extension}`;
                filename = this.makeUniqueFilename(fallbackName, usedNames);
                fileHandle = await caseDirectory.getFileHandle(filename, {
                    create: true
                });
            }
            const writable = await fileHandle.createWritable();
            try {
                await writable.write(downloaded.data);
                await writable.close();
            } catch (e) {
                try { await writable.abort(); } catch (_) {}
                throw e;
            }
            await this.sleep(0);
        }
        return true;
    };
    saveBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    /******************************************************************
* MAIN DOWNLOAD
******************************************************************/
    downloadAllFiles = async () => {
        if (this.isDownloading) return;
        const caseId = this.getCaseReference();
        const format = GLOBAL.settingsManager.settings.downloadAllFormat || 'zip';
        this.isDownloading = true;
        const button = document.getElementById(BUTTON_ID);
        if (button) { button.disabled = true; button.style.opacity = '0.7'; button.style.cursor = 'wait'; }
        try {
            this.updateButtonText('Loading files...');

            // Synchronous DOM read: no await before the native picker
            const files = this.getFilesFromDom();

            if (!files.length) {
                alert('No files or attachments were found on this page.');
                return;
            }

            let directZipHandle = null;
            let directParentDirectory = null;

            // Open the native picker while the button click is still active
            if (format === 'folder') {
                if (typeof pageWindow.showDirectoryPicker !== 'function') {
                    throw new Error(
                        'Folder download requires Chrome or Edge with File System Access API support.'
                    );
                }

                directParentDirectory = await pageWindow.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'downloads'
                });
            } else if (typeof pageWindow.showSaveFilePicker === 'function') {
                directZipHandle = await pageWindow.showSaveFilePicker({
                    suggestedName: `Case_${this.getCaseReference()}_files.zip`,
                    types: [
                        {
                            description: 'ZIP archive',
                            accept: { 'application/zip': ['.zip'] }
                        }
                    ]
                });
            }

            const duplicateMessage =
                  this.duplicateFileCount > 0
            ? `\n${this.duplicateFileCount} duplicate file(s) skipped.`
            : '';
            this.log(`Starting download of ${files.length} file(s) in ${format} mode.`);

            if (format === 'folder') {
                const success = await this.createFolderDirectToDisk(
                    files,
                    directParentDirectory
                );
                if (success) {
                    this.updateButtonText('Download all files');
                    alert(
                        `Directory created successfully.\n\n` +
                        `Case_${caseId}_files\n` +
                        `${files.length} unique file(s) downloaded.` +
                        duplicateMessage
                    );
                    return;
                }
            }

            if (typeof pageWindow.showSaveFilePicker === 'function') {
                try {
                    const success = await this.createZipDirectToDisk(
                        files,
                        directZipHandle
                    );
                    if (success) {
                        this.updateButtonText('Download all files');
                        alert(
                            `ZIP created successfully.\n\n` +
                            `${files.length} unique file(s) downloaded.` +
                            duplicateMessage
                        );
                        return;
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') {
                        this.log('Save dialog cancelled.');
                        return;
                    }

                    this.error(
                        'Direct-to-disk ZIP creation failed. Falling back to browser download.',
                        e
                    );
                }
            }
            this.updateButtonText('Creating ZIP...');
            const blob = await this.createZipBlob(files);
            this.saveBlob(blob, `Case_${caseId}_files.zip`);
            this.updateButtonText('Download all files');
            alert(
                `ZIP created successfully.\n\n` +
                `${files.length} unique file(s) downloaded.` +
                duplicateMessage
            );
            this.log('ZIP download started.');
        } catch (e) {
            if (e && e.name === 'AbortError') {
                this.log('Directory selection cancelled.');
                return;
            }
            this.error('Download all failed:', e);
            alert(`Download failed.\n\n${e.message || e}`);
        } finally {
            this.isDownloading = false;
            const btn = document.getElementById(BUTTON_ID);
            if (btn) {
                btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
                this.updateButtonText('Download all files');
            }
        }
    };

   //
    synchronizeButtonPosition = (
        button = document.getElementById(BUTTON_ID),
    ) => {
        if (!button) return false;
        const candidates =
              typeof deepQuerySelector === 'function'
        ? deepQuerySelector('button', document, false) || []
        : [...document.querySelectorAll('button')];

        const uploadButton = candidates.find((element) => {
            const label = (element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

            return (
                label === 'Upload Files' &&
                downloadAllIsVisible(element)
            );
        });

        if (!uploadButton) {
            button.style.position = 'fixed';
            button.style.top = BUTTON_TOP;
            button.style.left = 'auto';
            button.style.right = BUTTON_RIGHT;
            return false;
        }

        const uploadPosition = uploadButton.getBoundingClientRect();
        const gap = 8;

        button.style.position = 'fixed';
        button.style.top = `${uploadPosition.top}px`;
        button.style.left = `${
        uploadPosition.left - button.offsetWidth - gap
    }px`;
        button.style.right = 'auto';

        return true;
    };
    /******************************************************************
* BUTTON
******************************************************************/
    createButton = () => {
        let button = document.getElementById(BUTTON_ID);
        if (button) {
            this.synchronizeButtonPosition(button);
            return button;
        }
        button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = 'Download all files';
        button.title = 'Download all Case files as ZIP or Directory';
        Object.assign(button.style, {
            position: 'fixed', top: BUTTON_TOP, right: BUTTON_RIGHT, zIndex: '2147483647',
            padding: '6px 14px', background: '#0176d3', color: '#ffffff', border: 'none',
            borderRadius: '4px', fontFamily: 'Salesforce Sans, Arial, sans-serif',
            fontSize: '13px', fontWeight: '400', lineHeight: '18px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)', cursor: 'pointer', display: 'inline-block', userSelect: 'none'
        });
        button.addEventListener('mouseenter', () => { if (!button.disabled) button.style.filter = 'brightness(0.95)'; });
        button.addEventListener('mouseleave', () => { button.style.filter = ''; });
        button.addEventListener('click', this.downloadAllFiles);
        document.body.appendChild(button);
        this.synchronizeButtonPosition(button);
        if (!this.positionListenerAttached) {
            this.positionListenerAttached = true;
            window.addEventListener('resize', () => {
                this.synchronizeButtonPosition();
            });
        }
        let alignmentAttempts = 0;
        const retryAlignment = () => {
            if (
                this.synchronizeButtonPosition(button) ||
                alignmentAttempts++ >= 20
            ) {
                return;
            }
            setTimeout(retryAlignment, 500);
        };
        retryAlignment();
        return button;
    };
    updateButtonText = (text) => {
        const button = document.getElementById(BUTTON_ID);
        if (button) button.textContent = text;
    };
    /******************************************************************
* PREVIEW DETECTION
******************************************************************/
    hasVisiblePreviewContainer = () => {
        const selectors = ['.forceContentPreviewPlayer', '.forceContentPreviewPlayerDesktop', '.forceContentPreviewViewer', '.lightning-file-preview'];
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) { if (downloadAllIsVisible(element)) return true; }
        }
        return false;
    };
    hasVisiblePreviewDialog = () => {
        const dialogs = document.querySelectorAll('[role="dialog"], section.slds-modal');
        for (const dialog of dialogs) {
            if (!downloadAllIsVisible(dialog)) continue;
            const rect = dialog.getBoundingClientRect();
            const viewportArea = window.innerWidth * window.innerHeight;
            const dialogArea = rect.width * rect.height;
            if (dialogArea < viewportArea * 0.15) continue;
            const previewContent = dialog.querySelector('iframe, img, video, audio, embed, object');
            if (previewContent && downloadAllIsVisible(previewContent)) return true;
        }
        return false;
    };
    isFilePreviewOpen = () => this.hasVisiblePreviewContainer() || this.hasVisiblePreviewDialog();
    hasVisibleApplicationPopup = () => {
        const popupIds = [
            'roland-ui-mods-settings-popup',
            'roland-ui-mods-image-viewer-popup'
        ];

        return popupIds.some((id) => {
            const popup = document.getElementById(id);
            return popup && downloadAllIsVisible(popup);
        });
    };

    updateButtonVisibility = () => {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    const shouldHide =
        this.isFilePreviewOpen() ||
        this.hasVisibleApplicationPopup();

    button.style.display = shouldHide ? 'none' : 'block';
};
    /******************************************************************
* SYNCHRONIZATION WITH SALESFORCE SPA NAVIGATION
******************************************************************/
    synchronizeButton = () => {
        this.synchronizationScheduled = false;
        if (!this.isEnabled() || !this.isAttachmentsPage()) {
            const existing = document.getElementById(BUTTON_ID);
            if (existing) existing.remove();
            return;
        }
        this.createButton();
        this.updateButtonVisibility();

        const button = document.getElementById(BUTTON_ID);
        if (button && button.style.display !== 'none') {
            this.synchronizeButtonPosition(button);
        }
    };
    scheduleSynchronization = () => {
        if (this.synchronizationScheduled) return;
        this.synchronizationScheduled = true;
        setTimeout(this.synchronizeButton, 100);
    };
    startObserver = () => {
        if (this.observerStarted) return;
        this.observerStarted = true;
        const observer = new MutationObserver(() => { this.scheduleSynchronization(); });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
        this.log('MutationObserver started.');
    };
    monitorNavigation = () => {
        let lastUrl = window.location.href;
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) { lastUrl = currentUrl; this.log('Salesforce navigation detected.'); this.scheduleSynchronization(); }
        }, 500);
    };
    /******************************************************************
* ENTRY POINT
******************************************************************/
    run = () => {
        this.log('Salesforce Download All V4.3 (integrated) initialized.');
        this.synchronizeButton();
        this.startObserver();
        this.monitorNavigation();
        setTimeout(this.synchronizeButton, 500);
        setTimeout(this.synchronizeButton, 1500);
        setTimeout(this.synchronizeButton, 3000);
    };
}


//entry function

const rolandUImods = () => {
  console.log('Service Cloud Premium version:', GLOBAL.version);
  GLOBAL.settingsManager = new SettingsManager();
  GLOBAL.downloadAllFiles = new DownloadAllFiles();
  GLOBAL.downloadAllFiles.run();
  GLOBAL.mutationObserverRegistry = new MutationObserverRegistry('Global');
  GLOBAL.mutationObserverRegistry.createObserver();
  GLOBAL.mutationObserverRegistry.observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  }); //, characterData: true,attributes: true childList: true,
  GLOBAL.conditionalFormatting = new ConditionalFormatting();
  GLOBAL.uiInjector = new UIinjector();
  GLOBAL.conditionalFormatting.run();
  GLOBAL.mutationObserverRegistry.addFunctionForNodeAddition(detectUserName);
  exposeUserName();
  const whosLooking = new WhosLooking();
  whosLooking.check();
  refreshLists();
  refreshReports();
};

//global functions

//
// determine if a control is effectively visible or not
//
function isVisible(element) {
  const style = getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.offsetParent !== null
  );
}

//
// recursively traverse dom & shadow dom
// can filter on visible elements only, to avoid finding elements
// in other, hidden tabs
//
function deepQuerySelector(selector, root = document, visibleOnly = true) {
  //console.log('select ' + selector + ' in ' + root.id);

  let allFound = [...root.querySelectorAll(selector)];
  if (visibleOnly) allFound = allFound.filter((el) => isVisible(el));

  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      if (!visibleOnly || isVisible(el)) {
        const result = deepQuerySelector(selector, el.shadowRoot, visibleOnly);
        if (result) allFound.push(...result);
      }
    }
  }

  return allFound.length > 0 ? allFound : null;
}

const refreshLists = () => {
  if (!isNaN(parseFloat(GLOBAL.settingsManager.settings.listRefreshRate))) {
    setTimeout(
      () => {
        if (!GLOBAL.settingsManager.settings.disableListRefresh) {
          let button = $(
            $('button', $('force-list-view-manager-button-bar'))[0],
          );
          if (button.length > 0) {
            button.click();
          }
        }
        refreshLists();
      },
      parseFloat(GLOBAL.settingsManager.settings.listRefreshRate) * 1000,
    );
  }
};

const refreshReports = () => {
  if (
    !isNaN(parseFloat(GLOBAL.settingsManager.settings.reportRefreshRate)) &&
    GLOBAL.settingsManager.settings.reportRefreshRate > 0
  ) {
    setTimeout(
      () => {
        let button = $($('.report-action-refreshReport')[0]);
        if (button.length > 0) {
          button.click();
        }
        refreshReports();
      },
      parseFloat(GLOBAL.settingsManager.settings.reportRefreshRate) * 1000,
    );
  }
};

function partial(func) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function () {
    var allArguments = args.concat(Array.prototype.slice.call(arguments));
    return func.apply(this, allArguments);
  };
}

const detectUserName = (node) => {
  const selector = 'h1.profile-card-name a';
  const results = $(node).find(selector);
  if (results.length > 0) {
    if (
      GLOBAL.profileButton != null &&
      GLOBAL.settingsManager.settings.userName == null
    ) {
      //GLOBAL.userName
      GLOBAL.settingsManager.update('userName', results.html());
      GLOBAL.uiInjector.setUserName(GLOBAL.settingsManager.settings.userName);
      setTimeout(() => {
        GLOBAL.profileButton.click();
      }, 100);
    }
  }
};

const exposeUserName = () => {
  if (GLOBAL.settingsManager.settings.userName == null) {
    const selector = 'button.branding-userProfile-button';
    const results = $(selector);
    if (results.length > 0) {
      GLOBAL.profileButton = results.get(0);
      tryOpeningProfilePopupToLookForName();
    } else {
      setTimeout(() => {
        exposeUserName();
      }, 15000);
    }
  } else {
    GLOBAL.uiInjector.setUserName(GLOBAL.settingsManager.settings.userName);
  }
};

const tryOpeningProfilePopupToLookForName = () => {
  if (GLOBAL.settingsManager.settings.userName == null) {
    //GLOBAL.userName
    GLOBAL.profileButton.click();
    setTimeout(() => {
      let h1 = $('h1.profile-card-name');
      if (h1.length == 0) {
        tryOpeningProfilePopupToLookForName();
      }
    }, 15000);
  }
};

if (window.location.href.indexOf('/email/htmlbody/htmlbody.jsp') === -1) {
  rolandUImods();
}

// ============================================================
// EMAIL EDITOR FULLSCREEN TOGGLE
// ============================================================
// Works by running in both the parent Lightning page and the email-editor
// iframe (htmlbody.jsp). The iframe sends a postMessage ping; the parent
// receives it, locates the matching <iframe> element (piercing shadow DOM),
// and attaches a fullscreen toggle button as a sibling of the iframe.
// Fullscreen styling targets the iframe ELEMENT itself in the parent DOM,
// so 100vw/100vh refer to the real browser viewport, not the iframe's.

(function () {
  'use strict';

  const SCP_PING_TYPE = 'scp_email_iframe_ping';
  const SCP_PONG_TYPE = 'scp_email_iframe_pong';
  const isInIframe = window.top !== window.self;
  const pageHref = window.location.href;

  const css = `
        .scp-fullscreen-toggle {
            position: absolute;
            top: 6px;
            right: 12px;
            z-index: 100000;
            background: #0176d3;
            color: #ffffff;
            border: 1px solid #014486;
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .scp-fullscreen-toggle:hover {
            background: #014486;
        }
        .scp-fullscreen-toggle.scp-fs-active {
            position: fixed;
            top: 12px;
            right: 20px;
        }
        iframe.scp-email-iframe-fullscreen {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 99998 !important;
            background: #ffffff !important;
            box-shadow: 0 0 40px rgba(0,0,0,0.4) !important;
            border: none !important;
        }
    `;
  try {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
    } else {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
  } catch (e) {
    /* ignore */
  }

  // ============================================================
  // IFRAME SIDE: send pings so the parent can find this iframe element
  // ============================================================
  if (isInIframe && pageHref.indexOf('/email/htmlbody/htmlbody.jsp') !== -1) {
    const sendPing = function () {
      try {
        window.parent.postMessage(
          { type: SCP_PING_TYPE, href: pageHref },
          'https://planview.lightning.force.com',
        );
      } catch (e) {
        /* ignore */
      }
    };
    sendPing();
    setTimeout(sendPing, 500);
    setTimeout(sendPing, 1500);
    setTimeout(sendPing, 3000);
    window.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'scp_fullscreen_entered') {
        document.documentElement.style.overflow = 'auto';
        if (document.body) document.body.style.overflow = 'auto';
        var ckeContents = document.getElementById('cke_1_contents');
        if (ckeContents) {
          var toolbar = document.querySelector('.cke_top');
          var availableH =
            window.innerHeight - (toolbar ? toolbar.offsetHeight : 0);
          ckeContents._scpOrigH = ckeContents.style.height;
          ckeContents._scpOrigOvf = ckeContents.style.overflow;
          ckeContents.style.height = availableH + 'px';
          ckeContents.style.overflow = 'hidden';
          var inner = ckeContents.querySelector('iframe');
          if (inner) {
            inner._scpOrigH = inner.style.height;
            inner.style.height = availableH + 'px';
          }
        }
      } else if (e.data.type === 'scp_fullscreen_exited') {
        document.documentElement.style.overflow = '';
        if (document.body) document.body.style.overflow = '';
        var ckeContents = document.getElementById('cke_1_contents');
        if (ckeContents) {
          ckeContents.style.height = ckeContents._scpOrigH || '';
          ckeContents.style.overflow = ckeContents._scpOrigOvf || '';
          var inner = ckeContents.querySelector('iframe');
          if (inner) inner.style.height = inner._scpOrigH || '';
        }
      }
    });
    return;
  }

  // ============================================================
  // PARENT SIDE: listen for pings, attach toggle to the iframe element
  // ============================================================
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== SCP_PING_TYPE) return;
    const iframe = findEmailIframeElement(e.source);
    if (iframe) {
      attachFullscreenToggle(iframe);
      try {
        e.source.postMessage(
          { type: SCP_PONG_TYPE },
          'https://planview.lightning.force.com',
        );
      } catch (err) {
        /* ignore */
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const fsIframe = document.querySelector(
        'iframe.scp-email-iframe-fullscreen',
      );
      if (fsIframe) exitFullscreen(fsIframe);
    }
  });

  function findEmailIframeElement(sourceWindow) {
    const stack = [document.documentElement];
    let safety = 50000;
    while (stack.length && safety-- > 0) {
      const node = stack.pop();
      if (!node) continue;
      if (node.tagName === 'IFRAME') {
        try {
          if (node.contentWindow === sourceWindow) return node;
        } catch (e) {
          /* cross-origin - skip */
        }
      }
      if (node.shadowRoot) {
        const kids = node.shadowRoot.children;
        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++)
          stack.push(node.children[i]);
      }
    }
    return null;
  }

  function attachFullscreenToggle(iframe) {
    try {
      if (
        iframe.style.height === '' ||
        parseInt(iframe.style.height, 10) < 582
      ) {
        iframe.style.height = '582px';
      }
    } catch (e) {
      /* ignore */
    }

    const parentEl = iframe.parentElement;
    if (!parentEl) return;

    if (parentEl.querySelector(':scope > .scp-fullscreen-toggle')) return;

    if (getComputedStyle(parentEl).position === 'static') {
      parentEl.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scp-fullscreen-toggle';
    btn.title = 'Toggle fullscreen email editor (Esc to exit)';
    btn.innerHTML = '⛶ Fullscreen';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (iframe.classList.contains('scp-email-iframe-fullscreen')) {
        exitFullscreen(iframe);
      } else {
        enterFullscreen(iframe);
      }
    });
    parentEl.appendChild(btn);
  }

  function enterFullscreen(iframe) {
    iframe.classList.add('scp-email-iframe-fullscreen');
    const btn =
      iframe.parentElement &&
      iframe.parentElement.querySelector(':scope > .scp-fullscreen-toggle');
    if (btn) {
      btn.classList.add('scp-fs-active');
      btn.innerHTML = '✕ Exit fullscreen';
    }
    document.body.style.overflow = 'hidden';
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc) {
        iframe._scpPrevDocOverflow = doc.documentElement.style.overflow;
        iframe._scpPrevBodyOverflow = doc.body ? doc.body.style.overflow : '';
        doc.documentElement.style.overflow = 'auto';
        if (doc.body) doc.body.style.overflow = 'auto';
      }
    } catch (e) {
      /* cross-origin guard */
    }
    try {
      iframe.contentWindow.postMessage({ type: 'scp_fullscreen_entered' }, '*');
    } catch (e) {}
  }

  function exitFullscreen(iframe) {
    iframe.classList.remove('scp-email-iframe-fullscreen');
    const btn =
      iframe.parentElement &&
      iframe.parentElement.querySelector(':scope > .scp-fullscreen-toggle');
    if (btn) {
      btn.classList.remove('scp-fs-active');
      btn.innerHTML = '⛶ Fullscreen';
    }
    document.body.style.overflow = '';
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc) {
        doc.documentElement.style.overflow = iframe._scpPrevDocOverflow || '';
        if (doc.body)
          doc.body.style.overflow = iframe._scpPrevBodyOverflow || '';
      }
    } catch (e) {
      /* cross-origin guard */
    }
    try {
      iframe.contentWindow.postMessage({ type: 'scp_fullscreen_exited' }, '*');
    } catch (e) {}
  }
})();
