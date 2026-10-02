var CRM_HEADERS = {
  '人物マスタ': ['id','name','metDate','source','overallPriority','note','createdAt','updatedAt'],
  '紹介関係': ['id','fromId','toId','memo','createdAt','updatedAt'],
  'サービス候補': ['id','personId','serviceName','priority','note','createdAt','updatedAt'],
  '次回アクション': ['id','personId','actionDate','actionText','done','completedAt','createdAt','updatedAt'],
  '設定': ['key','value','description']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Connect CRM')
    .addItem('初期設定を実行', 'setupConnectCRM')
    .addItem('サンプル28人を投入', 'seedSampleData')
    .addSeparator()
    .addItem('接続キーを再発行', 'regenerateConnectionKey')
    .addToUi();
}

function setupConnectCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  var names = Object.keys(CRM_HEADERS);
  for (var i = 0; i < names.length; i++) {
    ensureSheet_(ss, names[i], CRM_HEADERS[names[i]]);
  }

  ensureStructure_();

  var settings = ss.getSheetByName('設定');
  setSettingInSheet_(settings, 'schema_version', '006', 'Connect CRMのデータ構造バージョン');
  setSettingInSheet_(settings, 'app_name', 'Connect CRM', 'アプリ名');

  if (!settingFromSheet_(settings, 'connection_key')) {
    setSettingInSheet_(
      settings,
      'connection_key',
      Utilities.getUuid().replace(/-/g, ''),
      'Webアプリ側へ入力する接続キー'
    );
  }

  setSettingInSheet_(settings, 'spreadsheet_id', ss.getId(), '連携対象スプレッドシートID');
  setSettingInSheet_(settings, 'timezone', Session.getScriptTimeZone() || 'Asia/Tokyo', '日付処理タイムゾーン');

  SpreadsheetApp.getUi().alert(
    'Connect CRMの初期設定が完了しました。\n' +
    '「設定」シートの connection_key をWebアプリへ入力してください。'
  );
}

function ensureStructure_() {
  var ss = spreadsheet_();
  var names = Object.keys(CRM_HEADERS);
  for (var i = 0; i < names.length; i++) {
    ensureSheet_(ss, names[i], CRM_HEADERS[names[i]]);
  }
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }

  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var width = Math.max(headers.length, sh.getLastColumn());
  var current = sh.getRange(1, 1, 1, width).getValues()[0].slice(0, headers.length);
  var currentStrings = [];

  for (var i = 0; i < current.length; i++) {
    currentStrings.push(String(current[i]));
  }

  if (currentStrings.join('|') !== headers.join('|')) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#1E5B43')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');

  sh.autoResizeColumns(1, headers.length);

  if (name === '人物マスタ') {
    sh.setColumnWidth(2, 140);
    sh.setColumnWidth(6, 360);
  }
  if (name === '紹介関係') {
    sh.setColumnWidth(4, 380);
  }
  if (name === 'サービス候補') {
    sh.setColumnWidth(3, 220);
  }
  if (name === '次回アクション') {
    sh.setColumnWidth(4, 320);
  }
  if (name === '設定') {
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 360);
    sh.setColumnWidth(3, 320);
  }

  return sh;
}

function regenerateConnectionKey() {
  var sh = spreadsheet_().getSheetByName('設定');
  var key = Utilities.getUuid().replace(/-/g, '');
  setSettingInSheet_(sh, 'connection_key', key, 'Webアプリ側へ入力する接続キー');
  SpreadsheetApp.getUi().alert('接続キーを再発行しました。Webアプリ側の設定も更新してください。');
}

function setSettingInSheet_(sh, key, value, description) {
  var rows = [];
  if (sh.getLastRow() > 1) {
    rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  }

  var index = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      index = i;
      break;
    }
  }

  if (index >= 0) {
    sh.getRange(index + 2, 1, 1, 3).setValues([[
      key,
      value,
      description || rows[index][2] || ''
    ]]);
  } else {
    sh.appendRow([key, value, description || '']);
  }
}

function settingFromSheet_(sh, key) {
  if (sh.getLastRow() < 2) return '';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(key)) {
      return rows[i][1];
    }
  }
  return '';
}
