const CRM_SCHEMA_VERSION = '006';
const SHEETS = {
  people: '人物マスタ',
  relationships: '紹介関係',
  services: 'サービス候補',
  actions: '次回アクション',
  settings: '設定'
};

function doGet() {
  return json_({ ok: true, app: 'Connect CRM', version: CRM_SCHEMA_VERSION, message: 'POST JSON to this Web App URL.' });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    requireConnectionKey_(req.key);
    let data;
    switch (req.action) {
      case 'bootstrap': data = bootstrap_(); break;
      case 'upsertPerson': upsertPerson_(req.person); data = bootstrap_(); break;
      case 'deletePerson': deletePerson_(req.personId); data = bootstrap_(); break;
      case 'addRelationship': addRelationship_(req.relationship); data = bootstrap_(); break;
      case 'deleteRelationship': deleteRelationship_(req.relationshipId); data = bootstrap_(); break;
      case 'toggleAction': toggleAction_(req.personId, req.done); data = bootstrap_(); break;
      case 'replaceAll': replaceAll_(req.state); data = bootstrap_(); break;
      case 'ping': data = { version: CRM_SCHEMA_VERSION, spreadsheetId: spreadsheet_().getId() }; break;
      default: throw new Error('Unknown action: ' + req.action);
    }
    return json_({ ok: true, data });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function bootstrap_() {
  ensureStructure_();
  const peopleRows = objects_(sheet_(SHEETS.people));
  const relationshipRows = objects_(sheet_(SHEETS.relationships));
  const serviceRows = objects_(sheet_(SHEETS.services));
  const actionRows = objects_(sheet_(SHEETS.actions));

  const servicesByPerson = {};
  serviceRows.forEach(s => {
    if (!s.personId) return;
    (servicesByPerson[s.personId] ||= []).push({ name: s.serviceName || '', priority: s.priority || 'medium' });
  });

  const actionByPerson = {};
  actionRows.forEach(a => {
    if (!a.personId) return;
    const candidate = {
      date: dateString_(a.actionDate), text: a.actionText || '', done: toBool_(a.done)
    };
    const current = actionByPerson[a.personId];
    if (!current || (!candidate.done && current.done) || (candidate.date && candidate.date < (current.date || '9999-99-99'))) {
      actionByPerson[a.personId] = candidate;
    }
  });

  const people = peopleRows.filter(p => p.id && p.name).map(p => ({
    id: String(p.id), name: String(p.name), metDate: dateString_(p.metDate), source: p.source || '',
    overallPriority: p.overallPriority || 'medium', note: p.note || '',
    services: servicesByPerson[p.id] || [],
    nextAction: actionByPerson[p.id] || { date: '', text: '', done: false },
    updatedAt: dateString_(p.updatedAt)
  }));

  const relationships = relationshipRows.filter(r => r.id && r.fromId && r.toId).map(r => ({
    id: String(r.id), fromId: String(r.fromId), toId: String(r.toId), memo: r.memo || '', createdAt: dateString_(r.createdAt)
  }));
  return { version: CRM_SCHEMA_VERSION, people, relationships };
}

function upsertPerson_(p) {
  if (!p || !p.name) throw new Error('人物名が必要です。');
  ensureStructure_();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const now = today_();
    if (!p.id) p.id = nextId_(sheet_(SHEETS.people), 'P');
    upsertById_(sheet_(SHEETS.people), p.id, {
      id: p.id, name: p.name, metDate: p.metDate || '', source: p.source || '',
      overallPriority: p.overallPriority || 'medium', note: p.note || '',
      createdAt: existingValue_(sheet_(SHEETS.people), p.id, 'createdAt') || now, updatedAt: now
    });

    deleteWhere_(sheet_(SHEETS.services), row => String(row.personId) === String(p.id));
    (p.services || []).filter(s => s && s.name).forEach(s => appendObject_(sheet_(SHEETS.services), {
      id: nextId_(sheet_(SHEETS.services), 'S'), personId: p.id, serviceName: s.name,
      priority: s.priority || 'medium', note: '', createdAt: now, updatedAt: now
    }));

    deleteWhere_(sheet_(SHEETS.actions), row => String(row.personId) === String(p.id));
    if (p.nextAction && p.nextAction.text) appendObject_(sheet_(SHEETS.actions), {
      id: nextId_(sheet_(SHEETS.actions), 'A'), personId: p.id, actionDate: p.nextAction.date || '',
      actionText: p.nextAction.text, done: !!p.nextAction.done,
      completedAt: p.nextAction.done ? now : '', createdAt: now, updatedAt: now
    });
  } finally { lock.releaseLock(); }
}

function deletePerson_(personId) {
  if (!personId) throw new Error('personId is required.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    deleteWhere_(sheet_(SHEETS.people), r => String(r.id) === String(personId));
    deleteWhere_(sheet_(SHEETS.services), r => String(r.personId) === String(personId));
    deleteWhere_(sheet_(SHEETS.actions), r => String(r.personId) === String(personId));
    deleteWhere_(sheet_(SHEETS.relationships), r => String(r.fromId) === String(personId) || String(r.toId) === String(personId));
  } finally { lock.releaseLock(); }
}

