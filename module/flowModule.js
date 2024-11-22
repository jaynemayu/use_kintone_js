// 草稿 -> (送到第一位審核者手中) -> 待審核 -> (簽核) -> 處理中 -> (確認完成) -> 完成
//                                 ⤤ (發現下一位簽核者) ⤾
//   註:
//      括號內為動作名稱，未有括號則為狀態名稱
//      確認完成 跟 發現下一位簽核者 需要在狀態變更後執行確認

let FLOW_NAME, CURRENT_APP_ID;

const currentUser = kintone.getLoginUser();

const STATUS = {
  DRAFT: '草稿',
  PENDING: '待審核',
  PROCESSING: '處理中',
  DONE: '完成'
}
const ACTION = {
  SEND_TO_FIRST_APPROVER: '送到第一位審核者手中',
  APPROVE: '簽核',
  CONFIRM: '確認完成',
  FIND_NEXT_APPROVER: '發現下一位簽核者'
}


async function handleProcessStatusChange(flowName) {
  FLOW_NAME = flowName;
  CURRENT_APP_ID = FLOW_APPS[FLOW_NAME];
  kintone.events.on('app.record.detail.show', async function(event) {
    if (event.record['狀態'].value === STATUS.PROCESSING) {
      await updateProcessStatusToLatest(event.record['$id'].value, event);
      location.reload();
    }
  });

  kintone.events.on('app.record.detail.process.proceed', async function(event) {
    const record = event.record;
    const nextStatus = event.nextStatus.value;
    const approverList = event.record['approvers'].value;

    if (nextStatus === STATUS.DRAFT) {
      record.currentApprover.value = [record.applyUser.value];
    } else if (nextStatus === STATUS.PENDING) {
      record.currentApprover.value = [approverList[0]];
    } else if (nextStatus === STATUS.PROCESSING) {
      const currentApproverCode = event.record.currentApprover.value[0]?.code;
      const approverList = event.record.approvers.value;
      const nextApproverIndex = approverList.findIndex(a => a.code === currentApproverCode) + 1;

      if (nextApproverIndex < approverList.length) {
        record.currentApprover.value = [approverList[nextApproverIndex]]
      } else {
        record.currentApprover.value = []
      }
    } else if (nextStatus === STATUS.DONE) {
      record.currentApprover.value = [];
    }

    return event;
  });

  kintone.events.on(['app.record.create.show'], async function(event) {
    const flowApproverUsers = await fetchAllFlowApproverUsers(currentUser);
    event.record['approvers'].value = flowApproverUsers;
    event.record['currentApprover'].value = [{ code: currentUser.code, name: currentUser.name }]

    return event;
  });
}

async function updateProcessStatusToLatest(flowId, event) {
  if (event.record.currentApprover.value.length === 0) {
    const variables = { app: CURRENT_APP_ID, id: flowId, action: ACTION.CONFIRM };
    await kintone.api('/k/v1/record/status.json', 'PUT', variables);
  } else {
    const variables = { app: CURRENT_APP_ID, id: flowId, action: ACTION.FIND_NEXT_APPROVER };
    await kintone.api('/k/v1/record/status.json', 'PUT', variables);
  }
}

async function fetchAllFlowApproverUsers(user) {
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
  const query = `flowName = "${FLOW_NAME}" order by seq asc`;

  return kintone.api('/k/v1/records.json', 'GET', { "app": FLOW_APP_ID, query: query }).then(function(resp) {
    if (resp?.records?.length > 0) {
      const roles = resp.records.map(rec => rec.role.value);
      return roles;
    } else {
      console.warn(`cannot find flow with name "${FLOW_NAME}"`);
    }
  });
}
