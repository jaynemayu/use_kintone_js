(function() {
  'use strict';

  const flowName = 'ArtDesign';
  handleProcessStatusChange(flowName)

  const currentUser = kintone.getLoginUser();
  kintone.events.on(['app.record.create.show'], async function(event) {
    console.log(event)
    
    const orgName = await fetchOrgName(currentUser.code);
    event.record['projectName'].value = `[${orgName}]`;

    return event;
  });
})();
