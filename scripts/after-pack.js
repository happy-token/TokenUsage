import { execSync } from 'child_process'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') {
    console.log('[afterPack] Rebuilding native modules...')
    execSync('npx electron-rebuild', { stdio: 'inherit' })
  }
}
