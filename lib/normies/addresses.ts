import { mainnet } from "viem/chains";

export const CHAIN = mainnet;

/** Serc's Normies contracts (Ethereum Mainnet). We do not own or deploy these. */
export const NORMIES_NFT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438" as const;
export const NORMIES_CANVAS = "0x64951d92e345C50381267380e2975f66810E869c" as const;
/** Original mint images (INormiesStorage). */
export const ORIGINAL_STORAGE = "0x1B976bAf51cF51F0e369C070d47FBc47A706e602" as const;
/** Transform overlays (INormiesCanvasStorage). */
export const TRANSFORM_STORAGE = "0xC255BE0983776BAB027a156681b6925cde47B2D1" as const;
