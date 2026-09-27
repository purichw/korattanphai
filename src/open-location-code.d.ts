// The pinned npm release exposes instance methods, unlike later static API typings.
declare module 'open-location-code' {
  export class OpenLocationCode {
    isShort(code: string): boolean;
    isFull(code: string): boolean;
    decode(code: string): {
      latitudeCenter: number;
      longitudeCenter: number;
      codeLength: number;
    };
  }
}
