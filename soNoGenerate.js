(function () {
  "use strict";

  kintone.events.on('app.record.create.show', function (event) {
    event.record['soNo'].disabled = true;

    return event;
  });

  kintone.events.on('app.record.create.submit', async function (event) {
    const record = event.record;
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const date = currentDate.getDate().toString().padStart(2, '0');
    const currentDateString = `${year}${month}${date}`;

    const response = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: 2,
      limit: 1,
      offset: 0
    });
    
    const lastRecord = response.records[0];

    let soNo; 
    if (lastRecord) {
      if (lastRecord['soNo'].value.startsWith(`SO${currentDateString}`)) { // 今天
        const soNoNumber = lastRecord['soNo'].value.replace(`SO${currentDateString}`, ''); 
        const newSoNoNumber = parseInt(soNoNumber) + 1;
        soNo = `SO${currentDateString}${newSoNoNumber.toString().padStart(4, '0')}`;

      } else { // 不是今天
        soNo = `SO${currentDateString}0001`; 
      }
    } else {
      soNo = `SO${currentDateString}0001`;
    }

    record['soNo'].value = soNo;

    return event;
  });
})();
