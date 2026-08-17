import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
  console.error('Android project not found. Run: npx cap add android');
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];

const missing = permissions.filter((permission) => !xml.includes(`android:name="${permission}"`));
if (missing.length) {
  const insert = missing.map((permission) => `    <uses-permission android:name="${permission}" />`).join('\n') + '\n';
  const applicationIndex = xml.indexOf('    <application');
  if (applicationIndex < 0) throw new Error('Could not find <application> in AndroidManifest.xml');
  xml = xml.slice(0, applicationIndex) + insert + xml.slice(applicationIndex);
  fs.writeFileSync(manifestPath, xml);
  console.log(`Added Android permissions: ${missing.join(', ')}`);
} else {
  console.log('Android microphone permissions already configured.');
}