function addRelationship_(r) {
  if (!r || !r.fromId || !r.toId) throw new Error('紹介元・紹介先が必要です。');
  if (String(r.fromId) === String(r.toId)) throw new Error('同じ人物同士は紹介関係にできません。');
  const sh = sheet_(SHEETS.relationships);
  if (objects_(sh).some(x => String(x.fromId) === String(r.fromId) && String(x.toId) === String(r.toId))) throw new Error('同じ紹介関係がすでにあります。');
  const now = today_();
  appendObject_(sh, { id: r.id || nextId_(sh, 'R'), fromId: r.fromId, toId: r.toId, memo: r.memo || '', createdAt: r.createdAt || now, updatedAt: now });
}

function deleteRelationship_(relationshipId) {
  deleteWhere_(sheet_(SHEETS.relationships), r => String(r.id) === String(relationshipId));
}

function toggleAction_(personId, done) {
  const sh = sheet_(SHEETS.actions), rows = objects_(sh), headers = headers_(sh), now = today_();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].personId) !== String(personId)) continue;
    sh.getRange(i + 2, headers.indexOf('done') + 1).setValue(!!done);
    sh.getRange(i + 2, headers.indexOf('completedAt') + 1).setValue(done ? now : '');
    sh.getRange(i + 2, headers.indexOf('updatedAt') + 1).setValue(now);
    return;
  }
}

function replaceAll_(state) {
  if (!state || !Array.isArray(state.people) || !Array.isArray(state.relationships)) throw new Error('state data is invalid.');
  ensureStructure_();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    clearData_(sheet_(SHEETS.people)); clearData_(sheet_(SHEETS.relationships)); clearData_(sheet_(SHEETS.services)); clearData_(sheet_(SHEETS.actions));
    const now = today_();
    state.people.forEach(p => {
      appendObject_(sheet_(SHEETS.people), { id:p.id, name:p.name, metDate:p.metDate||'', source:p.source||'', overallPriority:p.overallPriority||'medium', note:p.note||'', createdAt:p.metDate||now, updatedAt:p.updatedAt||now });
      (p.services||[]).filter(s=>s.name).forEach(s => appendObject_(sheet_(SHEETS.services), { id:nextId_(sheet_(SHEETS.services),'S'), personId:p.id, serviceName:s.name, priority:s.priority||'medium', note:'', createdAt:now, updatedAt:now }));
      if (p.nextAction && p.nextAction.text) appendObject_(sheet_(SHEETS.actions), { id:nextId_(sheet_(SHEETS.actions),'A'), personId:p.id, actionDate:p.nextAction.date||'', actionText:p.nextAction.text, done:!!p.nextAction.done, completedAt:p.nextAction.done?now:'', createdAt:now, updatedAt:now });
    });
    state.relationships.forEach(r => appendObject_(sheet_(SHEETS.relationships), { id:r.id||nextId_(sheet_(SHEETS.relationships),'R'), fromId:r.fromId, toId:r.toId, memo:r.memo||'', createdAt:r.createdAt||now, updatedAt:now }));
  } finally { lock.releaseLock(); }
}

function requireConnectionKey_(key) {
  const expected = getSetting_('connection_key');
  if (!expected) throw new Error('接続キーが未設定です。Apps Scriptで setupConnectCRM() を一度実行してください。');
  if (String(key || '') !== String(expected)) throw new Error('接続キーが一致しません。');
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_IDがありません。setupConnectCRM() を実行してください。');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) { const sh = spreadsheet_().getSheetByName(name); if (!sh) throw new Error('Sheet not found: ' + name); return sh; }
function headers_(sh) { return sh.getLastColumn() ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String) : []; }
function objects_(sh) { const lr=sh.getLastRow(), lc=sh.getLastColumn(); if(lr<2||lc<1)return[]; const h=headers_(sh), vals=sh.getRange(2,1,lr-1,lc).getValues(); return vals.map(row=>Object.fromEntries(h.map((k,i)=>[k,row[i]]))); }
function appendObject_(sh,obj){const h=headers_(sh);sh.appendRow(h.map(k=>obj[k]??''));}
function upsertById_(sh,id,obj){const rows=objects_(sh),h=headers_(sh),idx=rows.findIndex(r=>String(r.id)===String(id)),values=h.map(k=>obj[k]??'');if(idx>=0)sh.getRange(idx+2,1,1,h.length).setValues([values]);else sh.appendRow(values);}
function existingValue_(sh,id,key){const r=objects_(sh).find(x=>String(x.id)===String(id));return r?r[key]:'';}
function deleteWhere_(sh,pred){const rows=objects_(sh);for(let i=rows.length-1;i>=0;i--)if(pred(rows[i]))sh.deleteRow(i+2);}
function clearData_(sh){if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,Math.max(1,sh.getLastColumn())).clearContent();}
function nextId_(sh,prefix){const ids=objects_(sh).map(r=>String(r.id||'')).filter(x=>x.startsWith(prefix)).map(x=>parseInt(x.replace(/\D/g,''),10)||0);return prefix+String(Math.max(0,...ids)+1).padStart(3,'0');}
function dateString_(v){if(!v)return'';if(Object.prototype.toString.call(v)==='[object Date]')return Utilities.formatDate(v,Session.getScriptTimeZone()||'Asia/Tokyo','yyyy-MM-dd');return String(v).slice(0,10);}
function today_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Tokyo','yyyy-MM-dd');}
function toBool_(v){return v===true||String(v).toLowerCase()==='true'||v===1||String(v)==='1';}
function getSetting_(key){const sh=sheet_(SHEETS.settings), rows=objects_(sh), r=rows.find(x=>String(x.key)===String(key)); return r ? r.value : '';}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
