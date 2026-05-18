// ==UserScript==
// @name         Service Cloud Premium 3
// @namespace    https://github.com/sadnalor/tampermonkeys
// @version      2026.05.18.0
// @author       Roland
// @description  Internal Salesforce Service Cloud helper
//
// @include      /.*planview.lightning.force.*/
// @include      /.*planview--trident.lightning.force.*/
// @include      /.*planview--trident.sandbox.lightning.force.*/
// @include      /.*planview--partialsb.lightning.force.*/
// @include      /.*planview--partialsb.sandbox.lightning.force.*/
//
// @connect      whoslookingatcases.herokuapp.com
// @connect      servicecloudpremium-781150c5a240.herokuapp.com
// @connect      tam-04a6caab6366.herokuapp.com
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
      this.findEscalatedToT3OrDevWarning(textNode);
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
    const finish = Date.now();
    GLOBAL.totalTimeSpent += finish - start;
  };

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
      let topLevel = $(textNode.parentNode).closest('div.slds-form-element');
      let numberSpan = topLevel.find('span.uiOutputNumber');
      this.supportScoreHighlight(topLevel, numberSpan.html());
    }
  };

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

  tryToHighlightSupportScoreInHighlightsPanel = (textNode) => {
    this.supportScoreHighlight(
      $(textNode.parentNode.parentNode),
      this.querySelectorDeep(`slot`, textNode.parentNode.parentNode)?.[0]
        ?.innerText,
    );
  };

  supportScoreHighlight = (elToHighlight, score) => {
    let number = isNaN(parseFloat(score)) ? 0 : parseFloat(score);
    if (number > GLOBAL.settingsManager.settings.ssRedThreshold) {
      elToHighlight.css('background-color', '#ea9999');
    } else if (number > GLOBAL.settingsManager.settings.ssOrangeThreshold) {
      elToHighlight.css('background-color', '#f5b799');
    } else if (number > GLOBAL.settingsManager.settings.ssYellowThreshold) {
      elToHighlight.css('background-color', '#ffe599');
    } else {
      elToHighlight.css('background-color', '#d9ead3');
    }
  };

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
    if (/^\d*\.\d*$/.test(textNode.textContent)) {
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
    if (isNaN(textNode.textContent)) return;
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
              break;
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
          GLOBAL.keyPressedOn != this.lastKeyboardActivitySent)
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
          url: 'http://servicecloudpremium-781150c5a240.herokuapp.com/whosLookingStatusUpdate',
          data: JSON.stringify(this.payload),
          onload: this.updateUI,
        };
        GM_xmlhttpRequest(this.callDetails);
      }
      this.check();
    }, this.cooldown);
  };

  updateUI = (response) => {
    if (response.status == 200) {
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
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Active',
          exactMatch: true,
          bgColor: '#e33232ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Pending Internal Team Response',
          exactMatch: true,
          bgColor: '#de6e31ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Tier 3 Support',
          exactMatch: true,
          bgColor: '#de6e31ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev',
          exactMatch: true,
          bgColor: '#90ba92ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev - Release Scheduled',
          exactMatch: true,
          bgColor: '#34b738ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Dev - Review',
          exactMatch: true,
          bgColor: '#90ba92ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops',
          exactMatch: true,
          bgColor: '#82c1beff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops - Scheduled',
          exactMatch: true,
          bgColor: '#1dbbb3ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'In Cloud Ops - Pending Build',
          exactMatch: true,
          bgColor: '#1dbbb3ff',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Pending Customer',
          exactMatch: true,
          bgColor: '#3091EC',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'On Hold',
          exactMatch: true,
          bgColor: '#2F3941',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Case Closed',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Closed',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Merged',
          exactMatch: true,
          bgColor: '#eaedf0ff',
          textColor: '#000',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Ongoing Activity',
          exactMatch: true,
          bgColor: '#3ba755',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Solution Provided',
          exactMatch: true,
          bgColor: '#2F3941',
          textColor: '#D8DCDE',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Critical',
          exactMatch: true,
          bgColor: '#f30707ff',
          textColor: '#ffffff',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '2 - Major',
          exactMatch: true,
          bgColor: '#e1590fff',
          textColor: '#ffffff',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Moderate',
          exactMatch: true,
          bgColor: '#FBC02D',
          textColor: '#333333',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '4 - Minor',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#333333',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Flagged to Case Owner',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '1 - Watching',
          exactMatch: true,
          bgColor: '#d9ead3',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '2 - Elevated to Manager',
          exactMatch: true,
          bgColor: '#ffe599',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Escalated to Development',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '3 - Escalated to PM/Infrastructure team',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: '4 - Global XCAR',
          exactMatch: true,
          bgColor: '#ea9999',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
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
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'AMBER',
          exactMatch: true,
          bgColor: '#f5b799',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'RED',
          exactMatch: true,
          bgColor: '#ea9999',
          textColor: '#000000',
          ancestorToHighlight: ['.slds-form-element'],
          highlightIfAncestorNotFound: true,
        },
        {
          text: 'Scheduled Task',
          exactMatch: true,
          bgColor: '#3ba755',
          textColor: '#ffffff',
          ancestorToHighlight: [],
          highlightIfAncestorNotFound: true,
        },
      ]),
      avatarColor: '#E34F32',
      autoClickInternalUpdatesTab: JSON.stringify(false),
      userName: null,
      scrollbarWidth: 5,
      listRefreshRate: 60,
      reportRefreshRate: 0,
      disableListRefresh: false,
      closeAllTabsUsingCtrlQ: false,
      openAllImagesUsingCtrlI: false,
      allUrlHyperlinkingBeta: true,
      ssRedThreshold: 90,
      ssOrangeThreshold: 80,
      ssYellowThreshold: 70,
      overrideStandardFeedFont: false,
      customFeedFont: '',
      feedFontFamily: 'Sans-Serif',
      feedFontSize: '12',
      hideEmptyMilestones: true,
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
    this.whosLookingText = null;
    this.whosLookingResponseTimestamp = null;
    this.chatLoader = null;
    this.environment = 'prd';
  }

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
            outline: none;
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
    for (let i in GLOBAL.whosLookingResponse.response) {
      let record = GLOBAL.whosLookingResponse.response[i];
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
      feedActions.prepend(
        this.whosLookingIndicatorTemplate({
          title: `${record.name} was active on this case ${secondsAgo}s ago`,
          initials: this.nameToInitials(record.name),
          opacity: opacity,
          show: secondsToShow < secondsAgo ? false : true,
          isTyping: Date.now() - record.lastKeypressTimestamp < 5000,
          backgroundColor: record.backgroundColor,
        }),
      );
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
    return `<div id="roland-ui-mods-header-buttons">${this.settingsButtonTemplate()}${this.timesheetsButtonTemplate()}</div>`;
  };

  settingsMenuTemplate = () => {
    return `<div class="roland-ui-mods-form">
        <div class="roland-ui-mods-form-heading">Release notes for version: ${GLOBAL.version}</div>
        <ul>
          <li>&bull;&nbsp;"PVC" id support for Jason's team</li><br>
          <li>&bull;&nbsp;Color updates on the new statuses</li><br>
        </ul>
        <br>
  
        <div class="roland-ui-mods-form-heading">Settings</div>
        <form>
          <label><span>Avatar color</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="avatarColor" id="avatar-color-input" value="${GLOBAL.settingsManager.settings.avatarColor}"/></label>
          <label><span>Scrollbar width</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="scrollbarWidth" id="scrollbar-width-input" value="${GLOBAL.settingsManager.settings.scrollbarWidth}"/></label>
          <label><span>Auto-click "Internal Only"</span><input class="roland-ui-mods-settings-input" data-id="autoClickInternalUpdatesTab" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.autoClickInternalUpdatesTab) ? 'checked' : ''}/></label>
          <label><span>Disable list refresh</span><input class="roland-ui-mods-settings-input" data-id="disableListRefresh" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.disableListRefresh) ? 'checked' : ''}/></label>
          <label><span>List refresh rate (in seconds)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="listRefreshRate" value="${GLOBAL.settingsManager.settings.listRefreshRate}"/></label>
          <label><span>Report refresh rate (in seconds)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="reportRefreshRate" value="${GLOBAL.settingsManager.settings.reportRefreshRate}"/></label>
          <label><span>Use CTRL+Q to close all tabs</span><input class="roland-ui-mods-settings-input" data-id="closeAllTabsUsingCtrlQ" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.closeAllTabsUsingCtrlQ) ? 'checked' : ''}/></label>
          <label><span>Use CTRL+I to open all images</span><input class="roland-ui-mods-settings-input" data-id="openAllImagesUsingCtrlI" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.openAllImagesUsingCtrlI) ? 'checked' : ''}/></label>
          <label><span>Hyperlink URLs when possible</span><input class="roland-ui-mods-settings-input" data-id="allUrlHyperlinkingBeta" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.allUrlHyperlinkingBeta) ? 'checked' : ''}/></label>
          <label><span>Support Score red threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssRedThreshold" value="${GLOBAL.settingsManager.settings.ssRedThreshold}"/></label>
          <label><span>Support Score orange threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssOrangeThreshold" value="${GLOBAL.settingsManager.settings.ssOrangeThreshold}"/></label>
          <label><span>Support Score yellow threshold</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="ssYellowThreshold" value="${GLOBAL.settingsManager.settings.ssYellowThreshold}"/></label>
          <label><span>Override standard feed font (<span style="text-decoration: underline; color: blue;" title='If disabled, below feed font settings will not be applied.'>info</span>)</span><input class="roland-ui-mods-settings-input" data-id="overrideStandardFeedFont" type="checkbox" ${JSON.parse(GLOBAL.settingsManager.settings.overrideStandardFeedFont) ? 'checked' : ''}/></label>
          <label><span>Custom feed font (<span style="text-decoration: underline; color: blue;" title='If a valid and available font is entered it will be used instead of the below feed font selected in the picklist.'>info</span>)</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="customFeedFont" value="${GLOBAL.settingsManager.settings.customFeedFont}"/></label>
          <label><span>Feed font (<span style="text-decoration: underline; color: blue;" title='This will be used if custom feed font is blank'>info</span>)</span><div style='display:inline-block;'><div>${this.feedFontSelectorHTML(GLOBAL.settingsManager.settings.feedFontFamily)}</div><div id='abcxyz' style='padding-top:10px;font-family:${GLOBAL.settingsManager.settings.feedFontFamily};'>ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789</div></div></label>
          <label><span>Feed font size</span><input type="text" class="roland-ui-mods-input-field roland-ui-mods-settings-input" data-id="feedFontSize" value="${GLOBAL.settingsManager.settings.feedFontSize}"/></label>
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
        });
      $(document)
        .off('click', '#roland-ui-mods-timesheets-button')
        .on('click', '#roland-ui-mods-timesheets-button', (e) => {
          window.open(
            'https://tam-04a6caab6366.herokuapp.com/timesheets',
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
      `button.slds-button.slds-button_icon.slds-button_icon-x-small.slds-button_icon-container[title^="Close "]`,
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
  version: 'v20251211',
};

//entry function

const rolandUImods = () => {
  console.log('Service Cloud Premium version:', GLOBAL.version);
  GLOBAL.settingsManager = new SettingsManager();
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

rolandUImods();
