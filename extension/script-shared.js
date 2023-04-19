function _log(message) {
  console.debug('[ChatGPT HTML viewer]', message);
}

function listenToChange(regenerateButtonSelector, codeBlockSelector, iframeParentSelector) {
  _log('listening to change');
  // Tried using resize observer etc. but not very reliable. Considering the operation is not super complex, just doing it in an interval.
  setInterval(() => {
    if (document.querySelector(regenerateButtonSelector).textContent.includes('Regenerate response')) {
      injectUI(codeBlockSelector, iframeParentSelector);
    }
  }, 1000);
}

function injectUI(codeBlockSelector, iframeParentSelector) {
  const preEls = scanHtmlBlock(codeBlockSelector);
  if (preEls.length) _log(`Found: ${preEls.length}`);
  for (const preEl of preEls) {
    preEl.classList.add('chatgpt-code-previewer');
    const code = preEl.querySelector('code').textContent;
    const type = preEl.querySelector('span').textContent.toLowerCase();

    // Inject iframe
    const iframeContent = parseIframe(code, type);

    const codepenEl = generateCodepenLink(code, type);

    const controlRow = preEl.querySelector('div > div');
    controlRow.classList.add('control-row');
    const titleEl = controlRow.querySelector('span');
    titleEl.classList.add('control-title');
    titleEl.after(codepenEl);

    if (iframeContent) {
      const iframeEl = createElement('iframe', {srcdoc: type === 'markdown' ? marked.parse(code) : code});
      const iframeParentEl = preEl.querySelector(iframeParentSelector);
      iframeParentEl.classList.add('iframe-parent');
      iframeParentEl.append(iframeEl);

      const toggleEl = generateToggle(() => {
        iframeEl.classList.toggle('-hide');
      });
      titleEl.after(toggleEl);
    }
    _log(`Added one code preview/link`);
  }
}

function generateToggle(eventHandler) {
  const toggleEl = createElement('div', {}, ['toggle']);

  // Left label
  toggleEl.append(createElement('span', {textContent: 'Code'}, ['label-text']));

  // Input
  const labelEl = createElement('label', {}, ['switch']);
  const inputEl = createElement('input', {type: 'checkbox', checked: true});
  const insideSpanEl = createElement('span', {}, ['slider', 'round']);
  labelEl.append(inputEl);
  labelEl.append(insideSpanEl);
  toggleEl.append(labelEl);

  // Left label
  toggleEl.append(createElement('span', {textContent: 'Preview'}, ['label-text']));


  inputEl.addEventListener('change', eventHandler);
  return toggleEl;
}

function generateCodepenLink(code, type) {
  const codeContent = JSON.stringify({
    title: 'Generated by ChatGPT Code Previewer extension',
    description: 'Generated by ChatGPT Code Previewer extension.',
    ...parseCodePen(code, type),
  });
  const formEl = createElement('form', {action: 'https://codepen.io/pen/define', method: 'POST', target: '_blank'});
  const hiddenEl = createElement('input', {type: 'hidden', name: 'data', value: codeContent});
  const clickEl = createElement('button', {textContent: 'Open in CodePen'}, ['codepen']);
  formEl.append(hiddenEl);
  formEl.append(clickEl);

  return formEl;
}

function scanHtmlBlock(codeBlockSelector) {
  let htmlCodeEls = [];
  const allCodeEls = [...document.querySelectorAll(codeBlockSelector)];
  for (const el of allCodeEls) {
    const language = el.querySelector('span')?.textContent.toLowerCase();
    if (ALL_SUPPORTED_TYPES.includes(language) && !el.querySelector('.control-row')) {
      htmlCodeEls.push(el);
    }
  }
  return htmlCodeEls;
}

// lower case.
const ALL_SUPPORTED_TYPES = ['html', 'svg', 'xml', 'php', 'markdown', 'css', 'js', 'javascript', 'typescript'];

function parseIframe(code, type) {
  switch (type) {
    case 'html':
    case 'php':
    case 'svg':
    case 'xml':
      return code;
    case 'markdown':
      return marked.parse(code)
    default:
      // Other types do not have previews
      return null;
  }
}

// See parameters in https://blog.codepen.io/documentation/prefill/
function parseCodePen(code, type) {
  switch (type) {
    case 'html':
    case 'php': {
      const tempFrame = document.createElement('html');
      tempFrame.innerHTML = code;
      const styleEls = [...tempFrame.querySelectorAll('style')];
      const styleString = styleEls.map((el) => el.textContent).join('\n');
  
      const scriptEls = [...tempFrame.querySelectorAll('script')];
      const scriptString = scriptEls.map((el) => el.textContent).join('\n');
  
      const cssLinks = [...tempFrame.querySelectorAll('link[rel=stylesheet]')]
          .map((el) => el.href)
          .join(';');
      const jsLinks = [...tempFrame.querySelectorAll('script[src]')]
          .map((el) => el.src)
          .join(';');

      for (const el of [...styleEls, ...scriptEls]) {
        el.remove();
      }
      const htmlString = tempFrame.querySelector('body').innerHTML;
      return {
        html: removeExtraIndentation(htmlString),
        css: removeExtraIndentation(styleString),
        js: removeExtraIndentation(scriptString),
        css_external: cssLinks,
        js_external: jsLinks,
      };
    }
    case 'markdown':
      return {
        html: code,
        html_pre_processor: 'markdown',
      }
    case 'svg':
    case 'xml':
      return {html: removeExtraIndentation(code)};
    case 'css':
      return {css: code};
    case 'js':
    case 'javascript':
      return {js: code}
    case 'typescript':
      return {
        js: code,
        js_pre_processor: 'typescript',
      }
  }
}

function removeExtraIndentation(codeString) {
  const originalLines = codeString.split('\n');
  const lines = originalLines[0].trim().length ? originalLines : originalLines.slice(1);
  const indentationSize = (lines[0] || '').match(/^ */)?.[0].length;
  return lines.map((line) => line.replace(new RegExp(`^ {${indentationSize}}`), '')).join('\n');
}

function createElement(tag, attributes, classes = [], innerHTML = '') {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    element[key] = value;
  }
  for (const classname of classes) {
    element.classList.add(classname);
  }
  if (innerHTML) {
    element.innerHTML = innerHTML;
  }
  return element;
}
