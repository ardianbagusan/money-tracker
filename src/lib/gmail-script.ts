// The Google Apps Script that runs inside your own Gmail account. It looks for
// new transaction emails every 15 minutes and sends them to your app. It runs on
// Google's servers under your account, so no Google login is added to the app.

const SENDERS = [
  'bca.co.id', 'klikbca.com', 'bankmandiri.co.id', 'bri.co.id', 'bni.co.id', 'jago.com', 'jenius.com', 'btpn.com', 'seabank.co.id',
  'cimbniaga.co.id', 'permatabank.co.id', 'gojek.com', 'gopay.co.id', 'ovo.id', 'dana.id', 'shopee.co.id', 'shopeepay.co.id',
  'linkaja.id', 'grab.com', 'tokopedia.com', 'traveloka.com', 'tiket.com', 'blibli.com', 'lazada.co.id', 'flip.id',
];
const SUBJECT_WORDS = ['transaksi', 'pembayaran', 'payment', 'receipt', 'e-receipt', 'struk', 'transfer', 'top up', 'dana masuk', 'pembelian', 'invoice'];

export function gmailScript(appUrl: string, key: string) {
  const query = `newer_than:3d -in:spam -in:trash -label:telaga-imported (from:(${SENDERS.join(' OR ')}) OR subject:(${SUBJECT_WORDS.map((w) => (w.includes(' ') ? `"${w}"` : w)).join(' OR ')}))`;
  return `// Telaga: send transaction emails from this Gmail to your money app.
// 1) Paste this whole file into a new project at script.google.com
// 2) Pick "setup" in the function menu at the top and press Run, then allow access.
// That's it: it now checks every 15 minutes. Emails it has sent get the Gmail label "telaga-imported".

const APP_URL = ${JSON.stringify(appUrl)};
const KEY = ${JSON.stringify(key)}; // private: anyone with this key can add drafts to your app

// Which emails to look at. Add your bank's address here if it's missing,
// e.g. add  OR from:mybank.co.id  inside the brackets.
const QUERY = ${JSON.stringify(query)};

function importTransactions() {
  const label = GmailApp.getUserLabelByName('telaga-imported') || GmailApp.createLabel('telaga-imported');
  const threads = GmailApp.search(QUERY, 0, 25);
  if (!threads.length) return;
  const messages = [];
  const sent = [];
  threads.forEach(function (t) {
    const ms = t.getMessages();
    if (messages.length + ms.length > 50) return; // the rest go next run
    sent.push(t);
    ms.forEach(function (m) {
      messages.push({
        id: m.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        date: m.getDate().toISOString(),
        body: m.getPlainBody().slice(0, 8000),
      });
    });
  });
  const res = UrlFetchApp.fetch(APP_URL + '/api/import/email', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + KEY },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('App said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  if (sent.length) label.addToThreads(sent);
  console.log(res.getContentText());
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'importTransactions') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('importTransactions').timeBased().everyMinutes(15).create();
  importTransactions();
}
`;
}
