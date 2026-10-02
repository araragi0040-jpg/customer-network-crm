var CRM_SCHEMA_VERSION = '006';
var SHEETS = {
  people: '人物マスタ',
  relationships: '紹介関係',
  services: 'サービス候補',
  actions: '次回アクション',
  settings: '設定'
};

function doGet() {
  return json_({
    ok: true,
    app: 'Connect CRM',
    version: CRM_SCHEMA_VERSION,
    message: 'POST JSON to this Web App URL.'
  });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    requireConnectionKey_(req.key);

    var data;
    switch (req.action) {
      case 'bootstrap':
        data = bootstrap_();
        break;
      case 'upsertPerson':
        upsertPerson_(req.person);
        data = bootstrap_();
        break;
      case 'deletePerson':
        deletePerson_(req.personId);
        data = bootstrap_();
        break;
      case 'addRelationship':
        addRelationship_(req.relationship);
        data = bootstrap_();
        break;
      case 'deleteRelationship':
        deleteRelationship_(req.relationshipId);
        data = bootstrap_();
        break;
      case 'toggleAction':
        toggleAction_(req.personId, req.done);
        data = bootstrap_();
        break;
      case 'replaceAll':
        replaceAll_(req.state);
        data = bootstrap_();
        break;
      case 'ping':
        data = {
          version: CRM_SCHEMA_VERSION,
          spreadsheetId: spreadsheet_().getId()
        };
        break;
      default:
        throw new Error('Unknown action: ' + req.action);
    }

    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function bootstrap_() {
  ensureStructure_();

  var peopleRows = objects_(sheet_(SHEETS.people));
  var relationshipRows = objects_(sheet_(SHEETS.relationships));
  var serviceRows = objects_(sheet_(SHEETS.services));
  var actionRows = objects_(sheet_(SHEETS.actions));

  var servicesByPerson = {};
  serviceRows.forEach(function(s) {
    if (!s.personId) return;
    var key = String(s.personId);
    if (!servicesByPerson[key]) {
      servicesByPerson[key] = [];
    }
    servicesByPerson[key].push({
      name: s.serviceName || '',
      priority: s.priority || 'medium'
    });
  });

  var actionByPerson = {};
  actionRows.forEach(function(a) {
    if (!a.personId) return;
    var key = String(a.personId);
    var candidate = {
      date: dateString_(a.actionDate),
      text: a.actionText || '',
      done: toBool_(a.done)
    };
    var current = actionByPerson[key];
    if (
      !current ||
      (!candidate.done && current.done) ||
      (candidate.date && candidate.date < (current.date || '9999-99-99'))
    ) {
      actionByPerson[key] = candidate;
    }
  });

  var people = peopleRows
    .filter(function(p) {
      return p.id && p.name;
    })
    .map(function(p) {
      var id = String(p.id);
      return {
        id: id,
        name: String(p.name),
        metDate: dateString_(p.metDate),
        source: p.source || '',
        overallPriority: p.overallPriority || 'medium',
        note: p.note || '',
        services: servicesByPerson[id] || [],
        nextAction: actionByPerson[id] || { date: '', text: '', done: false },
        updatedAt: dateString_(p.updatedAt)
      };
    });

  var relationships = relationshipRows
    .filter(function(r) {
      return r.id && r.fromId && r.toId;
    })
    .map(function(r) {
      return {
        id: String(r.id),
        fromId: String(r.fromId),
        toId: String(r.toId),
        memo: r.memo || '',
        createdAt: dateString_(r.createdAt)
      };
    });

  return {
    version: CRM_SCHEMA_VERSION,
    people: people,
    relationships: relationships
  };
}

function upsertPerson_(p) {
  if (!p || !p.name) {
    throw new Error('人物名が必要です。');
  }

  ensureStructure_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var now = today_();
    var peopleSheet = sheet_(SHEETS.people);

    if (!p.id) {
      p.id = nextId_(peopleSheet, 'P');
    }

    upsertById_(peopleSheet, p.id, {
      id: p.id,
      name: p.name,
      metDate: p.metDate || '',
      source: p.source || '',
      overallPriority: p.overallPriority || 'medium',
      note: p.note || '',
      createdAt: existingValue_(peopleSheet, p.id, 'createdAt') || now,
      updatedAt: now
    });

    var servicesSheet = sheet_(SHEETS.services);
    deleteWhere_(servicesSheet, function(row) {
      return String(row.personId) === String(p.id);
    });

    var services = p.services || [];
    for (var i = 0; i < services.length; i++) {
      var s = services[i];
      if (!s || !s.name) continue;
      appendObject_(servicesSheet, {
        id: nextId_(servicesSheet, 'S'),
        personId: p.id,
        serviceName: s.name,
        priority: s.priority || 'medium',
        note: '',
        createdAt: now,
        updatedAt: now
      });
    }

    var actionsSheet = sheet_(SHEETS.actions);
    deleteWhere_(actionsSheet, function(row) {
      return String(row.personId) === String(p.id);
    });

    if (p.nextAction && p.nextAction.text) {
      appendObject_(actionsSheet, {
        id: nextId_(actionsSheet, 'A'),
        personId: p.id,
        actionDate: p.nextAction.date || '',
        actionText: p.nextAction.text,
        done: !!p.nextAction.done,
        completedAt: p.nextAction.done ? now : '',
        createdAt: now,
        updatedAt: now
      });
    }
  } finally {
    lock.releaseLock();
  }
}

