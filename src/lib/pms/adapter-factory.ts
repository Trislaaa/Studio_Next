import type { PMSAdapter } from './types'
import { MockPMSAdapter } from './mock-pms'

/**
 * Factory function to create the appropriate PMS adapter based on environment
 * This enables easy swapping between mock and real PMS implementations
 */
export function createPMSAdapter(): PMSAdapter {
    const pmsType = process.env.PMS_TYPE || 'mock'

    switch (pmsType.toLowerCase()) {
        case 'mock':
            console.log('[PMS] Using Mock PMS adapter')
            return new MockPMSAdapter()

        case 'opera':
            // Future: return new OperaPMSAdapter()
            console.error('[PMS] Opera PMS adapter not yet implemented')
            throw new Error('Opera PMS adapter not yet implemented. Please use mock PMS for now.')

        case 'ezee':
            // Future: return new EzeePMSAdapter()
            console.error('[PMS] eZee PMS adapter not yet implemented')
            throw new Error('eZee PMS adapter not yet implemented. Please use mock PMS for now.')

        case 'hotelogix':
            // Future: return new HotelogixPMSAdapter()
            console.error('[PMS] Hotelogix PMS adapter not yet implemented')
            throw new Error('Hotelogix PMS adapter not yet implemented. Please use mock PMS for now.')

        default:
            console.warn(`[PMS] Unknown PMS type: ${pmsType}, falling back to mock`)
            return new MockPMSAdapter()
    }
}

/**
 * Singleton PMS adapter instance
 * Ensures only one adapter is created per application lifecycle
 */
let pmsAdapterInstance: PMSAdapter | null = null

/**
 * Get the singleton PMS adapter instance
 */
export function getPMSAdapter(): PMSAdapter {
    if (!pmsAdapterInstance) {
        pmsAdapterInstance = createPMSAdapter()
    }
    return pmsAdapterInstance
}

/**
 * Reset the PMS adapter instance (useful for testing)
 */
export function resetPMSAdapter(): void {
    pmsAdapterInstance = null
}
