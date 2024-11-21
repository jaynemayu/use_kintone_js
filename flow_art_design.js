(function() {
  'use strict';

  kintone.events.on(['app.record.create.show'], async function(event) {
    const FLOW_APP_ID = 44;
    const FLOW_ROLE_APP_ID = 45;
    const FLOWNAME = 'ArtDesign';

    var user = kintone.getLoginUser();
    const orgName = await fetchOrgName(user.code);
    const flowApproverUsers = await fetchAllFlowApproverUsers();

    event.record['projectName'].value = `[${orgName}]`;
    event.record['approvers'].value = flowApproverUsers;

    console.log(event.record)
    // 把 flowApproverUsers 秀在 approversLabel 空白欄內

    return event;

    // ---function start-------------------------------------------------------------------------
    // 取得所有簽核者
    async function fetchAllFlowApproverUsers() {
      // 第一階段簽核者
      const supervisorUsers = await fetchSupervisorUsers(user.id);

      // 第二階段簽核者
      const flowRoleCodes = await fetchSecondApproverFlowRoleCodes();
      const flowRoleUsers = await fetchFlowRoleUsersByFlowRoleCodes(flowRoleCodes);

      let users = [...supervisorUsers, ...flowRoleUsers];

      // 移掉重複簽核者，但是越後面越優先保留
      users = users.reverse().filter((value, index, self) => self.findIndex(v => v.code === value.code) === index).reverse();

      return users;
    }

    async function fetchSupervisorUsers(userId) {
      const supervisorUserIds = await fetchAllSupervisorIds(userId);

      const users = await kintone.api('/v1/users.json', 'GET', { ids: supervisorUserIds })
                                 .then(function(resp) { return resp.users })
                                 

      return users.sort((a, b) => {
                    const indexA = supervisorUserIds.indexOf(a.id.value);
                    const indexB = supervisorUserIds.indexOf(b.id.value);
                    return indexA - indexB;
                  })
                  .map(user => { return { code: user.code, name: user.name } })
    }

    async function fetchSupervisorId(userId) {
      return kintone.api('/v1/users.json', 'GET', { ids: [userId] }).then(function(resp) {
        return resp.users[0]?.customItemValues.filter(item => item.code === 'Report_Manager')?.[0]?.value;
      })
    }

    async function fetchAllSupervisorIds(userId) {
      let ids = [];
      let supervisorId = await fetchSupervisorId(userId);

      while (supervisorId) {
        ids.push(supervisorId); 
        supervisorId = await fetchSupervisorId(supervisorId);  
      }

      // 移掉最高階層主管(CEO)，因為CEO會是第二階段簽核者，並且不一定要會是CEO簽核
      ids.pop();

      return ids; 
    }

    // flowRoleCodes example: ['ArtMaster', 'ceo']
    async function fetchFlowRoleUsersByFlowRoleCodes(flowRoleCodes) {
      const query = flowRoleCodes.map(roleCode => `code = "${roleCode}"`).join(' or ');

      return kintone.api('/k/v1/records.json', 'GET', { "app": FLOW_ROLE_APP_ID, query: query }).then(function(resp) {
        if (resp?.records?.length > 0) {
          let hash = {};
          resp.records.forEach(obj => {
            hash[obj.code.value] = obj.users.value;
          });

          return flowRoleCodes.map (roleCode => { return hash[roleCode] || []; })
                              .flat()
                              .filter((value, index, self) => self.findIndex(v => v.code === value.code) === index); // remove duplicate
        } else {
          console.warn(`cannot find flow with role codes "${flowRoleCodes}"`);
        }
      });
    }
   
    async function fetchSecondApproverFlowRoleCodes() {
      const query = `flowName = "${FLOWNAME}" order by seq asc`;

      return kintone.api('/k/v1/records.json', 'GET', { "app": FLOW_APP_ID, query: query }).then(function(resp) {
        if (resp?.records?.length > 0) {
          const roles = resp.records.map(rec => rec.role.value);
          return roles;
        } else {
          console.warn(`cannot find flow with name "${FLOWNAME}"`);
        }
      });
    }

    async function fetchOrgName(userCode) {
      return kintone.api('/v1/user/organizations.json', 'GET', { code: userCode }).then(function(resp) {
        if (resp?.organizationTitles?.length > 0) {
          return resp.organizationTitles[0].organization.name;
        } else {
          console.warn(`cannot find organization name with user "${userCode}"`);
        }
      });
    };
  });
})();
