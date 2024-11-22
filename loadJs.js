
(function() {
  'use strict';

  const url = [window.location.origin, window.location.pathname.split('/')[1], ''].join('/');
  const urlParams = new URLSearchParams(window.location.search);
  const flowName = urlParams.get('flow_name');

  kintone.events.on('app.record.detail.show', function (event) {
    const headerSpace = kintone.app.record.getHeaderMenuSpaceElement();
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="app"></div>
      <script type="module" src="${url}${flowName}.js"></script>
    `;
  
    headerSpace.appendChild(container);
  
    return event;
  }); 
})();