function deletePerson_(personId) {
  if (!personId) {
    throw new Error('personId is required.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    deleteWhere_(sheet_(SHEETS.people), function(r) {
      return String(r.id) === String(personId);
    });
    deleteWhere_(sheet_(SHEETS.services), function(r) {
      return String(r.personId) === String(personId);
    });
    deleteWhere_(sheet_(SHEETS.actions), function(r) {
      return String(r.personId) === String(personId);
    });
    deleteWhere_(sheet_(SHEETS.relationships), function(r) {
      return String(r.fromId) === String(personId) || String(r.toId) === String(personId);
    });
  } finally {
    lock.releaseLock();
  }
}

function addRelationship_(r) {
  if (!r || !r.fromId || !r.toId) {
    throw new Error('紹介元・紹介先が必要です。');
  }
  if (String(r.fromId) === String(r.toId)) {
    throw new Error('同じ人物同士は紹介関係にできません。');
  }

  var sh = sheet_(SHEETS.relationships);
  var rows = objects_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].toId) === String(r.toId)) {
      throw new Error('この人物にはすでに紹介元が登録されています。紹介元は最初の1人のみ記録します。');
    }
  }

  var now = today_();
  appendObject_(sh, {
    id: r.id || nextId_(sh, 'R'),
    fromId: r.fromId,
    toId: r.toId,
    memo: r.memo || '',
    createdAt: r.createdAt || now,
    updatedAt: now
  });
}

function deleteRelationship_(relationshipId) {
  deleteWhere_(sheet_(SHEETS.relationships), function(r) {
    return String(r.id) === String(relationshipId);
  });
}

function toggleAction_(personId, done) {
  var sh = sheet_(SHEETS.actions);
  var rows = objects_(sh);
  var headers = headers_(sh);
  var now = today_();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].personId) !== String(personId)) continue;

    sh.getRange(i + 2, headers.indexOf('done') + 1).setValue(!!done);
    sh.getRange(i + 2, headers.indexOf('completedAt') + 1).setValue(done ? now : '');
    sh.getRange(i + 2, headers.indexOf('updatedAt') + 1).setValue(now);
    return;
  }
}

