export declare function seekTarget(fraction: number, duration: number): number;
export declare function scrubFraction(position: number, duration: number): number;
export declare function clampVolume(value: number): number;
export declare function captionButton(
  available: boolean | null,
  on: boolean,
): { label: string; pressed: boolean; disabled: boolean };
export declare function clockText(seconds: number): string;
