require('dotenv').config()
const { notarize } = require('@electron/notarize')
const { execSync } = require('child_process')

exports.default = async (context) => {
  if (context.electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('Skipping notarization: missing env vars')
    return
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`Notarizing: ${appPath}`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })

  console.log('Notarization complete')

  // Staple the notarization ticket
  console.log('Stapling ticket...')
  try {
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' })
    console.log('Stapling complete')
  } catch (err) {
    console.warn('Warning: stapling failed (app may still work with notarization)')
  }

  // Gatekeeper verification
  console.log('Verifying Gatekeeper...')
  try {
    execSync(`spctl --assess --type execute --verbose "${appPath}"`, { stdio: 'inherit' })
    console.log('Gatekeeper verification passed')
  } catch (err) {
    console.warn('Warning: Gatekeeper check did not pass (normal in CI)')
  }
}
