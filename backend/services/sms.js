// Sends the OTP text message. Choose the provider in .env with SMS_PROVIDER:
//   console   -> prints the SMS in the server terminal (for testing without an SMS account)
//   twilio    -> real SMS through Twilio     (TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM)
//   fast2sms  -> real SMS through Fast2SMS   (FAST2SMS_KEY)
// Uses only Node's built-in https module, so no extra npm package is needed.
const https = require('https');

function post(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => (res.statusCode < 300 ? resolve(data) : reject(new Error(`SMS provider answered ${res.statusCode}: ${data.slice(0, 200)}`))));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('SMS provider timeout')));
    req.write(body);
    req.end();
  });
}

async function sendOtp(phone, code) {
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  const text = `Your AgriHire verification code is ${code}. It is valid for 5 minutes. Do not share it.`;

  if (provider === 'console') {
    console.log(`\n[SMS - console mode] to +91${phone}: ${text}\n`);
    return;
  }

  if (provider === 'twilio') {
    const { TWILIO_SID: sid, TWILIO_TOKEN: token, TWILIO_FROM: from } = process.env;
    if (!sid || !token || !from) throw new Error('Twilio settings missing in .env');
    const body = new URLSearchParams({ To: '+91' + phone, From: from, Body: text }).toString();
    await post({
      hostname: 'api.twilio.com', path: `/2010-04-01/Accounts/${sid}/Messages.json`, method: 'POST', auth: `${sid}:${token}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    return;
  }

  if (provider === 'fast2sms') {
    if (!process.env.FAST2SMS_KEY) throw new Error('FAST2SMS_KEY missing in .env');
    const body = JSON.stringify({ route: 'otp', variables_values: code, numbers: phone });
    const answer = JSON.parse(await post({
      hostname: 'www.fast2sms.com', path: '/dev/bulkV2', method: 'POST',
      headers: { authorization: process.env.FAST2SMS_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, body));
    if (answer.return !== true) throw new Error('Fast2SMS refused the message: ' + JSON.stringify(answer.message));
    return;
  }

  throw new Error('Unknown SMS_PROVIDER: ' + provider);
}

module.exports = { sendOtp };
