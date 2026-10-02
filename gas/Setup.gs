const CRM_HEADERS = {
  '人物マスタ': ['id','name','metDate','source','overallPriority','note','createdAt','updatedAt'],
  '紹介関係': ['id','fromId','toId','memo','createdAt','updatedAt'],
  'サービス候補': ['id','personId','serviceName','priority','note','createdAt','updatedAt'],
  '次回アクション': ['id','personId','actionDate','actionText','done','completedAt','createdAt','updatedAt'],
  '設定': ['key','value','description']
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Connect CRM')
    .addItem('初期設定を実行', 'setupConnectCRM')
    .addItem('サンプル28人を投入', 'seedSampleData')
    .addSeparator()
    .addItem('接続キーを再発行', 'regenerateConnectionKey')
    .addToUi();
}

function setupConnectCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Object.keys(CRM_HEADERS).forEach(name => ensureSheet_(ss, name, CRM_HEADERS[name]));
  ensureStructure_();
  const settings = ss.getSheetByName('設定');
  setSettingInSheet_(settings, 'schema_version', '006', 'Connect CRMのデータ構造バージョン');
  setSettingInSheet_(settings, 'app_name', 'Connect CRM', 'アプリ名');
  if (!settingFromSheet_(settings, 'connection_key')) setSettingInSheet_(settings, 'connection_key', Utilities.getUuid().replace(/-/g,''), 'Webアプリ側へ入力する接続キー');
  setSettingInSheet_(settings, 'spreadsheet_id', ss.getId(), '連携対象スプレッドシートID');
  setSettingInSheet_(settings, 'timezone', Session.getScriptTimeZone() || 'Asia/Tokyo', '日付処理タイムゾーン');
  SpreadsheetApp.getUi().alert('Connect CRMの初期設定が完了しました。\n「設定」シートの connection_key をWebアプリへ入力してください。');
}

function ensureStructure_() {
  const ss = spreadsheet_();
  Object.keys(CRM_HEADERS).forEach(name => ensureSheet_(ss, name, CRM_HEADERS[name]));
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  const current = sh.getRange(1,1,1,Math.max(headers.length,sh.getLastColumn())).getValues()[0].slice(0,headers.length).map(String);
  if (current.join('|') !== headers.join('|')) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setBackground('#1E5B43').setFontColor('#FFFFFF').setFontWeight('bold');
  sh.autoResizeColumns(1, headers.length);
  if (name === '人物マスタ') { sh.setColumnWidth(2,140); sh.setColumnWidth(6,360); }
  if (name === '紹介関係') sh.setColumnWidth(4,380);
  if (name === 'サービス候補') sh.setColumnWidth(3,220);
  if (name === '次回アクション') sh.setColumnWidth(4,320);
  if (name === '設定') { sh.setColumnWidth(1,160); sh.setColumnWidth(2,360); sh.setColumnWidth(3,320); }
  return sh;
}

function regenerateConnectionKey() {
  const sh = spreadsheet_().getSheetByName('設定');
  const key = Utilities.getUuid().replace(/-/g,'');
  setSettingInSheet_(sh, 'connection_key', key, 'Webアプリ側へ入力する接続キー');
  SpreadsheetApp.getUi().alert('接続キーを再発行しました。Webアプリ側の設定も更新してください。');
}

function setSettingInSheet_(sh,key,value,description){const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,3).getValues():[];const i=rows.findIndex(r=>String(r[0])===String(key));if(i>=0)sh.getRange(i+2,1,1,3).setValues([[key,value,description||rows[i][2]||'']]);else sh.appendRow([key,value,description||'']);}
function settingFromSheet_(sh,key){if(sh.getLastRow()<2)return'';const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();const r=rows.find(x=>String(x[0])===String(key));return r?r[1]:'';}