function replaceAll_(state) {
  if (!state || !Array.isArray(state.people) || !Array.isArray(state.relationships)) {
    throw new Error('state data is invalid.');
  }

  ensureStructure_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var peopleSheet = sheet_(SHEETS.people);
    var relationshipsSheet = sheet_(SHEETS.relationships);
    var servicesSheet = sheet_(SHEETS.services);
    var actionsSheet = sheet_(SHEETS.actions);

    clearData_(peopleSheet);
    clearData_(relationshipsSheet);
    clearData_(servicesSheet);
    clearData_(actionsSheet);

    var now = today_();

    for (var i = 0; i < state.people.length; i++) {
      var p = state.people[i];
      appendObject_(peopleSheet, {
        id: p.id,
        name: p.name,
        metDate: p.metDate || '',
        source: p.source || '',
        overallPriority: p.overallPriority || 'medium',
        note: p.note || '',
        createdAt: p.metDate || now,
        updatedAt: p.updatedAt || now
      });

      var services = p.services || [];
      for (var j = 0; j < services.length; j++) {
        var s = services[j];
        if (!s || !s.name) continue;
        appendObject_(servicesSheet, {
          id: nextId_(servicesSheet, 'S'),
          personId: p.id,
          serviceName: s.name,
          priority: s.priority || 'medium',
          note: '',
          createdAt: now,
          updatedAt: now
        });
      }

      if (p.nextAction && p.nextAction.text) {
        appendObject_(actionsSheet, {
          id: nextId_(actionsSheet, 'A'),
          personId: p.id,
          actionDate: p.nextAction.date || '',
          actionText: p.nextAction.text,
          done: !!p.nextAction.done,
          completedAt: p.nextAction.done ? now : '',
          createdAt: now,
          updatedAt: now
        });
      }
    }

    for (var k = 0; k < state.relationships.length; k++) {
      var r = state.relationships[k];
      appendObject_(relationshipsSheet, {
        id: r.id || nextId_(relationshipsSheet, 'R'),
        fromId: r.fromId,
        toId: r.toId,
        memo: r.memo || '',
        createdAt: r.createdAt || now,
        updatedAt: now
      });
    }
  } finally {
    lock.releaseLock();
  }
}

function requireConnectionKey_(key) {
  var expected = getSetting_('connection_key');
  if (!expected) {
    throw new Error('接続キーが未設定です。Apps Scriptで setupConnectCRM() を一度実行してください。');
  }
  if (String(key || '') !== String(expected)) {
    throw new Error('接続キーが一致しません。');
  }
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_IDがありません。setupConnectCRM() を実行してください。');
  }
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  var sh = spreadsheet_().getSheetByName(name);
  if (!sh) {
    throw new Error('Sheet not found: ' + name);
  }
  return sh;
}

function headers_(sh) {
  if (!sh.getLastColumn()) return [];
  var values = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var result = [];
  for (var i = 0; i < values.length; i++) {
    result.push(String(values[i]));
  }
  return result;
}

function objects_(sh) {
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  var headers = headers_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var result = [];

  for (var r = 0; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
    }
    result.push(obj);
  }

  return result;
}

function valueOrBlank_(value) {
  return (value === null || typeof value === 'undefined') ? '' : value;
}

function appendObject_(sh, obj) {
  var headers = headers_(sh);
  var values = [];
  for (var i = 0; i < headers.length; i++) {
    values.push(valueOrBlank_(obj[headers[i]]));
  }
  sh.appendRow(values);
}

function upsertById_(sh, id, obj) {
  var rows = objects_(sh);
  var headers = headers_(sh);
  var index = -1;

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      index = i;
      break;
    }
  }

  var values = [];
  for (var j = 0; j < headers.length; j++) {
    values.push(valueOrBlank_(obj[headers[j]]));
  }

  if (index >= 0) {
    sh.getRange(index + 2, 1, 1, headers.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
}

function existingValue_(sh, id, key) {
  var rows = objects_(sh);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      return rows[i][key];
    }
  }
  return '';
}

function deleteWhere_(sh, predicate) {
  var rows = objects_(sh);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (predicate(rows[i])) {
      sh.deleteRow(i + 2);
    }
  }
}

function clearData_(sh) {
  if (sh.getLastRow() > 1) {
    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      Math.max(1, sh.getLastColumn())
    ).clearContent();
  }
}

function nextId_(sh, prefix) {
  var rows = objects_(sh);
  var maxNumber = 0;

  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i].id || '');
    if (id.indexOf(prefix) !== 0) continue;
    var number = parseInt(id.replace(/\D/g, ''), 10) || 0;
    if (number > maxNumber) maxNumber = number;
  }

  var next = String(maxNumber + 1);
  while (next.length < 3) {
    next = '0' + next;
  }
  return prefix + next;
}

function dateString_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || 'Asia/Tokyo',
      'yyyy-MM-dd'
    );
  }
  return String(value).slice(0, 10);
}

function today_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || 'Asia/Tokyo',
    'yyyy-MM-dd'
  );
}

function toBool_(value) {
  return value === true ||
    String(value).toLowerCase() === 'true' ||
    value === 1 ||
    String(value) === '1';
}

function getSetting_(key) {
  var rows = objects_(sheet_(SHEETS.settings));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key) === String(key)) {
      return rows[i].value;
    }
  }
  return '';
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
