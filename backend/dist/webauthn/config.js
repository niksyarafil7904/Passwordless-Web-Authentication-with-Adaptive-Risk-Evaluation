"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webauthnConfig = void 0;
// backend/src/webauthn/config.ts
const isProduction = process.env.NODE_ENV === 'production';
exports.webauthnConfig = {
    rpID: isProduction
        ? (process.env.RP_ID || 'auth.testonline.digital')
        : 'localhost',
    rpName: isProduction
        ? (process.env.RP_NAME || 'PasswordlessAuthFYP')
        : 'PasswordlessAuthFYP (Dev)',
    expectedOrigin: isProduction
        ? (process.env.ORIGIN || 'https://auth.testonline.digital')
        : 'http://localhost:5173',
};
// Validation
const { rpID, rpName, expectedOrigin } = exports.webauthnConfig;
if (!rpID || !rpName || !expectedOrigin) {
    throw new Error(`WebAuthn configuration missing: rpID=${rpID}, rpName=${rpName}, expectedOrigin=${expectedOrigin}`);
}
console.log(`🔐 WebAuthn Config: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`   RP ID: ${rpID}`);
console.log(`   Origin: ${expectedOrigin}`);
//# sourceMappingURL=config.js.map