import { createContext, useContext, useState } from 'react'

const LicenseContext = createContext({ isReadOnly: false, license: null, showUpgradeModal: () => {} })

export function useLicense() {
  return useContext(LicenseContext)
}

export { LicenseContext }
export default LicenseContext
