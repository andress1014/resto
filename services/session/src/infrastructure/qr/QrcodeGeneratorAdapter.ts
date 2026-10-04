import QRCode from 'qrcode';
import { QrCodeGenerator, QrCodeResult } from '@packages/shared-types';

export class QrcodeGeneratorAdapter implements QrCodeGenerator {
  async generate(payloadUrl: string): Promise<QrCodeResult> {
    const pngDataUrl = await QRCode.toDataURL(payloadUrl);
    return {
      url: payloadUrl,
      pngDataUrl,
    };
  }
}
