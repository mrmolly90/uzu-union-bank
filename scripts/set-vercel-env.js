const fs = require('fs');
const envContent = fs.readFileSync('.env.vercel', 'utf8');
const match = envContent.match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
const oidcToken = match ? match[1] : null;
console.log('OIDC Token found:', !!oidcToken);

async function setEnv(name, value) {
  const res = await fetch('https://api.vercel.com/v10/projects/uzudigitalservices/env?teamId=kev-aef5', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + oidcToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: name,
      value: value,
      type: 'encrypted',
      target: ['production', 'preview', 'development']
    })
  });
  const data = await res.json();
  console.log(name + ':', res.status, data.error ? data.error.message || JSON.stringify(data.error) : 'OK');
}

(async () => {
  await setEnv('DATABASE_URL', 'postgresql://uzu_bank_owner:npg_1Yq0q0Qq0q0Q@ep-spring-bird-a1y0q0q0-pooler.svc.eu-west-1.neon.tech/uzu_bank?sslmode=require');
  await setEnv('JWT_SECRET', 'uzu-production-secret-' + Date.now());
  await setEnv('NEXT_PUBLIC_APP_URL', 'https://uzudigitalservices.vercel.app');
  await setEnv('NEXT_PUBLIC_WS_URL', 'https://uzudigitalservices.vercel.app');
  console.log('\nDone');
})();