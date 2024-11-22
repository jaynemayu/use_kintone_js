async function fetchOrgName(userCode) {
  return kintone.api('/v1/user/organizations.json', 'GET', { code: userCode }).then(function(resp) {
    if (resp?.organizationTitles?.length > 0) {
      return resp.organizationTitles[0].organization.name;
    } else {
      console.warn(`cannot find organization name with user "${userCode}"`);
    }
  });
};
